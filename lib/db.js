// ============================================================
// Konekte — Base de données JSON (zéro dépendance)
// Migration facile vers MySQL/PostgreSQL plus tard :
// chaque "table" est un tableau d'objets avec id.
// ============================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const motdepasse = require('./motdepasse.js');
const horaires = require('./horaires.js');

/* Mot de passe du tout premier administrateur, sur une base neuve. */
const MDP_ADMIN_INITIAL = crypto.randomBytes(9).toString('base64url');

/* Emplacement de la base.
   Sur Render, le dossier de l'application est effacé à chaque déploiement.
   DATA_DIR doit donc pointer vers le disque persistant (ex. /var/data).
   Sans cette variable, on retombe sur ./data, utile en local. */
const DOSSIER_DONNEES = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DOSSIER_DONNEES, 'db.json');

let db = null;
let saveTimer = null;
/* Vrai quand la base vient d'être créée : le serveur s'en sert pour
   n'afficher qu'une seule fois le mot de passe du premier administrateur. */
let baseNeuve = false;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* Écriture atomique : on écrit d'abord un fichier voisin, puis on le
   renomme par-dessus la base. Le renommage est indivisible pour le
   système de fichiers — une coupure de courant ou un redémarrage au
   mauvais moment laisse donc soit l'ancienne base entière, soit la
   nouvelle, jamais un fichier tronqué. Écrire directement dans db.json
   exposait à tout perdre d'un coup. */
function ecrire() {
  const provisoire = DB_PATH + '.tmp';
  const texte = JSON.stringify(db, null, 2);
  const f = fs.openSync(provisoire, 'w');
  try {
    fs.writeFileSync(f, texte, 'utf8');
    fs.fsyncSync(f);          // force l'écriture sur le disque, pas seulement en cache
  } finally {
    fs.closeSync(f);
  }
  fs.renameSync(provisoire, DB_PATH);
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { ecrire(); }
    catch (e) { console.error('[BASE] Échec de l\'enregistrement :', e.message); }
  }, 100);
}

/* Enregistrement immédiat, sans attendre le délai de regroupement :
   utilisé à l'arrêt du serveur pour ne rien perdre en route. */
function saveNow() {
  clearTimeout(saveTimer);
  try { ecrire(); } catch (e) { console.error('[BASE] Échec de l\'enregistrement :', e.message); }
}

function load() {
  if (fs.existsSync(DB_PATH)) {
    db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const avant = JSON.stringify(Object.keys(db)) + (db.chambres || []).filter((c) => !Array.isArray(c.equipements)).length + (db.entreprises || []).filter((e) => !e.formule || !e.metier || !e.abonnement).length;
    // Migration douce pour les bases créées avant le module Séjours
    if (!db.chambres) db.chambres = [];
    // Module hôtellerie : équipements des chambres + carte restaurant/bar
    if (!db.carte) db.carte = [];
    // Gestion hôtelière : plans tarifaires et périodes saisonnières
    if (!db.tarifs) db.tarifs = [];
    if (!db.saisons) db.saisons = [];
    // Capacité détaillée des chambres
    db.chambres.forEach((c) => {
      if (c.adultes === undefined) c.adultes = c.capacite || 2;
      if (c.enfants === undefined) c.enfants = 0;
    });
    // Module scolaire : programmes et demandes d'inscription
    if (!db.programmes) db.programmes = [];
    if (!db.inscriptions) db.inscriptions = [];
    // Module dossiers : notaire, arpenteur, avocat, comptable
    if (!db.dossiers) db.dossiers = [];
    // Module catalogue : produits en vente
    // Services : galerie, avec reprise d'une éventuelle photo unique
    db.services.forEach((s) => {
      if (!Array.isArray(s.photos)) s.photos = s.photo ? [s.photo] : [];
      if (s.description === undefined) s.description = '';
    });
    if (!db.produits) db.produits = [];
    // Produits : galerie et vidéo, avec reprise de l'ancienne photo unique
    db.produits.forEach((p) => {
      if (!Array.isArray(p.photos)) p.photos = p.photo ? [p.photo] : [];
      if (p.video === undefined) p.video = '';
    });
    // Module vente : commandes avec livraison ou retrait
    if (!db.commandes) db.commandes = [];
    // Messages reçus : contact, partenariat, questions
    if (!db.messages) db.messages = [];
    // Journal de fréquentation, agrégé et purgé automatiquement
    if (!db.visites) db.visites = [];
    // Abonnements aux notifications poussées
    if (!db.pushAbonnements) db.pushAbonnements = [];
    // Module comptabilité : écritures en partie double
    if (!db.ecritures) db.ecritures = [];
    db.chambres.forEach((c) => {
      if (!Array.isArray(c.equipements)) c.equipements = [];
      // Galerie : les chambres créées avec une seule photo la conservent
      if (!Array.isArray(c.photos)) c.photos = c.photo ? [c.photo] : [];
    });
    // Métier : déduit de l'ancienne catégorie pour les entreprises existantes
    const DEPUIS_CATEGORIE = {
      'Beauté': 'salon-beaute', 'Santé': 'cabinet-medical', 'Formation': 'centre-formation',
      'Auto': 'garage', 'Maison': 'artisan', 'Juridique': 'avocat',
      'Hôtels & Restaurants': 'hotel', 'Restaurant': 'restaurant', 'Autre': 'autre'
    };
    // Abonnement : les entreprises déjà inscrites démarrent leur essai maintenant
    const forfaits = require('./forfaits.js');
    db.entreprises?.forEach((e) => {
      if (!e.abonnement) e.abonnement = forfaits.nouvelAbonnement('decouverte', new Date());
      if (!e.metier) e.metier = DEPUIS_CATEGORIE[e.categorie] || 'autre';
      if (!e.champs || typeof e.champs !== 'object') e.champs = {};
    });
    // Formule d'hébergement : les entreprises existantes restent en standard
    db.entreprises?.forEach((e) => { if (!e.formule) e.formule = 'standard'; if (!Array.isArray(e.inclus)) e.inclus = []; });
    if (!db.sejours) db.sejours = [];
    // Migration douce pour le module Paiements
    if (!db.paiements) db.paiements = [];
    if (!db.portefeuilles) db.portefeuilles = [];
    if (!db.retraits) db.retraits = [];
    // Ajouter le champ paye aux RDV/séjours existants
    db.rendezvous?.forEach((r) => { if (r.paye === undefined) r.paye = false; });
    /* Horaires incomplets : une entreprise dont il manque un jour ferait
       planter sa page publique. On remet en forme celles qui en ont besoin. */
    let horairesRepares = 0;
    db.entreprises?.forEach((e) => {
      if (!horaires.estComplet(e.horaires)) { e.horaires = horaires.normaliser(e.horaires); horairesRepares++; }
    });
    if (horairesRepares) console.log(`[BASE] Horaires remis en forme pour ${horairesRepares} entreprise(s).`);
    db.sejours?.forEach((s) => { if (s.paye === undefined) s.paye = false; });
    // Écrire immédiatement si la migration a modifié la structure,
    // sans attendre la première action de l'utilisateur.
    const apres = JSON.stringify(Object.keys(db)) + (db.chambres || []).filter((c) => !Array.isArray(c.equipements)).length + (db.entreprises || []).filter((e) => !e.formule || !e.metier || !e.abonnement).length;
    if (avant !== apres || horairesRepares) ecrire();
  } else {
    baseNeuve = true;
    db = seed();
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    // Copie de sécurité de l'état précédent, avant d'écrire par-dessus
    try {
      if (fs.existsSync(DB_PATH)) fs.copyFileSync(DB_PATH, DB_PATH + '.bak');
    } catch { /* une sauvegarde ratée ne doit pas bloquer l'enregistrement */ }
    ecrire();
  }
  return db;
}

// ------------------------------------------------------------
// Données de démonstration
// ------------------------------------------------------------
function seed() {
  const now = new Date();
  const jour = (offset) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  const horairesDefaut = {
    lun: { ouvert: true, debut: '08:00', fin: '17:00' },
    mar: { ouvert: true, debut: '08:00', fin: '17:00' },
    mer: { ouvert: true, debut: '08:00', fin: '17:00' },
    jeu: { ouvert: true, debut: '08:00', fin: '17:00' },
    ven: { ouvert: true, debut: '08:00', fin: '17:00' },
    sam: { ouvert: true, debut: '09:00', fin: '14:00' },
    dim: { ouvert: false, debut: '09:00', fin: '13:00' }
  };

  const users = [
    /* Mot de passe tiré au hasard et affiché une seule fois au démarrage.
       Une valeur connue d'avance, publiée qui plus est dans le dépôt,
       laisserait la porte ouverte sur toute base neuve. */
    { id: 'admin1', nom: 'Administrateur', email: 'admin@bizniskonekte.tech',
      motdepasse: motdepasse.hacherSync(MDP_ADMIN_INITIAL), role: 'admin', creeLe: now.toISOString() }
  ];

  const entreprises = [];  // Vide — les entreprises s'inscrivent elles-mêmes

  const services = [];  // Vide — chaque entreprise crée ses services

  const employes = [];  // Vide — chaque entreprise crée ses employés

  const rendezvous = [];  // Vide — pas de démo

  const avis = [];  // Vide — pas de démo

  const notifications = [];  // Vide

  return { users, entreprises, services, employes, rendezvous, avis, notifications, chambres: [], sejours: [], carte: [], tarifs: [], saisons: [], programmes: [], inscriptions: [], dossiers: [], produits: [], commandes: [], messages: [], visites: [], pushAbonnements: [], ecritures: [], paiements: [], portefeuilles: [], retraits: [], sessions: {} };
}

module.exports = { load, save, saveNow, uid, DB_PATH, DOSSIER_DONNEES, MDP_ADMIN_INITIAL,
  get baseNeuve() { return baseNeuve; }, get db() { return db; } };
