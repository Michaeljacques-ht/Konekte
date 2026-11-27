/* ==========================================================
   Intégration Taksi Konekte — livraison des commandes
   ----------------------------------------------------------
   Deux modes de fonctionnement :

   1. API connectée — si TAKSI_API_URL et TAKSI_API_KEY sont
      définis, une course est créée directement chez Taksi
      Konekte et son identifiant est rattaché à la commande.

   2. Repli manuel — sans ces variables, la course n'est pas
      créée automatiquement. Le module produit alors un
      récapitulatif prêt à envoyer et un lien WhatsApp vers le
      répartiteur, pour que la livraison parte quand même.

   Les chemins d'API ci-dessous sont ceux qu'on attend d'une
   plateforme de ce type ; ils sont surchargeables par
   TAKSI_CHEMIN_COURSE et TAKSI_CHEMIN_SUIVI si l'API réelle
   diffère. Vérifiez-les avant la mise en production.
   ========================================================== */
const https = require('https');
const http = require('http');

const TAKSI = {
  urlBase: process.env.TAKSI_API_URL || '',
  cle: process.env.TAKSI_API_KEY || '',
  telRepartiteur: process.env.TAKSI_TEL || '',
  cheminCourse: process.env.TAKSI_CHEMIN_COURSE || '/api/courses',
  cheminSuivi: process.env.TAKSI_CHEMIN_SUIVI || '/api/courses/'
};

function actif() {
  return !!(TAKSI.urlBase && TAKSI.cle);
}

/** Appel HTTP générique vers l'API Taksi Konekte. */
function appel(chemin, methode, corpsObjet) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(chemin, TAKSI.urlBase); }
    catch { return resolve({ ok: false, erreur: 'URL Taksi Konekte invalide.' }); }

    const corps = corpsObjet ? JSON.stringify(corpsObjet) : null;
    const client = u.protocol === 'http:' ? http : https;
    const req = client.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: u.pathname + u.search,
      method: methode,
      timeout: 12000,
      headers: Object.assign(
        { Authorization: `Bearer ${TAKSI.cle}`, Accept: 'application/json' },
        corps ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(corps) } : {}
      )
    }, (rep) => {
      let data = '';
      rep.on('data', (c) => { data += c; });
      rep.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { /* réponse non JSON */ }
        if (rep.statusCode >= 200 && rep.statusCode < 300) resolve({ ok: true, corps: json });
        else resolve({ ok: false, erreur: (json && (json.erreur || json.message)) || `Erreur ${rep.statusCode}`, code: rep.statusCode });
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, erreur: 'Taksi Konekte ne répond pas.' }); });
    req.on('error', (e) => resolve({ ok: false, erreur: e.message }));
    if (corps) req.write(corps);
    req.end();
  });
}

/** Récapitulatif lisible, utilisé pour le repli manuel. */
function recapitulatif(cmd, entreprise) {
  const lignes = [
    `Livraison ${cmd.reference}`,
    `De : ${entreprise.nom}${entreprise.adresse ? ' — ' + entreprise.adresse : ''}`,
    `Vers : ${cmd.adresse}${cmd.repere ? ' (' + cmd.repere + ')' : ''}`,
    cmd.zone ? `Zone : ${cmd.zone}` : '',
    `Client : ${cmd.clientNom} — ${cmd.clientTel}`,
    `Colis : ${cmd.lignes.reduce((s, l) => s + l.quantite, 0)} article(s)`,
    cmd.paye
      ? `Déjà payé — rien à encaisser`
      : `À encaisser : ${cmd.total.toLocaleString('fr-HT')} HTG`
  ];
  return lignes.filter(Boolean).join('\n');
}

/**
 * Demande une course de livraison.
 * Retourne toujours un objet exploitable, même sans API configurée.
 */
async function demanderCourse(cmd, entreprise) {
  const texte = recapitulatif(cmd, entreprise);
  const lienWhatsApp = TAKSI.telRepartiteur
    ? `https://wa.me/${String(TAKSI.telRepartiteur).replace(/\D/g, '')}?text=${encodeURIComponent(texte)}`
    : '';

  if (!actif()) {
    return {
      ok: true, mode: 'manuel', courseId: null, texte, lienWhatsApp,
      message: 'Taksi Konekte n\'est pas connecté. Transmettez la course manuellement.'
    };
  }

  const r = await appel(TAKSI.cheminCourse, 'POST', {
    reference: cmd.reference,
    type: 'livraison',
    depart: {
      nom: entreprise.nom,
      adresse: entreprise.adresse || '',
      latitude: entreprise.latitude ?? null,
      longitude: entreprise.longitude ?? null,
      telephone: entreprise.telephone || ''
    },
    arrivee: {
      nom: cmd.clientNom,
      adresse: cmd.adresse,
      repere: cmd.repere || '',
      zone: cmd.zone || '',
      telephone: cmd.clientTel
    },
    colis: { articles: cmd.lignes.reduce((s, l) => s + l.quantite, 0) },
    // Le livreur n'encaisse que si la commande n'a pas été payée en ligne
    encaissement: cmd.paye ? 0 : cmd.total,
    fraisLivraison: cmd.frais || 0
  });

  if (!r.ok) {
    // L'échec de l'API ne doit pas bloquer la livraison : on bascule en manuel
    return {
      ok: true, mode: 'manuel', courseId: null, texte, lienWhatsApp,
      message: `Taksi Konekte injoignable (${r.erreur}). Transmettez la course manuellement.`
    };
  }
  const c = r.corps || {};
  return {
    ok: true, mode: 'api',
    courseId: c.id || c.courseId || c.reference || null,
    statut: c.statut || 'demandee',
    chauffeur: c.chauffeur || null,
    lienSuivi: c.lienSuivi || c.url || '',
    texte, lienWhatsApp
  };
}

/** État d'une course déjà créée. */
async function suivreCourse(courseId) {
  if (!actif() || !courseId) return { ok: false, erreur: 'Suivi indisponible.' };
  const r = await appel(TAKSI.cheminSuivi + encodeURIComponent(courseId), 'GET');
  if (!r.ok) return { ok: false, erreur: r.erreur };
  const c = r.corps || {};
  return {
    ok: true,
    statut: c.statut || 'inconnu',
    chauffeur: c.chauffeur || null,
    position: c.position || null,
    lienSuivi: c.lienSuivi || c.url || ''
  };
}

module.exports = { TAKSI, actif, demanderCourse, suivreCourse, recapitulatif };
