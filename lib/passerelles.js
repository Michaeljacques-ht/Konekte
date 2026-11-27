'use strict';
/* ============================================================
   KONEKTE — Registre des passerelles de paiement
   ------------------------------------------------------------
   Konekte encaissait par PLOP PLOP, et par elle seule. Une
   entreprise qui a son propre compte marchand ailleurs — MonCash
   Business, NatCash, une banque, un prestataire étranger — ne
   pouvait rien en faire. Chaque fournisseur est maintenant un
   adaptateur derrière la même porte : `initier` ouvre une
   transaction et rend une adresse où payer, `verifier` dit si
   elle est réglée. Ajouter un fournisseur, c'est écrire ces
   deux fonctions, rien d'autre.

   Trois sont fournis, et ils couvrent la réalité haïtienne :

     plop      — PLOP PLOP, automatique de bout en bout.
     json      — n'importe quelle passerelle qui parle JSON :
                 l'entreprise donne les deux adresses et dit où
                 lire la réponse. Automatique elle aussi.
     lien      — un simple lien de paiement (MonCash Business,
                 PayPal, Stripe…). Rien à programmer : le client
                 paie sur ce lien et déclare sa référence, et
                 l'entreprise confirme. C'est le seul moyen
                 d'accepter une passerelle sans API publique.

   Les secrets n'entrent ici que déchiffrés, le temps d'un appel.
   Ils ne sont ni journalisés ni renvoyés.
   ============================================================ */
const https = require('https');
const dns = require('dns');

/* ============================================================
   SÉCURITÉ — Où le serveur accepte-t-il d'aller frapper ?
   ------------------------------------------------------------
   L'entreprise écrit elle-même l'adresse de sa passerelle, et
   c'est le serveur de Konekte qui l'appelle. Sans garde-fou, elle
   pouvait le faire interroger des services inaccessibles depuis
   l'extérieur : la machine elle-même, le réseau privé de
   l'hébergeur, les adresses de métadonnées des fournisseurs de
   nuage — et récupérer une partie de la réponse par le champ où
   elle indique quoi lire. Une passerelle de paiement réelle est
   sur l'Internet public ; le reste est refusé.
   ============================================================ */
const HOTES_INTERNES = ['localhost', 'metadata.google.internal', 'metadata'];

function estInterne(hote) {
  const h = String(hote || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h || HOTES_INTERNES.includes(h) || h.endsWith('.local') || h.endsWith('.internal')) return true;
  /* IPv6 : bouclage, lien-local et adresses uniques locales. */
  if (h === '::1' || h === '::' || /^fe[89ab]/.test(h) || /^f[cd]/.test(h)) return true;
  /* IPv4 mappée en IPv6 — ::ffff:127.0.0.1 contourne sinon le test. */
  const mappee = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(h);
  const v4 = mappee ? mappee[1] : h;
  const o = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v4);
  if (!o) return false;                       // un nom de domaine public
  const [a, b] = [Number(o[1]), Number(o[2])];
  return a === 0 || a === 10 || a === 127                       // ce poste, réseau privé
    || (a === 169 && b === 254)                                 // lien-local, métadonnées
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)                       // partagé entre opérateurs
    || a >= 224;                                                // multidiffusion et réservé
}

/* ---------- Appel JSON sortant ---------- */
function appelJSON(adresse, corps, entetes) {
  return new Promise((resoudre, rejeter) => {
    let u;
    try { u = new URL(adresse); } catch { return rejeter(new Error('Adresse de passerelle invalide.')); }
    /* Le chiffrement n'est plus facultatif : la tolérance accordée aux
       adresses de bouclage servait les essais, et ouvrait la porte aux
       services tournant sur la même machine. */
    if (u.protocol !== 'https:') return rejeter(new Error('La passerelle doit être en HTTPS.'));
    if (estInterne(u.hostname))
      return rejeter(new Error("Cette adresse de passerelle n'est pas autorisée."));
    const donnees = JSON.stringify(corps || {});
    const requete = https.request({
      hostname: u.hostname,
      port: u.port ? Number(u.port) : 443,
      path: u.pathname + u.search,
      method: 'POST',
      /* Le nom peut être public et pointer tout de même vers une adresse
         privée : le contrôle est refait sur l'adresse réellement résolue,
         juste avant la connexion. C'est le seul endroit où l'on dispose
         des deux à la fois. */
      lookup: (hote, options, rappel) => {
        dns.lookup(hote, options, (err, adr, famille) => {
          if (err) return rappel(err);
          const liste = Array.isArray(adr) ? adr : [{ address: adr, family: famille }];
          for (const e of liste)
            if (estInterne(e.address))
              return rappel(new Error('Cette passerelle pointe vers une adresse interne.'));
          return rappel(null, adr, famille);
        });
      },
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(donnees)
      }, entetes || {}),
      timeout: 25000
    }, (reponse) => {
      let brut = '';
      reponse.on('data', (m) => brut += m);
      reponse.on('end', () => {
        try { resoudre({ code: reponse.statusCode, corps: JSON.parse(brut || '{}') }); }
        catch { resoudre({ code: reponse.statusCode, corps: { message: brut.slice(0, 300) } }); }
      });
    });
    requete.on('timeout', () => { requete.destroy(); rejeter(new Error('Passerelle injoignable (délai dépassé)')); });
    requete.on('error', (e) => rejeter(new Error('Passerelle injoignable : ' + e.message)));
    requete.write(donnees);
    requete.end();
  });
}

/* Lit une valeur en suivant un chemin pointé — « data.payment.url ».
   Les passerelles rangent leurs réponses où elles veulent ; c'est
   l'entreprise qui indique où regarder. */
function lire(objet, chemin) {
  if (!chemin) return undefined;
  return String(chemin).split('.').reduce(
    (o, c) => (o && typeof o === 'object' ? o[c] : undefined), objet);
}

/* Remplace {reference}, {montant} et les identifiants dans un gabarit —
   adresse, corps de requête ou en-tête. */
function remplir(valeur, vars) {
  if (typeof valeur === 'string')
    return valeur.replace(/\{(\w+)\}/g, (tout, cle) => (cle in vars ? String(vars[cle]) : tout));
  if (Array.isArray(valeur)) return valeur.map((v) => remplir(v, vars));
  if (valeur && typeof valeur === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(valeur)) o[k] = remplir(v, vars);
    return o;
  }
  return valeur;
}

function enObjet(texte) {
  if (!texte) return {};
  if (typeof texte === 'object') return texte;
  try { const o = JSON.parse(texte); return (o && typeof o === 'object') ? o : {}; }
  catch { return {}; }
}

/* ============================================================
   Les fournisseurs
   ------------------------------------------------------------
   `champs` décrit ce que l'entreprise doit saisir : l'espace de
   gestion construit son formulaire à partir de là, et seuls les
   champs marqués `secret` sont chiffrés et jamais réaffichés.
   ============================================================ */
const FOURNISSEURS = {

  plop: {
    nom: 'PLOP PLOP',
    resume: 'MonCash, NatCash et Kashpaw réunis. Encaissement et confirmation automatiques.',
    automatique: true,
    champs: [
      { cle: 'clientId',     libelle: 'Identifiant marchand', exemple: 'pp_…', requis: true },
      { cle: 'clientSecret', libelle: 'Clé secrète',          secret: true,    requis: true }
    ],
    async initier({ reference, montant, methode, ids, hote }) {
      const base = hote || 'plopplop.solutionip.app';
      const r = await appelJSON(`https://${base}/api/paiement-marchand`, {
        client_id: ids.clientId, refference_id: reference,
        montant: Math.round(montant), payment_method: methode || 'all'
      });
      if (r.code !== 200 || !r.corps.status || !r.corps.url)
        return { ok: false, error: r.corps.message || 'La passerelle a refusé la transaction.' };
      return { ok: true, urlPaiement: r.corps.url, transactionId: r.corps.transaction_id || null };
    },
    async verifier({ reference, ids, hote }) {
      const base = hote || 'plopplop.solutionip.app';
      const r = await appelJSON(`https://${base}/api/paiement-verify`, {
        client_id: ids.clientId, refference_id: reference
      });
      const c = r.corps || {};
      if (c.trans_status === 'ok')
        return { ok: true, paye: true, infos: { transactionId: c.id_transaction || null, methode: c.method || null } };
      return { ok: true, paye: false, message: c.message || 'Paiement non encore confirmé.' };
    }
  },

  json: {
    nom: 'Autre passerelle (API)',
    resume: 'Toute passerelle qui parle JSON. Vous donnez les deux adresses et dites où lire la réponse.',
    automatique: true,
    champs: [
      { cle: 'urlCreer',     libelle: 'Adresse pour créer un paiement', exemple: 'https://…/payments', requis: true },
      { cle: 'urlVerifier',  libelle: 'Adresse pour vérifier',          exemple: 'https://…/payments/status', requis: true },
      { cle: 'corpsCreer',   libelle: 'Corps envoyé à la création (JSON)',
        exemple: '{"amount":"{montant}","ref":"{reference}"}', zone: true, requis: true },
      { cle: 'corpsVerifier', libelle: 'Corps envoyé à la vérification (JSON)',
        exemple: '{"ref":"{reference}"}', zone: true, requis: true },
      { cle: 'cheminUrl',    libelle: 'Où lire l\'adresse de paiement', exemple: 'data.url', requis: true },
      { cle: 'cheminStatut', libelle: 'Où lire le statut',              exemple: 'data.status', requis: true },
      { cle: 'valeurPaye',   libelle: 'Valeur qui signifie « payé »',   exemple: 'paid', requis: true },
      { cle: 'entetes',      libelle: 'En-têtes (JSON) — facultatif',
        exemple: '{"Authorization":"Bearer {cle}"}', zone: true },
      { cle: 'cle',          libelle: 'Clé ou jeton',                   secret: true }
    ],
    async initier({ reference, montant, ids }) {
      const vars = { reference, montant: Math.round(montant), cle: ids.cle || '' };
      const r = await appelJSON(remplir(ids.urlCreer, vars),
        remplir(enObjet(ids.corpsCreer), vars), remplir(enObjet(ids.entetes), vars));
      const url = lire(r.corps, ids.cheminUrl);
      if (r.code >= 400 || !url)
        return { ok: false, error: lire(r.corps, 'message') || 'La passerelle a refusé la transaction.' };
      return { ok: true, urlPaiement: String(url), transactionId: null };
    },
    async verifier({ reference, ids }) {
      const vars = { reference, cle: ids.cle || '' };
      const r = await appelJSON(remplir(ids.urlVerifier, vars),
        remplir(enObjet(ids.corpsVerifier), vars), remplir(enObjet(ids.entetes), vars));
      const statut = lire(r.corps, ids.cheminStatut);
      const paye = statut !== undefined &&
        String(statut).toLowerCase() === String(ids.valeurPaye || '').toLowerCase();
      return { ok: true, paye, message: paye ? '' : 'Paiement non encore confirmé.' };
    }
  },

  lien: {
    nom: 'Lien de paiement',
    resume: 'MonCash Business, PayPal, Stripe… Vous collez votre lien ; le client paie dessus et vous confirmez.',
    automatique: false,
    champs: [
      { cle: 'url',   libelle: 'Votre lien de paiement', exemple: 'https://…', requis: true },
      { cle: 'consigne', libelle: 'Consigne au client — facultatif',
        exemple: 'Indiquez votre référence de commande dans le motif.' }
    ],
    async initier({ ids }) {
      /* Rien à ouvrir : le lien existe déjà. La confirmation sera manuelle,
         comme pour un virement — c'est le prix à payer pour accepter une
         passerelle qui n'expose aucune interface. */
      return { ok: true, urlPaiement: ids.url, transactionId: null, manuel: true };
    },
    async verifier() {
      return { ok: true, paye: false, manuel: true,
        message: 'Ce moyen se confirme à la main : vérifiez la réception, puis marquez la commande payée.' };
    }
  }
};

const CLES = Object.keys(FOURNISSEURS);

/** Description des fournisseurs pour l'espace de gestion, sans aucun secret. */
function catalogue() {
  const o = {};
  for (const [cle, f] of Object.entries(FOURNISSEURS))
    o[cle] = { nom: f.nom, resume: f.resume, automatique: f.automatique, champs: f.champs };
  return o;
}

/** Les champs secrets d'un fournisseur — ceux qu'il faut chiffrer. */
function champsSecrets(fournisseur) {
  const f = FOURNISSEURS[fournisseur];
  return f ? f.champs.filter((c) => c.secret).map((c) => c.cle) : [];
}

/** Ce qui manque encore pour que la passerelle fonctionne. */
function champsManquants(fournisseur, ids) {
  const f = FOURNISSEURS[fournisseur];
  if (!f) return ['fournisseur'];
  return f.champs.filter((c) => c.requis && !String((ids || {})[c.cle] || '').trim())
    .map((c) => c.libelle);
}

async function initier(fournisseur, args) {
  const f = FOURNISSEURS[fournisseur];
  if (!f) return { ok: false, error: 'Fournisseur de paiement inconnu.' };
  try { return await f.initier(args); }
  catch (e) { return { ok: false, error: e.message }; }
}

async function verifier(fournisseur, args) {
  const f = FOURNISSEURS[fournisseur];
  if (!f) return { ok: false, paye: false, error: 'Fournisseur de paiement inconnu.' };
  try { return await f.verifier(args); }
  catch (e) { return { ok: false, paye: false, error: e.message }; }
}

const estAutomatique = (fournisseur) =>
  !!(FOURNISSEURS[fournisseur] && FOURNISSEURS[fournisseur].automatique);

module.exports = { FOURNISSEURS, CLES, catalogue, champsSecrets, champsManquants, estInterne,
                   initier, verifier, estAutomatique };
