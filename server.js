// ============================================================
// Konekte — Serveur (Node.js pur, zéro dépendance)
// Lancer :  node server.js   →  http://localhost:3000
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./lib/db');
const plopplop = require('./plopplop.js');
const passerelles = require('./lib/passerelles.js');
const metiers = require('./lib/metiers.js');
const forfaits = require('./lib/forfaits.js');
const qr = require('./lib/qr.js');
const visites = require('./lib/visites.js');
const courriel = require('./lib/courriel.js');
const push = require('./lib/push.js');
const taksi = require('./lib/taksi.js');
const compta = require('./lib/compta.js');
const mdpOutil = require('./lib/motdepasse.js');
const horaires = require('./lib/horaires.js');
const geo = require('./lib/geo.js');

// ---- Paramètres commerciaux ----
const COMMISSION_RANDEVOU = 0.15;   // part Konekte sur chaque encaissement
const MONTANT_MIN_RETRAIT = 1000;   // retrait minimum du portefeuille, en HTG

const PORT = process.env.PORT || 3000;

/* ==========================================================
   Adresse publique de la plateforme
   ----------------------------------------------------------
   Un même site répond sur plusieurs adresses : le domaine
   définitif, l'adresse technique de Render, et localhost en
   développement. Tant que les liens partagés étaient fabriqués
   à partir de l'adresse du navigateur, une entreprise connectée
   par l'ancienne adresse Render diffusait des liens en
   .onrender.com — et son code QR imprimé pointait ailleurs que
   son lien WhatsApp.

   URL_PUBLIQUE tranche : c'est l'adresse officielle, la seule
   qui sorte de la plateforme. Sans elle, on retombe sur l'hôte
   de la requête, ce qui reste correct en développement.
   ========================================================== */
const URL_PUBLIQUE = String(process.env.URL_PUBLIQUE || '').trim().replace(/\/+$/, '');

function basePublique(req) {
  if (URL_PUBLIQUE) return URL_PUBLIQUE;
  const hote = (req && req.headers && req.headers.host) || ('localhost:' + PORT);
  return (/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(hote) ? 'http://' : 'https://') + hote;
}

/* Adresse du suivi envoye au client : « Mes achats et reservations ».
   Les courriels menaient jusqu'ici a la page publique de la boutique, ou
   le client ne retrouvait rien de sa commande. Son adresse est reportee
   dans le lien pour qu'il n'ait pas a la retaper ; elle n'ouvre aucun
   acces par elle-meme, un code lui est toujours envoye par courriel. */
function lienAchats(req, courriel) {
  const base = basePublique(req) + '/mes-achats.html';
  return courriel ? `${base}?email=${encodeURIComponent(courriel)}` : base;
}

/* Les visiteurs arrivés par une autre adresse sont renvoyés vers
   l'adresse officielle : les anciens liens et les codes QR déjà
   imprimés continuent de fonctionner, et plus personne ne navigue
   — ni ne partage — depuis l'ancienne adresse.

   Uniquement sur GET et HEAD : rediriger un POST changerait sa
   méthode et ferait perdre les données du formulaire. */
function redirigerVersAdresseOfficielle(req, res) {
  if (!URL_PUBLIQUE) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const hote = req.headers.host || '';
  let officiel;
  try { officiel = new URL(URL_PUBLIQUE).host; } catch { return false; }
  if (!hote || hote === officiel) return false;
  // Jamais en développement local
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(hote)) return false;
  res.writeHead(301, { Location: URL_PUBLIQUE + req.url, 'Cache-Control': 'no-cache' });
  res.end();
  return true;
}
const PUBLIC_DIR = path.join(__dirname, 'public');
const db = store.load();

/* ==========================================================
   Accès de secours à l'administration
   ----------------------------------------------------------
   Un administrateur peut se retrouver dehors : mot de passe
   oublié, adresse mal notée, ou vérification en deux étapes
   activée sur un canal qui n'envoie plus rien. Sans porte de
   secours, il faudrait éditer la base à la main.

   Cette porte-là s'ouvre depuis les variables d'environnement
   de Render, auxquelles seul le propriétaire du compte
   d'hébergement accède. Au démarrage, si ADMIN_EMAIL et
   ADMIN_MOTDEPASSE sont présentes, le compte est créé ou
   remis en état : rôle administrateur, mot de passe imposé,
   double authentification retirée, sessions ouvertes fermées.

   À retirer des variables une fois l'accès retrouvé : tant
   qu'elles sont là, le mot de passe est réimposé à chaque
   redémarrage.
   ========================================================== */
function reparerAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const mdp = String(process.env.ADMIN_MOTDEPASSE || '');
  if (!email || !mdp) return;
  if (mdp.length < 8) {
    console.log('[ADMIN] ADMIN_MOTDEPASSE trop court (8 caractères minimum) — compte inchangé.');
    return;
  }
  let u = db.users.find((x) => String(x.email).toLowerCase() === email);
  const creation = !u;
  if (!u) {
    u = { id: store.uid(), nom: 'Administrateur', email, role: 'admin', creeLe: new Date().toISOString() };
    db.users.push(u);
  }
  u.motdepasse = mdpOutil.hacherSync(mdp);
  u.role = 'admin';
  u.a2f = null;                       // le canal de vérification peut être muet
  // Les sessions déjà ouvertes sur ce compte sont révoquées
  for (const [jeton, id] of Object.entries(db.sessions)) {
    if (id === u.id) delete db.sessions[jeton];
  }
  store.save();
  console.log(`[ADMIN] Compte ${creation ? 'créé' : 'réinitialisé'} : ${email}`);
  console.log('[ADMIN] Retirez ADMIN_EMAIL et ADMIN_MOTDEPASSE des variables une fois connecté.');
}
reparerAdmin();

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml; charset=utf-8', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.webmanifest': 'application/manifest+json; charset=utf-8' };

// ---------------- Utilitaires ----------------
/* ============================================================
   Aperçu de partage (Open Graph)
   ------------------------------------------------------------
   Facebook, WhatsApp et les autres lisent la page sans exécuter
   le JavaScript. Les balises doivent donc être écrites par le
   serveur, avant l'envoi.
   ============================================================ */
function echapperHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function baseUrl(req) {
  const hote = req.headers.host;
  const protocole = req.headers['x-forwarded-proto'] || (hote && hote.startsWith('localhost') ? 'http' : 'https');
  return `${protocole}://${hote}`;
}

/** Balises d'aperçu pour une entreprise, ou pour l'un de ses produits. */
function balisesPartage(req, e, produit) {
  const base = baseUrl(req);
  const url = produit ? `${base}/${e.slug}?produit=${produit.id}` : `${base}/${e.slug}`;

  let titre, description, image;
  if (produit) {
    const prix = (produit.prixPromo > 0 ? produit.prixPromo : produit.prix);
    titre = `${produit.nom} — ${prix.toLocaleString('fr-HT')} HTG`;
    description = [produit.description, `Disponible chez ${e.nom}`, e.adresse]
      .filter(Boolean).join(' · ').slice(0, 200);
    image = produit.photo ? `${base}/img/produit/${produit.id}` : '';
  } else {
    titre = `${e.nom} — ${e.categorie || 'Konekte'}`;
    const verbe = metiers.aModule(e, 'commandes') ? 'Commandez en ligne'
      : (metiers.aModule(e, 'hotellerie') ? 'Réservez votre séjour' : 'Prenez rendez-vous en ligne');
    description = [verbe, e.adresse, e.description].filter(Boolean).join(' · ').slice(0, 200);
    image = '';
  }
  /* Repli en cascade : photo du produit, vignette de partage, logo, image
     de la marque. La vignette de partage est seule à être vraiment au
     format 1200 x 630 ; c'est pour cela qu'elle passe avant l'affiche. */
  let auFormat = false;
  if (!image) {
    if (e.photoPartage) { image = `${base}/img/partage/${e.id}`; auFormat = true; }
    else if (e.photoFond) image = `${base}/img/fond/${e.id}`;
    else if (e.logoImage) image = `${base}/img/logo/${e.id}`;
    else { image = `${base}/banniere-fond.jpg`; auFormat = true; }
  }

  const T = echapperHtml(titre), D = echapperHtml(description);
  const I = echapperHtml(image), U = echapperHtml(url);
  return `
<title>${T} · Konekte</title>
<meta name="description" content="${D}">
<meta property="og:type" content="${produit ? 'product' : 'business.business'}">
<meta property="og:site_name" content="Konekte">
<meta property="og:locale" content="fr_HT">
<meta property="og:title" content="${T}">
<meta property="og:description" content="${D}">
<meta property="og:image" content="${I}">
${auFormat ? `<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">` : ''}
<meta property="og:url" content="${U}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${T}">
<meta name="twitter:description" content="${D}">
<meta name="twitter:image" content="${I}">
${produit ? `<meta property="product:price:amount" content="${produit.prixPromo > 0 ? produit.prixPromo : produit.prix}">
<meta property="product:price:currency" content="HTG">` : ''}
<link rel="canonical" href="${U}">`;
}

/** Sert la page d'une entreprise avec son aperçu de partage. */
function pageEntreprise(res, req, e, produit) {
  let html;
  try {
    html = fs.readFileSync(path.join(__dirname, 'public', 'entreprise.html'), 'utf8');
  } catch {
    res.writeHead(404); return res.end('Page introuvable');
  }
  // Le titre existant est remplacé, les balises insérées à sa place
  html = html.replace(/<title>[\s\S]*?<\/title>/i, balisesPartage(req, e, produit));
  /* Page composée à la volée, et dont le contenu dépend de l'entreprise :
     elle ne doit jamais être resservie depuis le cache sans vérification,
     sinon une boutique modifie sa page sans que ses clients le voient. */
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  return res.end(html);
}

function ipDe(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

/* Toute réponse de l'API porte des données vivantes : un prix, un stock,
   un rendez-vous, une commande. Sans consigne de cache, le navigateur
   décidait seul de les resservir — c'est ainsi qu'un téléphone pouvait
   afficher un catalogue périmé pendant que l'ordinateur montrait le bon.
   Le service worker ne met jamais l'API en cache : la consigne ci-dessous
   est donc le seul garde-fou du côté du navigateur. */
function json(res, code, data) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}
function lireCorps(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 4e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('='); if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1));
  });
  return out;
}
function utilisateurConnecte(req) {
  const token = cookies(req).rdv_session;
  const userId = token && db.sessions[token];
  return db.users.find((u) => u.id === userId) || null;
}
function slugifier(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}
// ---- Formule d'hébergement et prestations incluses (resort / tout inclus) ----
const FORMULES = ['standard', 'resort'];
const INCLUS = {
  petitdej:   { fr: 'Petit-déjeuner',            ht: 'Ti dejene',            ico: '🥐' },
  dejeuner:   { fr: 'Déjeuner',                  ht: 'Manje midi',           ico: '🍽️' },
  diner:      { fr: 'Dîner',                     ht: 'Manje aswè',           ico: '🍛' },
  collations: { fr: 'Collations à volonté',      ht: 'Ti manje a volonte',   ico: '🍪' },
  boissons:   { fr: 'Boissons sans alcool',      ht: 'Bwason san alkòl',     ico: '🧃' },
  alcool:     { fr: 'Boissons alcoolisées',      ht: 'Bwason ak alkòl',      ico: '🍹' },
  barouvert:  { fr: 'Bar ouvert',                ht: 'Ba louvri',            ico: '🍸' },
  piscine:    { fr: 'Accès piscine',             ht: 'Aksè pisin',           ico: '🏊' },
  plage:      { fr: 'Accès plage privée',        ht: 'Aksè plaj prive',      ico: '🏖️' },
  animations: { fr: 'Animations et soirées',     ht: 'Animasyon ak sware',   ico: '🎶' },
  sport:      { fr: 'Activités sportives',       ht: 'Aktivite espòtif',     ico: '🏐' },
  nautique:   { fr: 'Sports nautiques',          ht: 'Espò nan dlo',         ico: '🚤' },
  spa:        { fr: 'Accès spa',                 ht: 'Aksè espa',            ico: '💆' },
  gym:        { fr: 'Salle de sport',            ht: 'Sal espò',             ico: '🏋️' },
  kids:       { fr: 'Club enfants',              ht: 'Klib timoun',          ico: '🧒' },
  navette:    { fr: 'Navette aéroport',          ht: 'Navèt ayewopò',        ico: '🚐' },
  wifi:       { fr: 'Wi-Fi partout',             ht: 'Wi-Fi toupatou',       ico: '📶' },
  parking:    { fr: 'Parking',                   ht: 'Pakin',                ico: '🅿️' }
};
const CLES_INCLUS = Object.keys(INCLUS);
function nettoyerInclus(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((k) => CLES_INCLUS.includes(k)))];
}

/* Vidéo d'un produit : un lien, pas un fichier.
   Une vidéo stockée dans la base la ferait gonfler de plusieurs mégaoctets
   par produit. On accepte donc les hébergeurs courants, et on en tire
   l'adresse d'intégration. */
/* ---- Réseaux sociaux de l'entreprise ----
   Chaque réseau est reconnu par son domaine : cela évite qu'un lien
   quelconque soit affiché sous le logo de Facebook. */
const RESEAUX = {
  facebook:  { nom: 'Facebook',  hotes: ['facebook.com', 'fb.com', 'm.facebook.com', 'fb.me'] },
  instagram: { nom: 'Instagram', hotes: ['instagram.com'] },
  whatsapp:  { nom: 'WhatsApp',  hotes: ['wa.me', 'whatsapp.com', 'api.whatsapp.com'] },
  tiktok:    { nom: 'TikTok',    hotes: ['tiktok.com'] },
  youtube:   { nom: 'YouTube',   hotes: ['youtube.com', 'youtu.be'] },
  x:         { nom: 'X',         hotes: ['x.com', 'twitter.com'] },
  linkedin:  { nom: 'LinkedIn',  hotes: ['linkedin.com'] },
  threads:   { nom: 'Threads',   hotes: ['threads.net', 'threads.com'] },
  telegram:  { nom: 'Telegram',  hotes: ['t.me', 'telegram.me', 'telegram.org'] },
  site:      { nom: 'Site web',  hotes: [] }      // n'importe quel domaine
};

function nettoyerReseaux(v) {
  if (!Array.isArray(v)) return [];
  const sortie = [];
  for (const r of v.slice(0, 10)) {
    const cle = String(r && r.cle || '').toLowerCase();
    const lien = String(r && r.lien || '').trim();
    if (!RESEAUX[cle] || !lien) continue;
    let u;
    try { u = new URL(lien.startsWith('http') ? lien : 'https://' + lien); } catch { continue; }
    const hote = u.hostname.replace(/^www\./, '');
    const attendus = RESEAUX[cle].hotes;
    // Le lien doit correspondre au réseau annoncé
    if (attendus.length && !attendus.some((h) => hote === h || hote.endsWith('.' + h))) continue;
    if (sortie.some((x) => x.cle === cle)) continue;   // un seul lien par réseau
    sortie.push({ cle, lien: u.href.slice(0, 300) });
  }
  return sortie;
}

/* Date au format AAAA-MM-JJ, ou chaîne vide. Une date passée est
   refusée : annoncer « bientôt disponible le 12 mars » alors que mars
   est écoulé fait plus de mal que pas de date du tout. */
/* ==========================================================
   Précommandes arrivées à échéance
   ----------------------------------------------------------
   Un produit annoncé « bientôt disponible » pour une date passe
   en vente tout seul le jour dit. Sans cela, l'annonce restait
   figée sur une date périmée et le commerçant devait y penser.
   Le passage est enregistré pour de bon — l'espace de gestion
   et la page publique disent donc la même chose — et une
   notification prévient l'entreprise de ce qui a changé.
   Un produit sans stock devient « Fini » plutôt que vendable :
   la date est passée, la marchandise n'est pas là pour autant.
   ========================================================== */
let dernierBalayage = '';
function libererPrecommandesEchues() {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  if (dernierBalayage === aujourdhui) return 0;
  dernierBalayage = aujourdhui;
  const murs = db.produits.filter((p) => p.bientot && p.dateDispo && p.dateDispo < aujourdhui);
  if (!murs.length) return 0;
  const parEntreprise = {};
  for (const p of murs) {
    p.bientot = false;
    p.dateDispo = '';
    p.misEnVenteLe = new Date().toISOString();
    (parEntreprise[p.entrepriseId] = parEntreprise[p.entrepriseId] || []).push(p);
  }
  store.save();
  for (const [entrepriseId, liste] of Object.entries(parEntreprise)) {
    const noms = liste.map((p) => p.nom).join(', ');
    const sansStock = liste.filter((p) => p.stock !== null && p.stock <= 0);
    notifier(entrepriseId, 'produit',
      `Date d'arrivée atteinte : ${noms} ${liste.length > 1 ? 'passent' : 'passe'} en vente.` +
      (sansStock.length
        ? ` Attention : ${sansStock.map((p) => p.nom).join(', ')} ${sansStock.length > 1 ? 'sont affichés' : 'est affiché'} « Fini » faute de stock — indiquez les quantités reçues.`
        : ''));
  }
  console.log(`[PRÉCOMMANDES] ${murs.length} produit(s) mis en vente à leur date annoncée.`);
  return murs.length;
}

function dateSimple(v) {
  const s = String(v || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return '';
  if (s < new Date().toISOString().slice(0, 10)) return '';
  return s;
}

/**
 * État public d'un produit, calculé à un seul endroit pour que la
 * vitrine, la place de marché et la prise de commande racontent
 * toujours la même chose.
 *
 *   bientot    — annoncé, pas encore arrivé
 *   fini       — stock épuisé
 *   disponible — en vente
 *
 * « Précommandable » n'est vrai que si l'entreprise l'a autorisé pour
 * ce produit, que son forfait ouvre les précommandes et que ses
 * commandes en ligne sont actives : sans quoi on promettrait au
 * client un bouton qui ne mène à rien.
 */
function etatProduit(e, pr) {
  const epuise = pr.stock !== null && pr.stock <= 0;
  const bientot = !!pr.bientot;
  const etat = bientot ? 'bientot' : (epuise ? 'fini' : 'disponible');
  const v = (e && e.vente) || {};
  const commandesOuvertes = metiers.aModule(e, 'commandes') && !!v.commandesActives
    && forfaits.forfaitAutorise(e, 'commandes');
  const precommandable = etat !== 'disponible' && !!pr.precommande
    && commandesOuvertes && forfaits.forfaitAutorise(e, 'precommandes');
  /* Une date d'arrivée dépassée ne doit plus être annoncée : « disponible
     le 10 octobre » affiché le 28 octobre fait douter de toute la boutique.
     Le produit reste « bientôt disponible », sans date, jusqu'à ce que
     l'entreprise le mette en vente ou annonce une nouvelle date. L'espace
     de gestion, lui, est prévenu que l'échéance est passée. */
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const dateDepassee = bientot && !!pr.dateDispo && pr.dateDispo < aujourdhui;
  /* Paiement par versement : jamais automatique. Il faut que l'entreprise
     l'ait ouvert, que son entente avec l'organisme soit validée, et que ce
     produit-ci soit concerné. Voir `versementEligible`. */
  return {
    etat, epuise, bientot, precommandable, dateDepassee,
    versement: etat === 'disponible' && versementEligible(e, pr),
    dateDispo: dateDepassee ? '' : (pr.dateDispo || ''),
    stockFaible: pr.stock !== null && pr.stock > 0 && pr.stock <= Math.max(pr.seuilAlerte, 3)
  };
}

/* ==========================================================
   Comptabilité — reprise automatique des ventes de la plateforme
   ----------------------------------------------------------
   Tout ce qui a été encaissé par Konekte doit se
   retrouver en comptabilité sans ressaisie : c'est la moitié
   de l'intérêt du module. Chaque écriture produite porte sa
   source (type + identifiant), ce qui garantit qu'une même
   vente n'est jamais enregistrée deux fois, même si la
   synchronisation est relancée dix fois.
   ========================================================== */
function synchroniserCompta(e) {
  const r = compta.reglages(e);
  const faites = new Set((db.ecritures || [])
    .filter((x) => x.entrepriseId === e.id && x.source)
    .map((x) => x.source.type + ':' + x.source.id + ':' + (x.source.volet || '')));

  /* Une vente encaissée avant la date de clôture ne peut pas
     s'inscrire dans une période fermée : on la date du lendemain
     de la clôture, et la note dit pourquoi. */
  const dateUtile = (d) => {
    if (!r.clotureJusquau || d > r.clotureJusquau) return { date: d, reporte: false };
    const suivant = new Date(new Date(r.clotureJusquau + 'T00:00:00Z').getTime() + 86400000)
      .toISOString().slice(0, 10);
    const jour = compta.aujourdhui();
    return { date: suivant > jour ? jour : suivant, reporte: true };
  };

  let creees = 0;
  const poser = (saisie) => {
    const res = compta.construire(e, saisie, store.uid);
    if (res.erreur) return;           // une reprise ne doit jamais bloquer une vente
    db.ecritures.push(res.ecriture);
    creees++;
  };

  /* Où l'argent est réellement arrivé : le portefeuille Konekte pour un
     encaissement de la plateforme, le compte de l'entreprise pour un
     virement direct, la caisse pour un règlement en espèces. */
  const caisseDe = (enLigne) => (enLigne ? '5153' : r.caisseDefaut);
  const caisseCommande = (c) => {
    if (c.paiement === 'enligne') return c.surCompteEntreprise ? '5151' : '5153';
    if (c.paiement === 'direct' && c.versement) {
      const t = TYPES_COMPTE[c.versement.compteType];
      if (t && t.tresorerie) return t.tresorerie;
    }
    return r.caisseDefaut;
  };

  // ---- Commandes payées ----
  for (const c of db.commandes.filter((x) => x.entrepriseId === e.id && x.paye)) {
    const enLigne = c.paiement === 'enligne';
    const d = dateUtile((c.majLe || c.creeLe || '').slice(0, 10));
    const base = { tresorerie: caisseCommande(c), piece: c.reference, date: d.date,
                   note: d.reporte ? 'Vente antérieure à la clôture, reportée.' : '' };
    const marchandise = c.total - (c.frais || 0);
    if (marchandise > 0 && !faites.has('commande:' + c.id + ':')) {
      poser(Object.assign({}, base, { operation: 'vente_encaissee', categorie: 'marchandises',
        montant: marchandise, libelle: `Commande ${c.reference} — ${c.clientNom}`,
        source: { type: 'commande', id: c.id } }));
    }
    // Les frais de livraison encaissés sont une recette distincte
    if (c.frais > 0 && !faites.has('commande:' + c.id + ':livraison')) {
      poser(Object.assign({}, base, { operation: 'vente_encaissee', categorie: 'livraison',
        montant: c.frais, libelle: `Livraison ${c.reference}`,
        source: { type: 'commande', id: c.id, volet: 'livraison' } }));
    }
    /* La commission n'est prélevée que sur ce que la plateforme
       encaisse : un paiement remis en espèces à la livraison ne
       passe pas par nous, donc aucune commission. */
    if (enLigne && !c.surCompteEntreprise && !faites.has('commande:' + c.id + ':commission')) {
      const com = forfaits.commissionPour(e, c.total);
      if (com > 0) poser(Object.assign({}, base, { operation: 'achat_paye', categorie: 'commission',
        montant: com, tca: false, libelle: `Commission Konekte — ${c.reference}`,
        source: { type: 'commande', id: c.id, volet: 'commission' } }));
    }
  }

  // ---- Rendez-vous payés ----
  const catRdv = metiers.aModule(e, 'dossiers') ? 'honoraires' : 'services';
  for (const rv of db.rendezvous.filter((x) => x.entrepriseId === e.id && x.paye && x.prixTotal > 0)) {
    if (faites.has('rendezvous:' + rv.id + ':')) continue;
    const d = dateUtile(rv.date || (rv.creeLe || '').slice(0, 10));
    poser({ operation: 'vente_encaissee', categorie: catRdv, montant: rv.prixTotal,
            date: d.date, tresorerie: '5153', piece: rv.id.slice(-8).toUpperCase(),
            libelle: `Rendez-vous — ${rv.clientNom}`,
            note: d.reporte ? 'Encaissement antérieur à la clôture, reporté.' : '',
            source: { type: 'rendezvous', id: rv.id } });
    const com = rv.surCompteEntreprise ? 0 : forfaits.commissionPour(e, rv.prixTotal);
    if (com > 0) poser({ operation: 'achat_paye', categorie: 'commission', montant: com, tca: false,
            date: d.date, tresorerie: '5153', piece: rv.id.slice(-8).toUpperCase(),
            libelle: 'Commission Konekte', source: { type: 'rendezvous', id: rv.id, volet: 'commission' } });
  }

  // ---- Séjours payés ----
  for (const sj of db.sejours.filter((x) => x.entrepriseId === e.id && x.paye && x.prixTotal > 0)) {
    if (faites.has('sejour:' + sj.id + ':')) continue;
    const d = dateUtile(sj.arrivee || (sj.creeLe || '').slice(0, 10));
    poser({ operation: 'vente_encaissee', categorie: 'hebergement', montant: sj.prixTotal,
            date: d.date, tresorerie: '5153', piece: sj.reference || sj.id.slice(-8).toUpperCase(),
            libelle: `Séjour — ${sj.clientNom}`,
            note: d.reporte ? 'Encaissement antérieur à la clôture, reporté.' : '',
            source: { type: 'sejour', id: sj.id } });
    const com = sj.surCompteEntreprise ? 0 : forfaits.commissionPour(e, sj.prixTotal);
    if (com > 0) poser({ operation: 'achat_paye', categorie: 'commission', montant: com, tca: false,
            date: d.date, tresorerie: '5153', piece: sj.reference || '',
            libelle: 'Commission Konekte', source: { type: 'sejour', id: sj.id, volet: 'commission' } });
  }

  // ---- Retraits du portefeuille vers MonCash ou NatCash ----
  for (const re of (db.retraits || []).filter((x) => x.entrepriseId === e.id && x.statut === 'paye')) {
    if (faites.has('retrait:' + re.id + ':')) continue;
    const d = dateUtile((re.traiteLe || re.creeLe || '').slice(0, 10));
    poser({ operation: 'virement_interne', montant: re.montant, date: d.date,
            tresorerie: '5153', tresorerieArrivee: re.methode === 'natcash' ? '5152' : '5151',
            libelle: 'Retrait du portefeuille Konekte',
            source: { type: 'retrait', id: re.id } });
  }

  if (creees) store.save();
  return creees;
}

/** Écritures d'une entreprise. */
function ecrituresDe(e) {
  return (db.ecritures || []).filter((x) => x.entrepriseId === e.id);
}

/** +1 recette, −1 dépense, 0 pour un simple mouvement d'argent. */
function signeOperation(ec) {
  const op = compta.OPERATIONS[ec && ec.operation];
  return op ? op.signe : 0;
}

function nettoyerVideo(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    const h = u.hostname.replace(/^www\./, '');
    if (!/^(youtube\.com|youtu\.be|m\.youtube\.com|facebook\.com|fb\.watch|tiktok\.com|vimeo\.com|instagram\.com)$/.test(h)) return '';
    return s.slice(0, 300);
  } catch { return ''; }
}

// Galerie d'une chambre : plusieurs photos, la première sert de vignette.
const MAX_PHOTOS_CHAMBRE = 8;
function nettoyerPhotos(v, existant) {
  if (v === undefined) return existant || [];
  const liste = Array.isArray(v) ? v : [v];
  const ok = [];
  for (const ph of liste.slice(0, MAX_PHOTOS_CHAMBRE)) {
    const s = String(ph || '');
    if (s.startsWith('data:image/') && s.length <= 900000) ok.push(s);
    else if (s.startsWith('data:image/')) return null;   // trop lourde
  }
  return ok;
}

// ---- Équipements de chambre (catalogue fermé, clés stables) ----
const EQUIPEMENTS = {
  clim: { fr: 'Climatiseur', ht: 'Èkondisyone', ico: '❄️' },
  ventilateur: { fr: 'Ventilateur', ht: 'Vantilatè', ico: '🌀' },
  wifi: { fr: 'Internet Wi-Fi', ht: 'Entènèt Wi-Fi', ico: '📶' },
  litdouble: { fr: 'Lit double', ht: 'Kabann doub', ico: '🛏️' },
  litsimple: { fr: 'Lit simple', ht: 'Kabann senp', ico: '🛌' },
  tv: { fr: 'Téléviseur', ht: 'Televizyon', ico: '📺' },
  netflix: { fr: 'Netflix / streaming', ht: 'Netflix / striming', ico: '🎬' },
  eauchaude: { fr: 'Eau chaude', ht: 'Dlo cho', ico: '🚿' },
  sdb: { fr: 'Salle de bain privée', ht: 'Twalèt prive', ico: '🛁' },
  balcon: { fr: 'Balcon', ht: 'Balkon', ico: '🌅' },
  frigo: { fr: 'Réfrigérateur', ht: 'Frijidè', ico: '🧊' },
  coffre: { fr: 'Coffre-fort', ht: 'Kòf-fò', ico: '🔒' },
  inverter: { fr: 'Inverter / courant 24h', ht: 'Envètè / kouran 24h', ico: '🔋' },
  parking: { fr: 'Parking', ht: 'Pakin', ico: '🅿️' },
  piscine: { fr: 'Accès piscine', ht: 'Aksè pisin', ico: '🏊' },
  petitdej: { fr: 'Petit-déjeuner inclus', ht: 'Ti dejene enkli', ico: '🥐' }
};
const CLES_EQUIPEMENTS = Object.keys(EQUIPEMENTS);
function nettoyerEquipements(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((k) => CLES_EQUIPEMENTS.includes(k)))];
}

// ---- Carte restaurant & bar ----
const CATEGORIES_CARTE = ['entree', 'plat', 'accompagnement', 'dessert', 'boisson', 'cocktail', 'biere', 'vin', 'spiritueux'];

/* ================= Freinage des tentatives =================
   Sans cela, une machine peut essayer des milliers de mots de passe
   par minute. Les échecs sont comptés par couple (adresse, compte) :
   bloquer la seule adresse laisserait passer une attaque répartie,
   bloquer le seul compte permettrait à n'importe qui de verrouiller
   une entreprise en se trompant exprès.

   La mémoire suffit : un redémarrage remet les compteurs à zéro, ce
   qui est sans conséquence puisque la fenêtre dure un quart d'heure. */
const ECHECS = new Map();
const ECHECS_MAX = 5;              // connexion
const ECHECS_MAX_INSCRIPTION = 8;  // inscriptions depuis une même adresse
const ECHECS_FENETRE_MS = 15 * 60 * 1000;

function adresseClient(req) {
  /* Render place un intermédiaire devant le serveur : la vraie adresse
     du visiteur est le premier élément de X-Forwarded-For. */
  const transmise = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return transmise || (req.socket && req.socket.remoteAddress) || 'inconnue';
}

function cleFreinage(req, portee, identifiant) {
  return portee + '|' + adresseClient(req) + '|' + String(identifiant || '').toLowerCase();
}

/* Renvoie le nombre de secondes à attendre, ou 0 si la voie est libre. */
function attenteRestante(cle, maximum) {
  const e = ECHECS.get(cle);
  if (!e) return 0;
  if (Date.now() > e.expireLe) { ECHECS.delete(cle); return 0; }
  if (e.n < maximum) return 0;
  return Math.ceil((e.expireLe - Date.now()) / 1000);
}

function noterEchec(cle) {
  const t = Date.now();
  const e = ECHECS.get(cle);
  if (!e || t > e.expireLe) ECHECS.set(cle, { n: 1, expireLe: t + ECHECS_FENETRE_MS });
  else { e.n++; e.expireLe = t + ECHECS_FENETRE_MS; }
}

function effacerEchecs(cle) { ECHECS.delete(cle); }

/* Ménage périodique, pour que la table ne grossisse pas indéfiniment. */
setInterval(() => {
  const t = Date.now();
  for (const [cle, e] of ECHECS) if (t > e.expireLe) ECHECS.delete(cle);
}, 10 * 60 * 1000).unref();

// ================= Authentification à deux facteurs =================
// Le code est envoyé par WhatsApp, moyen déjà utilisé par la plateforme.
// Les défis vivent en mémoire : ils expirent vite et n'ont pas à survivre
// à un redémarrage, ce qui évite de stocker des codes valides sur disque.
const DEFIS_A2F = new Map();
const A2F_VALIDITE_MS = 10 * 60 * 1000;
const A2F_TENTATIVES_MAX = 5;

function nettoyerDefis() {
  const t = Date.now();
  for (const [id, d] of DEFIS_A2F) if (d.expireLe < t) DEFIS_A2F.delete(id);
}
function codeA2F() {
  // 6 chiffres tirés au sort de façon cryptographique
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}
/* ============================================================
   Mot de passe oublié
   ------------------------------------------------------------
   Le code est envoyé au canal déjà connu du compte : WhatsApp
   du responsable, ou son adresse email. On ne demande jamais
   au demandeur où l'envoyer — sinon n'importe qui pourrait
   détourner un compte en indiquant son propre numéro.

   La réponse est toujours la même, que le compte existe ou non :
   cela empêche de découvrir quelles adresses sont inscrites.
   ============================================================ */
const DEMANDES_MDP = new Map();
const MDP_VALIDITE_MS = 15 * 60 * 1000;
const MDP_TENTATIVES_MAX = 5;
const MDP_PAR_HEURE = 3;
const HISTORIQUE_DEMANDES = [];

function nettoyerDemandes() {
  const t = Date.now();
  for (const [id, d] of DEMANDES_MDP) if (d.expireLe < t) DEMANDES_MDP.delete(id);
}

/** Limite les demandes répétées pour un même compte. */
function tropDeDemandes(email) {
  const limite = Date.now() - 3600000;
  while (HISTORIQUE_DEMANDES.length && HISTORIQUE_DEMANDES[0].le < limite) HISTORIQUE_DEMANDES.shift();
  return HISTORIQUE_DEMANDES.filter((x) => x.email === email).length >= MDP_PAR_HEURE;
}

/** Canal de récupération d'un compte, et sa forme masquée. */
function canalRecuperation(u) {
  const ent = u.entrepriseId && db.entreprises.find((e) => e.id === u.entrepriseId);
  const tel = (u.a2f && u.a2f.telephone) || (ent && (ent.whatsapp || ent.telephone)) || '';
  if (tel && String(tel).replace(/\D/g, '').length >= 8) {
    return { canal: 'whatsapp', destination: tel, masque: telMasque(tel) };
  }
  if (u.email) return { canal: 'courriel', destination: u.email, masque: courrielMasque(u.email) };
  return null;
}

/* ============================================================
   Espace client
   ------------------------------------------------------------
   Pas de compte à créer, pas de mot de passe : le client prouve
   qu'il possède son numéro grâce à un code reçu par WhatsApp.

   Conséquence heureuse : tout ce qu'il a déjà commandé ou réservé
   avec ce numéro apparaît immédiatement, même avant l'existence
   de cet espace. Aucune migration n'est nécessaire.
   ============================================================ */
const DEFIS_CLIENT = new Map();
const CLIENT_VALIDITE_MS = 10 * 60 * 1000;
const CLIENT_TENTATIVES_MAX = 5;
const SESSIONS_CLIENT = new Map();          // jeton -> { tel, expireLe }
const CLIENT_SESSION_MS = 30 * 86400000;    // 30 jours

/** Ne garde que les chiffres : les numéros sont saisis de mille façons. */
/* ---- Financement Micro Crédit Solidarité ----
   L'adresse du formulaire est une variable d'environnement : elle
   contient un jeton, et pourra changer sans toucher au code. */
const FINANCEMENT_URL = process.env.FINANCEMENT_URL
  || 'https://microcreditsolidarite.com/microcredit-php/demande.php';
const FINANCEMENT_SEUIL = Number(process.env.FINANCEMENT_SEUIL || 10000);
/* Micro Crédit Solidarité ne prête que là où elle peut se rendre : son
   financement est réservé aux entreprises d'une commune, Saint-Marc pour
   l'instant. Le jour où elle ouvrira ailleurs, cette variable suffira. */
const FINANCEMENT_COMMUNE = process.env.FINANCEMENT_COMMUNE || 'Saint-Marc';

/** L'entreprise est-elle dans la commune desservie par le financement ? */
const financementOuvert = (e) => geo.estDansCommune(e, FINANCEMENT_COMMUNE);

/* ---- Paiement par versement : une entente, pas une case à cocher ----
   Le bouton « Payer par versement » engage Micro Crédit Solidarité, qui
   avancera l'argent. Il ne peut donc pas s'afficher d'office sur tout ce
   qui dépasse un prix : il faut que l'entreprise ait une entente signée
   avec l'organisme, que Konekte l'ait constatée, et que l'entreprise ait
   elle-même décidé où le proposer. Trois conditions, et la commune par
   dessus — l'organisme ne prête que là où il se déplace. */

/** L'état complet du paiement par versement d'une entreprise. */
function versementDe(e) {
  const v = (e && e.versement) || {};
  const minimum = Number(v.minimum) > 0 ? Number(v.minimum) : FINANCEMENT_SEUIL;
  return {
    actif: !!v.actif,
    portee: v.portee === 'choisis' ? 'choisis' : 'tous',
    minimum,
    /* L'entente telle que l'entreprise l'a déclarée, et ce que Konekte en
       a fait. Une référence modifiée repart toujours à valider. */
    reference: v.reference || '',
    declareeLe: v.declareeLe || '',
    validee: !!v.validee,
    valideeLe: v.valideeLe || '',
    refusee: !!v.refusee,
    motifRefus: v.motifRefus || '',
    dansCommune: financementOuvert(e),
    commune: FINANCEMENT_COMMUNE,
    /* Ce qui reste à faire pour que le bouton paraisse, dit en clair. */
    enService: financementOuvert(e) && !!v.validee && !!v.actif
  };
}

/** Ce produit-ci porte-t-il le bouton « Payer par versement » ? */
function versementEligible(e, pr) {
  const v = versementDe(e);
  if (!v.enService) return false;
  const prix = pr.prixPromo > 0 ? pr.prixPromo : pr.prix;
  if (!(prix >= v.minimum)) return false;
  return v.portee === 'tous' ? true : !!pr.versement;
}

/* ---- Messages WhatsApp pré-enregistrés ----
   Bibliothèque de départ, proposée à toute entreprise qui n'a pas encore fait
   la sienne. Les mentions entre accolades sont remplacées au moment de l'envoi
   par les données du client concerné. */
const MODELES_WA_DEFAUT = [
  { id: 'confirme', titre: 'Confirmer le rendez-vous',
    texte: 'Bonjour {client}, votre rendez-vous chez {entreprise} est confirmé pour le {date} à {heure}. À bientôt !' },
  { id: 'rappel', titre: 'Rappeler la veille',
    texte: 'Bonjour {client}, petit rappel : nous vous attendons demain {date} à {heure} chez {entreprise}. Si vous ne pouvez pas venir, prévenez-nous.' },
  { id: 'retard', titre: 'Prévenir d\'un retard',
    texte: 'Bonjour {client}, nous avons un peu de retard aujourd\'hui. Votre passage de {heure} sera décalé de quelques minutes. Merci de votre patience.' },
  { id: 'pret', titre: 'Commande prête',
    texte: 'Bonjour {client}, votre commande {reference} est prête chez {entreprise}. Vous pouvez passer la récupérer.' },
  { id: 'route', titre: 'Commande en route',
    texte: 'Bonjour {client}, votre commande {reference} vient de partir en livraison. Elle arrive bientôt.' },
  { id: 'probleme', titre: 'Signaler un problème',
    texte: 'Bonjour {client}, nous rencontrons un souci avec votre commande {reference}. Pouvons-nous en discuter ? Merci de nous rappeler.' },
  { id: 'reporter', titre: 'Demander à reporter',
    texte: 'Bonjour {client}, un imprévu nous oblige à décaler votre rendez-vous du {date} à {heure}. Quelle autre date vous conviendrait ?' },
  { id: 'paiement', titre: 'Rappeler un paiement',
    texte: 'Bonjour {client}, il reste {montant} à régler pour {reference}. Merci de votre règlement.' },
  { id: 'merci', titre: 'Remercier après le passage',
    texte: 'Bonjour {client}, merci de votre visite chez {entreprise}. Si tout vous a plu, un avis nous aiderait beaucoup !' }
];

/* Les modèles enregistrés, ou la bibliothèque de départ tant que l'entreprise
   n'y a pas touché. */
function modelesWhatsApp(e) {
  return Array.isArray(e.modelesWhatsApp) && e.modelesWhatsApp.length
    ? e.modelesWhatsApp
    : MODELES_WA_DEFAUT;
}

/* Contrôle à l'enregistrement : au plus 30 modèles, titres et textes bornés. */
function nettoyerModelesWhatsApp(liste) {
  if (!Array.isArray(liste)) return null;
  const out = [];
  for (const m of liste.slice(0, 30)) {
    const titre = String((m && m.titre) || '').trim().slice(0, 60);
    const texte = String((m && m.texte) || '').trim().slice(0, 700);
    if (!titre || !texte) continue;
    out.push({ id: String((m && m.id) || '').slice(0, 24) || crypto.randomBytes(5).toString('hex'), titre, texte });
  }
  return out;
}

function telNormalise(v) {
  const n = String(v || '').replace(/\D/g, '');
  // Un numéro haïtien saisi sans indicatif est complété
  return n.length === 8 ? '509' + n : n;
}

function nettoyerClient() {
  const t = Date.now();
  for (const [k, d] of DEFIS_CLIENT) if (d.expireLe < t) DEFIS_CLIENT.delete(k);
  for (const [k, s] of SESSIONS_CLIENT) if (s.expireLe < t) SESSIONS_CLIENT.delete(k);
}

/** Client identifié par le cookie de session, ou null. */
function clientConnecte(req) {
  nettoyerClient();
  const jeton = cookies(req).bk_client;
  const s = jeton && SESSIONS_CLIENT.get(jeton);
  return s || null;
}

/**
 * Tout ce qu'un client a réservé, commandé ou déposé.
 *
 * Deux identifiants, parce que les deux existent dans les données : le
 * téléphone, demandé partout, et le courriel, demandé depuis que les
 * notifications passent par là. Un client qui a commandé avant et après
 * ce changement retrouve ainsi l'intégralité de son historique.
 */
function achatsDe(tel, courriel) {
  const n = tel ? telNormalise(tel) : '';
  const mail = String(courriel || '').trim().toLowerCase();
  const memeTel = (x) => !!n && telNormalise(x) === n;
  const memeMail = (x) => !!mail && String(x || '').trim().toLowerCase() === mail;
  const correspond = (t, m) => memeTel(t) || memeMail(m);
  const nomEnt = (id) => {
    const e = db.entreprises.find((x) => x.id === id);
    return e ? { nom: e.nom, slug: e.slug, telephone: e.whatsapp || e.telephone } : null;
  };

  const rdv = db.rendezvous.filter((x) => correspond(x.clientTel, x.clientEmail)).map((x) => {
    const s = db.services.find((y) => y.id === x.serviceId);
    return { genre: 'rendezvous', id: x.id, reference: x.id.slice(-8).toUpperCase(),
             titre: s ? s.nom : 'Rendez-vous', quand: `${x.date} à ${x.heure}`,
             date: x.date, montant: x.prixTotal || 0, statut: x.statut,
             paye: !!x.paye || x.statut === 'paye',
             entreprise: nomEnt(x.entrepriseId), creeLe: x.creeLe };
  });

  /* Les lignes d'une commande sont dans `lignes`, le mode de remise dans
     `mode` et le règlement dans `paye` : ce bloc lisait `articles`,
     `modeRemise` et `paiementStatut`, qui n'existent pas — l'espace
     client annonçait « 0 article(s) » et jamais « payé ». */
  const commandes = db.commandes.filter((x) => correspond(x.clientTel, x.clientEmail)).map((x) => {
    const lignes = x.lignes || [];
    const n = lignes.reduce((s, l) => s + (+l.quantite || 1), 0);
    return {
      genre: 'commande', id: x.id, reference: x.reference,
      titre: `${n} article${n > 1 ? 's' : ''}`,
      articles: lignes.map((l) => `${l.quantite || 1} × ${l.nom}`),
      quand: x.mode === 'livraison' ? 'Livraison' : 'Retrait sur place',
      precommande: !!x.precommande, dateDispo: x.dateDispo || '',
      date: (x.creeLe || '').slice(0, 10), montant: x.total || 0, statut: x.statut,
      paye: !!x.paye, entreprise: nomEnt(x.entrepriseId), creeLe: x.creeLe
    };
  });

  const sejours = db.sejours.filter((x) => correspond(x.clientTel, x.clientEmail)).map((x) => ({
    genre: 'sejour', id: x.id, reference: x.reference || x.id.slice(-8).toUpperCase(),
    titre: 'Séjour', quand: `du ${x.arrivee} au ${x.depart}`,
    // Le montant d'un séjour est `prixTotal`
    date: x.arrivee, montant: x.prixTotal || x.total || 0, statut: x.statut,
    paye: !!x.paye, entreprise: nomEnt(x.entrepriseId), creeLe: x.creeLe
  }));

  const dossiers = db.dossiers.filter((x) => correspond(x.clientTel, x.clientEmail)).map((x) => ({
    genre: 'dossier', id: x.id, reference: x.reference,
    titre: x.type || 'Dossier', quand: x.etapeActuelle || '',
    date: (x.creeLe || '').slice(0, 10), montant: x.honoraires || 0, statut: x.statut,
    etapes: x.etapes || [], entreprise: nomEnt(x.entrepriseId), creeLe: x.creeLe
  }));

  // Les plus récents d'abord : c'est ce qu'on vient consulter
  return [...rdv, ...commandes, ...sejours, ...dossiers]
    .sort((a, b) => String(b.creeLe || '').localeCompare(String(a.creeLe || '')));
}

function creerDefi(userId, destination, canal) {
  nettoyerDefis();
  const id = crypto.randomBytes(18).toString('hex');
  const code = codeA2F();
  DEFIS_A2F.set(id, { userId, code, tel: destination, destination, canal: canal || 'whatsapp',
                      tentatives: 0, expireLe: Date.now() + A2F_VALIDITE_MS });
  return { id, code };
}

/** Masque une adresse : ma***@exemple.ht */
function courrielMasque(adresse) {
  const s = String(adresse || '');
  const i = s.indexOf('@');
  if (i < 1) return '•••';
  const debut = s.slice(0, Math.min(2, i));
  return `${debut}${'•'.repeat(Math.max(2, i - 2))}${s.slice(i)}`;
}

/** Envoie le code par le canal choisi. */
/** Le canal peut-il réellement délivrer un code à l'utilisateur ?
    Il n'en reste qu'un : le courriel. */
function canalA2FDisponible() {
  return courriel.configure();
}

/* Le courriel est le seul canal : la plateforme n'envoie plus de message
   WhatsApp automatique. Le paramètre `canal` est conservé pour les comptes
   déjà enregistrés avec canal « whatsapp » — leur code part désormais à
   l'adresse du compte. */
async function envoyerCodeA2F(canal, destination, nom, code) {
  await courriel.envoyer(destination, 'code_connexion', { nom, code });
}
/**
 * L'adresse que ce client a laissée lors d'un achat, la plus récente.
 * Un même numéro peut avoir servi plusieurs fois : on prend la dernière
 * adresse connue, c'est celle qu'il consulte encore.
 */
function courrielConnuDe(tel) {
  const n = telNormalise(tel);
  if (!n) return '';
  const candidats = [];
  const ajouter = (liste, champTel, champMail) => {
    for (const x of liste || []) {
      if (telNormalise(x[champTel]) !== n) continue;
      const m = String(x[champMail] || '').trim();
      if (courriel.adresseValide(m)) candidats.push({ m, le: x.creeLe || '' });
    }
  };
  ajouter(db.commandes, 'clientTel', 'clientEmail');
  ajouter(db.rendezvous, 'clientTel', 'clientEmail');
  ajouter(db.sejours, 'clientTel', 'clientEmail');
  ajouter(db.dossiers, 'clientTel', 'clientEmail');
  ajouter(db.inscriptions, 'parentTel', 'parentEmail');
  candidats.sort((a, b) => String(b.le).localeCompare(String(a.le)));
  return candidats.length ? candidats[0].m : '';
}

/** Masque un numéro pour l'afficher sans le divulguer : 509 •••• 45 67 */
function telMasque(tel) {
  const n = String(tel || '').replace(/\D/g, '');
  if (n.length < 4) return '••••';
  return '•••• ' + n.slice(-4);
}

// ---- Vente en ligne : modes de remise et statuts de commande ----
/* ==========================================================
   Comptes de paiement propres à l'entreprise
   ----------------------------------------------------------
   Konekte encaisse pour l'entreprise et retient sa commission.
   Toutes n'en veulent pas : certaines ont déjà un MonCash, un
   NatCash ou un compte en banque et préfèrent être payées
   directement. Ces comptes-là sont déclarés ici, affichés au
   client au moment de payer, et l'argent ne passe jamais par
   la plateforme — donc aucune commission n'est prélevée.
   Rien n'est automatique : le client déclare sa référence de
   transaction, l'entreprise confirme l'avoir reçue.
   ========================================================== */
const TYPES_COMPTE = {
  moncash: { nom: 'MonCash',        ico: '🔴', champ: 'Numéro MonCash',   tresorerie: '5151' },
  natcash: { nom: 'NatCash',        ico: '🔵', champ: 'Numéro NatCash',   tresorerie: '5152' },
  banque:  { nom: 'Compte bancaire', ico: '🏦', champ: 'Numéro de compte', tresorerie: '5121' },
  autre:   { nom: 'Autre moyen',    ico: '💵', champ: 'Coordonnées',      tresorerie: '' }
};

function nettoyerComptes(v, existants) {
  if (v === undefined) return existants || [];
  if (!Array.isArray(v)) return [];
  const sortie = [];
  for (const c of v.slice(0, 8)) {
    const type = String(c && c.type || '').toLowerCase();
    if (!TYPES_COMPTE[type]) continue;
    const numero = String(c.numero || '').trim().slice(0, 60);
    if (!numero) continue;                       // un compte sans numéro ne sert à rien
    sortie.push({
      id: String(c.id || '').slice(0, 24) || store.uid(),
      type,
      libelle: String(c.libelle || TYPES_COMPTE[type].nom).trim().slice(0, 50),
      numero,
      titulaire: String(c.titulaire || '').trim().slice(0, 80),
      banque: String(c.banque || '').trim().slice(0, 60),
      instructions: String(c.instructions || '').trim().slice(0, 240),
      actif: c.actif === undefined ? true : !!c.actif
    });
  }
  return sortie;
}

/* Comptes montrés au client : les actifs, sans rien de superflu. */
function comptesPublics(e) {
  if (!e || !(e.vente && e.vente.paiementDirect)) return [];
  return (e.comptesPaiement || []).filter((c) => c.actif).map((c) => ({
    id: c.id, type: c.type, libelle: c.libelle, numero: c.numero,
    titulaire: c.titulaire, banque: c.banque, instructions: c.instructions,
    ico: TYPES_COMPTE[c.type] ? TYPES_COMPTE[c.type].ico : '💵'
  }));
}

const MODES_REMISE = [
  { cle: 'cueillette', fr: 'Retrait sur place',  ht: 'Vin chèche',    ico: '🏪' },
  { cle: 'livraison',  fr: 'Livraison',          ht: 'Livrezon',      ico: '🛵' }
];
const STATUTS_COMMANDE = [
  { cle: 'nouvelle',    fr: 'Nouvelle',            ht: 'Nouvo',          badge: 'badge-orange' },
  { cle: 'confirmee',   fr: 'Confirmée',           ht: 'Konfime',        badge: 'badge-bleu' },
  { cle: 'preparation', fr: 'En préparation',      ht: 'Ap prepare',     badge: 'badge-violet' },
  { cle: 'prete',       fr: 'Prête',               ht: 'Pare',           badge: 'badge-bleu' },
  { cle: 'en_route',    fr: 'En route',            ht: 'Sou wout',       badge: 'badge-violet' },
  { cle: 'livree',      fr: 'Livrée / retirée',    ht: 'Livre / pran',   badge: 'badge-vert' },
  { cle: 'annulee',     fr: 'Annulée',             ht: 'Anile',          badge: 'badge-rouge' }
];
// Étapes visibles par le client selon le mode choisi
function etapesCommande(mode) {
  return mode === 'livraison'
    ? ['nouvelle', 'confirmee', 'preparation', 'en_route', 'livree']
    : ['nouvelle', 'confirmee', 'preparation', 'prete', 'livree'];
}
function nettoyerZones(v) {
  if (!Array.isArray(v)) return [];
  return v.map((z) => ({
    nom: String(z.nom || '').slice(0, 60),
    frais: Math.max(0, Math.min(+z.frais || 0, 100000)),
    delai: String(z.delai || '').slice(0, 40)
  })).filter((z) => z.nom).slice(0, 30);
}

// Distance en km entre deux points (formule de Haversine)
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function noteMoyenne(entrepriseId) {
  const a = db.avis.filter((x) => x.entrepriseId === entrepriseId);
  if (!a.length) return { note: 0, total: 0 };
  return { note: Math.round((a.reduce((s, x) => s + x.note, 0) / a.length) * 10) / 10, total: a.length };
}
/** Envoie une notification poussée à tous les appareils d'un utilisateur. */
async function envoyerPush(userId, contenu) {
  if (!push.configure()) return 0;
  const abonnements = db.pushAbonnements.filter((x) => x.userId === userId);
  let envoyees = 0, aRetirer = [];
  for (const ab of abonnements) {
    const r = await push.envoyer(ab, contenu);
    if (r.ok) envoyees++;
    // Un abonnement périmé est retiré : le navigateur l'a révoqué
    else if (r.perime) aRetirer.push(ab.endpoint);
  }
  if (aRetirer.length) {
    db.pushAbonnements = db.pushAbonnements.filter((x) => !aRetirer.includes(x.endpoint));
    store.save();
  }
  return envoyees;
}

const TITRES_PUSH = {
  rdv: 'Nouveau rendez-vous', rdv_paye: 'Rendez-vous payé',
  sejour: 'Nouvelle réservation', sejour_paye: 'Séjour payé',
  commande: 'Nouvelle commande', commande_payee: 'Commande payée',
  inscription: 'Nouvelle inscription', dossier: 'Nouveau dossier',
  avis: 'Nouvel avis client', abonnement: 'Abonnement',
  produit: 'Produit mis en vente'
};

function notifier(entrepriseId, type, message) {
  db.notifications.unshift({ id: store.uid(), entrepriseId, type, message, lu: false, creeLe: new Date().toISOString() });
  store.save();

  /* La même notification part vers le téléphone du responsable.
     L'envoi n'est pas attendu : une panne du service de notification
     ne doit jamais retarder la réponse au client. */
  // Le lien va de l'utilisateur vers l'entreprise : on cherche dans ce sens.
  const titre = TITRES_PUSH[String(type).split('_')[0]] || TITRES_PUSH[type] || 'Konekte';
  for (const u of db.users.filter((x) => x.entrepriseId === entrepriseId)) {
    envoyerPush(u.id, { titre, corps: message, url: '/dashboard.html', tag: type })
      .catch(() => { /* sans conséquence */ });
  }
}

/* ---------------- Notifications ----------------
   Tout part par courriel, via lib/courriel.js. Deux variables suffisent :
     BREVO_API_KEY        = la clé API Brevo (xkeysib-…)
     COURRIEL_EXPEDITEUR  = l'adresse expéditrice vérifiée dans Brevo
   Sans elles, les messages sont écrits dans les journaux : la plateforme
   fonctionne, mais le client ne reçoit rien.

   L'envoi automatique par WhatsApp a été retiré. Obtenir un jeton permanent
   auprès de Meta suppose une vérification d'entreprise et l'approbation de
   chaque modèle de message, démarche longue et incertaine. Les liens
   « Contacter sur WhatsApp » restent partout : ce sont des liens wa.me, qui
   n'ont jamais rien demandé à Meta. */
const https = require('https');
// -------- Gestion portefeuille --------
function creerOuObtenirPortefeuille(entrepriseId) {
  let p = db.portefeuilles.find((x) => x.id === entrepriseId);
  if (!p) {
    p = { id: entrepriseId, solde: 0, soldeBloque: 0, totalRecu: 0, totalRetire: 0, creeLe: new Date().toISOString() };
    db.portefeuilles.push(p);
  }
  return p;
}
/* ============================================================
   Reçus de paiement et vérification
   ------------------------------------------------------------
   Un reçu imprimé ou envoyé en image se falsifie facilement.
   Le code QR ne contient donc AUCUN montant : il porte une
   adresse de vérification signée. Le commerçant scanne, et
   c'est le serveur qui répond « payé » ou « non payé ».

   La signature empêche de fabriquer une adresse valable pour
   une référence inventée.
   ============================================================ */
/* Le sel doit survivre aux redémarrages. Tiré au hasard à chaque
   démarrage, il changerait à chaque déploiement et invaliderait d'un
   coup tous les reçus déjà remis aux clients : la page de vérification
   les déclarerait faux. On le conserve donc sur le disque persistant,
   à côté de la base, quand la variable d'environnement n'est pas posée. */
const SEL_RECUS = (() => {
  if (process.env.SEL_RECUS) return String(process.env.SEL_RECUS);
  const chemin = path.join(store.DOSSIER_DONNEES, '.sel-recus');
  try {
    const garde = fs.readFileSync(chemin, 'utf8').trim();
    if (garde.length >= 32) return garde;
  } catch { /* premier démarrage : il n'existe pas encore */ }
  const neuf = crypto.randomBytes(24).toString('hex');
  try {
    fs.mkdirSync(store.DOSSIER_DONNEES, { recursive: true });
    fs.writeFileSync(chemin, neuf, { encoding: 'utf8', mode: 0o600 });
    console.log('[RECUS] Sel de signature engendré et conservé dans ' + chemin);
  } catch (e) {
    console.log('[RECUS] ATTENTION : impossible de conserver le sel (' + e.message + ').');
    console.log('[RECUS] Les reçus déjà émis cesseront d\'être vérifiables au prochain redémarrage.');
    console.log('[RECUS] Posez la variable SEL_RECUS pour régler cela définitivement.');
  }
  return neuf;
})();

/* ==========================================================
   Identifiants marchands d'une entreprise
   ----------------------------------------------------------
   Une entreprise qui possède son propre compte marchand peut
   encaisser directement : l'argent va chez elle, Konekte ne
   retient rien. Mais ces identifiants ouvrent son compte
   d'argent : ils sont chiffrés avant d'être écrits sur le
   disque, ne ressortent jamais vers un navigateur, et le
   secret ne s'affiche nulle part — on ne montre que les
   quatre derniers caractères pour que l'entreprise se
   reconnaisse. Même une copie volée de la base ne les livre
   pas sans la clé.
   ========================================================== */
const CLE_SECRETS = (() => {
  if (process.env.CLE_SECRETS) return crypto.createHash('sha256').update(String(process.env.CLE_SECRETS)).digest();
  const chemin = path.join(store.DOSSIER_DONNEES, '.cle-secrets');
  try {
    const garde = fs.readFileSync(chemin, 'utf8').trim();
    if (garde.length >= 32) return crypto.createHash('sha256').update(garde).digest();
  } catch { /* premier démarrage */ }
  const neuf = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(store.DOSSIER_DONNEES, { recursive: true });
    fs.writeFileSync(chemin, neuf, { encoding: 'utf8', mode: 0o600 });
    console.log('[SECRETS] Clé de chiffrement engendrée et conservée dans ' + chemin);
  } catch (e) {
    console.log('[SECRETS] ATTENTION : impossible de conserver la clé (' + e.message + ').');
    console.log('[SECRETS] Les identifiants marchands enregistrés deviendront illisibles au redémarrage.');
    console.log('[SECRETS] Posez la variable CLE_SECRETS pour régler cela définitivement.');
  }
  return crypto.createHash('sha256').update(neuf).digest();
})();

function chiffrer(texte) {
  if (!texte) return '';
  const nonce = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', CLE_SECRETS, nonce);
  const corps = Buffer.concat([c.update(String(texte), 'utf8'), c.final()]);
  return [nonce.toString('base64'), c.getAuthTag().toString('base64'), corps.toString('base64')].join('.');
}

function dechiffrer(paquet) {
  if (!paquet || typeof paquet !== 'string' || paquet.split('.').length !== 3) return '';
  try {
    const [n, t, c] = paquet.split('.');
    const d = crypto.createDecipheriv('aes-256-gcm', CLE_SECRETS, Buffer.from(n, 'base64'));
    d.setAuthTag(Buffer.from(t, 'base64'));
    return Buffer.concat([d.update(Buffer.from(c, 'base64')), d.final()]).toString('utf8');
  } catch { return ''; }        // clé changée ou données altérées : on n'invente rien
}

/* Les quatre derniers caractères, pour que l'entreprise reconnaisse la clé
   qu'elle a posée sans que personne puisse la relire. */
const masquer = (v) => (v && v.length > 4 ? '••••' + v.slice(-4) : (v ? '••••' : ''));

/* La passerelle à employer pour cette entreprise.
   Elle en a déclaré une et l'a activée → c'est la sienne, l'argent va
   chez elle et aucune commission n'est retenue. Sinon, celle de la
   plateforme. Les secrets sont déchiffrés ici seulement, le temps de
   l'appel, et ne sont ni journalisés ni renvoyés. */
function passerelleDe(e) {
  const g = (e && e.passerelle) || null;
  if (g && g.actif && g.fournisseur && passerelles.FOURNISSEURS[g.fournisseur]) {
    const ids = Object.assign({}, g.identifiants || {});
    for (const cle of passerelles.champsSecrets(g.fournisseur)) {
      const clair = dechiffrer(ids[cle]);
      if (!clair) return { propre: false, fournisseur: 'plop' };   // secret illisible : on ne tente rien
      ids[cle] = clair;
    }
    if (passerelles.champsManquants(g.fournisseur, ids).length)
      return { propre: false, fournisseur: 'plop' };
    return { propre: true, fournisseur: g.fournisseur, ids,
             manuel: !passerelles.estAutomatique(g.fournisseur) };
  }
  /* Passerelle de la plateforme : PLOP PLOP, avec ses propres identifiants. */
  return { propre: false, fournisseur: 'plop',
           ids: { clientId: plopplop.PLOP.clientId, clientSecret: plopplop.PLOP.clientSecret },
           hote: plopplop.PLOP.hote };
}

function signatureRecu(reference) {
  return crypto.createHmac('sha256', SEL_RECUS).update(String(reference)).digest('hex').slice(0, 16);
}

function recuValide(reference, signature) {
  const attendue = signatureRecu(reference);
  const fournie = String(signature || '');
  if (fournie.length !== attendue.length) return false;
  // Comparaison à durée constante
  return crypto.timingSafeEqual(Buffer.from(fournie), Buffer.from(attendue));
}

/** Détail d'un paiement, tel qu'affiché sur le reçu et à la vérification. */
function detailPaiement(pmt) {
  const ent = db.entreprises.find((x) => x.id === pmt.entrepriseId);
  let objet = '';
  /* Les paiements sont créés avec le type « rdv » : la comparaison portait
     sur « rendezvous » et l'objet du reçu restait vide. On accepte les deux. */
  if (pmt.commandeType === 'rdv' || pmt.commandeType === 'rendezvous') {
    const r = db.rendezvous.find((x) => x.id === pmt.commandeId);
    const s = r && db.services.find((x) => x.id === r.serviceId);
    objet = r ? `${s ? s.nom : 'Rendez-vous'} — ${r.date} à ${r.heure}` : 'Rendez-vous';
  } else if (pmt.commandeType === 'sejour') {
    const s = db.sejours.find((x) => x.id === pmt.commandeId);
    objet = s ? `Séjour du ${s.arrivee} au ${s.depart}` : 'Séjour';
  } else if (pmt.commandeType === 'commande') {
    const c = db.commandes.find((x) => x.id === pmt.commandeId);
    /* Les lignes d'une commande sont dans `lignes` : ce calcul lisait
       `articles`, qui n'existe pas, et tout reçu annonçait 0 article. */
    const n = c ? (c.lignes || []).reduce((s, l) => s + (+l.quantite || 1), 0) : 0;
    objet = c ? `Commande de ${n} article${n > 1 ? 's' : ''}` : 'Commande';
  } else if (pmt.commandeType === 'abonnement') {
    objet = 'Abonnement Konekte';
  }
  return {
    reference: pmt.reference,
    statut: pmt.statut,
    montant: pmt.montantBrut,
    methode: pmt.methode || pmt.methodePaiement || '',
    client: pmt.clientNom || '',
    objet,
    entreprise: ent ? ent.nom : '',
    entrepriseSlug: ent ? ent.slug : '',
    le: pmt.dateConfirmation || pmt.creeLe,
    transaction: pmt.idTransaction || ''
  };
}

/* ==========================================================
   L'entreprise telle que la voit son espace de gestion
   ----------------------------------------------------------
   `/api/moi` et `/api/mon-entreprise` doivent décrire la même
   entreprise. Ils construisaient chacun leur réponse, et les
   deux ont dérivé : `/api/moi`, celle qui sert au démarrage,
   oubliait les listes calculées. Résultat, l'espace jugeait les
   droits sur des champs absents — le menu ne verrouillait rien,
   puis la comptabilité se croyait hors forfait alors qu'elle
   était comprise. Un seul endroit décrit maintenant l'entreprise.
   ========================================================== */
function entreprisePourGestion(e, req) {
  if (!e) return null;
  return {
    ...e, motdepasse: undefined,
    /* Les identifiants marchands ne sortent jamais d'ici : leur état se
       consulte par leur propre point d’entrée, qui en masque le secret. */
    passerelle: e.passerelle ? { actif: !!e.passerelle.actif,
                                 fournisseur: e.passerelle.fournisseur || 'plop' } : null,
    urlPublique: basePublique(req),
    /* Les fonctions du métier (le socle), toujours ouvertes, et les
       options de croissance que le forfait ouvre ou retient. */
    modulesMetier: metiers.metierDe(e).modules,
    modulesActifs: metiers.modulesActifs(e),
    modulesVerrouilles: metiers.modulesActifs(e).filter((m) => !forfaits.forfaitAutorise(e, m)),
    options: forfaits.optionsDe(e),
    abonnementEtat: forfaits.etatAbonnement(e),
    /* Messages pré-enregistrés à envoyer aux clients sur WhatsApp. */
    modelesWhatsApp: modelesWhatsApp(e),
    modelesWhatsAppPersonnalises: Array.isArray(e.modelesWhatsApp) && e.modelesWhatsApp.length > 0,
    /* Le financement n'est ouvert que dans une commune : l'espace de gestion
       n'affiche la demande que là, plutôt que de promettre une porte qui se
       refermerait au moment de l'envoi. */
    financement: { ouvert: financementOuvert(e), commune: FINANCEMENT_COMMUNE,
                   departementNom: geo.nomDepartement(e.departement) },
    /* État du paiement par versement : entente déclarée, validée, ouverte. */
    versement: versementDe(e)
  };
}

/* ==========================================================
   Reçu par référence
   ----------------------------------------------------------
   Le client saisit la référence qu'il a reçue — celle de son
   règlement en ligne, mais le plus souvent celle de sa commande,
   car c'est elle que porte le courriel de confirmation. Les deux
   donnent droit au même reçu. Une commande payable à la remise
   en reçoit un aussi, marqué « à régler » : c'est la preuve de
   sa commande, et refuser la référence lui laissait croire à une
   erreur de la plateforme.
   ========================================================== */
function recuParReference(reference) {
  const ref = String(reference || '').trim().toUpperCase();
  if (!ref) return null;
  const infoEnt = (id) => {
    const e = db.entreprises.find((x) => x.id === id);
    return { entreprise: e ? e.nom : '', entrepriseSlug: e ? e.slug : '' };
  };

  const pmt = db.paiements.find((x) => String(x.reference).toUpperCase() === ref);
  if (pmt) {
    if (pmt.statut !== 'confirme') return { nonConfirme: true };
    return detailPaiement(pmt);
  }

  const cmd = db.commandes.find((x) => String(x.reference || '').toUpperCase() === ref);
  if (cmd) {
    const n = (cmd.lignes || []).reduce((s, l) => s + (+l.quantite || 1), 0);
    return {
      reference: cmd.reference, statut: cmd.paye ? 'confirme' : 'a_regler',
      montant: cmd.total || 0, methode: cmd.paye ? (cmd.methodePaiement || '') : '',
      client: cmd.clientNom || '',
      objet: `Commande de ${n} article${n > 1 ? 's' : ''} — ${cmd.mode === 'livraison' ? 'livraison' : 'retrait sur place'}`,
      ...infoEnt(cmd.entrepriseId),
      le: cmd.payeLe || cmd.creeLe, transaction: cmd.transactionId || ''
    };
  }

  const sej = db.sejours.find((x) => String(x.reference || x.id.slice(-8)).toUpperCase() === ref);
  if (sej) {
    return {
      reference: String(sej.reference || sej.id.slice(-8)).toUpperCase(),
      statut: sej.paye ? 'confirme' : 'a_regler',
      montant: sej.prixTotal || 0, methode: '', client: sej.clientNom || '',
      objet: `Séjour du ${sej.arrivee} au ${sej.depart}`,
      ...infoEnt(sej.entrepriseId),
      le: sej.creeLe, transaction: sej.transactionId || ''
    };
  }

  const rdv = db.rendezvous.find((x) => x.id.slice(-8).toUpperCase() === ref);
  if (rdv) {
    const sv = db.services.find((x) => x.id === rdv.serviceId);
    return {
      reference: rdv.id.slice(-8).toUpperCase(),
      statut: rdv.paye ? 'confirme' : 'a_regler',
      montant: rdv.prixTotal || (sv ? sv.prix : 0), methode: '', client: rdv.clientNom || '',
      objet: `${sv ? sv.nom : 'Rendez-vous'} — ${rdv.date} à ${rdv.heure}`,
      ...infoEnt(rdv.entrepriseId),
      le: rdv.creeLe, transaction: rdv.transactionId || ''
    };
  }
  return null;
}

/* ==========================================================
   Encaissement confirmé — effets communs
   ----------------------------------------------------------
   Appelé de deux endroits : la vérification demandée par la
   page de règlement, et le rattrapage périodique des paiements
   restés en attente. Écrire ces effets une seule fois garantit
   qu'un paiement rattrapé crédite le portefeuille, décompte le
   stock et prévient le client exactement comme un paiement
   confirmé dans la foulée.
   ========================================================== */
function appliquerPaiementConfirme(paiement, infos) {
  if (paiement.statut === 'confirme') return false;   // jamais deux fois
  infos = infos || {};
  paiement.statut = 'confirme';
  paiement.methode = infos.methode || '';
  paiement.dateConfirmation = new Date().toISOString();
  paiement.idTransaction = infos.transactionId || paiement.reference;
  
  /* Le portefeuille Konekte n'est crédité que de ce que Konekte a
     réellement encaissé. Un paiement reçu sur le compte marchand de
     l'entreprise est déjà chez elle : l'ajouter ici lui ferait croire
     qu'elle peut le retirer une seconde fois. */
  if (!paiement.surCompteEntreprise) {
    const port = creerOuObtenirPortefeuille(paiement.entrepriseId);
    port.solde += paiement.montantNet;
    port.totalRecu += paiement.montantNet;
  }
  
  // Traiter selon le type de commande
  const e = db.entreprises.find((x) => x.id === paiement.entrepriseId);
  if (paiement.commandeType === 'rdv') {
    const r = db.rendezvous.find((x) => x.id === paiement.commandeId);
    if (r) {
      r.paye = true;
      r.statut = 'confirme';  // Automatiquement confirmé après paiement
      r.transactionId = paiement.idTransaction;
      r.surCompteEntreprise = !!paiement.surCompteEntreprise;
      const svc = db.services.find(s => s.id === r.serviceId);
      courrielClient(r.clientEmail, 'rdv_statut', {
        nom: r.clientNom, entreprise: e?.nom || '', statut: 'confirmé et payé',
        date: r.date, heure: r.heure, adresse: e?.adresse || '',
        telephone: e?.telephone || '', couleur: e?.couleur
      });
      // Notifier l'entreprise
      notifier(paiement.entrepriseId, 'rdv_paye', `Rendez-vous payé : ${r.clientNom} — ${db.services.find(s => s.id === r.serviceId)?.nom || ''} le ${r.date}`);
    }
  } else if (paiement.commandeType === 'sejour') {
    const s = db.sejours.find((x) => x.id === paiement.commandeId);
    if (s) {
      s.paye = true;
      s.transactionId = paiement.idTransaction;
      s.surCompteEntreprise = !!paiement.surCompteEntreprise;
      const chambre = db.chambres.find(c => c.id === s.chambreId);
      courrielClient(s.clientEmail, 'sejour_paye', {
        nom: s.clientNom, entreprise: e?.nom || '', chambre: chambre?.nom || '',
        arrivee: s.arrivee, depart: s.depart, montant: paiement.montant,
        couleur: e?.couleur
      });
    }
  } else if (paiement.commandeType === 'commande') {
    const c = db.commandes.find((x) => x.id === paiement.commandeId);
    if (c) {
      c.paye = true;
      c.transactionId = paiement.idTransaction;
      c.methodePaiement = paiement.methode || '';
      /* Mémorisé sur la commande : la comptabilité doit savoir où l'argent
         a atterri, et ne pas inscrire une commission qui n'a pas eu lieu. */
      c.surCompteEntreprise = !!paiement.surCompteEntreprise;
      // Une commande payée passe directement en confirmée, avec décompte du stock
      if (!c.stockDecompte) {
        c.lignes.forEach((l) => {
          const pr = db.produits.find((x) => x.id === l.produitId);
          if (!pr || pr.stock === null) { l.decompte = 0; return; }
          const pris = Math.min(pr.stock, l.quantite);
          pr.stock -= pris;
          l.decompte = pris;
        });
        c.stockDecompte = true;
      }
      if (c.statut === 'nouvelle') c.statut = 'confirmee';
      c.journal.push({ le: new Date().toISOString(), texte: 'Paiement reçu — ' + c.total.toLocaleString('fr-HT') + ' HTG' });
      c.majLe = new Date().toISOString();
      courrielClient(c.clientEmail, 'commande_payee', {
        nom: c.clientNom, entreprise: e?.nom || '', reference: c.reference,
        total: c.total, mode: c.mode === 'livraison' ? 'Livraison' : 'Retrait sur place',
        couleur: e?.couleur
      });
      notifier(paiement.entrepriseId, 'commande_payee', `Commande ${c.reference} payée — ${c.total.toLocaleString('fr-HT')} HTG`);
    }
  }
  
  return true;
}

/* ==========================================================
   Rattrapage des encaissements restés en attente
   ----------------------------------------------------------
   Un client qui paie puis ferme sa page, ou dont la connexion
   lâche au retour, laissait son règlement « en attente » pour
   toujours : l'argent était chez la passerelle, le portefeuille
   affichait zéro et la commande n'était pas marquée payée.
   On redemande donc à la passerelle l'état des règlements
   récents, et on applique ceux qu'elle déclare réglés.
   ========================================================== */
let rattrapageEnCours = false;
async function rattraperPaiements(entrepriseId) {
  if (rattrapageEnCours) return { verifies: 0, confirmes: 0, occupe: true };
  if (!plopplop.passerelleActive()) return { verifies: 0, confirmes: 0, inactive: true };
  rattrapageEnCours = true;
  try {
    /* On remonte sur trente jours : au-delà, une transaction abandonnée
       ne sera plus réglée, et interroger la passerelle pour rien coûte du
       temps à chaque passage. */
    const depuis = new Date(Date.now() - 30 * 864e5).toISOString();
    const attente = db.paiements.filter((x) => x.statut === 'en_attente'
      && x.creeLe >= depuis && (!entrepriseId || x.entrepriseId === entrepriseId));
    let confirmes = 0;
    for (const paiement of attente.slice(0, 120)) {
      let v;
      /* Un moyen qui se confirme à la main n'a rien à demander : on ne
         harcèle pas une passerelle qui n'expose aucune interface. */
      if (paiement.manuel) continue;
      try {
        const ent = db.entreprises.find((x) => x.id === paiement.entrepriseId);
        const pgv = passerelleDe(ent);
        v = await passerelles.verifier(paiement.fournisseur || pgv.fournisseur, {
          reference: paiement.reference, ids: pgv.ids, hote: pgv.hote });
      }
      catch { continue; }                       // passerelle muette : on réessaiera
      if (v.ok && v.paye && appliquerPaiementConfirme(paiement, v.infos)) confirmes++;
    }
    if (confirmes) store.save();
    return { verifies: attente.length, confirmes };
  } finally {
    rattrapageEnCours = false;
  }
}

function creerPaiement(entrepriseId, commandeType, commandeId, montant, methodePaiement, clientEmail, clientNom, surCompteEntreprise) {
  const reference = `${commandeType[0].toUpperCase()}${commandeId.slice(0, 8)}${Date.now().toString(36).toUpperCase()}`;
  const ent = db.entreprises.find((x) => x.id === entrepriseId);
  /* Encaissement sur le compte marchand de l'entreprise : l'argent ne
     passe pas par Konekte, il n'y a donc rien à retenir ni à créditer. */
  const commission = surCompteEntreprise ? 0 : forfaits.commissionPour(ent, montant);
  const paiement = {
    id: store.uid(), entrepriseId, reference, commandeType, commandeId, montantBrut: montant,
    commission,
    montantNet: montant - commission,
    surCompteEntreprise: !!surCompteEntreprise,
    methodePaiement: methodePaiement || 'all', clientEmail, clientNom,
    statut: 'en_attente', transactionId: null, creeLe: new Date().toISOString()
  };
  db.paiements.push(paiement);
  return paiement;
}

function normaliserTel(tel) {
  let n = String(tel || '').replace(/\D/g, '');
  if (n.length === 8) n = '509' + n; // numéro haïtien local → indicatif 509
  return n.length >= 10 ? n : null;
}
/**
 * Notification au client, par courriel.
 *
 * Remplace l'ancien envoi WhatsApp par l'API de Meta : obtenir un jeton
 * permanent suppose une vérification d'entreprise et des modèles approuvés
 * un par un, démarche qui peut durer des semaines. Le courriel part dès que
 * la clé Brevo est en place.
 *
 * Volontairement sans `await` : une notification est un à-côté, elle ne doit
 * jamais retarder la réponse donnée au client ni la faire échouer.
 */
function courrielClient(destinataire, modele, params) {
  courriel.envoyer(destinataire, modele, params || {});
}

/**
 * Lien de conversation WhatsApp — sans rapport avec ce qui précède.
 * Un lien wa.me n'a jamais demandé d'autorisation à Meta : il ouvre
 * simplement WhatsApp. C'est ainsi que les clients haïtiens joignent une
 * entreprise, et cela reste en place partout dans la plateforme.
 */
function lienWhatsApp(tel, texte) {
  const numero = normaliserTel(tel);
  if (!numero) return '';
  return `https://wa.me/${numero}${texte ? '?text=' + encodeURIComponent(texte) : ''}`;
}

// Vue publique du service d'urgence.
// L'état d'affluence n'est transmis que s'il est récent : une information
// périmée pourrait orienter quelqu'un vers un service saturé.
function urgencePublique(e) {
  const u = e.urgence;
  if (!u || !u.actif) return null;
  const heures = u.etatMaj ? (Date.now() - new Date(u.etatMaj).getTime()) / 3600000 : Infinity;
  const etatRecent = heures <= 12;
  return {
    permanence: !!u.permanence,
    telephone: u.telephone || e.telephone || '',
    telephone2: u.telephone2 || '',
    ambulance: !!u.ambulance,
    telAmbulance: u.telAmbulance || '',
    capacites: u.capacites || [],
    consigne: u.consigne || '',
    horaires: u.horaires || '',
    etat: etatRecent ? u.etat : null,
    etatDepuis: etatRecent ? Math.round(heures) : null,
    garde: (u.gardeDebut && u.gardeFin)
      ? { debut: u.gardeDebut, fin: u.gardeFin,
          active: new Date().toISOString().slice(0, 10) >= u.gardeDebut
               && new Date().toISOString().slice(0, 10) <= u.gardeFin }
      : null
  };
}

function publicEntreprise(e) {
  const { note, total } = noteMoyenne(e.id);
  return { slug: e.slug, nom: e.nom, categorie: e.categorie, description: e.description, adresse: e.adresse,
    ville: e.ville || '', departement: e.departement || '', departementNom: geo.nomDepartement(e.departement), telephone: e.telephone, whatsapp: e.whatsapp, couleur: e.couleur, couleur2: e.couleur2, logoTexte: e.logoTexte, logoImage: e.logoImage || '', photoFond: e.photoFond || '', horaires: e.horaires, plan: e.plan, latitude: e.latitude ?? null, longitude: e.longitude ?? null,
    formule: e.formule || 'standard', inclus: e.inclus || [], noteFormule: e.noteFormule || '',
    metier: e.metier || 'autre', champs: e.champs || {}, urgence: urgencePublique(e),
    action: { fr: metiers.actionDe(e, 'fr'), ht: metiers.actionDe(e, 'ht') },
    note, totalAvis: total };
}

// ---------------- Calcul des créneaux disponibles ----------------
const JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
// ---------------- Séjours (chambres d'hôtel) ----------------
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// ================= Gestion hôtelière : tarification =================
// Un plan tarifaire est une façon de vendre la même chambre : tarif standard,
// non remboursable moins cher, ou avec petit-déjeuner. Une saison ajuste ces
// prix sur une période. Les taxes et l'acompte sont réglés par l'établissement.

/** Saison applicable à une date donnée (la plus récemment créée l'emporte). */
function saisonPour(entrepriseId, date) {
  return db.saisons
    .filter((s) => s.entrepriseId === entrepriseId && s.actif && date >= s.debut && date <= s.fin)
    .sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0] || null;
}

/** Liste des dates d'un séjour (la nuit de départ n'est pas facturée). */
function nuitsDu(arrivee, depart) {
  const out = [];
  const d = new Date(arrivee + 'T00:00:00Z'), fin = new Date(depart + 'T00:00:00Z');
  while (d < fin) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

/**
 * Devis complet d'un séjour, nuit par nuit.
 * Le détail est renvoyé pour que le client voie ce qu'il paie.
 */
function devisSejour(e, chambre, plan, arrivee, depart) {
  const nuits = nuitsDu(arrivee, depart);
  const base = plan && plan.prixNuit > 0 ? plan.prixNuit : chambre.prixNuit;
  const detail = nuits.map((date) => {
    const s = saisonPour(e.id, date);
    let prix = base;
    if (s) prix = s.type === 'pourcentage' ? Math.round(base * (1 + s.valeur / 100)) : Math.max(0, base + s.valeur);
    return { date, prix, saison: s ? s.nom : '' };
  });
  const sousTotal = detail.reduce((n, x) => n + x.prix, 0);
  const h = e.hotel || {};
  const taxes = [];
  if (h.taxeSejour > 0) taxes.push({ nom: 'Taxe de séjour', montant: Math.round(h.taxeSejour * nuits.length) });
  if (h.tauxTaxe > 0) taxes.push({ nom: `Taxes (${h.tauxTaxe}%)`, montant: Math.round(sousTotal * h.tauxTaxe / 100) });
  const totalTaxes = taxes.reduce((n, x) => n + x.montant, 0);
  const total = sousTotal + totalTaxes;
  const pctAcompte = Math.max(0, Math.min(+h.acompte || 0, 100));
  return {
    nuits: nuits.length, detail, base, sousTotal, taxes, totalTaxes, total,
    plan: plan ? { id: plan.id, nom: plan.nom, remboursable: plan.remboursable, petitDejeuner: plan.petitDejeuner } : null,
    acompte: pctAcompte ? Math.round(total * pctAcompte / 100) : 0,
    pourcentageAcompte: pctAcompte
  };
}

/** Contrôle des règles de vente : séjour minimum et délai de réservation. */
function verifierRegles(e, arrivee, depart) {
  const h = e.hotel || {};
  const n = nbNuits(arrivee, depart);
  if (h.sejourMin && n < h.sejourMin)
    return `Séjour minimum de ${h.sejourMin} nuit${h.sejourMin > 1 ? 's' : ''}.`;
  if (h.sejourMax && n > h.sejourMax)
    return `Séjour maximum de ${h.sejourMax} nuits.`;
  return null;
}

function nbNuits(arrivee, depart) {
  return Math.round((new Date(depart + 'T12:00:00Z') - new Date(arrivee + 'T12:00:00Z')) / 86400000);
}
// Chambres restantes pour un type donné sur la période [arrivee, depart)
function chambresRestantes(chambre, arrivee, depart, ignorerId) {
  const occupees = db.sejours.filter((s) =>
    s.chambreId === chambre.id &&
    s.id !== ignorerId &&
    ['en_attente', 'confirme'].includes(s.statut) &&
    s.arrivee < depart && arrivee < s.depart // chevauchement de périodes
  ).length;
  return Math.max(0, (+chambre.quantite || 1) - occupees);
}
function validerPeriode(arrivee, depart) {
  if (!DATE_RE.test(arrivee || '') || !DATE_RE.test(depart || '')) return 'Dates invalides.';
  const nuits = nbNuits(arrivee, depart);
  if (nuits < 1) return 'La date de départ doit être après la date d\'arrivée.';
  if (nuits > 90) return 'Séjour limité à 90 nuits.';
  const aujourdhui = new Date().toISOString().slice(0, 10);
  if (arrivee < aujourdhui) return 'La date d\'arrivée est déjà passée.';
  return null;
}

function creneauxDisponibles(entreprise, service, dateStr) {
  const jour = JOURS[new Date(dateStr + 'T12:00:00').getDay()];
  const h = horaires.normaliser(entreprise.horaires)[jour];
  if (!h || !h.ouvert) return [];
  // Capacité : réglage manuel de l'entreprise s'il existe, sinon nombre d'employés actifs
  const capacite = +entreprise.capaciteMax > 0
    ? +entreprise.capaciteMax
    : Math.max(1, db.employes.filter((p) => p.entrepriseId === entreprise.id && p.actif).length);
  const versMin = (t) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  const versHeure = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const pris = db.rendezvous.filter((r) => r.entrepriseId === entreprise.id && r.date === dateStr && ['en_attente', 'confirme'].includes(r.statut));
  const creneaux = [];
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const minMaintenant = new Date().getHours() * 60 + new Date().getMinutes();
  /* Pas entre deux créneaux : réglage de l'entreprise, sinon la durée
     du service, sinon 30 minutes. Un salon qui travaille par heure pose
     60 ; un cabinet qui enchaîne des visites courtes pose 15. */
  const pas = Math.max(5, Math.min(+entreprise.pasCreneaux || service.duree || 30, 480));
  for (let m = versMin(h.debut); m + service.duree <= versMin(h.fin); m += pas) {
    if (dateStr === aujourdhui && m <= minMaintenant) continue;
    // Pauses déclarées (déjeuner, fermeture de midi…)
    const enPause = (entreprise.pauses || []).some((p) => {
      const d = versMin(p.debut), f = versMin(p.fin);
      return m < f && m + service.duree > d;
    });
    if (enPause) continue;
    const chevauche = pris.filter((r) => {
      const s = db.services.find((x) => x.id === r.serviceId);
      const debut = versMin(r.heure), fin = debut + (s ? s.duree : 30);
      return m < fin && m + service.duree > debut;
    }).length;
    if (chevauche < capacite) creneaux.push(versHeure(m));
  }
  return creneaux;
}

// ---------------- Routes API ----------------
async function api(req, res, url) {
  const p = url.pathname;
  const q = url.searchParams;
  const user = utilisateurConnecte(req);
  const corps = ['POST', 'PUT', 'DELETE'].includes(req.method) ? await lireCorps(req) : {};
  const monEntreprise = () => user && db.entreprises.find((e) => e.id === user.entrepriseId);

  // ---- Authentification ----
  if (p === '/api/inscription' && req.method === 'POST') {
    /* Une même adresse réseau ne doit pas pouvoir ouvrir des comptes en
       rafale : la page publique de chacun serait aussitôt en ligne. */
    const cleIns = cleFreinage(req, 'inscription', '');
    const attenteIns = attenteRestante(cleIns, ECHECS_MAX_INSCRIPTION);
    if (attenteIns) {
      res.setHeader('Retry-After', String(attenteIns));
      return json(res, 429, { erreur: 'Trop d\'inscriptions depuis cet appareil. Réessayez dans un quart d\'heure.' });
    }
    noterEchec(cleIns);

    const { nomResponsable, email, motdepasse, nomEntreprise, categorie, telephone, adresse } = corps;
    if (!nomResponsable || !email || !motdepasse || !nomEntreprise || !categorie)
      return json(res, 400, { erreur: 'Tous les champs obligatoires doivent être remplis.' });
    // Contrôles du mot de passe avant toute création
    if (String(motdepasse).length < 6)
      return json(res, 400, { erreur: 'Le mot de passe doit contenir au moins 6 caractères.' });
    if (corps.motdepasse2 !== undefined && motdepasse !== corps.motdepasse2)
      return json(res, 400, { erreur: 'Les deux mots de passe ne correspondent pas.' });
    if (db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()))
      return json(res, 400, { erreur: 'Un compte existe déjà avec cet email.' });
    let slug = slugifier(nomEntreprise); let i = 1;
    while (db.entreprises.find((e) => e.slug === slug)) slug = slugifier(nomEntreprise) + '-' + ++i;
    const entreprise = {
      id: store.uid(), slug, nom: nomEntreprise, categorie, description: '',
      adresse: adresse || '', telephone: telephone || '', whatsapp: (telephone || '').replace(/\D/g, ''),
      /* Ville et département : ils situent l'entreprise sur la carte comme
         dans les recherches « près de moi », et c'est la ville qui ouvre —
         ou non — le financement de Micro Crédit Solidarité. La ville reste
         libre ; le département, lui, doit être l'un des dix. */
      ville: String(corps.ville || '').slice(0, 60).trim(),
      departement: geo.cleDepartement(corps.departement),
      email, statut: 'en_attente', plan: 'gratuit', couleur: '#2563EB', couleur2: '#F59E0B',
      metier: metiers.CLES_METIERS.includes(corps.metier) ? corps.metier : 'autre',
      abonnement: (() => {
        const ab = forfaits.nouvelAbonnement(corps.forfait, new Date());
        // Traces des étapes légales : conservées telles qu'acceptées
        ab.politique = corps.politiqueAcceptee ? { acceptee: true, le: new Date().toISOString() } : null;
        if (corps.signature) {
          ab.contrat = {
            signature: String(corps.signature).slice(0, 90),
            qualite: String(corps.qualiteSignataire || '').slice(0, 60),
            le: new Date().toISOString(),
            version: '1.0'
          };
        }
        return ab;
      })(),
      champs: {},
      /* Logo et photo d'en-tête déposés dès le formulaire. Mêmes limites que
         dans l'espace de gestion : une valeur hors normes est ignorée plutôt
         que de faire échouer une inscription déjà remplie. */
      logoImage: (typeof corps.logoImage === 'string' && corps.logoImage.startsWith('data:image/')
        && corps.logoImage.length <= 350000) ? corps.logoImage : '',
      photoFond: (typeof corps.photoFond === 'string' && corps.photoFond.startsWith('data:image/')
        && corps.photoFond.length <= 1500000) ? corps.photoFond : '',
      photoPartage: '',
      logoTexte: nomEntreprise.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
      horaires: { lun: { ouvert: true, debut: '08:00', fin: '17:00' }, mar: { ouvert: true, debut: '08:00', fin: '17:00' }, mer: { ouvert: true, debut: '08:00', fin: '17:00' }, jeu: { ouvert: true, debut: '08:00', fin: '17:00' }, ven: { ouvert: true, debut: '08:00', fin: '17:00' }, sam: { ouvert: true, debut: '09:00', fin: '13:00' }, dim: { ouvert: false, debut: '09:00', fin: '13:00' } },
      creeLe: new Date().toISOString()
    };
    const nouvelUser = { id: store.uid(), nom: nomResponsable, email, motdepasse: await mdpOutil.hacher(motdepasse), role: 'responsable', entrepriseId: entreprise.id, creeLe: new Date().toISOString() };

    /* Activation par courriel. Si l'envoi n'est pas configuré, le lien
       n'arriverait jamais : on ouvre alors le compte directement, plutôt que
       de laisser quelqu'un devant une porte dont personne n'a la clé. */
    const parCourriel = courriel.configure() && courriel.adresseValide(email);
    if (parCourriel) {
      nouvelUser.courrielVerifie = false;
      nouvelUser.activation = {
        jeton: crypto.randomBytes(24).toString('hex'),
        expire: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      };
    } else {
      /* Sans envoi de courriel, aucun lien ne peut partir : le compte est ouvert
         et l'entreprise mise en ligne immédiatement, comme elle le serait après
         le clic sur le lien. */
      nouvelUser.courrielVerifie = true;
      entreprise.statut = 'approuvee';
    }

    db.entreprises.push(entreprise); db.users.push(nouvelUser);

    if (parCourriel) {
      store.save();
      courrielClient(email, 'compte_activation', {
        nom: nomResponsable, entreprise: nomEntreprise,
        lien: `${basePublique(req)}/activer?j=${nouvelUser.activation.jeton}`
      });
      return json(res, 200, { ok: true, activation: true, courriel: email });
    }

    const token = crypto.randomBytes(24).toString('hex');
    db.sessions[token] = nouvelUser.id; store.save();
    res.setHeader('Set-Cookie', `rdv_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
    return json(res, 200, { ok: true, role: 'responsable' });
  }

  /* ---- Renvoi du lien d'activation ---- */
  if (p === '/api/activation/renvoyer' && req.method === 'POST') {
    const u = db.users.find((x) => x.email.toLowerCase() === String(corps.email || '').toLowerCase());
    /* Réponse identique dans tous les cas : dire quelles adresses ont un compte
       renseignerait un curieux sur la clientèle de la plateforme. */
    if (u && u.courrielVerifie === false && courriel.configure()) {
      u.activation = {
        jeton: crypto.randomBytes(24).toString('hex'),
        expire: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
      };
      store.save();
      const ent = db.entreprises.find((x) => x.id === u.entrepriseId);
      courrielClient(u.email, 'compte_activation', {
        nom: u.nom, entreprise: ent ? ent.nom : '',
        lien: `${basePublique(req)}/activer?j=${u.activation.jeton}`
      });
    }
    return json(res, 200, { ok: true });
  }

  if (p === '/api/connexion' && req.method === 'POST') {
    const adresseSaisie = String(corps.email || '').toLowerCase();
    const cle = cleFreinage(req, 'connexion', adresseSaisie);
    const attente = attenteRestante(cle, ECHECS_MAX);
    if (attente) {
      res.setHeader('Retry-After', String(attente));
      const minutes = Math.ceil(attente / 60);
      return json(res, 429, { erreur: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.` });
    }

    const u = db.users.find((x) => String(x.email).toLowerCase() === adresseSaisie);
    /* La vérification a lieu même si le compte n'existe pas : une réponse
       plus rapide dans ce cas indiquerait quelles adresses sont inscrites. */
    const motDePasseJuste = await mdpOutil.verifier(
      String(corps.motdepasse || ''),
      u ? u.motdepasse : 'scrypt$16384$8$1$00$00'
    );
    if (!u || !motDePasseJuste) {
      noterEchec(cle);
      return json(res, 401, { erreur: 'Email ou mot de passe incorrect.' });
    }
    effacerEchecs(cle);

    /* Compte d'avant le hachage : son mot de passe vient d'être confirmé,
       on le remplace par son empreinte. L'utilisateur ne voit rien. */
    if (mdpOutil.doitEtreMigre(u.motdepasse)) {
      u.motdepasse = await mdpOutil.hacher(String(corps.motdepasse || ''));
      store.save();
    }

    /* Compte créé mais jamais activé. Le test porte sur `false` et non sur
       l'absence de valeur : les comptes antérieurs à l'activation par courriel
       n'ont pas ce champ et ne doivent surtout pas se retrouver bloqués. */
    if (u.courrielVerifie === false) {
      return json(res, 403, {
        erreur: 'Votre compte n\'est pas encore activé. Ouvrez le courriel d\'activation que nous vous avons envoyé et cliquez sur le bouton.',
        activation: true, courriel: u.email
      });
    }

    // Deuxième facteur : le mot de passe seul ne suffit plus
    if (u.a2f && u.a2f.actif) {
      const canal = u.a2f.canal || 'whatsapp';
      const destination = canal === 'courriel' ? (u.a2f.courriel || u.email) : (u.a2f.telephone || '');
      /* Le canal a pu cesser de fonctionner depuis l'activation. Mieux vaut
         le dire que d'afficher une case de code que rien ne viendra remplir. */
      if (!canalA2FDisponible())
        return json(res, 503, { erreur: 'Votre compte demande un code de vérification, mais l\'envoi des codes n\'est pas disponible actuellement. Contactez l\'administrateur de la plateforme.' });
      const { id, code } = creerDefi(u.id, destination, canal);
      await envoyerCodeA2F(canal, destination, u.nom, code);
      return json(res, 200, {
        a2f: true, defi: id, canal,
        destination: canal === 'courriel' ? courrielMasque(destination) : telMasque(destination)
      });
    }

    const token = crypto.randomBytes(24).toString('hex');
    db.sessions[token] = u.id; store.save();
    res.setHeader('Set-Cookie', `rdv_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
    return json(res, 200, { ok: true, role: u.role });
  }

  // Validation du code reçu
  if (p === '/api/connexion/code' && req.method === 'POST') {
    nettoyerDefis();
    const d = DEFIS_A2F.get(String(corps.defi || ''));
    if (!d) return json(res, 401, { erreur: 'Code expiré. Reconnectez-vous.' });
    d.tentatives++;
    if (d.tentatives > A2F_TENTATIVES_MAX) {
      DEFIS_A2F.delete(corps.defi);
      return json(res, 429, { erreur: 'Trop de tentatives. Reconnectez-vous.' });
    }
    const saisi = String(corps.code || '').replace(/\D/g, '');
    // Comparaison à durée constante : ne révèle pas où le code diffère
    const ok = saisi.length === 6 &&
      crypto.timingSafeEqual(Buffer.from(saisi), Buffer.from(d.code));
    if (!ok) return json(res, 401, { erreur: `Code incorrect. ${A2F_TENTATIVES_MAX - d.tentatives} essai(s) restant(s).` });

    DEFIS_A2F.delete(corps.defi);
    const u = db.users.find((x) => x.id === d.userId);
    if (!u) return json(res, 401, { erreur: 'Compte introuvable.' });
    const token = crypto.randomBytes(24).toString('hex');
    db.sessions[token] = u.id; store.save();
    res.setHeader('Set-Cookie', `rdv_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
    return json(res, 200, { ok: true, role: u.role });
  }

  // ---- Réglage du deuxième facteur ----
  if (p === '/api/moi/a2f' && req.method === 'GET') {
    if (!user) return json(res, 401, { erreur: 'Non connecté' });
    const a = user.a2f || {};
    const canal = a.canal || 'whatsapp';
    return json(res, 200, {
      actif: !!a.actif, canal,
      destination: !a.actif ? '' : (canal === 'courriel' ? courrielMasque(a.courriel) : telMasque(a.telephone)),
      /* Ce que la plateforme sait réellement envoyer. Le panneau s'y règle :
         proposer un canal muet mènerait à un refus, ou pire, à un compte
         enfermé derrière un code qui n'arrive jamais. */
      courrielDispo: canalA2FDisponible(),
      whatsappDispo: false,          // la plateforme n'envoie plus par WhatsApp
      emailCompte: user.email || ''
    });
  }

  // Demande d'activation : on envoie un code au numéro proposé
  if (p === '/api/moi/a2f/demarrer' && req.method === 'POST') {
    if (!user) return json(res, 401, { erreur: 'Non connecté' });
    const canal = 'courriel';
    /* Un canal qui n'envoie rien enferme le compte : le code finit dans
       les journaux du serveur, et plus personne ne peut se connecter. */
    if (!canalA2FDisponible())
      return json(res, 400, { erreur: "L'envoi de courriels n'est pas encore configuré sur la plateforme : le code ne vous parviendrait pas. Configurez l'envoi avant d'activer cette protection." });
    let destination;
    if (canal === 'courriel') {
      destination = String(corps.courriel || user.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(destination))
        return json(res, 400, { erreur: 'Adresse email invalide.' });
    } else {
      destination = String(corps.telephone || '').replace(/[^\d+]/g, '');
      if (destination.replace(/\D/g, '').length < 8)
        return json(res, 400, { erreur: 'Numéro WhatsApp invalide.' });
    }
    const { id, code } = creerDefi(user.id, destination, canal);
    await envoyerCodeA2F(canal, destination, user.nom, code);
    return json(res, 200, {
      ok: true, defi: id, canal,
      destination: canal === 'courriel' ? courrielMasque(destination) : telMasque(destination)
    });
  }

  // Confirmation : l'option ne s'active que si le code arrive vraiment
  if (p === '/api/moi/a2f/activer' && req.method === 'POST') {
    if (!user) return json(res, 401, { erreur: 'Non connecté' });
    nettoyerDefis();
    const d = DEFIS_A2F.get(String(corps.defi || ''));
    if (!d || d.userId !== user.id) return json(res, 401, { erreur: 'Code expiré. Recommencez.' });
    d.tentatives++;
    if (d.tentatives > A2F_TENTATIVES_MAX) { DEFIS_A2F.delete(corps.defi); return json(res, 429, { erreur: 'Trop de tentatives.' }); }
    const saisi = String(corps.code || '').replace(/\D/g, '');
    const ok = saisi.length === 6 && crypto.timingSafeEqual(Buffer.from(saisi), Buffer.from(d.code));
    if (!ok) return json(res, 401, { erreur: `Code incorrect. ${A2F_TENTATIVES_MAX - d.tentatives} essai(s) restant(s).` });
    const canal = d.canal || 'whatsapp';
    user.a2f = {
      actif: true, canal,
      telephone: canal === 'whatsapp' ? d.destination : (user.a2f && user.a2f.telephone) || '',
      courriel: canal === 'courriel' ? d.destination : (user.a2f && user.a2f.courriel) || '',
      activeLe: new Date().toISOString()
    };
    DEFIS_A2F.delete(corps.defi); store.save();
    // Avertir du changement : c'est ainsi qu'on repère une prise de contrôle
    const masque = canal === 'courriel' ? courrielMasque(d.destination) : telMasque(d.destination);
    if (user.email) courriel.envoyer(user.email, 'a2f_activee', { nom: user.nom, destination: masque });
    return json(res, 200, { ok: true, canal, destination: masque });
  }

  // Désactivation : le mot de passe est redemandé
  if (p === '/api/moi/a2f/desactiver' && req.method === 'POST') {
    if (!user) return json(res, 401, { erreur: 'Non connecté' });
    if (!(await mdpOutil.verifier(String(corps.motdepasse || ''), user.motdepasse)))
      return json(res, 401, { erreur: 'Mot de passe incorrect.' });
    user.a2f = { actif: false }; store.save();
    return json(res, 200, { ok: true });
  }

  // ---- Mot de passe oublié : demande d'un code ----
  if (p === '/api/mdp/demander' && req.method === 'POST') {
    nettoyerDemandes();
    const email = String(corps.email || '').trim().toLowerCase();
    // Réponse volontairement identique dans tous les cas
    const reponseNeutre = { ok: true, message: "Si un compte existe, un code vient d'être envoyé." };
    if (!email) return json(res, 200, reponseNeutre);
    if (tropDeDemandes(email))
      return json(res, 429, { erreur: 'Trop de demandes. Réessayez dans une heure.' });

    const u = db.users.find((x) => x.email.toLowerCase() === email);
    HISTORIQUE_DEMANDES.push({ email, le: Date.now() });
    if (!u) return json(res, 200, reponseNeutre);

    const c = canalRecuperation(u);
    if (!c) return json(res, 200, reponseNeutre);

    const id = crypto.randomBytes(18).toString('hex');
    const code = codeA2F();
    DEMANDES_MDP.set(id, { userId: u.id, code, tentatives: 0, expireLe: Date.now() + MDP_VALIDITE_MS });
    await envoyerCodeA2F(c.canal, c.destination, u.nom, code);

    return json(res, 200, { ...reponseNeutre, demande: id, canal: c.canal, destination: c.masque });
  }

  // ---- Vérification du code et nouveau mot de passe ----
  if (p === '/api/mdp/reinitialiser' && req.method === 'POST') {
    nettoyerDemandes();
    const d = DEMANDES_MDP.get(String(corps.demande || ''));
    if (!d) return json(res, 401, { erreur: 'Demande expirée. Recommencez.' });
    d.tentatives++;
    if (d.tentatives > MDP_TENTATIVES_MAX) {
      DEMANDES_MDP.delete(corps.demande);
      return json(res, 429, { erreur: 'Trop de tentatives. Recommencez.' });
    }
    const saisi = String(corps.code || '').replace(/\D/g, '');
    const ok = saisi.length === 6 && crypto.timingSafeEqual(Buffer.from(saisi), Buffer.from(d.code));
    if (!ok) return json(res, 401, { erreur: `Code incorrect. ${MDP_TENTATIVES_MAX - d.tentatives} essai(s) restant(s).` });

    const mdp = String(corps.motdepasse || '');
    if (mdp.length < 6) return json(res, 400, { erreur: 'Le mot de passe doit contenir au moins 6 caractères.' });
    if (corps.motdepasse2 !== undefined && mdp !== corps.motdepasse2)
      return json(res, 400, { erreur: 'Les deux mots de passe ne correspondent pas.' });

    const u = db.users.find((x) => x.id === d.userId);
    if (!u) return json(res, 404, { erreur: 'Compte introuvable.' });
    u.motdepasse = await mdpOutil.hacher(mdp);

    /* Toutes les sessions ouvertes sont fermées : si quelqu'un d'autre
       était connecté avec l'ancien mot de passe, il perd l'accès. */
    for (const [jeton, uid] of Object.entries(db.sessions)) {
      if (uid === u.id) delete db.sessions[jeton];
    }
    DEMANDES_MDP.delete(corps.demande);
    store.save();

    // Avertir par email : c'est ainsi qu'on repère un changement non voulu
    if (u.email) courriel.envoyer(u.email, 'mdp_change', { nom: u.nom });
    return json(res, 200, { ok: true });
  }

  if (p === '/api/deconnexion' && req.method === 'POST') {
    const t = cookies(req).rdv_session; if (t) delete db.sessions[t]; store.save();
    res.setHeader('Set-Cookie', 'rdv_session=; Path=/; Max-Age=0');
    return json(res, 200, { ok: true });
  }

  if (p === '/api/moi') {
    if (!user) return json(res, 401, { erreur: 'Non connecté' });
    const e = monEntreprise();
    /* Les messages pré-enregistrés accompagnent l'entreprise : c'est par cette
       route que le tableau de bord la reçoit, et les fiches clients en ont
       besoin dès le premier affichage. */
    return json(res, 200, {
      id: user.id, nom: user.nom, email: user.email, role: user.role,
      entreprise: entreprisePourGestion(e, req)
    });
  }

  // ---- Public : annuaire ----
  // Catalogue des forfaits et durée de la période d'essai
  if (p === '/api/forfaits' && req.method === 'GET') return json(res, 200, forfaits.catalogueForfaits());

  // Référentiel des métiers (vocabulaire, modules, champs)
  if (p === '/api/metiers' && req.method === 'GET') return json(res, 200, metiers.referentiel());

  if (p === '/api/entreprises' && req.method === 'GET') {
    let liste = db.entreprises.filter((e) => e.statut === 'approuvee');
    const cat = q.get('categorie'), recherche = (q.get('q') || '').toLowerCase();
    if (cat && cat !== 'Tout') liste = liste.filter((e) => e.categorie === cat);
    if (q.get('formule') === 'resort') liste = liste.filter((e) => e.formule === 'resort');
    if (q.get('urgence') === '1') liste = liste.filter((e) => e.urgence && e.urgence.actif);
    const met = q.get('metier'), fam = q.get('famille');
    if (met) liste = liste.filter((e) => e.metier === met);
    if (fam) liste = liste.filter((e) => metiers.metierDe(e).famille === fam);
    /* Ville et département filtrent la liste : c'est ainsi qu'un visiteur de
       Saint-Marc ne voit que ce qui est à sa portée. */
    const villeQ = q.get('ville'), deptQ = geo.cleDepartement(q.get('departement'));
    if (villeQ) liste = liste.filter((e) => geo.estDansCommune(e, villeQ));
    if (deptQ) liste = liste.filter((e) => e.departement === deptQ);
    if (recherche) liste = liste.filter((e) => (e.nom + ' ' + e.description + ' ' + e.adresse + ' ' + (e.ville || '') + ' ' + geo.nomDepartement(e.departement) + ' ' + e.categorie).toLowerCase().includes(recherche));
    // Tri par distance si le client partage sa position (?lat=&lng=)
    const lat0 = Number(q.get('lat')), lng0 = Number(q.get('lng'));
    if (Number.isFinite(lat0) && Number.isFinite(lng0)) {
      const sortie = liste.map((e) => {
        const v = publicEntreprise(e);
        v.distanceKm = (e.latitude != null && e.longitude != null)
          ? Math.round(distanceKm(lat0, lng0, e.latitude, e.longitude) * 10) / 10
          : null;
        return v;
      });
      sortie.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
      return json(res, 200, sortie);
    }
    return json(res, 200, liste.map(publicEntreprise));
  }

  const mPub = p.match(/^\/api\/entreprises\/([a-z0-9-]+)$/);
  if (mPub && req.method === 'GET') {
    const e = db.entreprises.find((x) => x.slug === mPub[1] && x.statut === 'approuvee');
    if (!e) return json(res, 404, { erreur: 'Entreprise introuvable' });
    return json(res, 200, {
      ...publicEntreprise(e),
      /* Adresse officielle de la plateforme : un lien partagé ne doit
         jamais dépendre de l'adresse par laquelle le visiteur est arrivé. */
      urlPublique: basePublique(req),
      services: db.services.filter((s) => s.entrepriseId === e.id && s.actif),
      chambres: db.chambres.filter((c) => c.entrepriseId === e.id && c.actif).map((c) => ({ id: c.id, nom: c.nom, description: c.description, prixNuit: c.prixNuit, capacite: c.capacite, quantite: c.quantite, photo: c.photo || '', photos: c.photos || (c.photo ? [c.photo] : []), equipements: c.equipements || [],
                       adultes: c.adultes ?? c.capacite, enfants: c.enfants ?? 0 })),
      carte: db.carte.filter((a) => a.entrepriseId === e.id && a.disponible).map((a) => ({ id: a.id, nom: a.nom, description: a.description, categorie: a.categorie, prix: a.prix, volume: a.volume || '', photo: a.photo || '' })),
      equipementsRef: EQUIPEMENTS,
      /* Comptes sur lesquels l'entreprise accepte d'être payée directement.
         Ce sont des coordonnées qu'elle choisit de publier, rien de secret. */
      comptesPaiement: comptesPublics(e),
      /* La page publique en a besoin pour parler le langage du métier :
         « Réservez », « Prenez rendez-vous » ou « Découvrez ». */
      modulesActifs: metiers.modulesActifs(e),
      reseaux: e.reseaux || [],
      /* Le paiement par versement n'est proposé que par les entreprises qui
         ont une entente validée avec l'organisme et l'ont ouvert. Quels
         produits le portent, chaque produit le dit lui-même. */
      financement: versementDe(e).enService
        ? { url: FINANCEMENT_URL, seuil: versementDe(e).minimum } : null,
      hotel: metiers.aModule(e, 'hotellerie') ? (e.hotel || {}) : null,
      tarifs: metiers.aModule(e, 'hotellerie')
        ? db.tarifs.filter((x) => x.entrepriseId === e.id && x.actif)
            .map((x) => ({ id: x.id, nom: x.nom, description: x.description, chambreId: x.chambreId,
                           prixNuit: x.prixNuit, remboursable: x.remboursable, petitDejeuner: x.petitDejeuner }))
        : [],
      inclusRef: INCLUS,
      produits: metiers.aModule(e, 'catalogue')
        /* Un produit épuisé reste visible, signalé « Fini » : le client
           voit que la boutique le vend, et reviendra. Il est seulement
           impossible à commander, ce que la commande vérifie de son côté. */
        ? db.produits.filter((x) => x.entrepriseId === e.id && x.disponible)
            .map((x) => Object.assign({
                           id: x.id, nom: x.nom, description: x.description, rayon: x.rayon, marque: x.marque,
                           prix: x.prix, prixPromo: x.prixPromo, unite: x.unite, photo: x.photo || '',
                           photos: x.photos || (x.photo ? [x.photo] : []), video: x.video || '' },
                           etatProduit(e, x)))
        : [],
      // Produit vers lequel mène un clic sur l'affiche de la bannière
      produitVedette: e.produitVedette || '',
      vente: metiers.aModule(e, 'commandes') && forfaits.forfaitAutorise(e, 'commandes')
        && e.vente && e.vente.commandesActives ? {
        cueillette: !!e.vente.cueillette, livraison: !!e.vente.livraison,
        zones: e.vente.zones || [], fraisBase: e.vente.fraisBase || 0,
        seuilGratuite: e.vente.seuilGratuite || 0, minimumCommande: e.vente.minimumCommande || 0,
        horairesCueillette: e.vente.horairesCueillette || '', delaiPreparation: e.vente.delaiPreparation || '',
        paiementEnLigne: e.vente.paiementEnLigne !== false, paiementRemise: e.vente.paiementRemise !== false,
        paiementDirect: !!e.vente.paiementDirect && (e.comptesPaiement || []).some((c) => c.actif),
        methodesEnLigne: Array.isArray(e.vente.methodesEnLigne) ? e.vente.methodesEnLigne : [],
        /* Nom du prestataire réellement employé, pour que le bouton dise
           « Payer par … » au lieu d'une formule creuse. */
        passerelleNom: (() => {
          const g = e.passerelle;
          const cle = (g && g.actif && g.fournisseur) ? g.fournisseur : '';
          const f = cle ? passerelles.FOURNISSEURS[cle] : null;
          return f ? f.nom : '';
        })(),
        /* Le client doit savoir si son règlement sera confirmé tout seul ou
           vérifié à la main : le dire évite de laisser croire à une
           confirmation immédiate qui ne viendra pas. */
        paiementManuel: !passerelles.estAutomatique(((e.passerelle && e.passerelle.actif)
          ? e.passerelle.fournisseur : 'plop') || 'plop'),
        consigne: e.vente.consigne || ''
      } : null,
      capacitesRef: metiers.CAPACITES_URGENCE,
      etatsRef: metiers.ETATS_URGENCE,
      programmes: db.programmes.filter((x) => x.entrepriseId === e.id && x.ouvert).map((x) => ({
        id: x.id, nom: x.nom, description: x.description, anneeScolaire: x.anneeScolaire,
        fraisInscription: x.fraisInscription, scolarite: x.scolarite, periodicite: x.periodicite,
        documents: x.documents || [],
        placesRestantes: x.places > 0
          ? Math.max(0, x.places - db.inscriptions.filter((i) => i.programmeId === x.id && i.statut === 'inscrit').length)
          : null
      })),
      employes: db.employes.filter((x) => x.entrepriseId === e.id && x.actif).map((x) => ({ nom: x.nom, poste: x.poste })),
      avis: db.avis.filter((a) => a.entrepriseId === e.id).slice(0, 20)
    });
  }

  // Disponibilité d'une chambre sur une période + prix total
  if (p === '/api/disponibilites-sejour' && req.method === 'GET') {
    const e = db.entreprises.find((x) => x.slug === q.get('slug') && x.statut === 'approuvee');
    const c = e && db.chambres.find((x) => x.id === q.get('chambre') && x.entrepriseId === e.id && x.actif);
    if (!c) return json(res, 404, { erreur: 'Chambre introuvable' });
    const arrivee = q.get('arrivee'), depart = q.get('depart');
    const errPeriode = validerPeriode(arrivee, depart);
    if (errPeriode) return json(res, 400, { erreur: errPeriode });
    const errRegle = verifierRegles(e, arrivee, depart);
    if (errRegle) return json(res, 400, { erreur: errRegle });
    const restantes = chambresRestantes(c, arrivee, depart);
    const plan = q.get('plan') ? db.tarifs.find((x) => x.id === q.get('plan') && x.entrepriseId === e.id && x.actif) : null;
    const devis = devisSejour(e, c, plan, arrivee, depart);
    return json(res, 200, Object.assign({ disponible: restantes > 0, restantes, prixNuit: devis.base, prixTotal: devis.total }, devis));
  }

  // ---- Paiement d'une réservation ----
  if (p === '/api/paiements/ouvrir' && req.method === 'POST') {
    const { commandeType, slug } = corps;
    let { commandeId } = corps;
    if (!['rdv', 'sejour', 'commande'].includes(commandeType)) return json(res, 400, { erreur: 'Type de commande invalide' });
    const e = db.entreprises.find((x) => x.slug === slug && x.statut === 'approuvee');
    if (!e) return json(res, 404, { erreur: 'Entreprise introuvable' });
    
    let montant = 0, clientNom = '', clientEmail = '';
    if (commandeType === 'rdv') {
      const r = db.rendezvous.find((x) => x.id === commandeId && x.entrepriseId === e.id);
      if (!r) return json(res, 404, { erreur: 'Rendez-vous introuvable' });
      const s = db.services.find((x) => x.id === r.serviceId);
      montant = s ? s.prix : 0;
      clientNom = r.clientNom; clientEmail = r.clientEmail;
    } else if (commandeType === 'sejour') {
      const s = db.sejours.find((x) => x.id === commandeId && x.entrepriseId === e.id);
      if (!s) return json(res, 404, { erreur: 'Séjour introuvable' });
      if (s.statut === 'annule') return json(res, 409, { erreur: 'Ce séjour a été annulé.' });
      if (s.paye) return json(res, 409, { erreur: 'Ce séjour est déjà payé.' });
      /* On encaisse ce qui a été annoncé au client : l'acompte quand
         l'établissement en demande un, le total sinon. Prélever le total
         après avoir affiché « Acompte à régler » serait une surprise. */
      montant = s.acompte > 0 ? s.acompte : s.prixTotal;
      clientNom = s.clientNom; clientEmail = s.clientEmail;
    } else {
      // Commande boutique : on paie le total, frais de remise compris
      const c = db.commandes.find((x) => (x.id === commandeId || x.reference === commandeId) && x.entrepriseId === e.id);
      if (!c) return json(res, 404, { erreur: 'Commande introuvable' });
      if (c.paye) return json(res, 409, { erreur: 'Cette commande est déjà payée.' });
      if (c.statut === 'annulee') return json(res, 409, { erreur: 'Cette commande a été annulée.' });
      montant = c.total;
      clientNom = c.clientNom; clientEmail = c.clientEmail || '';
      commandeId = c.id;
    }
    
    if (montant < plopplop.PLOP.montantMinHTG) return json(res, 400, { erreur: `Montant minimum : ${plopplop.PLOP.montantMinHTG} HTG` });
    
    const pg = passerelleDe(e);
    /* Moyens acceptés par l'entreprise : « all » laisse le client choisir
       sur la passerelle, une liste d'un seul élément n'y propose que lui. */
    const choisis = (e.vente && Array.isArray(e.vente.methodesEnLigne)) ? e.vente.methodesEnLigne : [];
    const methodeChoisie = (choisis.length === 1) ? choisis[0] : 'all';
    const paiement = creerPaiement(e.id, commandeType, commandeId, montant, methodeChoisie, clientEmail, clientNom, pg.propre);
    paiement.fournisseur = pg.fournisseur;
    paiement.manuel = !!pg.manuel;
    try {
      const result = await passerelles.initier(pg.fournisseur, {
        reference: paiement.reference, montant, methode: methodeChoisie,
        ids: pg.ids, hote: pg.hote
      });
      if (result.ok) {
        paiement.transactionId = result.transactionId;
        paiement.urlPaiement = result.urlPaiement;
        if (result.manuel) paiement.manuel = true;
        store.save();
        /* `urlInterne` garde le client chez Konekte : la passerelle s'ouvre
           dans une carte de notre page, et nous savons donc quand le
           règlement aboutit, au lieu de l'abandonner sur un site tiers. */
        return json(res, 200, {
          ok: true, paiementId: paiement.id, urlPaiement: result.urlPaiement,
          urlInterne: `/paiement.html?p=${encodeURIComponent(paiement.id)}`,
          montant, reference: paiement.reference
        });
      } else {
        db.paiements = db.paiements.filter((x) => x !== paiement);
        return json(res, 402, { erreur: result.error || 'La passerelle a refusé la transaction.' });
      }
    } catch (err) {
      db.paiements = db.paiements.filter((x) => x !== paiement);
      return json(res, 503, { erreur: 'Passerelle de paiement indisponible. Réessayez ultérieurement.' });
    }
  }

  /* ---- État d'un paiement, sans interroger la passerelle ----
     La page de règlement s'en sert pour s'afficher : montant, boutique,
     adresse de la passerelle. Elle ne révèle rien qu'un client n'ait déjà
     saisi lui-même, et ne permet aucune action. */
  if (p === '/api/paiements/etat' && req.method === 'GET') {
    const paiement = db.paiements.find((x) => x.id === q.get('p'));
    if (!paiement) return json(res, 404, { erreur: 'Paiement introuvable' });
    const ent = db.entreprises.find((x) => x.id === paiement.entrepriseId);
    return json(res, 200, {
      id: paiement.id, reference: paiement.reference, statut: paiement.statut,
      montant: paiement.montantBrut, commandeType: paiement.commandeType,
      urlPaiement: paiement.urlPaiement || '',
      /* Règlement qui se confirme à la main : la page doit le dire au lieu
         de faire tourner une attente qui n'aboutira jamais toute seule. */
      manuel: !!paiement.manuel,
      consigne: (() => {
        const g = ent && ent.passerelle;
        return (g && g.actif && g.fournisseur === 'lien' && g.identifiants) ? (g.identifiants.consigne || '') : '';
      })(),
      /* Ce que l'entreprise a réellement mis en place. La page de règlement
         n'invente plus de passerelle intégrée : elle montre ces moyens-là,
         avec leurs vrais noms et leurs vraies coordonnées. */
      passerelleNom: (() => {
        const g = ent && ent.passerelle;
        const cle = (g && g.actif && g.fournisseur) ? g.fournisseur : 'plop';
        const f = passerelles.FOURNISSEURS[cle];
        return f ? f.nom : 'Paiement en ligne';
      })(),
      comptes: comptesPublics(ent),
      entreprise: ent ? { nom: ent.nom, slug: ent.slug, couleur: ent.couleur } : null
    });
  }

  // ---- Vérifier un paiement ----
  if (p === '/api/paiements/verifier' && req.method === 'POST') {
    const { paiementId } = corps;
    /* La référence est acceptée en plus de l'identifiant : c'est elle que
       porte la page de retour quand le client revient de la passerelle. */
    const paiement = db.paiements.find((x) => x.id === paiementId)
      || (corps.reference ? db.paiements.find((x) => x.reference === corps.reference) : null);
    if (!paiement) return json(res, 404, { erreur: 'Paiement introuvable' });
    /* Déjà encaissé : on répond sans redemander à la passerelle, sinon un
       rechargement de page créditerait le portefeuille une seconde fois. */
    if (paiement.statut === 'confirme')
      return json(res, 200, { ok: true, statut: 'confirme', montantNet: paiement.montantNet, deja: true });

    /* Un règlement qui se confirme à la main ne s'interroge pas : c'est
       l'entreprise qui constatera la réception sur son propre compte. */
    if (paiement.manuel)
      return json(res, 402, { ok: false, statut: 'en_attente',
        erreur: 'Ce moyen de paiement se confirme à la main. Le commerçant validera votre règlement après vérification.' });

    try {
      const entV = db.entreprises.find((x) => x.id === paiement.entrepriseId);
      const pgv = passerelleDe(entV);
      const verification = await passerelles.verifier(paiement.fournisseur || pgv.fournisseur, {
        reference: paiement.reference, ids: pgv.ids, hote: pgv.hote });
      if (verification.ok && verification.paye) {
        appliquerPaiementConfirme(paiement, verification.infos);
        store.save();
        return json(res, 200, { ok: true, statut: 'confirme', montantNet: paiement.montantNet });
      } else {
        return json(res, 402, { ok: false, statut: 'en_attente',
          erreur: verification.message || verification.error || 'Paiement non encore confirmé.' });
      }
    } catch (err) {
      return json(res, 503, { erreur: 'Vérification impossible. Réessayez ultérieurement.' });
    }
  }
  if (p === '/api/sejours' && req.method === 'POST') {
    const e = db.entreprises.find((x) => x.slug === corps.slug && x.statut === 'approuvee');
    const c = e && db.chambres.find((x) => x.id === corps.chambreId && x.entrepriseId === e.id && x.actif);
    if (!c) return json(res, 404, { erreur: 'Chambre introuvable' });
    if (!corps.clientNom || !corps.clientTel) return json(res, 400, { erreur: 'Nom et téléphone obligatoires.' });
    const errPeriode = validerPeriode(corps.arrivee, corps.depart);
    if (errPeriode) return json(res, 400, { erreur: errPeriode });
    if (chambresRestantes(c, corps.arrivee, corps.depart) < 1)
      return json(res, 409, { erreur: 'Cette chambre est complète sur ces dates. Essayez d\'autres dates ou un autre type de chambre.' });
    // La capacité est refusée, pas rabotée en silence : le client doit savoir
    // que sa réservation ne couvre pas tout son groupe.
    const demandes = Math.max(1, +corps.nbPersonnes || 1);
    if (c.capacite && demandes > c.capacite)
      return json(res, 400, { erreur: `Cette chambre accueille ${c.capacite} personne${c.capacite > 1 ? 's' : ''} au maximum. Choisissez un autre type de chambre.` });
    const errRegle = verifierRegles(e, corps.arrivee, corps.depart);
    if (errRegle) return json(res, 400, { erreur: errRegle });
    const plan = corps.planId ? db.tarifs.find((x) => x.id === corps.planId && x.entrepriseId === e.id && x.actif) : null;
    const devis = devisSejour(e, c, plan, corps.arrivee, corps.depart);
    const nuits = devis.nuits;
    const sejour = {
      id: store.uid(), entrepriseId: e.id, chambreId: c.id,
      clientNom: String(corps.clientNom).slice(0, 80), clientTel: String(corps.clientTel).slice(0, 20),
      clientEmail: String(corps.clientEmail || '').slice(0, 120),
      arrivee: corps.arrivee, depart: corps.depart, nuits,
      nbPersonnes: demandes,
      planId: plan ? plan.id : '', planNom: plan ? plan.nom : '',
      sousTotal: devis.sousTotal, taxes: devis.taxes, totalTaxes: devis.totalTaxes,
      acompte: devis.acompte, detailNuits: devis.detail,
      prixTotal: devis.total, statut: 'en_attente', creeLe: new Date().toISOString()
    };
    db.sejours.push(sejour);
    notifier(e.id, 'nouveau_sejour', `Nouveau séjour : ${sejour.clientNom} — ${c.nom}, du ${sejour.arrivee} au ${sejour.depart} (${nuits} nuit${nuits > 1 ? 's' : ''})`);
    courrielClient(sejour.clientEmail, 'sejour_recu', {
      nom: sejour.clientNom, entreprise: e.nom, chambre: c.nom,
      arrivee: sejour.arrivee, depart: sejour.depart, nuits: sejour.nuits,
      total: sejour.prixTotal, acompte: sejour.acompte, couleur: e.couleur
    });
    /* Le total ET l'acompte sont renvoyés sous le nom qu'ils portent dans la
       fiche. La page annonce ainsi au client le montant exact qui lui sera
       demandé — l'acompte quand il y en a un, le total sinon — au lieu de
       deviner une somme qu'elle n'a pas. */
    return json(res, 200, {
      ok: true, reference: sejour.id, prix: sejour.prixTotal,
      prixTotal: sejour.prixTotal, acompte: sejour.acompte || 0,
      aPayer: sejour.acompte > 0 ? sejour.acompte : sejour.prixTotal
    });
  }

  // ---- Créneaux disponibles (client) ----
  if (p === '/api/disponibilites' && req.method === 'GET') {
    const e = db.entreprises.find((x) => x.slug === q.get('slug'));
    const s = e && db.services.find((x) => x.id === q.get('service') && x.entrepriseId === e.id);
    if (!e || !s || !q.get('date')) return json(res, 400, { erreur: 'Paramètres invalides' });
    return json(res, 200, { creneaux: creneauxDisponibles(e, s, q.get('date')) });
  }

  // ---- Réservation d'un rendez-vous (client) ----
  if (p === '/api/reservations' && req.method === 'POST') {
    const e = db.entreprises.find((x) => x.slug === corps.slug && x.statut === 'approuvee');
    const s = e && db.services.find((x) => x.id === corps.serviceId && x.entrepriseId === e.id);
    if (!e || !s) return json(res, 400, { erreur: 'Entreprise ou service invalide.' });
    if (!corps.clientNom || !corps.clientTel || !corps.date || !corps.heure)
      return json(res, 400, { erreur: 'Nom, téléphone, date et heure sont obligatoires.' });
    if (!creneauxDisponibles(e, s, corps.date).includes(corps.heure))
      return json(res, 409, { erreur: "Ce créneau n'est plus disponible. Choisissez-en un autre." });
    const rdv = { id: store.uid(), entrepriseId: e.id, serviceId: s.id, clientNom: corps.clientNom, clientTel: corps.clientTel, clientEmail: corps.clientEmail || '', date: corps.date, heure: corps.heure, statut: 'en_attente', paye: false, prixTotal: s.prix || 0, creeLe: new Date().toISOString() };
    db.rendezvous.push(rdv);
    store.save();
    notifier(e.id, 'nouveau_rdv', `Nouveau rendez-vous : ${rdv.clientNom} — ${s.nom} le ${rdv.date} à ${rdv.heure}`);
    // Notification WhatsApp uniquement (les emails clients ont été retirés)
    courrielClient(rdv.clientEmail, 'rdv_recu', {
      nom: rdv.clientNom, entreprise: e.nom, service: s.nom,
      date: rdv.date, heure: rdv.heure, adresse: e.adresse || '',
      lien: `${basePublique(req)}/${e.slug}`, couleur: e.couleur
    });
    return json(res, 200, { ok: true, reference: rdv.id, entreprise: e.nom, service: s.nom, date: rdv.date, heure: rdv.heure, whatsapp: e.whatsapp });
  }

  // ---- Boutique en ligne : catalogue commun à tous les vendeurs ----
  if (p === '/api/boutique' && req.method === 'GET') {
    const recherche = (q.get('q') || '').toLowerCase().trim();
    const rayon = q.get('rayon') || '';
    const ville = (q.get('ville') || '').toLowerCase().trim();
    const tri = q.get('tri') || '';
    const lat0 = Number(q.get('lat')), lng0 = Number(q.get('lng'));

    const vendeurs = db.entreprises.filter((e) => e.statut === 'approuvee' && metiers.aModule(e, 'catalogue'));
    let articles = [];
    for (const e of vendeurs) {
      /* La ville déclarée fait foi ; l'adresse écrite sert de secours pour
         les entreprises inscrites avant que le champ existe. */
      if (ville && !geo.estDansCommune(e, ville)
          && !String(e.adresse || '').toLowerCase().includes(ville)) continue;
      const v = e.vente || {};
      const peutCommander = metiers.aModule(e, 'commandes') && !!v.commandesActives
        && forfaits.forfaitAutorise(e, 'commandes');
      const distance = (Number.isFinite(lat0) && Number.isFinite(lng0) && e.latitude != null && e.longitude != null)
        ? Math.round(distanceKm(lat0, lng0, e.latitude, e.longitude) * 10) / 10 : null;
      for (const pr of db.produits) {
        if (pr.entrepriseId !== e.id || !pr.disponible) continue;
        // Épuisé : visible mais signalé, et placé en fin de liste plus bas
        if (rayon && pr.rayon !== rayon) continue;
        if (recherche && !(`${pr.nom} ${pr.description} ${pr.marque} ${pr.rayon}`.toLowerCase().includes(recherche))) continue;
        articles.push(Object.assign({
          id: pr.id, nom: pr.nom, description: pr.description, rayon: pr.rayon, marque: pr.marque,
          prix: pr.prix, prixPromo: pr.prixPromo, unite: pr.unite, photo: pr.photo || ''
        }, etatProduit(e, pr), {
          vendeur: {
            slug: e.slug, nom: e.nom, adresse: e.adresse || '', whatsapp: e.whatsapp || '',
            ville: e.ville || '', departement: geo.nomDepartement(e.departement),
            telephone: e.telephone || '', logoTexte: e.logoTexte || '', couleur: e.couleur || '#2563EB',
            distanceKm: distance,
            // Ce que l'acheteur peut faire chez ce vendeur
            commande: peutCommander,
            cueillette: peutCommander && !!v.cueillette,
            livraison: peutCommander && !!v.livraison
          }
        }));
      }
    }
    const prixDe = (a) => (a.prixPromo > 0 ? a.prixPromo : a.prix);
    if (tri === 'prix') articles.sort((a, b) => prixDe(a) - prixDe(b));
    else if (tri === 'prix_desc') articles.sort((a, b) => prixDe(b) - prixDe(a));
    else if (tri === 'proche') articles.sort((a, b) => (a.vendeur.distanceKm ?? 1e9) - (b.vendeur.distanceKm ?? 1e9));
    else articles.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    /* L'acheteur voit d'abord ce qu'il peut emporter aujourd'hui, puis
       ce qui arrive, puis ce qui est fini — quel que soit le tri choisi. */
    const rang = { disponible: 0, bientot: 1, fini: 2 };
    articles.sort((a, b) => (rang[a.etat] ?? 0) - (rang[b.etat] ?? 0));

    const rayons = [...new Set(articles.map((a) => a.rayon).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    return json(res, 200, {
      articles: articles.slice(0, 300),
      total: articles.length,
      rayons,
      vendeurs: vendeurs.length
    });
  }

  // ---- Passer une commande (public, sans compte) ----
  if (p === '/api/commandes' && req.method === 'POST') {
    const e = db.entreprises.find((x) => x.slug === corps.slug && x.statut === 'approuvee');
    if (!e || !metiers.aModule(e, 'commandes')) return json(res, 400, { erreur: 'Cette boutique ne prend pas de commande en ligne.' });
    const v = e.vente || {};
    if (!v.commandesActives) return json(res, 400, { erreur: 'Cette boutique ne prend pas de commande en ligne pour le moment.' });
    if (!Array.isArray(corps.lignes) || !corps.lignes.length) return json(res, 400, { erreur: 'Votre panier est vide.' });
    if (!corps.clientNom || !corps.clientTel) return json(res, 400, { erreur: 'Nom et téléphone obligatoires.' });

    const mode = corps.mode === 'livraison' ? 'livraison' : 'cueillette';
    if (mode === 'livraison' && !v.livraison) return json(res, 400, { erreur: 'La livraison n\'est pas proposée.' });
    if (mode === 'cueillette' && !v.cueillette) return json(res, 400, { erreur: 'Le retrait sur place n\'est pas proposé.' });
    // Service en chambre : le numéro remplace l'adresse
    if (corps.surPlace && !String(corps.numeroChambre || '').trim())
      return json(res, 400, { erreur: 'Indiquez votre numéro de chambre.' });
    if (mode === 'livraison' && !corps.surPlace && !corps.adresse)
      return json(res, 400, { erreur: 'Indiquez l\'adresse de livraison.' });

    // Les prix et le stock sont revérifiés ici : ceux envoyés par le
    // navigateur ne sont jamais utilisés pour le calcul.
    const lignes = [];
    for (const l of corps.lignes.slice(0, 60)) {
      const pr = db.produits.find((x) => x.id === l.produitId && x.entrepriseId === e.id && x.disponible);
      if (!pr) return json(res, 409, { erreur: 'Un produit de votre panier n\'est plus disponible.' });
      const q = Math.max(1, Math.min(+l.quantite || 1, 999));
      const et = etatProduit(e, pr);
      /* Un produit à venir ou fini n'entre dans le panier que s'il est
         ouvert à la précommande, et le stock n'est alors pas opposable :
         c'est tout l'objet d'une précommande. */
      if (et.etat !== 'disponible') {
        if (!et.precommandable)
          return json(res, 409, { erreur: `${pr.nom} n'est pas disponible actuellement.` });
      } else if (pr.stock !== null && pr.stock < q) {
        return json(res, 409, { erreur: `Stock insuffisant pour ${pr.nom} (${pr.stock} restant${pr.stock > 1 ? 's' : ''}).` });
      }
      const unitaire = pr.prixPromo > 0 ? pr.prixPromo : pr.prix;
      lignes.push({ produitId: pr.id, nom: pr.nom, unite: pr.unite || '', quantite: q,
                    prixUnitaire: unitaire, total: unitaire * q,
                    precommande: et.etat !== 'disponible',
                    dateDispo: et.etat !== 'disponible' ? et.dateDispo : '' });
    }
    /* Une commande qui contient au moins une précommande en est une :
       le délai annoncé n'est pas celui d'une commande ordinaire. */
    const estPrecommande = lignes.some((l) => l.precommande);
    const dateDispoMax = lignes.map((l) => l.dateDispo).filter(Boolean).sort().pop() || '';
    const sousTotal = lignes.reduce((s, l) => s + l.total, 0);
    if (v.minimumCommande && sousTotal < v.minimumCommande)
      return json(res, 400, { erreur: `Commande minimum : ${v.minimumCommande.toLocaleString('fr-HT')} HTG.` });

    // Frais de livraison : zone choisie, sinon frais de base ; gratuit au-delà du seuil
    let frais = 0, zoneNom = '';
    if (mode === 'livraison' && !corps.surPlace) {
      const zone = (v.zones || []).find((z) => z.nom === corps.zone);
      frais = zone ? zone.frais : (v.fraisBase || 0);
      zoneNom = zone ? zone.nom : '';
      if (v.seuilGratuite && sousTotal >= v.seuilGratuite) frais = 0;
    }

    const modePaie = ['enligne', 'direct'].includes(corps.paiement) ? corps.paiement : 'remise';
    if (modePaie === 'enligne' && v.paiementEnLigne === false)
      return json(res, 400, { erreur: 'Le paiement en ligne n\'est pas proposé par cette boutique.' });
    if (modePaie === 'remise' && v.paiementRemise === false)
      return json(res, 400, { erreur: 'Cette boutique demande le paiement en ligne.' });
    /* Virement annoncé sur un compte de l'entreprise : on vérifie que le
       compte existe bien chez elle, et on garde la référence donnée par le
       client. Rien n'est encaissé ici — c'est l'entreprise qui confirmera
       avoir reçu l'argent sur son propre compte. */
    let versement = null;
    if (modePaie === 'direct') {
      const dispo = comptesPublics(e);
      if (!dispo.length) return json(res, 400, { erreur: 'Cette boutique ne propose pas le paiement direct.' });
      const compte = dispo.find((c) => c.id === String(corps.compteId || '')) || dispo[0];
      const refVers = String(corps.referenceVersement || '').trim().slice(0, 60);
      if (!refVers) return json(res, 400, { erreur: 'Indiquez la référence de votre transaction.' });
      versement = {
        compteId: compte.id, compteType: compte.type, compteLibelle: compte.libelle,
        compteNumero: compte.numero,
        reference: refVers,
        nomPayeur: String(corps.nomPayeur || corps.clientNom || '').trim().slice(0, 80),
        declareLe: new Date().toISOString(), verifie: false
      };
    }

    const maintenant = new Date().toISOString();
    const cmd = {
      id: store.uid(), entrepriseId: e.id,
      reference: 'C' + Date.now().toString(36).toUpperCase().slice(-6),
      lignes, sousTotal, frais, total: sousTotal + frais,
      mode, zone: zoneNom,
      // Commande passée depuis une chambre de l'hôtel : le service sait où livrer
      surPlace: !!corps.surPlace,
      numeroChambre: String(corps.numeroChambre || '').slice(0, 20),
      adresse: corps.surPlace ? '' : (mode === 'livraison' ? String(corps.adresse).slice(0, 200) : ''),
      repere: String(corps.repere || '').slice(0, 140),
      creneau: String(corps.creneau || '').slice(0, 60),
      clientNom: String(corps.clientNom).slice(0, 90),
      clientTel: String(corps.clientTel).slice(0, 20),
      /* L'adresse sert à envoyer le suivi de commande et à retrouver son
         espace client. Facultative : un client sans adresse commande quand
         même, et garde sa référence à l'écran. */
      clientEmail: String(corps.clientEmail || '').trim().toLowerCase().slice(0, 120),
      message: String(corps.message || '').slice(0, 300),
      paiement: modePaie, versement,
      paye: false, transactionId: null,
      precommande: estPrecommande, dateDispo: dateDispoMax,
      statut: 'nouvelle', stockDecompte: false, noteInterne: '',
      journal: [{ le: maintenant, texte: estPrecommande ? 'Précommande reçue' : 'Commande reçue' }],
      creeLe: maintenant, majLe: maintenant
    };
    db.commandes.push(cmd); store.save();
    notifier(e.id, 'nouvelle_commande',
      `${estPrecommande ? 'Précommande' : 'Commande'} ${cmd.reference} — ${cmd.total.toLocaleString('fr-HT')} HTG (${mode})`);
    /* Un virement annoncé demande une vérification humaine : l'entreprise
       doit regarder son compte avant de préparer la commande. */
    if (versement) notifier(e.id, 'commande',
      `Virement annoncé sur votre ${versement.compteLibelle} — ${cmd.reference}, ${cmd.total.toLocaleString('fr-HT')} HTG, référence ${versement.reference}. À vérifier sur votre compte.`);
    courrielClient(cmd.clientEmail, 'commande_recue', {
      nom: cmd.clientNom, entreprise: e.nom, reference: cmd.reference, total: cmd.total,
      mode: cmd.surPlace ? ('Service en chambre ' + cmd.numeroChambre)
                         : (mode === 'livraison' ? 'Livraison' : 'Retrait sur place'),
      delai: mode === 'livraison' ? (v.delaiPreparation || '') : (v.horairesCueillette || ''),
      precommande: estPrecommande, dateDispo: dateDispoMax,
      lienSuivi: lienAchats(req, cmd.clientEmail), couleur: e.couleur
    });
    return json(res, 200, {
      ok: true, reference: cmd.reference, sousTotal, frais, total: cmd.total,
      mode, paiement: modePaie, commandeId: cmd.id, boutique: e.nom, whatsapp: e.whatsapp,
      precommande: estPrecommande, dateDispo: dateDispoMax,
      delai: mode === 'livraison' ? (v.delaiPreparation || '') : (v.horairesCueillette || '')
    });
  }

  // ---- Suivi public d'une commande ----
  if (p === '/api/commandes/suivi' && req.method === 'POST') {
    const e = db.entreprises.find((x) => x.slug === corps.slug && x.statut === 'approuvee');
    if (!e) return json(res, 400, { erreur: 'Boutique invalide.' });
    const ref = String(corps.reference || '').trim().toUpperCase();
    const tel = String(corps.telephone || '').replace(/\D/g, '').slice(-8);
    const c = db.commandes.find((x) => x.entrepriseId === e.id && x.reference === ref
      && String(x.clientTel).replace(/\D/g, '').slice(-8) === tel);
    if (!c) return json(res, 404, { erreur: 'Aucune commande ne correspond à ces informations.' });
    const etapes = etapesCommande(c.mode);
    const st = STATUTS_COMMANDE.find((s) => s.cle === c.statut);
    return json(res, 200, {
      reference: c.reference, statut: c.statut, statutLib: st ? st.fr : c.statut,
      etapes: etapes.map((k) => { const s = STATUTS_COMMANDE.find((x) => x.cle === k); return { cle: k, fr: s.fr, ht: s.ht }; }),
      etapeIndex: etapes.indexOf(c.statut),
      mode: c.mode, lignes: c.lignes, sousTotal: c.sousTotal, frais: c.frais, total: c.total,
      adresse: c.adresse, surPlace: !!c.surPlace, numeroChambre: c.numeroChambre || '',
      precommande: !!c.precommande, dateDispo: c.dateDispo || '',
      creneau: c.creneau, paye: !!c.paye, paiement: c.paiement || 'remise',
      passeeLe: c.creeLe.slice(0, 10), majLe: c.majLe.slice(0, 10)
    });
  }

  // ---- Suivi public d'un dossier (référence + téléphone) ----
  if (p === '/api/dossiers/suivi' && req.method === 'POST') {
    const e = db.entreprises.find((x) => x.slug === corps.slug && x.statut === 'approuvee');
    if (!e || !metiers.aModule(e, 'dossiers')) return json(res, 400, { erreur: 'Établissement invalide.' });
    const ref = String(corps.reference || '').trim().toUpperCase();
    const tel = String(corps.telephone || '').replace(/\D/g, '').slice(-8);
    if (!ref || !tel) return json(res, 400, { erreur: 'Référence et téléphone obligatoires.' });
    const d = db.dossiers.find((x) => x.entrepriseId === e.id && x.reference === ref
      && String(x.clientTel).replace(/\D/g, '').slice(-8) === tel);
    // Message identique en cas d'échec, pour ne pas révéler l'existence d'une référence
    if (!d) return json(res, 404, { erreur: 'Aucun dossier ne correspond à ces informations.' });
    const etapes = metiers.etapesDe(e.metier);
    const idx = etapes.findIndex((x) => x.cle === d.etape);
    const st = metiers.STATUTS_DOSSIER.find((x) => x.cle === d.statut);
    // Vue restreinte : ni honoraires, ni notes internes
    return json(res, 200, {
      reference: d.reference, objet: d.objet, clientNom: d.clientNom,
      statut: d.statut, statutLib: st ? st.fr : d.statut,
      etape: d.etape, etapeIndex: idx, etapes: etapes.map((x) => ({ cle: x.cle, fr: x.fr, ht: x.ht })),
      pieces: d.pieces, echeance: d.echeance,
      ouvertLe: d.creeLe.slice(0, 10), majLe: d.majLe.slice(0, 10)
    });
  }

  // ---- Demande d'inscription scolaire (public, sans compte) ----
  if (p === '/api/inscriptions' && req.method === 'POST') {
    const e = db.entreprises.find((x) => x.slug === corps.slug && x.statut === 'approuvee');
    if (!e || !metiers.aModule(e, 'inscriptions')) return json(res, 400, { erreur: 'Établissement invalide.' });
    const pr = db.programmes.find((x) => x.id === corps.programmeId && x.entrepriseId === e.id && x.ouvert);
    if (!pr) return json(res, 400, { erreur: 'Programme indisponible ou fermé aux inscriptions.' });
    if (!corps.eleveNom || !corps.parentNom || !corps.parentTel)
      return json(res, 400, { erreur: "Nom de l'élève, nom et téléphone du responsable sont obligatoires." });
    if (pr.places > 0) {
      const pris = db.inscriptions.filter((x) => x.programmeId === pr.id && x.statut === 'inscrit').length;
      if (pris >= pr.places) return json(res, 409, { erreur: 'Toutes les places de ce programme sont prises.' });
    }
    const ins = {
      id: store.uid(), entrepriseId: e.id, programmeId: pr.id,
      eleveNom: String(corps.eleveNom).slice(0, 90),
      eleveNaissance: String(corps.eleveNaissance || '').slice(0, 10),
      eleveSexe: ['F', 'M'].includes(corps.eleveSexe) ? corps.eleveSexe : '',
      ecoleProvenance: String(corps.ecoleProvenance || '').slice(0, 90),
      parentNom: String(corps.parentNom).slice(0, 90),
      parentLien: String(corps.parentLien || '').slice(0, 40),
      parentTel: String(corps.parentTel).slice(0, 20),
      parentEmail: String(corps.parentEmail || '').slice(0, 90),
      message: String(corps.message || '').slice(0, 400),
      statut: 'en_attente', note: '', creeLe: new Date().toISOString()
    };
    db.inscriptions.push(ins); store.save();
    notifier(e.id, 'nouvelle_inscription', `Demande d'inscription : ${ins.eleveNom} — ${pr.nom}`);
    courrielClient(ins.parentEmail, 'inscription_recue', {
      nom: ins.parentNom, entreprise: e.nom, eleve: ins.eleveNom,
      programme: pr.nom, frais: pr.fraisInscription, couleur: e.couleur
    });
    return json(res, 200, { ok: true, reference: ins.id, etablissement: e.nom, programme: pr.nom,
                            fraisInscription: pr.fraisInscription, whatsapp: e.whatsapp });
  }

  // ---- Sauvegarde et restauration (administrateur) ----
  // Indispensable avant un changement d'hébergement : le dossier de
  // l'application est effacé à chaque déploiement.
  if (p === '/api/admin/sauvegarde' && req.method === 'GET') {
    if (!user || user.role !== 'admin') return json(res, 403, { erreur: 'Accès refusé' });
    const nom = 'konekte-' + new Date().toISOString().slice(0, 10) + '.json';
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nom}"`
    });
    return res.end(JSON.stringify(db, null, 2));
  }

  if (p === '/api/admin/restaurer' && req.method === 'POST') {
    if (!user || user.role !== 'admin') return json(res, 403, { erreur: 'Accès refusé' });
    const sauvegarde = corps && corps.donnees;
    if (!sauvegarde || typeof sauvegarde !== 'object' || !Array.isArray(sauvegarde.entreprises))
      return json(res, 400, { erreur: 'Fichier de sauvegarde invalide.' });

    // Copie de l'état actuel avant d'écraser, au cas où
    try {
      const fs2 = require('fs');
      if (fs2.existsSync(store.DB_PATH))
        fs2.copyFileSync(store.DB_PATH, store.DB_PATH + '.avant-restauration');
    } catch { /* sans conséquence */ }

    // Les sessions en cours ne sont pas restaurées : les jetons de l'ancien
    // hébergement n'ont plus de sens, et cela évite de rouvrir de vieux accès.
    const sessionsActuelles = db.sessions;
    for (const cle of Object.keys(db)) delete db[cle];
    Object.assign(db, sauvegarde);
    db.sessions = sessionsActuelles;
    store.save();

    return json(res, 200, {
      ok: true,
      entreprises: (db.entreprises || []).length,
      utilisateurs: (db.users || []).length,
      rendezvous: (db.rendezvous || []).length,
      sejours: (db.sejours || []).length,
      commandes: (db.commandes || []).length
    });
  }

  // ---- Enregistrement d'une visite (appelé par le navigateur) ----
  if (p === '/api/visite' && req.method === 'POST') {
    try {
      /* Cookie de mesure : posé uniquement si le visiteur a accepté.
         Il ne contient qu'un identifiant tiré au sort, aucune donnée
         personnelle, et n'est lisible que par ce site. */
      let idCookie = cookies(req).bk_mesure || '';
      if (corps.consentement === true) {
        if (!idCookie) {
          idCookie = crypto.randomBytes(12).toString('hex');
          res.setHeader('Set-Cookie',
            `bk_mesure=${idCookie}; Path=/; Max-Age=15552000; SameSite=Lax; HttpOnly` +
            (req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''));
        }
      } else if (corps.consentement === false) {
        // Refus : on efface le cookie éventuellement posé auparavant
        idCookie = '';
        if (cookies(req).bk_mesure) res.setHeader('Set-Cookie', 'bk_mesure=; Path=/; Max-Age=0');
      }
      visites.enregistrer(db, {
        idCookie,
        chemin: corps.chemin,
        ip: ipDe(req),
        agent: req.headers['user-agent'] || '',
        referer: corps.referer || req.headers.referer || '',
        hote: req.headers.host,
        contexte: { langue: corps.langue, fuseau: corps.fuseau, installee: corps.installee }
      });
      store.save();
    } catch { /* la mesure ne doit jamais gêner la navigation */ }
    res.writeHead(204); return res.end();
  }

  // ---- Fréquentation, réservée à l'administrateur ----
  if (p === '/api/admin/frequentation' && req.method === 'GET') {
    if (!user || user.role !== 'admin') return json(res, 403, { erreur: 'Accès refusé' });
    return json(res, 200, visites.statistiques(db, q.get('jours') || 30));
  }

  // ---- Messages du public : contact, partenariat, question ----
  if (p === '/api/messages' && req.method === 'POST') {
    const TYPES = ['contact', 'partenaire', 'question'];
    const type = TYPES.includes(corps.type) ? corps.type : 'contact';
    if (!corps.nom || !corps.message)
      return json(res, 400, { erreur: 'Votre nom et votre message sont obligatoires.' });
    if (!corps.email && !corps.telephone)
      return json(res, 400, { erreur: 'Laissez au moins un email ou un téléphone pour la réponse.' });
    // Garde-fou simple contre les envois répétés depuis la même adresse
    const recents = db.messages.filter((m) => m.ip === ipDe(req) && Date.now() - new Date(m.creeLe).getTime() < 3600000);
    if (recents.length >= 5) return json(res, 429, { erreur: 'Trop de messages envoyés. Réessayez dans une heure.' });

    const m = {
      id: store.uid(),
      reference: 'M' + Date.now().toString(36).toUpperCase().slice(-6),
      type,
      nom: String(corps.nom).slice(0, 90),
      email: String(corps.email || '').slice(0, 120),
      telephone: String(corps.telephone || '').slice(0, 20),
      entreprise: String(corps.entreprise || '').slice(0, 90),
      sujet: String(corps.sujet || '').slice(0, 120),
      message: String(corps.message).slice(0, 2000),
      // Champs propres au partenariat
      activite: String(corps.activite || '').slice(0, 90),
      ville: String(corps.ville || '').slice(0, 90),
      statut: 'nouveau',
      ip: ipDe(req),
      creeLe: new Date().toISOString()
    };
    db.messages.push(m); store.save();
    const libelle = { contact: 'message', partenaire: 'demande de partenariat', question: 'question' }[type];
    courrielClient(m.email, 'message_recu', { nom: m.nom, sujet: m.sujet || libelle, reference: m.reference });
    return json(res, 200, { ok: true, reference: m.reference });
  }

  // ---- Administration des messages ----
  if (p === '/api/admin/messages' && req.method === 'GET') {
    if (!user || user.role !== 'admin') return json(res, 403, { erreur: 'Accès refusé' });
    return json(res, 200, db.messages.slice().reverse());
  }
  const mMsg = p.match(/^\/api\/admin\/messages\/(\w+)$/);
  if (mMsg && req.method === 'PUT') {
    if (!user || user.role !== 'admin') return json(res, 403, { erreur: 'Accès refusé' });
    const m = db.messages.find((x) => x.id === mMsg[1]);
    if (!m) return json(res, 404, { erreur: 'Message introuvable' });
    if (corps.statut && ['nouveau', 'traite', 'archive'].includes(corps.statut)) m.statut = corps.statut;
    store.save(); return json(res, 200, m);
  }
  if (mMsg && req.method === 'DELETE') {
    if (!user || user.role !== 'admin') return json(res, 403, { erreur: 'Accès refusé' });
    db.messages = db.messages.filter((x) => x.id !== mMsg[1]);
    store.save(); return json(res, 200, { ok: true });
  }

  /* ---- Vérification d'un reçu ----
     Ouverte sans authentification : le commerçant scanne avec
     l'appareil photo, sans avoir à se connecter. La signature
     protège contre les références inventées. */
  if (p === '/api/verifier-recu' && req.method === 'GET') {
    const ref = q.get('ref') || '';
    if (!recuValide(ref, q.get('c'))) return json(res, 403, { erreur: 'Lien de vérification invalide.' });
    const detail = recuParReference(ref);
    if (!detail || detail.nonConfirme) return json(res, 404, { erreur: 'Reçu introuvable.' });
    return json(res, 200, detail);
  }

  /* ---- Reçu d'un paiement ----
     Accessible avec la référence et le téléphone du client, comme
     le suivi de commande : le client n'a pas de compte. */
  if (p === '/api/recu' && req.method === 'GET') {
    const ref = String(q.get('ref') || '').trim().toUpperCase();
    const base = basePublique(req);
    const avecQR = (detail) => {
      const lien = `${base}/verifier.html?ref=${encodeURIComponent(detail.reference)}&c=${signatureRecu(detail.reference)}`;
      let image = '';
      try { image = qr.svg(lien, { taille: 420, couleur: '#0B2C6B' }); } catch { /* sans code QR */ }
      return json(res, 200, { ...detail, lienVerification: lien, qr: image });
    };

    const detail = recuParReference(ref);
    if (!detail) return json(res, 404, { erreur: 'Aucun achat ne porte cette référence. Vérifiez-la dans le courriel reçu après votre commande.' });
    if (detail.nonConfirme) return json(res, 400, { erreur: "Ce paiement n'est pas confirmé." });
    return avecQR(detail);
  }

  // ---- Notifications poussées ----
  if (p === '/api/push/cle' && req.method === 'GET') {
    return json(res, 200, { cle: process.env.VAPID_PUBLIQUE || '', actif: push.configure() });
  }

  if (p === '/api/push/abonner' && req.method === 'POST') {
    if (!user) return json(res, 401, { erreur: 'Non connecté' });
    const ab = corps.abonnement;
    if (!ab || !ab.endpoint || !ab.keys || !ab.keys.p256dh || !ab.keys.auth)
      return json(res, 400, { erreur: 'Abonnement invalide.' });
    // Un même appareil ne doit pas s'enregistrer deux fois
    db.pushAbonnements = db.pushAbonnements.filter((x) => x.endpoint !== ab.endpoint);
    db.pushAbonnements.push({
      id: store.uid(), userId: user.id,
      endpoint: String(ab.endpoint).slice(0, 500),
      keys: { p256dh: String(ab.keys.p256dh).slice(0, 200), auth: String(ab.keys.auth).slice(0, 100) },
      appareil: String(req.headers['user-agent'] || '').slice(0, 80),
      creeLe: new Date().toISOString()
    });
    store.save();
    return json(res, 200, { ok: true });
  }

  if (p === '/api/push/desabonner' && req.method === 'POST') {
    if (!user) return json(res, 401, { erreur: 'Non connecté' });
    const avant = db.pushAbonnements.length;
    db.pushAbonnements = db.pushAbonnements.filter(
      (x) => !(x.userId === user.id && (!corps.endpoint || x.endpoint === corps.endpoint)));
    store.save();
    return json(res, 200, { ok: true, retires: avant - db.pushAbonnements.length });
  }

  if (p === '/api/push/etat' && req.method === 'GET') {
    if (!user) return json(res, 401, { erreur: 'Non connecté' });
    return json(res, 200, {
      actif: push.configure(),
      appareils: db.pushAbonnements.filter((x) => x.userId === user.id).length
    });
  }

  // Envoi d'essai, pour vérifier la chaîne depuis l'espace de l'entreprise
  if (p === '/api/push/essai' && req.method === 'POST') {
    if (!user) return json(res, 401, { erreur: 'Non connecté' });
    const n = await envoyerPush(user.id, {
      titre: 'Konekte',
      corps: 'Les notifications fonctionnent. Vous serez prévenu à chaque nouvelle demande.',
      url: '/dashboard.html'
    });
    return json(res, 200, { ok: true, envoyees: n });
  }

  /* ---- Espace client : demande d'un code ----
     Le client s'identifie par son téléphone ou par son adresse — les deux
     figurent dans ses commandes. Le code part toujours par courriel : la
     plateforme n'envoie plus de message WhatsApp automatique. */
  if (p === '/api/client/code' && req.method === 'POST') {
    nettoyerClient();
    const saisiMail = String(corps.courriel || '').trim().toLowerCase();
    const tel = corps.telephone ? telNormalise(corps.telephone) : '';
    if (!saisiMail && tel.length < 8)
      return json(res, 400, { erreur: 'Indiquez votre numéro de téléphone ou votre adresse email.' });
    if (saisiMail && !courriel.adresseValide(saisiMail))
      return json(res, 400, { erreur: 'Adresse email invalide.' });

    // Inutile d'envoyer un code à quelqu'un qui n'a aucun historique
    const liste = achatsDe(tel, saisiMail);
    if (!liste.length)
      return json(res, 404, { erreur: 'Aucune commande ni réservation trouvée avec ces informations.' });

    /* Où envoyer le code : l'adresse saisie si elle est connue, sinon celle
       que le client a laissée lors d'un achat. */
    const destination = saisiMail || courrielConnuDe(tel);
    if (!destination)
      return json(res, 409, {
        erreur: "Aucune adresse email n'est enregistrée avec ce numéro. Contactez directement l'entreprise, qui a votre commande sous les yeux.",
        sansCourriel: true
      });

    const id = crypto.randomBytes(18).toString('hex');
    const code = codeA2F();
    DEFIS_CLIENT.set(id, { tel, courriel: destination, code, tentatives: 0, expireLe: Date.now() + CLIENT_VALIDITE_MS });
    await courriel.envoyer(destination, 'code_connexion', { nom: '', code });
    return json(res, 200, { ok: true, defi: id, destination: courrielMasque(destination) });
  }

  // ---- Vérification du code ----
  if (p === '/api/client/verifier' && req.method === 'POST') {
    nettoyerClient();
    const d = DEFIS_CLIENT.get(String(corps.defi || ''));
    if (!d) return json(res, 401, { erreur: 'Code expiré. Recommencez.' });
    d.tentatives++;
    if (d.tentatives > CLIENT_TENTATIVES_MAX) {
      DEFIS_CLIENT.delete(corps.defi);
      return json(res, 429, { erreur: 'Trop de tentatives.' });
    }
    const saisi = String(corps.code || '').replace(/\D/g, '');
    const ok = saisi.length === 6 && crypto.timingSafeEqual(Buffer.from(saisi), Buffer.from(d.code));
    if (!ok) return json(res, 401, { erreur: `Code incorrect. ${CLIENT_TENTATIVES_MAX - d.tentatives} essai(s) restant(s).` });

    const jeton = crypto.randomBytes(24).toString('hex');
    SESSIONS_CLIENT.set(jeton, { tel: d.tel, courriel: d.courriel, expireLe: Date.now() + CLIENT_SESSION_MS });
    DEFIS_CLIENT.delete(corps.defi);
    res.setHeader('Set-Cookie',
      `bk_client=${jeton}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${CLIENT_SESSION_MS / 1000}` +
      (req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''));
    return json(res, 200, { ok: true });
  }

  if (p === '/api/client/deconnexion' && req.method === 'POST') {
    const jeton = cookies(req).bk_client;
    if (jeton) SESSIONS_CLIENT.delete(jeton);
    res.setHeader('Set-Cookie', 'bk_client=; Path=/; Max-Age=0');
    return json(res, 200, { ok: true });
  }

  // ---- Mes achats et réservations ----
  if (p === '/api/client/mes-achats' && req.method === 'GET') {
    const sess = clientConnecte(req);
    if (!sess) return json(res, 401, { erreur: 'Non connecté' });
    const liste = achatsDe(sess.tel, sess.courriel);
    return json(res, 200, {
      telMasque: sess.tel ? telMasque(sess.tel) : courrielMasque(sess.courriel),
      total: liste.length,
      enCours: liste.filter((x) => !['livree', 'terminee', 'annulee', 'refuse', 'termine'].includes(x.statut)).length,
      achats: liste
    });
  }

  /* ---- Adresse officielle, pour les pages qui n'interrogent aucune
     entreprise (reçu, vérification) et doivent quand même partager
     un lien correct. ---- */
  if (p === '/api/url-publique' && req.method === 'GET')
    return json(res, 200, { url: basePublique(req) });

  // ---- Paramètres du financement, pour les pages publiques ----
  if (p === '/api/financement' && req.method === 'GET') {
    return json(res, 200, { url: FINANCEMENT_URL, seuil: FINANCEMENT_SEUIL, commune: FINANCEMENT_COMMUNE });
  }

  /* ---- Départements et communes, pour les formulaires ---- */
  if (p === '/api/geo' && req.method === 'GET')
    return json(res, 200, { departements: geo.referentiel(), financementCommune: FINANCEMENT_COMMUNE });

  /* ---- Chiffres publics de la plateforme ----
     Agrégés : aucun visiteur n'est identifiable, et seule
     l'entreprise la plus consultée est nommée — une mise en avant,
     pas une divulgation de performance commerciale. */
  if (p === '/api/statistiques' && req.method === 'GET') {
    const approuvees = db.entreprises.filter((x) => x.statut === 'approuvee');
    const consultations = (db.visites || []).filter((v) => (v.type || 'page') === 'page');

    // Entreprise la plus consultée, sur les 90 derniers jours
    const depuis = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const parEntreprise = {};
    for (const v of consultations) {
      if (!v.entreprise || v.jour < depuis) continue;
      parEntreprise[v.entreprise] = (parEntreprise[v.entreprise] || 0) + 1;
    }
    const meilleur = Object.entries(parEntreprise).sort((a, b) => b[1] - a[1])[0];
    const ent = meilleur && approuvees.find((x) => x.slug === meilleur[0]);

    /* Seuil d'affichage : des chiffres trop modestes desservent la
       plateforme. En deçà, la bande reste masquée et l'accueil met en
       avant ce qu'il sait faire plutôt que sa taille. */
    const SEUIL = Number(process.env.SEUIL_CHIFFRES || 20);
    return json(res, 200, {
      afficher: approuvees.length >= SEUIL,
      seuil: SEUIL,
      entreprises: approuvees.length,
      visiteurs: new Set(consultations.map((v) => v.visiteur)).size,
      visites: consultations.length,
      populaire: ent ? { nom: ent.nom, slug: ent.slug, visites: meilleur[1] } : null
    });
  }

  // ---- Avis client ----
  if (p === '/api/avis' && req.method === 'POST') {
    const e = db.entreprises.find((x) => x.slug === corps.slug && x.statut === 'approuvee');
    if (!e || !corps.clientNom || !corps.note) return json(res, 400, { erreur: 'Données invalides.' });
    db.avis.unshift({ id: store.uid(), entrepriseId: e.id, clientNom: corps.clientNom, note: Math.min(5, Math.max(1, +corps.note)), commentaire: (corps.commentaire || '').slice(0, 500), creeLe: new Date().toISOString() });
    store.save();
    notifier(e.id, 'nouvel_avis', `Nouvel avis (${corps.note}/5) de ${corps.clientNom}`);
    return json(res, 200, { ok: true });
  }

  // Espace responsable (authentifié) 
  if (p.startsWith('/api/mon-') || p.startsWith('/api/rendezvous') || p.startsWith('/api/sejours') || p === '/api/stats' || p === '/api/notifications') {
    if (!user || user.role !== 'responsable') return json(res, 401, { erreur: 'Connexion requise' });
    const e = monEntreprise();
    if (!e) return json(res, 404, { erreur: 'Entreprise introuvable' });

    if (p === '/api/mon-entreprise' && req.method === 'GET')
      /* `urlPublique` est l'adresse officielle : c'est elle que l'entreprise
         partage et qui est encodée dans son code QR, quelle que soit celle
         par laquelle elle s'est connectée. */
      return json(res, 200, entreprisePourGestion(e, req));
    if (p === '/api/mon-entreprise' && req.method === 'PUT') {
      ['nom', 'description', 'adresse', 'telephone', 'whatsapp', 'email', 'categorie', 'couleur', 'couleur2', 'logoTexte'].forEach((k) => {
        if (corps[k] !== undefined) e[k] = corps[k];
      });
      /* Ville et département. Un département non reconnu est effacé plutôt
         que conservé : une valeur fantaisiste fausserait les recherches. */
      if (corps.ville !== undefined) e.ville = String(corps.ville).slice(0, 60).trim();
      if (corps.departement !== undefined) e.departement = geo.cleDepartement(corps.departement);
      /* Les horaires passent par le filtre : un envoi incomplet ou mal formé
         est remis en forme plutôt qu'enregistré tel quel. */
      if (corps.horaires !== undefined) e.horaires = horaires.normaliser(corps.horaires);
      // Métier et champs propres au métier
      if (corps.metier !== undefined) {
        if (!metiers.CLES_METIERS.includes(corps.metier)) return json(res, 400, { erreur: 'Type d\'activité invalide.' });
        e.metier = corps.metier;
        e.champs = metiers.nettoyerChamps(e.metier, e.champs);  // ne garder que ce qui reste pertinent
      }
      if (corps.champs !== undefined) e.champs = metiers.nettoyerChamps(e.metier || 'autre', corps.champs);
      /* Les fonctions ne sont plus paramétrables une à une : le métier
         les décide, le forfait décide les options de croissance.
         Un ancien navigateur peut encore envoyer modulesOn/modulesOff —
         on les ignore silencieusement. */
      // Formule d'hébergement : standard ou resort (tout inclus)
      if (corps.formule !== undefined) {
        if (!FORMULES.includes(corps.formule)) return json(res, 400, { erreur: 'Formule invalide.' });
        if (corps.formule === 'resort' && !metiers.aModule(e, 'hotellerie'))
          return json(res, 400, { erreur: 'La formule tout inclus concerne les hôtels et resorts.' });
        e.formule = corps.formule;
      }
      if (corps.inclus !== undefined) e.inclus = nettoyerInclus(corps.inclus);
      if (corps.noteFormule !== undefined) e.noteFormule = String(corps.noteFormule).slice(0, 200);
      // Position géographique (latitude / longitude)
      if (corps.latitude !== undefined || corps.longitude !== undefined) {
        if (corps.latitude === '' || corps.latitude === null) { e.latitude = null; e.longitude = null; }
        else {
          const lat = Number(corps.latitude), lng = Number(corps.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)
            return json(res, 400, { erreur: 'Coordonnées invalides. Latitude entre -90 et 90, longitude entre -180 et 180.' });
          e.latitude = Math.round(lat * 1e6) / 1e6;
          e.longitude = Math.round(lng * 1e6) / 1e6;
        }
      }
      if (corps.capaciteMax !== undefined) e.capaciteMax = Math.max(0, Math.min(50, +corps.capaciteMax || 0));
      // Pas entre deux créneaux, en minutes. 0 = la durée du service.
      if (corps.pasCreneaux !== undefined) e.pasCreneaux = Math.max(0, Math.min(+corps.pasCreneaux || 0, 480));
      if (corps.pauses !== undefined && Array.isArray(corps.pauses)) {
        e.pauses = corps.pauses
          .map((x) => ({ debut: String(x.debut || '').slice(0, 5), fin: String(x.fin || '').slice(0, 5) }))
          .filter((x) => /^\d{2}:\d{2}$/.test(x.debut) && /^\d{2}:\d{2}$/.test(x.fin) && x.fin > x.debut)
          .slice(0, 5);
      }
      if (corps.reseaux !== undefined) e.reseaux = nettoyerReseaux(corps.reseaux);
      /* Messages WhatsApp pré-enregistrés. Une liste vidée remet la
         bibliothèque de départ, ce qui évite de rester sans aucun modèle. */
      if (corps.modelesWhatsApp !== undefined) {
        const propres = nettoyerModelesWhatsApp(corps.modelesWhatsApp);
        if (propres === null) return json(res, 400, { erreur: 'Modèles de messages invalides.' });
        e.modelesWhatsApp = propres;
      }
      // Images (base64) : logo max ~350 Ko, photo de fond max ~1,5 Mo
      const imgValide = (v, max) => v === '' || (typeof v === 'string' && v.startsWith('data:image/') && v.length <= max);
      if (corps.logoImage !== undefined) {
        if (!imgValide(corps.logoImage, 350000)) return json(res, 400, { erreur: 'Logo invalide ou trop lourd (350 Ko max après compression).' });
        e.logoImage = corps.logoImage;
      }
      if (corps.photoFond !== undefined) {
        if (!imgValide(corps.photoFond, 1500000)) return json(res, 400, { erreur: 'Photo invalide ou trop lourde (1,5 Mo max après compression).' });
        e.photoFond = corps.photoFond;
      }
      /* Affiche remise au format des vignettes des réseaux sociaux
         (1200 x 630), dessinée par le navigateur au moment de
         l'enregistrement. Elle ne vient jamais d'ailleurs. */
      if (corps.photoPartage !== undefined) {
        if (corps.photoPartage && !imgValide(corps.photoPartage, 900000))
          return json(res, 400, { erreur: 'Image de partage invalide.' });
        e.photoPartage = corps.photoPartage || '';
      }
      /* Produit mis en avant : une affiche de bannière porte souvent un
         « Commandez maintenant ! » dessiné dessus. L'entreprise désigne
         ici le produit vers lequel ce clic doit mener. L'identifiant est
         vérifié : on ne met en avant que l'un de ses propres produits. */
      if (corps.produitVedette !== undefined) {
        const id = String(corps.produitVedette || '');
        e.produitVedette = (id && db.produits.some((x) => x.id === id && x.entrepriseId === e.id)) ? id : '';
      }
      /* L'espace de gestion remplace son entreprise par cette réponse : elle
         doit donc être aussi complète que celle du chargement, sinon une
         simple modification du profil ferait disparaître les droits. */
      store.save(); return json(res, 200, entreprisePourGestion(e, req));
    }

    if (p === '/api/mon-entreprise/services' && req.method === 'GET')
      return json(res, 200, db.services.filter((s) => s.entrepriseId === e.id));
    if (p === '/api/mon-entreprise/services' && req.method === 'POST') {
      if (!corps.nom || !corps.duree) return json(res, 400, { erreur: 'Nom et durée obligatoires.' });
      // Le forfait limite le nombre de services
      const nbServices = db.services.filter((x) => x.entrepriseId === e.id).length;
      const limiteS = forfaits.limiteAtteinte(e, 'services', nbServices);
      if (limiteS) return json(res, 403, { erreur: limiteS, limite: true });
      const galerieS = nettoyerPhotos(corps.photos !== undefined ? corps.photos : corps.photo, []);
      if (galerieS === null) return json(res, 400, { erreur: 'Une photo est invalide ou trop lourde (900 Ko maximum).' });
      const s = {
        id: store.uid(), entrepriseId: e.id, nom: corps.nom,
        description: String(corps.description || '').slice(0, 200),
        duree: +corps.duree, prix: +corps.prix || 0,
        photos: galerieS, photo: galerieS[0] || '',
        actif: true
      };
      db.services.push(s); store.save(); return json(res, 200, s);
    }
    const mSrv = p.match(/^\/api\/mon-entreprise\/services\/(\w+)$/);
    if (mSrv) {
      const s = db.services.find((x) => x.id === mSrv[1] && x.entrepriseId === e.id);
      if (!s) return json(res, 404, { erreur: 'Service introuvable' });
      if (req.method === 'PUT') {
        ['nom'].forEach(k => corps[k] !== undefined && (s[k] = corps[k]));
        if (corps.description !== undefined) s.description = String(corps.description).slice(0, 200);
        if (corps.duree) s.duree = +corps.duree;
        if (corps.prix !== undefined) s.prix = +corps.prix;
        if (corps.actif !== undefined) s.actif = !!corps.actif;
        if (corps.photos !== undefined || corps.photo !== undefined) {
          const g = nettoyerPhotos(corps.photos !== undefined ? corps.photos : corps.photo, s.photos);
          if (g === null) return json(res, 400, { erreur: 'Une photo est invalide ou trop lourde (900 Ko maximum).' });
          s.photos = g; s.photo = g[0] || '';
        }
        store.save(); return json(res, 200, s);
      }
      if (req.method === 'DELETE') { db.services = db.services.filter((x) => x !== s); store.save(); return json(res, 200, { ok: true }); }
    }

    // ---- Chambres (module Séjours) ----
    // Les modules sont contrôlés côté serveur, pas seulement masqués dans l'interface
    if (p.startsWith('/api/mon-entreprise/carte') && !metiers.aModule(e, 'carte'))
      return json(res, 403, { erreur: 'Le module Restaurant & Bar n\'est pas disponible pour votre type d\'activité.' });
    if (p.startsWith('/api/mon-entreprise/chambres') && !metiers.aModule(e, 'hotellerie'))
      return json(res, 403, { erreur: 'Le module Chambres & Séjours n\'est pas disponible pour votre type d\'activité.' });

    /* ---- Lien de financement, pré-rempli ----
       Le formulaire de Micro Crédit Solidarité accepte des paramètres :
       on y porte les informations déjà connues, pour éviter au
       commerçant de les ressaisir. */
    if (p === '/api/mon-entreprise/financement' && req.method === 'GET') {
      /* La commune commande : refuser ici, et pas seulement masquer le
         bouton, car un lien recopié d'un autre compte arriverait sinon
         jusqu'au formulaire. */
      if (!financementOuvert(e))
        return json(res, 403, {
          erreur: `Le financement de Micro Crédit Solidarité est pour le moment réservé aux entreprises de ${FINANCEMENT_COMMUNE}.`,
          commune: FINANCEMENT_COMMUNE, horsZone: true
        });
      const champs = {
        nom: e.nom || '',
        telephone: (e.whatsapp || e.telephone || '').replace(/\D/g, ''),
        email: user.email || '',
        ville: e.ville || FINANCEMENT_COMMUNE,
        departement: geo.nomDepartement(e.departement),
        zone: e.adresse || '',
        activite: metiers.metierDe(e).nom.fr || e.categorie || ''
      };
      const params = Object.entries(champs)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');
      return json(res, 200, { url: FINANCEMENT_URL + (params ? '?' + params : '') });
    }

    /* ---- Paiement par versement : déclaration de l'entente et réglages ---- */
    if (p === '/api/mon-entreprise/versement' && req.method === 'GET')
      return json(res, 200, versementDe(e));

    if (p === '/api/mon-entreprise/versement' && req.method === 'PUT') {
      if (!financementOuvert(e))
        return json(res, 403, {
          erreur: `Le paiement par versement n'est proposé pour le moment qu'aux entreprises de ${FINANCEMENT_COMMUNE}.`,
          horsZone: true
        });
      const v = e.versement || (e.versement = {});
      /* La référence de l'entente. La changer remet la validation à zéro :
         c'est une nouvelle entente, et Konekte doit la constater à son tour. */
      if (corps.reference !== undefined) {
        const ref = String(corps.reference).slice(0, 60).trim();
        if (ref !== (v.reference || '')) {
          v.reference = ref;
          v.declareeLe = ref ? new Date().toISOString() : '';
          v.validee = false; v.valideeLe = '';
          v.refusee = false; v.motifRefus = '';
          /* Et l'offre s'éteint : une nouvelle entente se valide puis
             s'active, elle n'hérite pas de l'activation de l'ancienne. */
          v.actif = false;
        }
      }
      if (corps.portee !== undefined) v.portee = corps.portee === 'choisis' ? 'choisis' : 'tous';
      if (corps.minimum !== undefined) v.minimum = Math.max(0, Math.min(+corps.minimum || 0, 10000000));
      /* L'activation ne vaut que si l'entente est validée : accepter un
         « oui » sans entente laisserait croire que le bouton va paraître. */
      if (corps.actif !== undefined) {
        if (corps.actif && !v.validee)
          return json(res, 403, { erreur: 'Votre entente avec Micro Crédit Solidarité doit d\'abord être validée par Konekte.', aValider: true });
        v.actif = !!corps.actif;
      }
      store.save(); return json(res, 200, versementDe(e));
    }

    // ---- Ce que mon forfait ouvre ----
    if (p === '/api/mon-entreprise/fonctions' && req.method === 'GET') {
      return json(res, 200, forfaits.etatFonctions(e, {
        services: db.services.filter((x) => x.entrepriseId === e.id).length,
        employes: db.employes.filter((x) => x.entrepriseId === e.id).length,
        produits: db.produits.filter((x) => x.entrepriseId === e.id).length,
        chambres: db.chambres.filter((x) => x.entrepriseId === e.id).length,
        programmes: db.programmes.filter((x) => x.entrepriseId === e.id).length
      }, metiers.modulesActifs(e)));
    }

    // ---- Fréquentation de ma page ----
    if (p === '/api/mon-entreprise/frequentation' && req.method === 'GET')
      return json(res, 200, visites.statistiques(db, q.get('jours') || 30, e.slug));

    // ---- Code QR de la page publique ----
    if (p === '/api/mon-entreprise/qr.svg' && req.method === 'GET') {
      const base = basePublique(req);
      try {
        const image = qr.svg(`${base}/${e.slug}`, { taille: 600, couleur: e.couleur || '#0B2C6B' });
        res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8',
                             'Content-Disposition': `inline; filename="qr-${e.slug}.svg"` });
        return res.end(image);
      } catch (err) {
        return json(res, 500, { erreur: err.message });
      }
    }

    // ================= Abonnement de l'entreprise =================
    if (p === '/api/mon-entreprise/abonnement' && req.method === 'GET')
      return json(res, 200, Object.assign(forfaits.etatAbonnement(e), {
        catalogue: forfaits.catalogueForfaits(),
        historique: (e.abonnement && e.abonnement.paiements) || [],
        contrat: (e.abonnement && e.abonnement.contrat) || null,
        /* Règlement ouvert mais pas encore confirmé : la page de paiement
           s'en sert pour rouvrir la passerelle là où elle en était. */
        paiementEnCours: (e.abonnement && e.abonnement.paiementEnCours) || null
      }));

    // Changement de forfait : sans effet sur la date de fin d'essai
    if (p === '/api/mon-entreprise/abonnement' && req.method === 'PUT') {
      if (!e.abonnement) e.abonnement = forfaits.nouvelAbonnement('decouverte', new Date());
      if (corps.forfait !== undefined) {
        if (!forfaits.CLES_FORFAITS.includes(corps.forfait))
          return json(res, 400, { erreur: 'Forfait inconnu.' });
        e.abonnement.forfait = corps.forfait;
      }
      if (corps.signature !== undefined && String(corps.signature).trim()) {
        e.abonnement.contrat = {
          signature: String(corps.signature).slice(0, 90),
          qualite: String(corps.qualiteSignataire || '').slice(0, 60),
          le: new Date().toISOString(), version: '1.0'
        };
      }
      store.save();
      return json(res, 200, forfaits.etatAbonnement(e));
    }

    // Règlement de l'abonnement : par anticipation pendant l'essai, ou à échéance
    if (p === '/api/mon-entreprise/abonnement/payer' && req.method === 'POST') {
      const etat = forfaits.etatAbonnement(e);
      const f = forfaits.FORFAITS[etat.forfait];
      if (!f || f.prixMois <= 0)
        return json(res, 400, { erreur: 'Ce forfait est gratuit, aucun règlement n\'est nécessaire.' });
      const mois = Math.max(1, Math.min(+corps.mois || 1, 12));
      const montant = f.prixMois * mois;
      const reference = 'AB' + e.id.slice(0, 6).toUpperCase() + Date.now().toString(36).toUpperCase();
      let r;
      try {
        /* L'abonnement se règle chez la plateforme, toujours. */
        r = await passerelles.initier('plop', { reference, montant, methode: 'all',
          ids: { clientId: plopplop.PLOP.clientId, clientSecret: plopplop.PLOP.clientSecret },
          hote: plopplop.PLOP.hote });
      } catch (err) {
        return json(res, 503, { erreur: 'Passerelle de paiement indisponible.' });
      }
      if (!r.ok) return json(res, 402, { erreur: r.error || 'La passerelle a refusé la transaction.' });
      e.abonnement.paiementEnCours = { reference, montant, mois, url: r.urlPaiement,
                                        ouvertLe: new Date().toISOString() };
      store.save();
      return json(res, 200, { ok: true, reference, montant, mois,
        urlPaiement: r.urlPaiement, urlInterne: '/paiement.html?ab=1' });
    }

    if (p === '/api/mon-entreprise/abonnement/verifier' && req.method === 'POST') {
      const enCours = e.abonnement && e.abonnement.paiementEnCours;
      if (!enCours) return json(res, 400, { erreur: 'Aucun règlement en attente.' });
      let v;
      /* L'abonnement se règle toujours chez la plateforme : la passerelle
         de l'entreprise encaisse pour elle, pas pour nous. */
      try { v = await passerelles.verifier('plop', { reference: enCours.reference,
        ids: { clientId: plopplop.PLOP.clientId }, hote: plopplop.PLOP.hote }); }
      catch (err) { return json(res, 503, { erreur: 'Vérification impossible.' }); }
      if (!(v.ok && v.paye))
        return json(res, 402, { ok: false, message: v.message || 'Règlement non encore confirmé.' });

      // Les mois réglés repoussent la prochaine échéance
      const base = e.abonnement.prochainPaiement > new Date().toISOString().slice(0, 10)
        ? new Date(e.abonnement.prochainPaiement + 'T00:00:00Z') : new Date();
      e.abonnement.prochainPaiement = forfaits.ajouterMois(base, enCours.mois).toISOString().slice(0, 10);
      e.abonnement.statut = 'actif';
      e.abonnement.paiements.push({
        reference: enCours.reference, montant: enCours.montant, mois: enCours.mois,
        le: new Date().toISOString(), jusquau: e.abonnement.prochainPaiement
      });
      delete e.abonnement.paiementEnCours;
      store.save();
      courrielClient(e.email || (db.users.find((u) => u.entrepriseId === e.id) || {}).email,
        'abonnement_regle', {
          entreprise: e.nom, forfait: forfaits.FORFAITS[e.abonnement.forfait].nom.fr,
          montant: enCours.montant, prochain: e.abonnement.prochainPaiement
        });
      return json(res, 200, { ok: true, etat: forfaits.etatAbonnement(e) });
    }

    // ================= Gestion hôtelière =================
    if ((p.startsWith('/api/mon-entreprise/tarifs') || p.startsWith('/api/mon-entreprise/saisons')
         || p.startsWith('/api/mon-entreprise/hotel')) && !metiers.aModule(e, 'hotellerie'))
      return json(res, 403, { erreur: 'Le module Chambres & Séjours n\'est pas activé.' });

    // ---- Politiques de l'établissement ----
    if (p === '/api/mon-entreprise/hotel' && req.method === 'GET')
      return json(res, 200, e.hotel || {});

    if (p === '/api/mon-entreprise/hotel' && req.method === 'PUT') {
      const h = e.hotel || {};
      if (corps.checkin !== undefined) h.checkin = String(corps.checkin).slice(0, 5);
      if (corps.checkout !== undefined) h.checkout = String(corps.checkout).slice(0, 5);
      if (corps.sejourMin !== undefined) h.sejourMin = Math.max(0, Math.min(+corps.sejourMin || 0, 60));
      if (corps.sejourMax !== undefined) h.sejourMax = Math.max(0, Math.min(+corps.sejourMax || 0, 365));
      if (corps.tauxTaxe !== undefined) h.tauxTaxe = Math.max(0, Math.min(+corps.tauxTaxe || 0, 50));
      if (corps.taxeSejour !== undefined) h.taxeSejour = Math.max(0, Math.min(+corps.taxeSejour || 0, 100000));
      if (corps.acompte !== undefined) h.acompte = Math.max(0, Math.min(+corps.acompte || 0, 100));
      if (corps.annulation !== undefined) h.annulation = String(corps.annulation).slice(0, 400);
      if (corps.delaiAnnulation !== undefined) h.delaiAnnulation = Math.max(0, Math.min(+corps.delaiAnnulation || 0, 90));
      if (corps.conditions !== undefined) h.conditions = String(corps.conditions).slice(0, 600);
      if (corps.animaux !== undefined) h.animaux = !!corps.animaux;
      if (corps.fumeur !== undefined) h.fumeur = !!corps.fumeur;
      e.hotel = h; store.save(); return json(res, 200, h);
    }

    // ---- Plans tarifaires ----
    if (p === '/api/mon-entreprise/tarifs' && req.method === 'GET')
      return json(res, 200, db.tarifs.filter((x) => x.entrepriseId === e.id));

    if (p === '/api/mon-entreprise/tarifs' && req.method === 'POST') {
      if (!corps.nom) return json(res, 400, { erreur: 'Le nom du plan est obligatoire.' });
      const tf = {
        id: store.uid(), entrepriseId: e.id,
        nom: String(corps.nom).slice(0, 70),
        description: String(corps.description || '').slice(0, 300),
        chambreId: String(corps.chambreId || '').slice(0, 40),   // vide = toutes les chambres
        prixNuit: Math.max(0, +corps.prixNuit || 0),             // 0 = prix de la chambre
        remboursable: corps.remboursable === undefined ? true : !!corps.remboursable,
        petitDejeuner: !!corps.petitDejeuner,
        actif: corps.actif === undefined ? true : !!corps.actif,
        creeLe: new Date().toISOString()
      };
      db.tarifs.push(tf); store.save(); return json(res, 200, tf);
    }

    const mTar = p.match(/^\/api\/mon-entreprise\/tarifs\/(\w+)$/);
    if (mTar) {
      const tf = db.tarifs.find((x) => x.id === mTar[1] && x.entrepriseId === e.id);
      if (!tf) return json(res, 404, { erreur: 'Plan tarifaire introuvable' });
      if (req.method === 'PUT') {
        if (corps.nom) tf.nom = String(corps.nom).slice(0, 70);
        if (corps.description !== undefined) tf.description = String(corps.description).slice(0, 300);
        if (corps.chambreId !== undefined) tf.chambreId = String(corps.chambreId).slice(0, 40);
        if (corps.prixNuit !== undefined) tf.prixNuit = Math.max(0, +corps.prixNuit || 0);
        if (corps.remboursable !== undefined) tf.remboursable = !!corps.remboursable;
        if (corps.petitDejeuner !== undefined) tf.petitDejeuner = !!corps.petitDejeuner;
        if (corps.actif !== undefined) tf.actif = !!corps.actif;
        store.save(); return json(res, 200, tf);
      }
      if (req.method === 'DELETE') {
        db.tarifs = db.tarifs.filter((x) => x !== tf);
        store.save(); return json(res, 200, { ok: true });
      }
    }

    // ---- Saisons tarifaires ----
    if (p === '/api/mon-entreprise/saisons' && req.method === 'GET')
      return json(res, 200, db.saisons.filter((x) => x.entrepriseId === e.id)
        .sort((a, b) => a.debut.localeCompare(b.debut)));

    if (p === '/api/mon-entreprise/saisons' && req.method === 'POST') {
      if (!corps.nom || !corps.debut || !corps.fin) return json(res, 400, { erreur: 'Nom, début et fin obligatoires.' });
      if (corps.fin < corps.debut) return json(res, 400, { erreur: 'La date de fin doit suivre la date de début.' });
      const s = {
        id: store.uid(), entrepriseId: e.id,
        nom: String(corps.nom).slice(0, 60),
        debut: String(corps.debut).slice(0, 10), fin: String(corps.fin).slice(0, 10),
        type: corps.type === 'montant' ? 'montant' : 'pourcentage',
        valeur: Math.max(-100000, Math.min(+corps.valeur || 0, 100000)),
        actif: corps.actif === undefined ? true : !!corps.actif,
        creeLe: new Date().toISOString()
      };
      db.saisons.push(s); store.save(); return json(res, 200, s);
    }

    const mSai = p.match(/^\/api\/mon-entreprise\/saisons\/(\w+)$/);
    if (mSai) {
      const s = db.saisons.find((x) => x.id === mSai[1] && x.entrepriseId === e.id);
      if (!s) return json(res, 404, { erreur: 'Saison introuvable' });
      if (req.method === 'PUT') {
        if (corps.nom) s.nom = String(corps.nom).slice(0, 60);
        if (corps.debut) s.debut = String(corps.debut).slice(0, 10);
        if (corps.fin) s.fin = String(corps.fin).slice(0, 10);
        if (s.fin < s.debut) return json(res, 400, { erreur: 'La date de fin doit suivre la date de début.' });
        if (corps.type !== undefined) s.type = corps.type === 'montant' ? 'montant' : 'pourcentage';
        if (corps.valeur !== undefined) s.valeur = Math.max(-100000, Math.min(+corps.valeur || 0, 100000));
        if (corps.actif !== undefined) s.actif = !!corps.actif;
        store.save(); return json(res, 200, s);
      }
      if (req.method === 'DELETE') {
        db.saisons = db.saisons.filter((x) => x !== s);
        store.save(); return json(res, 200, { ok: true });
      }
    }

    // ---- Planning d'occupation ----
    if (p === '/api/mon-entreprise/occupation' && req.method === 'GET') {
      if (!metiers.aModule(e, 'hotellerie')) return json(res, 403, { erreur: 'Module non activé.' });
      const debut = q.get('debut') || new Date().toISOString().slice(0, 10);
      const jours = Math.max(1, Math.min(+q.get('jours') || 14, 60));
      const chambres = db.chambres.filter((c) => c.entrepriseId === e.id && c.actif);
      const dates = [];
      const d = new Date(debut + 'T00:00:00Z');
      for (let i = 0; i < jours; i++) { dates.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
      return json(res, 200, {
        dates,
        chambres: chambres.map((c) => ({
          id: c.id, nom: c.nom, quantite: c.quantite,
          occupation: dates.map((jour) => {
            const pris = db.sejours.filter((s) => s.chambreId === c.id
              && ['en_attente', 'confirme'].includes(s.statut)
              && s.arrivee <= jour && s.depart > jour).length;
            return { jour, pris, libres: Math.max(0, c.quantite - pris) };
          })
        }))
      });
    }

    // ================= Vente : réglages de remise =================
    if (p.startsWith('/api/mon-entreprise/vente') && !metiers.aModule(e, 'commandes'))
      return json(res, 403, { erreur: 'Le module Commandes & livraison n\'est pas activé.' });

    if (p === '/api/mon-entreprise/vente' && req.method === 'GET')
      return json(res, 200, { vente: e.vente || {}, modes: MODES_REMISE,
        methodes: plopplop.METHODES.filter((m) => m.id !== 'all') });

    if (p === '/api/mon-entreprise/vente' && req.method === 'PUT') {
      const v = e.vente || {};
      if (corps.commandesActives !== undefined) v.commandesActives = !!corps.commandesActives;
      if (corps.cueillette !== undefined) v.cueillette = !!corps.cueillette;
      if (corps.livraison !== undefined) v.livraison = !!corps.livraison;
      if (corps.zones !== undefined) v.zones = nettoyerZones(corps.zones);
      if (corps.fraisBase !== undefined) v.fraisBase = Math.max(0, Math.min(+corps.fraisBase || 0, 100000));
      // 0 = pas de gratuité au-delà d'un montant
      if (corps.seuilGratuite !== undefined) v.seuilGratuite = Math.max(0, Math.min(+corps.seuilGratuite || 0, 10000000));
      if (corps.minimumCommande !== undefined) v.minimumCommande = Math.max(0, Math.min(+corps.minimumCommande || 0, 10000000));
      if (corps.horairesCueillette !== undefined) v.horairesCueillette = String(corps.horairesCueillette).slice(0, 120);
      if (corps.delaiPreparation !== undefined) v.delaiPreparation = String(corps.delaiPreparation).slice(0, 60);
      if (corps.consigne !== undefined) v.consigne = String(corps.consigne).slice(0, 300);
      if (corps.paiementEnLigne !== undefined) v.paiementEnLigne = !!corps.paiementEnLigne;
      if (corps.paiementRemise !== undefined) v.paiementRemise = !!corps.paiementRemise;
      /* Paiement direct sur les comptes de l'entreprise : sans compte
         déclaré, l'interrupteur n'aurait rien à montrer au client. */
      if (corps.paiementDirect !== undefined)
        v.paiementDirect = !!corps.paiementDirect && (e.comptesPaiement || []).some((c) => c.actif);
      /* Portefeuilles acceptés en ligne. Vide ou complet revient au même :
         le client choisit sur la passerelle. Une liste restreinte n'y
         propose que ce que l'entreprise accepte. */
      if (corps.methodesEnLigne !== undefined) {
        const permises = plopplop.METHODES.filter((m) => m.id !== 'all').map((m) => m.id);
        const liste = Array.isArray(corps.methodesEnLigne)
          ? corps.methodesEnLigne.filter((m) => permises.includes(m)) : [];
        v.methodesEnLigne = (liste.length && liste.length < permises.length) ? liste : [];
      }
      if (v.livraison && !(v.zones || []).length && !v.fraisBase) v.fraisBase = v.fraisBase || 0;
      e.vente = v; store.save();
      return json(res, 200, v);
    }

    // ================= Commandes reçues =================
    if (p.startsWith('/api/mon-entreprise/commandes') && !metiers.aModule(e, 'commandes'))
      return json(res, 403, { erreur: 'Le module Commandes & livraison n\'est pas activé.' });

    if (p === '/api/mon-entreprise/commandes' && req.method === 'GET') {
      const liste = db.commandes.filter((c) => c.entrepriseId === e.id)
        .sort((a, b) => b.creeLe.localeCompare(a.creeLe));
      return json(res, 200, { commandes: liste, statuts: STATUTS_COMMANDE, modes: MODES_REMISE });
    }

    const mCmd = p.match(/^\/api\/mon-entreprise\/commandes\/(\w+)$/);
    if (mCmd && req.method === 'PUT') {
      const c = db.commandes.find((x) => x.id === mCmd[1] && x.entrepriseId === e.id);
      if (!c) return json(res, 404, { erreur: 'Commande introuvable' });
      if (corps.statut !== undefined) {
        if (!STATUTS_COMMANDE.some((s) => s.cle === corps.statut)) return json(res, 400, { erreur: 'Statut invalide.' });
        const avant = c.statut;
        /* Le stock est décompté à la confirmation et remis à l'annulation.
           On mémorise la quantité réellement retirée (`decompte`) : sans
           elle, annuler une précommande — ou une commande qui dépassait
           le stock — rendait plus d'unités qu'il n'en avait été pris, et
           créait du stock qui n'existe pas. */
        if (corps.statut === 'confirmee' && !c.stockDecompte) {
          c.lignes.forEach((l) => {
            const pr = db.produits.find((x) => x.id === l.produitId);
            if (!pr || pr.stock === null) { l.decompte = 0; return; }
            const pris = Math.min(pr.stock, l.quantite);
            pr.stock -= pris;
            l.decompte = pris;
          });
          c.stockDecompte = true;
        }
        if (corps.statut === 'annulee' && c.stockDecompte) {
          c.lignes.forEach((l) => {
            const pr = db.produits.find((x) => x.id === l.produitId);
            // Commandes d'avant cette version : `decompte` absent, on retombe sur la quantité
            const rendu = l.decompte === undefined ? l.quantite : l.decompte;
            if (pr && pr.stock !== null) pr.stock = pr.stock + rendu;
            l.decompte = 0;
          });
          c.stockDecompte = false;
        }
        c.statut = corps.statut;
        c.journal.push({ le: new Date().toISOString(), texte: 'Statut : ' + corps.statut });
        if (avant !== c.statut) {
          const st = STATUTS_COMMANDE.find((s) => s.cle === c.statut);
          courrielClient(c.clientEmail, 'commande_statut', {
            nom: c.clientNom, entreprise: e.nom, reference: c.reference,
            statut: st ? st.fr : c.statut, total: c.total,
            mode: c.mode === 'livraison' ? 'Livraison' : 'Retrait sur place',
            lienSuivi: lienAchats(req, c.clientEmail), couleur: e.couleur
          });
        }
        /* Paiement à la remise : l'argent change de main au moment de la
           livraison ou du retrait. Sans ce constat, une commande réglée
           en espèces restait « à encaisser » pour toujours et n'entrait
           jamais en comptabilité — c'est pourtant le cas le plus
           fréquent en Haïti. */
        if (c.statut === 'livree' && c.paiement === 'remise' && !c.paye) {
          c.paye = true;
          c.payeLe = new Date().toISOString();
          c.journal.push({ le: c.payeLe, texte: 'Encaissement en espèces à la remise' });
        }
      }
      /* Le commerçant peut aussi constater le paiement à la main, par
         exemple un client qui règle d'avance ou en plusieurs fois. */
      if (corps.paye !== undefined) {
        const paye = !!corps.paye;
        if (paye !== !!c.paye) {
          if (paye && c.paiement === 'enligne' && !c.transactionId)
            return json(res, 400, { erreur: 'Cette commande attend un paiement en ligne. Elle sera marquée payée automatiquement à la confirmation du paiement.' });
          c.paye = paye;
          c.payeLe = paye ? new Date().toISOString() : null;
          /* Virement annoncé par le client : la confirmation du commerçant
             vaut vérification sur son propre compte. La trace reste, pour
             qu'on sache plus tard d'où venait l'argent. */
          if (c.versement) c.versement.verifie = paye;
          c.journal.push({ le: new Date().toISOString(),
                           texte: paye
                             ? (c.versement
                                 ? `Virement vérifié sur ${c.versement.compteLibelle} — référence ${c.versement.reference}`
                                 : 'Paiement constaté par le commerçant')
                             : 'Paiement annulé par le commerçant' });
        }
      }
      if (corps.note !== undefined) c.noteInterne = String(corps.note).slice(0, 300);
      if (corps.creneau !== undefined) c.creneau = String(corps.creneau).slice(0, 60);
      c.majLe = new Date().toISOString();
      store.save(); return json(res, 200, c);
    }

    // ---- Livraison par Taksi Konekte ----
    const mTaksi = p.match(/^\/api\/mon-entreprise\/commandes\/(\w+)\/taksi$/);
    if (mTaksi && req.method === 'POST') {
      if (!metiers.aModule(e, 'commandes')) return json(res, 403, { erreur: 'Module Commandes & livraison non activé.' });
      const c = db.commandes.find((x) => x.id === mTaksi[1] && x.entrepriseId === e.id);
      if (!c) return json(res, 404, { erreur: 'Commande introuvable' });
      if (c.mode !== 'livraison') return json(res, 400, { erreur: 'Cette commande est en retrait sur place.' });
      if (c.statut === 'annulee') return json(res, 409, { erreur: 'Cette commande a été annulée.' });
      const r = await taksi.demanderCourse(c, e);
      c.taksi = { mode: r.mode, courseId: r.courseId || null, lienSuivi: r.lienSuivi || '',
                  demandeeLe: new Date().toISOString() };
      c.journal.push({ le: new Date().toISOString(),
                       texte: r.mode === 'api' ? 'Course Taksi Konekte demandée' : 'Course Taksi Konekte à transmettre manuellement' });
      if (c.statut === 'prete' || c.statut === 'preparation') {
        c.statut = 'en_route';
        courrielClient(c.clientEmail, 'commande_statut', {
          nom: c.clientNom, entreprise: e.nom, reference: c.reference,
          statut: 'En route', total: c.total, mode: 'Livraison',
          lienSuivi: lienAchats(req, c.clientEmail), couleur: e.couleur
        });
      }
      c.majLe = new Date().toISOString();
      store.save();
      return json(res, 200, r);
    }

    if (p === '/api/mon-entreprise/taksi/etat' && req.method === 'GET')
      return json(res, 200, { actif: taksi.actif() });

    /* ================= Module comptabilité =================
       Ouvert par le forfait, non par le métier : toute entreprise
       tient une comptabilité, quelle que soit son activité. */
    if (p.startsWith('/api/mon-entreprise/compta')) {
      if (!forfaits.forfaitAutorise(e, 'comptabilite'))
        return json(res, 403, { erreur: 'La comptabilité est comprise dans le forfait Pro.', option: 'comptabilite' });

      const r = compta.reglages(e);
      const periode = () => {
        const du = /^\d{4}-\d{2}-\d{2}$/.test(q.get('du') || '') ? q.get('du') : compta.moisDe().debut;
        const au = /^\d{4}-\d{2}-\d{2}$/.test(q.get('au') || '') ? q.get('au') : compta.moisDe().fin;
        return { du, au };
      };

      // ---- Référentiel : comptes, catégories, opérations ----
      if (p === '/api/mon-entreprise/compta/referentiel' && req.method === 'GET')
        return json(res, 200, Object.assign(compta.referentiel(), { reglages: r }));

      // ---- Tableau de bord comptable ----
      if (p === '/api/mon-entreprise/compta/tableau' && req.method === 'GET') {
        const reprises = synchroniserCompta(e);
        const ecr = ecrituresDe(e);
        return json(res, 200, Object.assign(compta.tableau(e, ecr), {
          reprises,
          evolution: compta.evolution(ecr, undefined, 6),
          /* Une caisse négative est impossible dans la réalité : c'est le
             signe d'une recette oubliée. Mieux vaut le dire que laisser
             l'entreprise croire son résultat. */
          alertes: compta.tresorerie(ecr, '', r.caissesActives).comptes
            .filter((c) => c.solde < 0)
            .map((c) => `La caisse « ${c.nom} » est négative (${c.solde.toLocaleString('fr-HT')} HTG) : une recette n'a probablement pas été saisie.`)
        }));
      }

      // ---- Journal : la liste des écritures ----
      if (p === '/api/mon-entreprise/compta/ecritures' && req.method === 'GET') {
        const { du, au } = periode();
        let liste = ecrituresDe(e).filter((x) => x.date >= du && x.date <= au);
        const op = q.get('operation') || '';
        const cat = q.get('categorie') || '';
        const rech = (q.get('q') || '').toLowerCase().trim();
        if (op) liste = liste.filter((x) => x.operation === op);
        if (cat) liste = liste.filter((x) => x.categorie === cat);
        if (rech) liste = liste.filter((x) =>
          `${x.libelle} ${x.tiersNom} ${x.piece} ${x.note}`.toLowerCase().includes(rech));
        liste.sort((a, b) => b.date.localeCompare(a.date) || b.creeLe.localeCompare(a.creeLe));
        return json(res, 200, {
          du, au, ecritures: liste.slice(0, 500), total: liste.length,
          /* Les totaux ne comptent que ce qui touche le résultat : un
             transfert entre caisses ou un règlement de dette n'est ni
             une recette ni une dépense, seulement de l'argent qui bouge. */
          totalRecettes: liste.reduce((s, x) => s + (signeOperation(x) > 0 ? x.montant : 0), 0),
          totalDepenses: liste.reduce((s, x) => s + (signeOperation(x) < 0 ? x.montant : 0), 0),
          clotureJusquau: r.clotureJusquau
        });
      }

      // ---- Saisie d'une opération ----
      if (p === '/api/mon-entreprise/compta/ecritures' && req.method === 'POST') {
        const resu = compta.construire(e, corps, store.uid);
        if (resu.erreur) return json(res, 400, { erreur: resu.erreur });
        db.ecritures.push(resu.ecriture); store.save();
        return json(res, 200, resu.ecriture);
      }

      const mEc = p.match(/^\/api\/mon-entreprise\/compta\/ecritures\/(\w+)$/);
      if (mEc) {
        const ec = db.ecritures.find((x) => x.id === mEc[1] && x.entrepriseId === e.id);
        if (!ec) return json(res, 404, { erreur: 'Écriture introuvable.' });
        if (r.clotureJusquau && ec.date <= r.clotureJusquau)
          return json(res, 403, { erreur: `Cette écriture est dans une période clôturée (jusqu'au ${r.clotureJusquau}).` });
        /* Une écriture issue d'une vente de la plateforme n'est pas
           modifiable : la corriger ici la ferait mentir par rapport à
           la commande. On peut en revanche l'annuler par une écriture
           inverse, ce qui laisse une trace. */
        if (ec.auto && req.method === 'PUT')
          return json(res, 403, { erreur: 'Cette écriture provient d\'une vente enregistrée sur la plateforme. Elle ne se modifie pas à la main.' });

        if (req.method === 'PUT') {
          const resu = compta.construire(e, Object.assign({}, ec, corps), () => ec.id);
          if (resu.erreur) return json(res, 400, { erreur: resu.erreur });
          Object.assign(ec, resu.ecriture, { creeLe: ec.creeLe, modifieLe: new Date().toISOString() });
          store.save(); return json(res, 200, ec);
        }
        if (req.method === 'DELETE') {
          db.ecritures = db.ecritures.filter((x) => x !== ec);
          store.save(); return json(res, 200, { ok: true });
        }
      }

      // ---- États ----
      if (p === '/api/mon-entreprise/compta/resultat' && req.method === 'GET') {
        const { du, au } = periode();
        return json(res, 200, compta.resultat(ecrituresDe(e), du, au));
      }
      if (p === '/api/mon-entreprise/compta/tresorerie' && req.method === 'GET') {
        const ecr = ecrituresDe(e);
        const { au } = periode();
        return json(res, 200, Object.assign(compta.tresorerie(ecr, au, r.caissesActives),
          { evolution: compta.evolution(ecr, undefined, 6) }));
      }
      if (p === '/api/mon-entreprise/compta/balance' && req.method === 'GET') {
        const { du, au } = periode();
        return json(res, 200, compta.balance(ecrituresDe(e), du, au));
      }
      if (p === '/api/mon-entreprise/compta/grand-livre' && req.method === 'GET') {
        const { du, au } = periode();
        const c = q.get('compte') || '';
        if (!compta.COMPTES[c]) return json(res, 400, { erreur: 'Compte inconnu.' });
        return json(res, 200, compta.grandLivre(ecrituresDe(e), c, du, au));
      }
      if (p === '/api/mon-entreprise/compta/tiers' && req.method === 'GET') {
        const ecr = ecrituresDe(e);
        return json(res, 200, { clients: compta.tiers(ecr, 'client'), fournisseurs: compta.tiers(ecr, 'fournisseur') });
      }
      if (p === '/api/mon-entreprise/compta/tca' && req.method === 'GET') {
        if (!r.tcaAssujetti) return json(res, 200, { assujetti: false });
        const { du, au } = periode();
        return json(res, 200, Object.assign({ assujetti: true }, compta.tca(ecrituresDe(e), du, au, r.tcaTaux)));
      }

      // ---- Réglages comptables ----
      if (p === '/api/mon-entreprise/compta/reglages' && req.method === 'GET')
        return json(res, 200, r);
      if (p === '/api/mon-entreprise/compta/reglages' && req.method === 'PUT') {
        e.compta = e.compta || {};
        if (corps.tcaAssujetti !== undefined) e.compta.tcaAssujetti = !!corps.tcaAssujetti;
        if (corps.tcaTaux !== undefined) {
          const t = +corps.tcaTaux;
          if (!(t >= 0 && t <= 0.5)) return json(res, 400, { erreur: 'Taux de TCA invalide.' });
          e.compta.tcaTaux = t;
        }
        if (corps.debutExercice !== undefined) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(corps.debutExercice)) return json(res, 400, { erreur: 'Date de début d\'exercice invalide.' });
          e.compta.debutExercice = corps.debutExercice;
        }
        if (corps.caisseDefaut !== undefined) {
          if (!compta.COMPTES[corps.caisseDefaut] || !compta.COMPTES[corps.caisseDefaut].tresorerie)
            return json(res, 400, { erreur: 'Caisse par défaut invalide.' });
          e.compta.caisseDefaut = corps.caisseDefaut;
        }
        if (corps.caissesActives !== undefined) {
          const liste = (Array.isArray(corps.caissesActives) ? corps.caissesActives : [])
            .filter((x) => compta.COMPTES[x] && compta.COMPTES[x].tresorerie);
          if (!liste.length) return json(res, 400, { erreur: 'Gardez au moins une caisse.' });
          e.compta.caissesActives = [...new Set(liste)];
        }
        store.save();
        return json(res, 200, compta.reglages(e));
      }

      /* ---- Clôture d'une période ----
         Verrouille les écritures jusqu'à une date, pour qu'un mois
         déjà déclaré ne change plus dans le dos de l'entreprise.
         Réversible : c'est une protection, pas une sanction. */
      if (p === '/api/mon-entreprise/compta/cloture' && req.method === 'POST') {
        const jusqua = String(corps.jusquau || '').slice(0, 10);
        if (corps.rouvrir) {
          e.compta = e.compta || {}; e.compta.clotureJusquau = '';
          store.save();
          return json(res, 200, { ok: true, clotureJusquau: '' });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(jusqua)) return json(res, 400, { erreur: 'Date de clôture invalide.' });
        if (jusqua > compta.aujourdhui()) return json(res, 400, { erreur: 'On ne clôture pas une période à venir.' });
        const b = compta.balance(ecrituresDe(e), '', jusqua);
        if (b.totalDebit !== b.totalCredit)
          return json(res, 409, { erreur: 'La balance de la période n\'est pas équilibrée. Clôture refusée.' });
        e.compta = e.compta || {}; e.compta.clotureJusquau = jusqua;
        store.save();
        return json(res, 200, { ok: true, clotureJusquau: jusqua, resultat: compta.resultat(ecrituresDe(e), r.debutExercice, jusqua) });
      }

      // ---- Export pour le comptable ----
      if (p === '/api/mon-entreprise/compta/export.csv' && req.method === 'GET') {
        const { du, au } = periode();
        const csv = compta.exportCSV(ecrituresDe(e), du, au);
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="comptabilite-${e.slug}-${du}_${au}.csv"`,
          'Cache-Control': 'no-store'
        });
        return res.end(csv);
      }

      return json(res, 404, { erreur: 'Route comptable inconnue.' });
    }

    // ================= Module catalogue =================
    if (p.startsWith('/api/mon-entreprise/produits') && !metiers.aModule(e, 'catalogue'))
      return json(res, 403, { erreur: 'Le module Catalogue n\'est pas disponible pour votre type d\'activité.' });

    if (p === '/api/mon-entreprise/produits' && req.method === 'GET') {
      const liste = db.produits.filter((x) => x.entrepriseId === e.id);
      const rayons = [...new Set([...metiers.rayonsDe(e.metier), ...liste.map((x) => x.rayon).filter(Boolean)])];
      return json(res, 200, {
        produits: liste,
        rayons,
        alertes: liste.filter((x) => x.stock !== null && x.stock <= x.seuilAlerte).length
      });
    }

    if (p === '/api/mon-entreprise/produits' && req.method === 'POST') {
      if (!corps.nom || !(+corps.prix > 0)) return json(res, 400, { erreur: 'Nom et prix obligatoires.' });
      const nbProduits = db.produits.filter((x) => x.entrepriseId === e.id).length;
      const limiteP = forfaits.limiteAtteinte(e, 'produits', nbProduits);
      if (limiteP) return json(res, 403, { erreur: limiteP, limite: true });
      const galeriePr = nettoyerPhotos(corps.photos !== undefined ? corps.photos : corps.photo, []);
      if (galeriePr === null) return json(res, 400, { erreur: 'Une photo est invalide ou trop lourde (900 Ko maximum).' });
      const pr = {
        id: store.uid(), entrepriseId: e.id,
        nom: String(corps.nom).slice(0, 90),
        description: String(corps.description || '').slice(0, 300),
        rayon: String(corps.rayon || '').slice(0, 50),
        reference: String(corps.reference || '').slice(0, 40),
        marque: String(corps.marque || '').slice(0, 50),
        prix: Math.max(1, +corps.prix),
        prixPromo: corps.prixPromo ? Math.max(0, +corps.prixPromo) : 0,
        unite: String(corps.unite || '').slice(0, 24),
        // stock null = quantité non suivie
        stock: corps.stock === null || corps.stock === '' || corps.stock === undefined ? null : Math.max(0, Math.min(+corps.stock || 0, 1000000)),
        seuilAlerte: Math.max(0, Math.min(+corps.seuilAlerte || 0, 100000)),
        photos: galeriePr, photo: galeriePr[0] || '',
        video: nettoyerVideo(corps.video),
        disponible: corps.disponible === undefined ? true : !!corps.disponible,
        /* Produit annoncé avant son arrivée : visible, signalé
           « Bientôt disponible », jamais vendu comme s'il était en stock. */
        bientot: !!corps.bientot,
        dateDispo: dateSimple(corps.dateDispo),
        // L'entreprise accepte-t-elle d'encaisser avant d'avoir la marchandise ?
        precommande: !!corps.precommande,
        /* Ce produit est-il proposé au paiement par versement ? Ne compte
           que si l'entreprise a choisi d'y aller produit par produit. */
        versement: !!corps.versement,
        creeLe: new Date().toISOString()
      };
      db.produits.push(pr); store.save(); return json(res, 200, pr);
    }

    const mProd = p.match(/^\/api\/mon-entreprise\/produits\/(\w+)$/);
    if (mProd) {
      const pr = db.produits.find((x) => x.id === mProd[1] && x.entrepriseId === e.id);
      if (!pr) return json(res, 404, { erreur: 'Produit introuvable' });
      if (req.method === 'PUT') {
        if (corps.nom) pr.nom = String(corps.nom).slice(0, 90);
        if (corps.description !== undefined) pr.description = String(corps.description).slice(0, 300);
        if (corps.rayon !== undefined) pr.rayon = String(corps.rayon).slice(0, 50);
        if (corps.reference !== undefined) pr.reference = String(corps.reference).slice(0, 40);
        if (corps.marque !== undefined) pr.marque = String(corps.marque).slice(0, 50);
        if (corps.prix) pr.prix = Math.max(1, +corps.prix);
        if (corps.prixPromo !== undefined) pr.prixPromo = corps.prixPromo ? Math.max(0, +corps.prixPromo) : 0;
        if (corps.unite !== undefined) pr.unite = String(corps.unite).slice(0, 24);
        if (corps.stock !== undefined)
          pr.stock = corps.stock === null || corps.stock === '' ? null : Math.max(0, Math.min(+corps.stock || 0, 1000000));
        if (corps.seuilAlerte !== undefined) pr.seuilAlerte = Math.max(0, Math.min(+corps.seuilAlerte || 0, 100000));
        if (corps.photos !== undefined || corps.photo !== undefined) {
          const g = nettoyerPhotos(corps.photos !== undefined ? corps.photos : corps.photo, pr.photos);
          if (g === null) return json(res, 400, { erreur: 'Une photo est invalide ou trop lourde (900 Ko maximum).' });
          pr.photos = g;
          pr.photo = g[0] || '';
        }
        if (corps.video !== undefined) pr.video = nettoyerVideo(corps.video);
        if (corps.disponible !== undefined) pr.disponible = !!corps.disponible;
        if (corps.bientot !== undefined) pr.bientot = !!corps.bientot;
        if (corps.dateDispo !== undefined) pr.dateDispo = dateSimple(corps.dateDispo);
        if (corps.precommande !== undefined) pr.precommande = !!corps.precommande;
        if (corps.versement !== undefined) pr.versement = !!corps.versement;
        // Mouvement de stock rapide : +N ou -N
        if (corps.mouvement !== undefined && pr.stock !== null)
          pr.stock = Math.max(0, Math.min(pr.stock + (+corps.mouvement || 0), 1000000));
        store.save(); return json(res, 200, pr);
      }
      if (req.method === 'DELETE') {
        db.produits = db.produits.filter((x) => x !== pr);
        store.save(); return json(res, 200, { ok: true });
      }
    }

    // ================= Module urgences =================
    if (p.startsWith('/api/mon-entreprise/urgence') && !metiers.aModule(e, 'urgences'))
      return json(res, 403, { erreur: 'Le module Urgences n\'est pas disponible pour votre type d\'activité.' });

    if (p === '/api/mon-entreprise/urgence' && req.method === 'GET')
      return json(res, 200, {
        urgence: e.urgence || {},
        capacites: metiers.CAPACITES_URGENCE,
        etats: metiers.ETATS_URGENCE
      });

    if (p === '/api/mon-entreprise/urgence' && req.method === 'PUT') {
      const u = e.urgence || {};
      if (corps.actif !== undefined) u.actif = !!corps.actif;
      if (corps.permanence !== undefined) u.permanence = !!corps.permanence;   // 24h/24
      if (corps.telephone !== undefined) u.telephone = String(corps.telephone).replace(/[^\d+ ]/g, '').slice(0, 20);
      if (corps.telephone2 !== undefined) u.telephone2 = String(corps.telephone2).replace(/[^\d+ ]/g, '').slice(0, 20);
      if (corps.ambulance !== undefined) u.ambulance = !!corps.ambulance;
      if (corps.telAmbulance !== undefined) u.telAmbulance = String(corps.telAmbulance).replace(/[^\d+ ]/g, '').slice(0, 20);
      if (corps.capacites !== undefined) u.capacites = metiers.nettoyerCapacites(corps.capacites);
      if (corps.consigne !== undefined) u.consigne = String(corps.consigne).slice(0, 300);
      if (corps.horaires !== undefined) u.horaires = String(corps.horaires).slice(0, 120);
      // Garde (pharmacies) : période déclarée
      if (corps.gardeDebut !== undefined) u.gardeDebut = String(corps.gardeDebut).slice(0, 10);
      if (corps.gardeFin !== undefined) u.gardeFin = String(corps.gardeFin).slice(0, 10);
      // État d'affluence, horodaté pour signaler une information ancienne
      if (corps.etat !== undefined) {
        if (!metiers.ETATS_URGENCE.some((x) => x.cle === corps.etat))
          return json(res, 400, { erreur: 'État invalide.' });
        u.etat = corps.etat;
        u.etatMaj = new Date().toISOString();
      }
      e.urgence = u; store.save();
      return json(res, 200, u);
    }

    // ================= Module dossiers =================
    if (p.startsWith('/api/mon-entreprise/dossiers') && !metiers.aModule(e, 'dossiers'))
      return json(res, 403, { erreur: 'Le module Dossiers n\'est pas disponible pour votre type d\'activité.' });

    if (p === '/api/mon-entreprise/dossiers' && req.method === 'GET') {
      const liste = db.dossiers.filter((d) => d.entrepriseId === e.id)
        .sort((a, b) => b.majLe.localeCompare(a.majLe));
      return json(res, 200, { dossiers: liste, etapes: metiers.etapesDe(e.metier),
                              pieces: metiers.PIECES_DOSSIER[e.metier] || [] });
    }

    if (p === '/api/mon-entreprise/dossiers' && req.method === 'POST') {
      if (!corps.clientNom || !corps.objet)
        return json(res, 400, { erreur: 'Le nom du client et l\'objet du dossier sont obligatoires.' });
      const etapes = metiers.etapesDe(e.metier);
      const maintenant = new Date().toISOString();
      const d = {
        id: store.uid(), entrepriseId: e.id,
        reference: 'D' + Date.now().toString(36).toUpperCase().slice(-6),
        objet: String(corps.objet).slice(0, 120),
        description: String(corps.description || '').slice(0, 600),
        clientNom: String(corps.clientNom).slice(0, 90),
        clientTel: String(corps.clientTel || '').slice(0, 20),
        clientEmail: String(corps.clientEmail || '').slice(0, 90),
        localisation: String(corps.localisation || '').slice(0, 140),
        statut: 'ouvert',
        etape: etapes[0].cle,
        pieces: Array.isArray(corps.pieces)
          ? corps.pieces.map((x) => ({ nom: String(x.nom || x).slice(0, 80), fournie: !!x.fournie })).slice(0, 25)
          : [],
        honoraires: Math.max(0, +corps.honoraires || 0),
        avance: Math.max(0, +corps.avance || 0),
        echeance: String(corps.echeance || '').slice(0, 10),
        journal: [{ le: maintenant, texte: 'Dossier ouvert' }],
        creeLe: maintenant, majLe: maintenant
      };
      db.dossiers.push(d); store.save();
      courrielClient(d.clientEmail, 'dossier_ouvert', {
        nom: d.clientNom, entreprise: e.nom, objet: d.objet, reference: d.reference,
        lienSuivi: lienAchats(req, d.clientEmail), couleur: e.couleur
      });
      return json(res, 200, d);
    }

    const mDos = p.match(/^\/api\/mon-entreprise\/dossiers\/(\w+)$/);
    if (mDos) {
      const d = db.dossiers.find((x) => x.id === mDos[1] && x.entrepriseId === e.id);
      if (!d) return json(res, 404, { erreur: 'Dossier introuvable' });
      if (req.method === 'PUT') {
        const etapes = metiers.etapesDe(e.metier);
        const avant = { etape: d.etape, statut: d.statut };
        if (corps.objet) d.objet = String(corps.objet).slice(0, 120);
        if (corps.description !== undefined) d.description = String(corps.description).slice(0, 600);
        if (corps.clientNom) d.clientNom = String(corps.clientNom).slice(0, 90);
        if (corps.clientTel !== undefined) d.clientTel = String(corps.clientTel).slice(0, 20);
        if (corps.clientEmail !== undefined) d.clientEmail = String(corps.clientEmail).slice(0, 90);
        if (corps.localisation !== undefined) d.localisation = String(corps.localisation).slice(0, 140);
        if (corps.honoraires !== undefined) d.honoraires = Math.max(0, +corps.honoraires || 0);
        if (corps.avance !== undefined) d.avance = Math.max(0, +corps.avance || 0);
        if (corps.echeance !== undefined) d.echeance = String(corps.echeance).slice(0, 10);
        if (corps.pieces !== undefined && Array.isArray(corps.pieces))
          d.pieces = corps.pieces.map((x) => ({ nom: String(x.nom || x).slice(0, 80), fournie: !!x.fournie })).slice(0, 25);
        if (corps.etape !== undefined) {
          if (!etapes.some((x) => x.cle === corps.etape)) return json(res, 400, { erreur: 'Étape invalide.' });
          d.etape = corps.etape;
        }
        if (corps.statut !== undefined) {
          if (!metiers.STATUTS_DOSSIER.some((s) => s.cle === corps.statut)) return json(res, 400, { erreur: 'Statut invalide.' });
          d.statut = corps.statut;
        }
        if (corps.note) d.journal.push({ le: new Date().toISOString(), texte: String(corps.note).slice(0, 200) });
        // Journal automatique des changements d'étape et de statut
        if (avant.etape !== d.etape) {
          const lib = etapes.find((x) => x.cle === d.etape);
          d.journal.push({ le: new Date().toISOString(), texte: 'Étape : ' + (lib ? lib.fr : d.etape) });
          if (d.clientTel && corps.prevenir !== false)
            courrielClient(d.clientEmail, 'dossier_etape', {
                nom: d.clientNom, entreprise: e.nom, objet: d.objet,
                etape: lib ? lib.fr : d.etape, reference: d.reference,
                lienSuivi: lienAchats(req, d.clientEmail), couleur: e.couleur
              });
        }
        if (avant.statut !== d.statut) {
          const s = metiers.STATUTS_DOSSIER.find((x) => x.cle === d.statut);
          d.journal.push({ le: new Date().toISOString(), texte: 'Statut : ' + (s ? s.fr : d.statut) });
        }
        d.journal = d.journal.slice(-60);
        d.majLe = new Date().toISOString();
        store.save(); return json(res, 200, d);
      }
      if (req.method === 'DELETE') {
        db.dossiers = db.dossiers.filter((x) => x !== d);
        store.save(); return json(res, 200, { ok: true });
      }
    }

    // ================= Module scolaire =================
    if ((p.startsWith('/api/mon-entreprise/programmes') || p.startsWith('/api/mon-entreprise/inscriptions'))
        && !metiers.aModule(e, 'inscriptions'))
      return json(res, 403, { erreur: 'Le module Inscriptions n\'est pas disponible pour votre type d\'activité.' });

    // ---- Programmes (niveaux, filières, formations) ----
    if (p === '/api/mon-entreprise/programmes' && req.method === 'GET') {
      const liste = db.programmes.filter((x) => x.entrepriseId === e.id).map((x) => ({
        ...x, inscrits: db.inscriptions.filter((i) => i.programmeId === x.id && i.statut === 'inscrit').length,
        demandes: db.inscriptions.filter((i) => i.programmeId === x.id && i.statut === 'en_attente').length
      }));
      return json(res, 200, liste);
    }

    if (p === '/api/mon-entreprise/programmes' && req.method === 'POST') {
      if (!corps.nom) return json(res, 400, { erreur: 'Le nom du programme est obligatoire.' });
      const limiteProg = forfaits.limiteAtteinte(e, 'programmes',
        db.programmes.filter((x) => x.entrepriseId === e.id).length);
      if (limiteProg) return json(res, 403, { erreur: limiteProg, limite: true });
      const pr = {
        id: store.uid(), entrepriseId: e.id,
        nom: String(corps.nom).slice(0, 90),
        description: String(corps.description || '').slice(0, 400),
        anneeScolaire: String(corps.anneeScolaire || '').slice(0, 20),
        places: Math.max(0, Math.min(+corps.places || 0, 5000)),
        fraisInscription: Math.max(0, +corps.fraisInscription || 0),
        scolarite: Math.max(0, +corps.scolarite || 0),
        periodicite: ['mensuel', 'trimestriel', 'annuel'].includes(corps.periodicite) ? corps.periodicite : 'mensuel',
        documents: Array.isArray(corps.documents) ? corps.documents.map((d) => String(d).slice(0, 80)).slice(0, 15) : [],
        ouvert: corps.ouvert === undefined ? true : !!corps.ouvert,
        creeLe: new Date().toISOString()
      };
      db.programmes.push(pr); store.save(); return json(res, 200, pr);
    }

    const mProg = p.match(/^\/api\/mon-entreprise\/programmes\/(\w+)$/);
    if (mProg) {
      const pr = db.programmes.find((x) => x.id === mProg[1] && x.entrepriseId === e.id);
      if (!pr) return json(res, 404, { erreur: 'Programme introuvable' });
      if (req.method === 'PUT') {
        if (corps.nom) pr.nom = String(corps.nom).slice(0, 90);
        if (corps.description !== undefined) pr.description = String(corps.description).slice(0, 400);
        if (corps.anneeScolaire !== undefined) pr.anneeScolaire = String(corps.anneeScolaire).slice(0, 20);
        if (corps.places !== undefined) pr.places = Math.max(0, Math.min(+corps.places || 0, 5000));
        if (corps.fraisInscription !== undefined) pr.fraisInscription = Math.max(0, +corps.fraisInscription || 0);
        if (corps.scolarite !== undefined) pr.scolarite = Math.max(0, +corps.scolarite || 0);
        if (corps.periodicite && ['mensuel', 'trimestriel', 'annuel'].includes(corps.periodicite)) pr.periodicite = corps.periodicite;
        if (corps.documents !== undefined) pr.documents = Array.isArray(corps.documents) ? corps.documents.map((d) => String(d).slice(0, 80)).slice(0, 15) : [];
        if (corps.ouvert !== undefined) pr.ouvert = !!corps.ouvert;
        store.save(); return json(res, 200, pr);
      }
      if (req.method === 'DELETE') {
        if (db.inscriptions.some((i) => i.programmeId === pr.id))
          return json(res, 409, { erreur: 'Ce programme a des inscriptions. Fermez-le plutôt que de le supprimer.' });
        db.programmes = db.programmes.filter((x) => x !== pr);
        store.save(); return json(res, 200, { ok: true });
      }
    }

    // ---- Demandes d'inscription reçues ----
    if (p === '/api/mon-entreprise/inscriptions' && req.method === 'GET') {
      const liste = db.inscriptions.filter((i) => i.entrepriseId === e.id)
        .sort((a, b) => b.creeLe.localeCompare(a.creeLe))
        .map((i) => ({ ...i, programme: db.programmes.find((x) => x.id === i.programmeId) || null }));
      return json(res, 200, liste);
    }

    const mIns = p.match(/^\/api\/mon-entreprise\/inscriptions\/(\w+)$/);
    if (mIns && req.method === 'PUT') {
      const i = db.inscriptions.find((x) => x.id === mIns[1] && x.entrepriseId === e.id);
      if (!i) return json(res, 404, { erreur: 'Demande introuvable' });
      const STATUTS = ['en_attente', 'acceptee', 'inscrit', 'refusee'];
      if (corps.statut !== undefined) {
        if (!STATUTS.includes(corps.statut)) return json(res, 400, { erreur: 'Statut invalide.' });
        // Contrôle des places au moment de valider l'inscription
        if (corps.statut === 'inscrit' && i.statut !== 'inscrit') {
          const pr = db.programmes.find((x) => x.id === i.programmeId);
          if (pr && pr.places > 0) {
            const pris = db.inscriptions.filter((x) => x.programmeId === pr.id && x.statut === 'inscrit').length;
            if (pris >= pr.places) return json(res, 409, { erreur: 'Toutes les places de ce programme sont prises.' });
          }
        }
        i.statut = corps.statut;
      }
      if (corps.note !== undefined) i.note = String(corps.note).slice(0, 300);
      store.save();
      const pr = db.programmes.find((x) => x.id === i.programmeId);
      const libelles = { acceptee: 'acceptée', inscrit: 'confirmée', refusee: 'refusée', en_attente: 'en attente' };
      if (['acceptee', 'inscrit', 'refusee'].includes(i.statut))
        courrielClient(i.parentEmail, 'inscription_statut', {
          nom: i.parentNom, entreprise: e.nom, eleve: i.eleveNom,
          programme: pr ? pr.nom : '', statut: libelles[i.statut],
          consigne: i.note || '', couleur: e.couleur
        });
      return json(res, 200, i);
    }

    // ---- Carte restaurant & bar (gestion) ----
    if (p === '/api/mon-entreprise/carte' && req.method === 'GET')
      return json(res, 200, db.carte.filter((a) => a.entrepriseId === e.id));

    if (p === '/api/mon-entreprise/carte' && req.method === 'POST') {
      if (!corps.nom || !(+corps.prix > 0)) return json(res, 400, { erreur: 'Nom et prix obligatoires.' });
      if (!CATEGORIES_CARTE.includes(corps.categorie)) return json(res, 400, { erreur: 'Catégorie invalide.' });
      if (corps.photo && !(String(corps.photo).startsWith('data:image/') && corps.photo.length <= 900000))
        return json(res, 400, { erreur: 'Photo invalide ou trop lourde.' });
      const a = {
        id: store.uid(), entrepriseId: e.id,
        nom: String(corps.nom).slice(0, 80),
        description: String(corps.description || '').slice(0, 300),
        categorie: corps.categorie,
        prix: Math.max(1, +corps.prix),
        volume: String(corps.volume || '').slice(0, 40),
        photo: corps.photo || '',
        disponible: corps.disponible === undefined ? true : !!corps.disponible
      };
      db.carte.push(a); store.save(); return json(res, 200, a);
    }

    const mCarte = p.match(/^\/api\/mon-entreprise\/carte\/(\w+)$/);
    if (mCarte) {
      const a = db.carte.find((x) => x.id === mCarte[1] && x.entrepriseId === e.id);
      if (!a) return json(res, 404, { erreur: 'Article introuvable' });
      if (req.method === 'PUT') {
        if (corps.nom) a.nom = String(corps.nom).slice(0, 80);
        if (corps.description !== undefined) a.description = String(corps.description).slice(0, 300);
        if (corps.categorie !== undefined) {
          if (!CATEGORIES_CARTE.includes(corps.categorie)) return json(res, 400, { erreur: 'Catégorie invalide.' });
          a.categorie = corps.categorie;
        }
        if (corps.prix) a.prix = Math.max(1, +corps.prix);
        if (corps.volume !== undefined) a.volume = String(corps.volume).slice(0, 40);
        if (corps.photo !== undefined) {
          if (corps.photo && !(String(corps.photo).startsWith('data:image/') && corps.photo.length <= 900000))
            return json(res, 400, { erreur: 'Photo invalide ou trop lourde.' });
          a.photo = corps.photo;
        }
        if (corps.disponible !== undefined) a.disponible = !!corps.disponible;
        store.save(); return json(res, 200, a);
      }
      if (req.method === 'DELETE') {
        db.carte = db.carte.filter((x) => x !== a);
        store.save(); return json(res, 200, { ok: true });
      }
    }

    if (p === '/api/mon-entreprise/chambres' && req.method === 'GET')
      return json(res, 200, db.chambres.filter((c) => c.entrepriseId === e.id));
    if (p === '/api/mon-entreprise/chambres' && req.method === 'POST') {
      if (!corps.nom || !(+corps.prixNuit > 0)) return json(res, 400, { erreur: 'Nom et prix par nuit obligatoires.' });
      const limiteCh = forfaits.limiteAtteinte(e, 'chambres',
        db.chambres.filter((x) => x.entrepriseId === e.id).length);
      if (limiteCh) return json(res, 403, { erreur: limiteCh, limite: true });
      const galerie = nettoyerPhotos(corps.photos !== undefined ? corps.photos : corps.photo, []);
      if (galerie === null) return json(res, 400, { erreur: 'Une photo est invalide ou trop lourde (900 Ko maximum).' });
      const c = {
        id: store.uid(), entrepriseId: e.id, nom: String(corps.nom).slice(0, 60),
        description: String(corps.description || '').slice(0, 300),
        prixNuit: Math.max(1, +corps.prixNuit), capacite: Math.max(1, Math.min(+corps.capacite || 2, 20)),
        quantite: Math.max(1, Math.min(+corps.quantite || 1, 200)),
        photos: galerie, photo: galerie[0] || '',
        equipements: nettoyerEquipements(corps.equipements), actif: true
      };
      db.chambres.push(c); store.save(); return json(res, 200, c);
    }
    const mChb = p.match(/^\/api\/mon-entreprise\/chambres\/(\w+)$/);
    if (mChb) {
      const c = db.chambres.find((x) => x.id === mChb[1] && x.entrepriseId === e.id);
      if (!c) return json(res, 404, { erreur: 'Chambre introuvable' });
      if (req.method === 'PUT') {
        if (corps.nom) c.nom = String(corps.nom).slice(0, 60);
        if (corps.description !== undefined) c.description = String(corps.description).slice(0, 300);
        if (corps.prixNuit) c.prixNuit = Math.max(1, +corps.prixNuit);
        if (corps.capacite) c.capacite = Math.max(1, Math.min(+corps.capacite, 20));
        if (corps.quantite) c.quantite = Math.max(1, Math.min(+corps.quantite, 200));
        if (corps.photos !== undefined || corps.photo !== undefined) {
          const g = nettoyerPhotos(corps.photos !== undefined ? corps.photos : corps.photo, c.photos);
          if (g === null) return json(res, 400, { erreur: 'Une photo est invalide ou trop lourde (900 Ko maximum).' });
          c.photos = g;
          c.photo = g[0] || '';   // vignette : toujours la première
        }
        if (corps.equipements !== undefined) c.equipements = nettoyerEquipements(corps.equipements);
        if (corps.actif !== undefined) c.actif = !!corps.actif;
        store.save(); return json(res, 200, c);
      }
      if (req.method === 'DELETE') {
        db.chambres = db.chambres.filter((x) => x !== c);
        store.save(); return json(res, 200, { ok: true });
      }
    }

    // ---- Séjours du responsable ----
    if (p === '/api/sejours' && req.method === 'GET') {
      const liste = db.sejours.filter((s) => s.entrepriseId === e.id)
        .sort((a, b) => b.creeLe.localeCompare(a.creeLe))
        .map((s) => ({ ...s, chambre: db.chambres.find((c) => c.id === s.chambreId) || null }));
      return json(res, 200, liste);
    }
    const mSej = p.match(/^\/api\/sejours\/(\w+)$/);
    if (mSej && req.method === 'PUT') {
      const s = db.sejours.find((x) => x.id === mSej[1] && x.entrepriseId === e.id);
      if (!s) return json(res, 404, { erreur: 'Séjour introuvable' });
      if (corps.statut && ['confirme', 'annule', 'termine', 'en_attente'].includes(corps.statut)) {
        s.statut = corps.statut;
        const c = db.chambres.find((x) => x.id === s.chambreId);
        const libelle = { confirme: 'confirmé', annule: 'annulé', termine: 'terminé', en_attente: 'remis en attente' }[corps.statut];
        if (['confirme', 'annule'].includes(corps.statut))
          courrielClient(s.clientEmail, 'sejour_statut', {
            nom: s.clientNom, entreprise: e.nom, statut: libelle,
            arrivee: s.arrivee, depart: s.depart, nuits: s.nuits,
            adresse: e.adresse || '', couleur: e.couleur
          });
        store.save(); return json(res, 200, s);
      }
      return json(res, 400, { erreur: 'Statut invalide' });
    }

    // ---- Portefeuille et transactions ----
    if (p === '/api/mon-entreprise/portefeuille' && req.method === 'GET') {
      const port = creerOuObtenirPortefeuille(e.id);
      const transactions = db.paiements.filter((x) => x.entrepriseId === e.id)
        .sort((a, b) => b.creeLe.localeCompare(a.creeLe))
        .slice(0, 50);  // 50 dernières
      const retraits = db.retraits.filter((x) => x.entrepriseId === e.id)
        .sort((a, b) => b.demandeLe.localeCompare(a.demandeLe));
      const enAttente = db.paiements.filter((x) => x.entrepriseId === e.id && x.statut === 'en_attente').length;
      return json(res, 200, { portefeuille: port, transactions, retraits, enAttente });
    }

    /* ---- Comptes sur lesquels l'entreprise encaisse elle-même ----
       Ces coordonnées sont destinées à être montrées aux clients : rien
       de secret n'y figure, contrairement aux identifiants marchands. */
    if (p === '/api/mon-entreprise/comptes' && req.method === 'GET')
      return json(res, 200, {
        comptes: e.comptesPaiement || [],
        types: TYPES_COMPTE,
        actif: !!(e.vente && e.vente.paiementDirect)
      });

    if (p === '/api/mon-entreprise/comptes' && req.method === 'PUT') {
      e.comptesPaiement = nettoyerComptes(corps.comptes, e.comptesPaiement);
      e.vente = e.vente || {};
      if (corps.actif !== undefined)
        e.vente.paiementDirect = !!corps.actif && e.comptesPaiement.some((c) => c.actif);
      /* Plus aucun compte utilisable : l'option s'éteint d'elle-même plutôt
         que de promettre au client un moyen de payer qui n'existe plus. */
      if (!e.comptesPaiement.some((c) => c.actif)) e.vente.paiementDirect = false;
      store.save();
      return json(res, 200, { ok: true, comptes: e.comptesPaiement, actif: !!e.vente.paiementDirect });
    }

    /* ---- Identifiants marchands de l'entreprise ----
       Le secret n'est jamais renvoyé : on en montre les quatre derniers
       caractères pour que l'entreprise reconnaisse la clé qu'elle a posée. */
    if (p === '/api/mon-entreprise/passerelle' && req.method === 'GET') {
      const g = e.passerelle || {};
      const fournisseur = g.fournisseur || 'plop';
      /* Les valeurs ordinaires reviennent telles quelles — une adresse ou
         un chemin de lecture n'a rien de confidentiel. Les secrets, eux,
         ne sortent jamais : seuls leurs quatre derniers caractères. */
      const secrets = passerelles.champsSecrets(fournisseur);
      const valeurs = {}, apercus = {};
      for (const [cle, v] of Object.entries(g.identifiants || {})) {
        if (secrets.includes(cle)) apercus[cle] = masquer(dechiffrer(v));
        else valeurs[cle] = v;
      }
      return json(res, 200, {
        actif: !!g.actif, fournisseur,
        valeurs, apercus,
        catalogue: passerelles.catalogue(),
        manquants: passerelles.champsManquants(fournisseur,
          Object.assign({}, valeurs, Object.fromEntries(secrets.map((c) => [c, (g.identifiants || {})[c] ? 'x' : ''])))),
        majLe: g.majLe || ''
      });
    }

    if (p === '/api/mon-entreprise/passerelle' && req.method === 'PUT') {
      const g = e.passerelle || {};
      if (corps.effacer) {
        e.passerelle = { fournisseur: g.fournisseur || 'plop', identifiants: {}, actif: false,
                         majLe: new Date().toISOString() };
        store.save();
        return json(res, 200, { ok: true, actif: false, valeurs: {}, apercus: {} });
      }
      /* Changer de fournisseur remet les identifiants à zéro : ceux de
         l'ancien n'ont aucun sens chez le nouveau, et les garder ferait
         croire à une configuration encore valable. */
      if (corps.fournisseur !== undefined && passerelles.FOURNISSEURS[corps.fournisseur]
          && corps.fournisseur !== g.fournisseur) {
        g.fournisseur = corps.fournisseur;
        g.identifiants = {};
        g.actif = false;
      }
      g.fournisseur = g.fournisseur || 'plop';
      const secrets = passerelles.champsSecrets(g.fournisseur);
      const connus = passerelles.FOURNISSEURS[g.fournisseur].champs.map((c) => c.cle);
      g.identifiants = g.identifiants || {};
      for (const [cle, v] of Object.entries(corps.valeurs || {})) {
        if (!connus.includes(cle)) continue;
        const texte = String(v == null ? '' : v).trim().slice(0, 1200);
        /* Un secret laissé vide signifie « ne change rien » : le formulaire
           ne peut pas réafficher l'ancien, il ne doit pas l'effacer. */
        if (secrets.includes(cle)) { if (texte) g.identifiants[cle] = chiffrer(texte); }
        else g.identifiants[cle] = texte;
      }
      if (corps.actif !== undefined) g.actif = !!corps.actif;
      if (g.actif) {
        const pourControle = Object.assign({}, g.identifiants);
        for (const cle of secrets) pourControle[cle] = g.identifiants[cle] ? 'x' : '';
        const manquants = passerelles.champsManquants(g.fournisseur, pourControle);
        if (manquants.length)
          return json(res, 400, { erreur: 'Complétez d’abord : ' + manquants.join(', ') + '.' });
      }
      g.majLe = new Date().toISOString();
      e.passerelle = g; store.save();
      const valeurs = {}, apercus = {};
      for (const [cle, v] of Object.entries(g.identifiants)) {
        if (secrets.includes(cle)) apercus[cle] = masquer(dechiffrer(v));
        else valeurs[cle] = v;
      }
      return json(res, 200, { ok: true, actif: !!g.actif, fournisseur: g.fournisseur, valeurs, apercus });
    }

    /* ---- Confronter les règlements en attente à la passerelle ----
       Le rattrapage tourne déjà toutes les heures ; ce bouton existe pour
       l'entreprise qui vient d'encaisser et ne veut pas patienter. */
    if (p === '/api/mon-entreprise/portefeuille/verifier' && req.method === 'POST') {
      const r = await rattraperPaiements(e.id);
      if (r.inactive) return json(res, 503, { erreur: 'Passerelle de paiement non configurée.' });
      if (r.occupe) return json(res, 429, { erreur: 'Vérification déjà en cours. Réessayez dans un instant.' });
      const port = creerOuObtenirPortefeuille(e.id);
      return json(res, 200, { ok: true, verifies: r.verifies, confirmes: r.confirmes, solde: port.solde });
    }

    // ---- Demander un retrait ----
    if (p === '/api/mon-entreprise/retraits' && req.method === 'POST') {
      const { montant, methode, destinataire } = corps;
      const port = creerOuObtenirPortefeuille(e.id);
      if (montant < MONTANT_MIN_RETRAIT) return json(res, 400, { erreur: `Montant minimum : ${MONTANT_MIN_RETRAIT} HTG` });
      if (montant > port.solde) return json(res, 402, { erreur: 'Solde insuffisant' });
      if (!['moncash', 'natcash'].includes(methode)) return json(res, 400, { erreur: 'Méthode invalide' });
      if (!destinataire || destinataire.length < 5) return json(res, 400, { erreur: 'Identifiant destinataire invalide' });
      
      const retrait = {
        id: store.uid(), entrepriseId: e.id, montant, methode, destinataire,
        statut: 'en_attente', reference: 'RET' + Date.now().toString(36).toUpperCase(),
        demandeLe: new Date().toISOString(), transactionId: null
      };
      db.retraits.push(retrait);
      port.soldeBloque += montant;  // Le montant est bloqué en attendant le retrait
      store.save();
      
      console.log(`[RETRAIT demandé] ${e.nom} — ${montant} HTG via ${methode} → ${destinataire}`);
      return json(res, 200, { ok: true, retraitId: retrait.id, reference: retrait.reference });
    }

    // ---- Historique des retraits ----
    if (p === '/api/mon-entreprise/retraits' && req.method === 'GET') {
      const retraits = db.retraits.filter((x) => x.entrepriseId === e.id)
        .sort((a, b) => b.demandeLe.localeCompare(a.demandeLe));
      return json(res, 200, retraits);
    }

    if (p === '/api/mon-entreprise/employes' && req.method === 'GET')
      return json(res, 200, db.employes.filter((x) => x.entrepriseId === e.id));
    if (p === '/api/mon-entreprise/employes' && req.method === 'POST') {
      if (!corps.nom) return json(res, 400, { erreur: 'Nom obligatoire.' });
      const nbEmployes = db.employes.filter((x) => x.entrepriseId === e.id).length;
      const limiteE = forfaits.limiteAtteinte(e, 'employes', nbEmployes);
      if (limiteE) return json(res, 403, { erreur: limiteE, limite: true });
      const emp = { id: store.uid(), entrepriseId: e.id, nom: corps.nom, poste: corps.poste || '', actif: true };
      db.employes.push(emp); store.save(); return json(res, 200, emp);
    }
    const mEmp = p.match(/^\/api\/mon-entreprise\/employes\/(\w+)$/);
    if (mEmp && req.method === 'DELETE') {
      db.employes = db.employes.filter((x) => !(x.id === mEmp[1] && x.entrepriseId === e.id));
      store.save(); return json(res, 200, { ok: true });
    }

    if (p === '/api/mon-entreprise/avis' && req.method === 'GET')
      return json(res, 200, db.avis.filter((a) => a.entrepriseId === e.id));

    if (p === '/api/rendezvous' && req.method === 'GET') {
      let liste = db.rendezvous.filter((r) => r.entrepriseId === e.id);
      if (q.get('date')) liste = liste.filter((r) => r.date === q.get('date'));
      if (q.get('du') && q.get('au')) liste = liste.filter((r) => r.date >= q.get('du') && r.date <= q.get('au'));
      liste = liste.map((r) => ({ ...r, service: db.services.find((s) => s.id === r.serviceId) || null }));
      liste.sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
      return json(res, 200, liste);
    }
    const mRdv = p.match(/^\/api\/rendezvous\/(\w+)$/);
    if (mRdv && req.method === 'PUT') {
      const r = db.rendezvous.find((x) => x.id === mRdv[1] && x.entrepriseId === e.id);
      if (!r) return json(res, 404, { erreur: 'Rendez-vous introuvable' });
      if (corps.statut && ['confirme', 'annule', 'termine', 'en_attente'].includes(corps.statut)) {
        r.statut = corps.statut;
        const libelle = { confirme: 'confirmé', annule: 'annulé', termine: 'terminé', en_attente: 'remis en attente' }[corps.statut];
        if (['confirme', 'annule'].includes(corps.statut))
          courrielClient(r.clientEmail, 'rdv_statut', {
            nom: r.clientNom, entreprise: e.nom, statut: libelle,
            date: r.date, heure: r.heure, adresse: e.adresse || '',
            telephone: e.telephone || '', couleur: e.couleur
          });
      }
      if (corps.date) r.date = corps.date;
      if (corps.heure) r.heure = corps.heure;
      store.save(); return json(res, 200, r);
    }

    if (p === '/api/stats') {
      const aujourdhui = new Date().toISOString().slice(0, 10);
      const debutMois = aujourdhui.slice(0, 8) + '01';
      const actifs = db.rendezvous.filter((r) => r.entrepriseId === e.id && r.statut !== 'annule');
      // Les séjours comptent au même titre que les rendez-vous : sans cela, un
      // hôtel voit un tableau de bord vide alors qu'il a des réservations.
      const sejoursActifs = db.sejours.filter((s) => s.entrepriseId === e.id && s.statut !== 'annule');
      const parJour = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        parJour[d.toISOString().slice(0, 10)] = 0;
      }
      actifs.forEach((r) => { if (parJour[r.date] !== undefined) parJour[r.date]++; });
      sejoursActifs.forEach((s) => { if (parJour[s.arrivee] !== undefined) parJour[s.arrivee]++; });
      const { note, total } = noteMoyenne(e.id);
      const enCoursAujourdhui = sejoursActifs.filter((s) => s.arrivee <= aujourdhui && s.depart > aujourdhui);

      /* Chiffres d'un commerce. Le tableau de bord ne comptait que les
         rendez-vous et les séjours : une boutique qui ne prend pas de
         rendez-vous voyait partout des zéros et un graphique plat, alors
         qu'elle recevait des commandes tous les jours. */
      const cmdActives = db.commandes.filter((c) => c.entrepriseId === e.id && c.statut !== 'annulee');
      const jourDe = (c) => String(c.creeLe || '').slice(0, 10);
      // « À préparer » : reçue, confirmée ou en cours — pas encore remise au client
      const aPreparer = cmdActives.filter((c) => ['nouvelle', 'confirmee', 'preparation'].includes(c.statut));
      // Pour un commerce, la courbe des 14 jours suit les commandes
      if (!metiers.aModule(e, 'rdv') && metiers.aModule(e, 'catalogue'))
        cmdActives.forEach((c) => { const j = jourDe(c); if (parJour[j] !== undefined) parJour[j]++; });

      return json(res, 200, {
        commandesAujourdhui: cmdActives.filter((c) => jourDe(c) === aujourdhui).length,
        commandesCeMois: cmdActives.filter((c) => jourDe(c) >= debutMois).length,
        commandesAPreparer: aPreparer.length,
        ventesMois: cmdActives.filter((c) => jourDe(c) >= debutMois).reduce((n, c) => n + (c.total || 0), 0),
        // « Aujourd'hui » : rendez-vous du jour + arrivées du jour + séjours en cours
        rdvAujourdhui: actifs.filter((r) => r.date === aujourdhui).length
          + sejoursActifs.filter((s) => s.arrivee === aujourdhui).length,
        rdvCeMois: actifs.filter((r) => r.date >= debutMois).length
          + sejoursActifs.filter((s) => s.arrivee >= debutMois).length,
        clientsTotaux: new Set([...actifs.map((r) => r.clientTel), ...sejoursActifs.map((s) => s.clientTel),
                                ...cmdActives.map((c) => c.clientTel)].filter(Boolean)).size,
        note, totalAvis: total,
        revenusMois: actifs.filter((r) => r.date >= debutMois && ['confirme', 'termine'].includes(r.statut))
            .reduce((s, r) => s + ((db.services.find((x) => x.id === r.serviceId) || {}).prix || 0), 0)
          + sejoursActifs.filter((s) => s.arrivee >= debutMois && ['confirme', 'termine'].includes(s.statut))
            .reduce((n, s) => n + (s.prixTotal || 0), 0),
        // Chiffres propres à l'hôtellerie
        sejoursEnCours: enCoursAujourdhui.length,
        arriveesAujourdhui: sejoursActifs.filter((s) => s.arrivee === aujourdhui).length,
        departsAujourdhui: sejoursActifs.filter((s) => s.depart === aujourdhui).length,
        sejoursEnAttente: sejoursActifs.filter((s) => s.statut === 'en_attente').length,
        parJour
      });
    }

    if (p === '/api/notifications' && req.method === 'GET') {
      const notifs = db.notifications.filter((n) => n.entrepriseId === e.id).slice(0, 30);
      return json(res, 200, notifs);
    }
    if (p === '/api/notifications' && req.method === 'PUT') {
      db.notifications.forEach((n) => { if (n.entrepriseId === e.id) n.lu = true; });
      store.save(); return json(res, 200, { ok: true });
    }
  }

  // ---- Administration ----
  if (p.startsWith('/api/admin')) {
    if (!user || user.role !== 'admin') return json(res, 401, { erreur: 'Accès administrateur requis' });
    if (p === '/api/admin/entreprises' && req.method === 'GET') {
      return json(res, 200, db.entreprises.map((e) => ({
        ...e, ...noteMoyenne(e.id),
        totalRdv: db.rendezvous.filter((r) => r.entrepriseId === e.id).length,
        /* Deux attentes à ne pas confondre : celle du responsable, qui n'a pas
           encore cliqué sur son lien d'activation, et la vôtre, qui décidez de
           la mise en ligne. */
        courrielVerifie: !db.users.some((u) => u.entrepriseId === e.id && u.courrielVerifie === false),
        /* Le dossier d'inscription tel qu'il a été rempli. Le mot de passe
           n'en fait évidemment pas partie. */
        responsables: db.users.filter((u) => u.entrepriseId === e.id).map((u) => ({
          nom: u.nom, email: u.email, role: u.role, creeLe: u.creeLe,
          courrielVerifie: u.courrielVerifie !== false
        })),
        volumes: {
          services: db.services.filter((x) => x.entrepriseId === e.id).length,
          produits: db.produits.filter((x) => x.entrepriseId === e.id).length,
          employes: db.employes.filter((x) => x.entrepriseId === e.id).length,
          chambres: db.chambres.filter((x) => x.entrepriseId === e.id).length,
          commandes: db.commandes.filter((x) => x.entrepriseId === e.id).length,
          sejours: db.sejours.filter((x) => x.entrepriseId === e.id).length,
          dossiers: db.dossiers.filter((x) => x.entrepriseId === e.id).length,
          ecritures: db.ecritures.filter((x) => x.entrepriseId === e.id).length
        }
      })));
    }
    const mAdm = p.match(/^\/api\/admin\/entreprises\/(\w+)$/);
    if (mAdm && req.method === 'PUT') {
      const e = db.entreprises.find((x) => x.id === mAdm[1]);
      if (!e) return json(res, 404, { erreur: 'Introuvable' });
      if (corps.statut && ['approuvee', 'en_attente', 'suspendue'].includes(corps.statut)) e.statut = corps.statut;
      if (corps.plan && ['gratuit', 'premium'].includes(corps.plan)) e.plan = corps.plan;
      /* Entente de paiement par versement : Konekte constate qu'elle existe
         auprès de Micro Crédit Solidarité, ou la refuse en disant pourquoi.
         Un refus éteint aussitôt l'offre, sans attendre l'entreprise. */
      if (corps.versementValide !== undefined) {
        const v = e.versement || (e.versement = {});
        v.validee = !!corps.versementValide;
        v.valideeLe = v.validee ? new Date().toISOString() : '';
        v.refusee = !v.validee && !!v.reference;
        v.motifRefus = v.validee ? '' : String(corps.motifRefus || '').slice(0, 200);
        if (!v.validee) v.actif = false;
      }
      store.save(); return json(res, 200, e);
    }

    /* ---- Suppression définitive d'une entreprise ----
       Tout ce qui dépend d'elle part avec elle : laisser des rendez-vous ou des
       écritures sans entreprise fausserait les totaux et ferait échouer les
       pages qui remontent au parent. Le parcours des collections est
       automatique, pour qu'une collection ajoutée plus tard soit couverte sans
       qu'on ait à y penser. */
    if (mAdm && req.method === 'DELETE') {
      const e = db.entreprises.find((x) => x.id === mAdm[1]);
      if (!e) return json(res, 404, { erreur: 'Introuvable' });
      /* Garde-fou : le nom exact doit être renvoyé par l'appelant. Une requête
         partie par mégarde ne peut pas le deviner. */
      if (String(corps.confirmation || '').trim() !== e.nom)
        return json(res, 400, { erreur: "Le nom de l'entreprise ne correspond pas." });

      const compte = {};
      for (const [cle, valeur] of Object.entries(db)) {
        if (!Array.isArray(valeur) || cle === 'entreprises') continue;
        const avant = valeur.length;
        db[cle] = valeur.filter((x) => !x || x.entrepriseId !== e.id);
        if (avant !== db[cle].length) compte[cle] = avant - db[cle].length;
      }
      // Les comptes rattachés, et les sessions qui leur donnaient accès
      const idsUsers = db.users.filter((u) => u.entrepriseId === e.id).map((u) => u.id);
      if (idsUsers.length) {
        compte.users = idsUsers.length;
        db.users = db.users.filter((u) => u.entrepriseId !== e.id);
        for (const [jeton, idUser] of Object.entries(db.sessions || {}))
          if (idsUsers.includes(idUser)) delete db.sessions[jeton];
      }
      db.entreprises = db.entreprises.filter((x) => x.id !== e.id);
      store.save();
      console.log(`[ADMIN] Entreprise supprimée : ${e.nom} (${e.slug}) —`,
        Object.entries(compte).map(([k, n]) => `${n} ${k}`).join(', ') || 'aucune donnée liée');
      return json(res, 200, { ok: true, nom: e.nom, supprime: compte });
    }

    if (p === '/api/admin/stats') {
      return json(res, 200, {
        entreprises: db.entreprises.length,
        enAttente: db.entreprises.filter((e) => e.statut === 'en_attente').length,
        rendezvous: db.rendezvous.length,
        avis: db.avis.length,
        utilisateurs: db.users.length
      });
    }
  }

  return json(res, 404, { erreur: 'Route introuvable' });
}

/* ---------------- Fichiers statiques + pages ----------------

   Jusqu'ici aucune consigne de cache n'accompagnait les pages. Privé de
   directive et de validateur, un navigateur décide seul combien de temps
   il garde un fichier : un téléphone pouvait ainsi afficher pendant des
   heures une version que l'ordinateur avait déjà remplacée.

   Désormais chaque réponse porte une empreinte (date de modification et
   taille). Les pages et le code sont revalidés à chaque visite — une
   requête minuscule qui renvoie « rien n'a changé » quand c'est le cas,
   et la nouvelle version dès qu'il y en a une. Les images, elles, se
   gardent une journée : elles changent rarement. */
function empreinte(st) {
  return `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
}

function statique(res, fichier, req) {
  const fp = path.join(PUBLIC_DIR, fichier);
  if (!fp.startsWith(PUBLIC_DIR) || !fs.existsSync(fp)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Page introuvable');
  }
  const ext = path.extname(fp);
  let st;
  try { st = fs.statSync(fp); } catch { st = null; }

  const entetes = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
  if (st) {
    const etag = empreinte(st);
    entetes.ETag = etag;
    entetes['Last-Modified'] = st.mtime.toUTCString();
    /* Une page, une feuille de style ou un script changent à chaque
       version : on les revalide toujours. Une image change rarement. */
    entetes['Cache-Control'] = ['.png', '.jpg', '.svg', '.ico'].includes(ext)
      ? 'public, max-age=86400'
      : 'no-cache';
    const connu = req && req.headers['if-none-match'];
    if (connu && connu.split(/,\s*/).includes(etag)) {
      res.writeHead(304, entetes);
      return res.end();
    }
  }
  res.writeHead(200, entetes);
  fs.createReadStream(fp).pipe(res);
}

const server = http.createServer(async (req, res) => {

  const url = new URL(req.url, 'http://localhost');
  /* Une fois par jour, à la première requête : les produits dont la date
     d'arrivée est atteinte passent en vente. Rien n'est calculé les fois
     suivantes, le contrôle se résume à comparer deux chaînes. */
  try { libererPrecommandesEchues(); } catch (e) { console.error('[PRÉCOMMANDES]', e.message); }
  // Une seule adresse pour la plateforme : tout le reste y est renvoyé
  if (redirigerVersAdresseOfficielle(req, res)) return;
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    /* ---- Images servies comme fichiers ----
       Les réseaux sociaux ne savent pas lire une image encodée dans la page :
       il leur faut une adresse. On expose donc les images stockées en base64
       sous une vraie URL, mise en cache longuement. */
    const mImg = url.pathname.match(/^\/img\/(produit|logo|fond|partage|chambre)\/(\w+)(?:\/(\d+))?$/);
    if (mImg && req.method === 'GET') {
      const [, genre, id, indice] = mImg;
      let source = '';
      if (genre === 'produit') {
        const pr = db.produits.find((x) => x.id === id);
        source = pr && pr.photo;
      } else if (genre === 'chambre') {
        const c = db.chambres.find((x) => x.id === id);
        const g = c && (c.photos || (c.photo ? [c.photo] : []));
        source = g && g[Number(indice || 0)];
      } else {
        const e = db.entreprises.find((x) => x.id === id || x.slug === id);
        /* `partage` est l'affiche remise au format des vignettes des réseaux
           sociaux ; à défaut, l'affiche d'origine fait l'affaire. */
        source = e && (genre === 'logo' ? e.logoImage
          : genre === 'partage' ? (e.photoPartage || e.photoFond)
          : e.photoFond);
      }
      if (!source || !String(source).startsWith('data:image/')) {
        res.writeHead(404); return res.end('Image introuvable');
      }
      const sep = source.indexOf(',');
      const type = source.slice(5, source.indexOf(';'));
      const donnees = Buffer.from(source.slice(sep + 1), 'base64');
      /* L'adresse d'un logo ou d'une bannière ne change pas quand l'image
         change : gardée une semaine, une nouvelle affiche serait restée
         invisible tout ce temps. L'empreinte porte sur le contenu, donc
         la réponse est minuscule tant que l'image est la même, et la
         nouvelle arrive dès la première visite suivante. */
      const sceau = 'W/"' + crypto.createHash('sha1').update(donnees).digest('hex').slice(0, 20) + '"';
      const entetesImg = {
        'Content-Type': type,
        'Cache-Control': 'no-cache',
        'ETag': sceau
      };
      if ((req.headers['if-none-match'] || '').split(/,\s*/).includes(sceau)) {
        res.writeHead(304, entetesImg);
        return res.end();
      }
      entetesImg['Content-Length'] = donnees.length;
      res.writeHead(200, entetesImg);
      return res.end(donnees);
    }


    /* ---- Activation d'un compte depuis le lien reçu par courriel ----
       Placée avant la reconnaissance des adresses d'entreprise : « activer »
       ressemble à un slug et serait interprété comme tel. */
    if (url.pathname === '/activer' && req.method === 'GET') {
      const jeton = url.searchParams.get('j') || '';
      const u = jeton && db.users.find((x) => x.activation && x.activation.jeton === jeton);
      const aller = (vers) => { res.writeHead(302, { Location: vers }); res.end(); };
      /* Un lien déjà utilisé mène à la connexion sans rien dire de plus : le
         compte est actif, l'utilisateur n'a qu'à entrer son mot de passe. */
      if (!u) return aller('/connexion.html?activation=inconnu');
      if (new Date(u.activation.expire).getTime() < Date.now())
        return aller('/connexion.html?activation=expire&email=' + encodeURIComponent(u.email));
      u.courrielVerifie = true;
      delete u.activation;
      /* L'activation vaut mise en ligne : le clic sur le lien suffit, il n'y a
         plus d'approbation manuelle. L'administrateur garde la possibilité de
         suspendre une entreprise après coup depuis /admin.html. */
      const entAct = db.entreprises.find((x) => x.id === u.entrepriseId);
      if (entAct && entAct.statut === 'en_attente') entAct.statut = 'approuvee';
      const jetonSession = crypto.randomBytes(24).toString('hex');
      db.sessions[jetonSession] = u.id; store.save();
      res.setHeader('Set-Cookie', `rdv_session=${jetonSession}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
      return aller('/dashboard.html?active=1');
    }

    // URL personnalisée : bizniskonekte.tech/salon-elegance
    const m = url.pathname.match(/^\/([a-z0-9-]+)$/);
    if (m) {
      const ent = db.entreprises.find((e) => e.slug === m[1]);
      if (ent) {
        // Un produit précis peut être partagé : /slug?produit=ID
        const idProduit = url.searchParams.get('produit');
        const prod = idProduit
          ? db.produits.find((x) => x.id === idProduit && x.entrepriseId === ent.id && x.disponible)
          : null;
        return pageEntreprise(res, req, ent, prod);
      }
    }
    if (url.pathname === '/') return statique(res, 'index.html', req);
    return statique(res, url.pathname.slice(1), req);
  } catch (err) {
    console.error(err);
    json(res, 500, { erreur: 'Erreur serveur' });
  }
});

// ---------------- Rappels automatiques la veille (J-1) ----------------
// Vérifie toutes les 30 minutes les rendez-vous confirmés de demain et les
// arrivées de séjour de demain, puis envoie WhatsApp + email une seule fois.
// NOTE : sur le plan gratuit de Render, le serveur s'endort après 15 min
// d'inactivité et les rappels ne partent pas pendant son sommeil. Passez au
// plan Starter (ou utilisez un ping UptimeRobot) pour des rappels fiables.
function envoyerRappels() {
  const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  let modifie = false;
  // Rendez-vous de demain
  db.rendezvous.filter((r) => r.date === demain && r.statut === 'confirme' && !r.rappelEnvoye).forEach((r) => {
    const e = db.entreprises.find((x) => x.id === r.entrepriseId);
    const s = db.services.find((x) => x.id === r.serviceId);
    if (!e) return;
    courrielClient(r.clientEmail, 'rdv_rappel', {
      nom: r.clientNom, entreprise: e.nom, date: demain, heure: r.heure,
      service: s ? s.nom : '', adresse: e.adresse || '', telephone: e.telephone || '',
      couleur: e.couleur
    });
    r.rappelEnvoye = true; modifie = true;
    console.log(`[RAPPEL J-1] ${r.clientNom} — ${e.nom} demain ${r.heure}`);
  });
  // Arrivées de séjour demain
  db.sejours.filter((s) => s.arrivee === demain && s.statut === 'confirme' && !s.rappelEnvoye).forEach((s) => {
    const e = db.entreprises.find((x) => x.id === s.entrepriseId);
    const c = db.chambres.find((x) => x.id === s.chambreId);
    if (!e) return;
    courrielClient(s.clientEmail, 'sejour_rappel', {
      nom: s.clientNom, entreprise: e.nom, chambre: c ? c.nom : '',
      arrivee: demain, depart: s.depart, nuits: s.nuits,
      adresse: e.adresse || '', telephone: e.telephone || '',
      total: s.prixTotal, reference: s.reference || s.id, couleur: e.couleur
    });
    s.rappelEnvoye = true; modifie = true;
    console.log(`[RAPPEL J-1 séjour] ${s.clientNom} — ${e.nom} arrivée demain`);
  });
  if (modifie) store.save();
}
setInterval(envoyerRappels, 30 * 60 * 1000);
setTimeout(envoyerRappels, 20 * 1000); // première vérification 20 s après le démarrage

server.listen(PORT, () => {
  console.log('==================================================');
  console.log('  KONEKTE — Rendez-vous, hôtellerie, vente et comptabilité');
  console.log('==================================================');
  console.log(`  Site      : http://localhost:${PORT}`);
  console.log('  Données   : ' + store.DB_PATH +
    (process.env.DATA_DIR ? '  (disque persistant)' : '  ⚠ dossier temporaire — effacé à chaque déploiement'));
  /* Le mot de passe du premier administrateur n'est montré que sur une base
     neuve, et une seule fois : il n'existe nulle part ailleurs. */
  if (store.baseNeuve) {
    console.log('--------------------------------------------------');
    console.log('  PREMIER DÉMARRAGE — notez ces accès, ils ne');
    console.log('  seront plus affichés :');
    console.log('     Administrateur : admin@bizniskonekte.tech');
    console.log('     Mot de passe   : ' + store.MDP_ADMIN_INITIAL);
    console.log('  Changez-le dès votre première connexion.');
    console.log('--------------------------------------------------');
  }
  if (!courriel.configure()) {
    console.log('  ⚠ Envoi de courriels non configuré (BREVO_API_KEY) :');
    console.log('    activations, codes et rappels partent en simulation.');
  }
  console.log('==================================================');
});

/* Toutes les heures, les règlements restés en attente sont confrontés à la
   passerelle. Un client qui a payé puis fermé sa page voit ainsi sa commande
   confirmée et l'entreprise créditée, sans que personne n'ait à y penser.
   Le premier passage a lieu une minute après le démarrage, pour ne pas
   retarder la mise en service. */
const RYTHME_RATTRAPAGE = 3600 * 1000;
function lancerRattrapage() {
  rattraperPaiements()
    .then((r) => { if (r && r.confirmes) console.log(`[PAIEMENTS] ${r.confirmes} règlement(s) confirmé(s) au rattrapage.`); })
    .catch((e) => console.error('[PAIEMENTS] rattrapage :', e.message));
}
setTimeout(lancerRattrapage, 60 * 1000).unref?.();
setInterval(lancerRattrapage, RYTHME_RATTRAPAGE).unref?.();

/* Render envoie SIGTERM avant chaque redéploiement : on vide ce qui
   attendait encore son tour d'enregistrement avant de rendre la main. */
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`[ARRÊT] ${signal} reçu — enregistrement de la base avant de quitter.`);
    try { store.saveNow(); } catch { /* rien de plus à tenter */ }
    process.exit(0);
  });
}
