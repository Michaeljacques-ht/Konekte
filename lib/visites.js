'use strict';
/* ==========================================================
   Fréquentation de la plateforme
   ----------------------------------------------------------
   Ce module compte les visites, sans identifier les personnes.

   Ce qui est enregistré : la page consultée, le moment, le type
   d'appareil, la provenance, la langue et le fuseau horaire du
   navigateur. Aucune adresse IP n'est stockée : elle sert
   uniquement à calculer une empreinte anonyme, qui permet de
   distinguer deux visiteurs sans jamais remonter à quelqu'un.

   L'empreinte change chaque jour, grâce à un sel quotidien.
   Deux visites du même appareil à deux jours d'intervalle ne
   peuvent donc pas être reliées.
   ========================================================== */
const crypto = require('crypto');

const RETENTION_JOURS = 180;   // au-delà, les visites détaillées sont purgées
const SEL_BASE = process.env.SEL_VISITES || crypto.randomBytes(16).toString('hex');

/** Empreinte anonyme du visiteur, renouvelée chaque jour. */
function empreinte(ip, agent, jour) {
  return crypto.createHash('sha256')
    .update(`${SEL_BASE}|${jour}|${ip}|${agent}`)
    .digest('hex').slice(0, 16);
}

/** Type d'appareil, déduit de la signature du navigateur. */
function appareilDe(agent) {
  const a = String(agent || '').toLowerCase();
  if (/ipad|tablet/.test(a)) return 'tablette';
  if (/mobi|android|iphone/.test(a)) return 'téléphone';
  if (/bot|crawl|spider|slurp|bingpreview/.test(a)) return 'robot';
  return 'ordinateur';
}

/** Source de la visite, à partir de la page précédente. */
function sourceDe(referer, hote) {
  if (!referer) return 'direct';
  try {
    const h = new URL(referer).hostname.replace(/^www\./, '');
    if (hote && h === String(hote).replace(/^www\./, '').split(':')[0]) return 'interne';
    if (/facebook|fb\.com|instagram|messenger/.test(h)) return 'Facebook / Instagram';
    if (/whatsapp/.test(h)) return 'WhatsApp';
    if (/google|bing|duckduckgo|yahoo/.test(h)) return 'moteur de recherche';
    if (/tiktok/.test(h)) return 'TikTok';
    return h;
  } catch { return 'direct'; }
}

/**
 * Enregistre une visite.
 * `contexte` porte les éléments transmis par le navigateur (langue,
 * fuseau horaire), qui donnent une idée de la région sans géolocalisation.
 */
function enregistrer(db, { chemin, ip, agent, referer, hote, contexte, type, fichier, idCookie }) {
  const appareil = appareilDe(agent);
  if (appareil === 'robot') return null;   // les robots ne sont pas des visiteurs

  const maintenant = new Date();
  const jour = maintenant.toISOString().slice(0, 10);
  const c = contexte || {};

  const v = {
    type: type || 'page',        // 'page' ou 'telechargement'
    fichier: fichier || '',
    jour,
    heure: maintenant.getUTCHours(),
    le: maintenant.toISOString(),
    chemin: String(chemin || '/').slice(0, 120),
    // Page d'entreprise consultée, le cas échéant
    entreprise: /^\/[a-z0-9-]+$/i.test(chemin) ? String(chemin).slice(1, 60) : '',
    /* Identité du visiteur.
       Avec consentement, un identifiant stable permet de distinguer
       un nouveau venu d'un habitué. Sans consentement, on retombe sur
       l'empreinte quotidienne, qui ne relie rien d'un jour à l'autre. */
    visiteur: idCookie || empreinte(ip, agent, jour),
    reconnu: !!idCookie,
    appareil,
    source: sourceDe(referer, hote),
    langue: String(c.langue || '').slice(0, 12),
    fuseau: String(c.fuseau || '').slice(0, 60),
    installee: !!c.installee     // ouverte depuis l'écran d'accueil
  };
  db.visites.push(v);

  // Purge : on ne conserve pas indéfiniment le détail
  const limite = new Date(Date.now() - RETENTION_JOURS * 86400000).toISOString().slice(0, 10);
  if (db.visites.length > 200 && db.visites[0].jour < limite) {
    db.visites = db.visites.filter((x) => x.jour >= limite);
  }
  return v;
}

/** Pays probable, déduit de l'en-tête de langue envoyé par le navigateur. */
function paysDepuisLangue(entete) {
  const s = String(entete || '').split(',')[0].trim();
  const m = s.match(/-([A-Za-z]{2})/);
  if (!m) {
    if (s.startsWith('ht')) return 'Haïti';
    return 'Inconnu';
  }
  const carte = { HT: 'Haïti', US: 'États-Unis', CA: 'Canada', FR: 'France',
                  DO: 'République dominicaine', BR: 'Brésil', CL: 'Chili',
                  MX: 'Mexique', GP: 'Guadeloupe', MQ: 'Martinique', GF: 'Guyane' };
  return carte[m[1].toUpperCase()] || m[1].toUpperCase();
}

/** Région approximative, déduite du fuseau horaire. */
function regionDe(fuseau) {
  if (!fuseau) return 'Inconnue';
  const f = String(fuseau);
  if (f === 'America/Port-au-Prince') return 'Haïti';
  const carte = {
    'America/New_York': 'États-Unis (Est)', 'America/Chicago': 'États-Unis (Centre)',
    'America/Los_Angeles': 'États-Unis (Ouest)', 'America/Toronto': 'Canada',
    'America/Montreal': 'Canada', 'America/Santo_Domingo': 'République dominicaine',
    'Europe/Paris': 'France', 'America/Miami': 'États-Unis (Est)',
    'America/Cayenne': 'Guyane', 'America/Guadeloupe': 'Guadeloupe',
    'America/Martinique': 'Martinique'
  };
  if (carte[f]) return carte[f];
  const zone = f.split('/')[0];
  return { America: 'Amériques', Europe: 'Europe', Africa: 'Afrique',
           Asia: 'Asie', Pacific: 'Pacifique' }[zone] || f;
}

/** Statistiques agrégées sur une période. */
function statistiques(db, jours, entrepriseSlug) {
  const n = Math.max(1, Math.min(+jours || 30, 365));
  const depuis = new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const toutes = db.visites.filter((v) => v.jour >= depuis);
  // Les téléchargements sont comptés à part : ils ne sont pas des consultations
  let visites = toutes.filter((v) => (v.type || 'page') === 'page');
  const telechargements = toutes.filter((v) => v.type === 'telechargement');
  if (entrepriseSlug) visites = visites.filter((v) => v.entreprise === entrepriseSlug);

  const compter = (cle, transf) => {
    const m = {};
    for (const v of visites) {
      const k = transf ? transf(v[cle]) : (v[cle] || '—');
      if (!k) continue;
      m[k] = (m[k] || 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };

  // Série quotidienne, jours vides compris
  const parJour = {};
  for (let i = n - 1; i >= 0; i--) {
    parJour[new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)] = { visites: 0, visiteurs: new Set() };
  }
  for (const v of visites) {
    if (parJour[v.jour]) {
      parJour[v.jour].visites++;
      parJour[v.jour].visiteurs.add(v.visiteur);
    }
  }

  const parHeure = new Array(24).fill(0);
  for (const v of visites) parHeure[v.heure]++;

  return {
    periode: n,
    total: visites.length,
    visiteurs: new Set(visites.map((v) => v.visiteur)).size,
    installees: visites.filter((v) => v.installee).length,
    parJour: Object.entries(parJour).map(([j, d]) => ({ jour: j, visites: d.visites, visiteurs: d.visiteurs.size })),
    parHeure,
    pages: compter('chemin').slice(0, 15),
    entreprises: compter('entreprise').filter(([k]) => k && k !== '—').slice(0, 15),
    sources: compter('source').slice(0, 10),
    appareils: compter('appareil'),
    regions: compter('fuseau', regionDe).slice(0, 12),
    fidelite: (() => {
      // Un visiteur est « habitué » s'il revient un autre jour
      const jours = {};
      for (const v of visites) {
        if (!v.reconnu) continue;
        (jours[v.visiteur] = jours[v.visiteur] || new Set()).add(v.jour);
      }
      const ids = Object.keys(jours);
      const habitues = ids.filter((id) => jours[id].size > 1).length;
      return {
        mesurables: ids.length,
        nouveaux: ids.length - habitues,
        habitues,
        // Part des visites mesurables : sans consentement, on ne sait pas
        consentement: visites.length ? Math.round(visites.filter((v) => v.reconnu).length / visites.length * 100) : 0
      };
    })(),
    telechargements: (() => {
      const parFichier = {}, parRegion = {}, parJourT = {};
      for (const t of telechargements) {
        parFichier[t.fichier || '—'] = (parFichier[t.fichier || '—'] || 0) + 1;
        const r = t.fuseau ? regionDe(t.fuseau) : (t.langue ? paysDepuisLangue(t.langue) : 'Inconnu');
        parRegion[r] = (parRegion[r] || 0) + 1;
        parJourT[t.jour] = (parJourT[t.jour] || 0) + 1;
      }
      const tri = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
      return {
        total: telechargements.length,
        personnes: new Set(telechargements.map((t) => t.visiteur)).size,
        fichiers: tri(parFichier),
        regions: tri(parRegion).slice(0, 12),
        parJour: tri(parJourT).sort((a, b) => a[0].localeCompare(b[0]))
      };
    })(),
    langues: compter('langue', (l) => (String(l).startsWith('ht') ? 'Créole' :
      String(l).startsWith('fr') ? 'Français' : String(l).startsWith('en') ? 'Anglais' : (l || '—'))).slice(0, 6)
  };
}

module.exports = { enregistrer, statistiques, regionDe, paysDepuisLangue, RETENTION_JOURS };
