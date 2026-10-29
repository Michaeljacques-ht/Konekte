'use strict';
/* ==========================================================
   Envoi de courriels
   ----------------------------------------------------------
   Render bloque le port SMTP : impossible d'envoyer directement
   depuis le serveur. On passe donc par l'interface web d'un
   service d'envoi.

   Brevo est retenu par défaut : sa formule gratuite couvre
   300 courriels par jour.

   Sans clé configurée, les courriels sont écrits dans les
   journaux : le développement reste possible, et rien ne casse.

   C'EST LE SEUL CANAL DE NOTIFICATION DE LA PLATEFORME.
   ----------------------------------------------------------
   Les messages automatiques passaient auparavant par l'API
   WhatsApp de Meta. Obtenir un jeton permanent suppose une
   vérification d'entreprise et des modèles approuvés un par
   un : une démarche longue, incertaine, et bloquante pour une
   plateforme qui doit fonctionner tout de suite. Le courriel
   demande une clé et une adresse vérifiée, et fonctionne le
   jour même.

   Les liens « Contacter sur WhatsApp » restent : ce sont de
   simples liens wa.me, qui n'ont jamais eu besoin de Meta.
   ========================================================== */
const https = require('https');

const CLE = process.env.BREVO_API_KEY || '';
/* Deux noms de variable ont coexisté dans le projet. On accepte les deux :
   une plateforme muette parce que la variable porte l'autre nom est un
   échec silencieux, et c'est le pire des échecs. */
const EXPEDITEUR = process.env.COURRIEL_EXPEDITEUR
  || process.env.EMAIL_EXPEDITEUR
  || 'contact@bizniskonekte.tech';
const NOM_EXPEDITEUR = process.env.COURRIEL_NOM || 'Konekte';
const CONTACT = process.env.COURRIEL_CONTACT || 'contact@bizniskonekte.tech';
const TEL_SUPPORT = process.env.TEL_SUPPORT || '+1 514 226 1860';
/* Adresse officielle du site. Les images d'un courriel doivent porter une
   adresse absolue : un chemin relatif ne mène nulle part dans une boîte
   de réception. */
const URL_SITE = String(process.env.URL_PUBLIQUE || 'https://bizniskonekte.tech').trim().replace(/\/+$/, '');

function configure() { return !!CLE; }

/** Requête vers l'interface de Brevo. */
function appel(charge) {
  return new Promise((resoudre) => {
    const corps = JSON.stringify(charge);
    const req = https.request({
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'api-key': CLE,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(corps)
      },
      timeout: 12000
    }, (rep) => {
      let donnees = '';
      rep.on('data', (d) => { donnees += d; });
      rep.on('end', () => {
        const ok = rep.statusCode >= 200 && rep.statusCode < 300;
        if (!ok) console.error('[COURRIEL] échec', rep.statusCode, donnees.slice(0, 200));
        resoudre({ ok, code: rep.statusCode });
      });
    });
    req.on('error', (e) => { console.error('[COURRIEL] erreur réseau', e.message); resoudre({ ok: false }); });
    req.on('timeout', () => { req.destroy(); resoudre({ ok: false }); });
    req.write(corps);
    req.end();
  });
}

/** Échappe le texte venu du public : un nom d'entreprise entre dans le HTML. */
function ech(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Montant en gourdes, toujours écrit de la même façon. */
function htg(n) { return Math.round(+n || 0).toLocaleString('fr-HT') + ' HTG'; }

/**
 * Gabarit commun : en-tête de marque, contenu, pied.
 *
 * `accent` permet à une entreprise de retrouver sa couleur dans le
 * courriel que reçoit son client : c'est son message, pas le nôtre.
 */
function gabarit(titre, contenu, accent) {
  const couleur = /^#[0-9A-Fa-f]{6}$/.test(String(accent || '')) ? accent : '#0B2C6B';
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#EEF2F8;font-family:system-ui,-apple-system,'Segoe UI',Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:26px 12px">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden">
    <tr><td style="height:5px;background:linear-gradient(90deg,${couleur} 60%,#F26B21 60%)"></td></tr>
    <tr><td style="padding:26px 28px 6px">
      <!-- Le logo remplace le mot « KONEKTE » écrit en toutes lettres. Le
           texte de remplacement le reprend : beaucoup de messageries
           n'affichent les images qu'après autorisation, et l'expéditeur
           doit se reconnaître même sans elles. -->
      <img src="${URL_SITE}/logo-courriel.png" alt="Konekte" width="118" height="90"
           style="display:block;border:0;outline:none;text-decoration:none;height:auto;width:118px;max-width:118px">
      <h1 style="margin:12px 0 0;font-size:20px;color:${couleur}">${titre}</h1>
    </td></tr>
    <tr><td style="padding:12px 28px 26px;font-size:14.5px;line-height:1.6;color:#26364F">${contenu}</td></tr>
    <tr><td style="padding:16px 28px;background:#F5F8FD;font-size:12px;color:#5A6B85">
      Message automatique — merci de ne pas y répondre.<br>
      Une question ? ${ech(CONTACT)} ou WhatsApp ${ech(TEL_SUPPORT)}
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

/* Fragments réutilisés par les modèles : un encadré de détails, et une
   référence mise en valeur. Écrits une fois pour que tous les courriels
   de la plateforme se ressemblent. */
function encadre(lignes) {
  const contenu = lignes.filter(Boolean)
    .map(([etiquette, valeur]) => `<tr>
      <td style="padding:3px 0;color:#5A6B85;font-size:13.5px">${ech(etiquette)}</td>
      <td style="padding:3px 0;text-align:right;font-weight:700;color:#26364F;font-size:13.5px">${ech(valeur)}</td></tr>`)
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background:#F5F8FD;border-radius:12px;padding:14px 16px;margin:16px 0">${contenu}</table>`;
}

function reference(ref) {
  return `<p style="margin:16px 0 0;text-align:center">
    <span style="display:inline-block;background:#F5F8FD;border-radius:10px;padding:10px 18px;
      font-size:18px;font-weight:800;letter-spacing:.08em;color:#0B2C6B">${ech(ref)}</span>
    <br><span style="font-size:12px;color:#5A6B85">Conservez cette référence</span></p>`;
}

/** Bouton d'appel à l'action, quand le courriel mène quelque part. */
function bouton(libelle, lien, couleur) {
  if (!lien) return '';
  return `<p style="margin:18px 0 0;text-align:center">
    <a href="${ech(lien)}" style="display:inline-block;background:${/^#[0-9A-Fa-f]{6}$/.test(String(couleur||'')) ? couleur : '#0B2C6B'};
      color:#fff;text-decoration:none;border-radius:999px;padding:11px 24px;font-weight:700;font-size:14px">${ech(libelle)}</a></p>`;
}

const MODELES = {
  compte_activation: (p) => ({
    sujet: 'Activez votre compte Konekte',
    titre: 'Plus qu\'une étape',
    contenu: `<p style="margin:0 0 14px">Bonjour ${p.nom || ''},</p>
      <p style="margin:0 0 18px">Votre inscription pour <strong>${p.entreprise || 'votre entreprise'}</strong>
      est enregistrée. Il ne reste qu'à confirmer cette adresse pour ouvrir votre espace de gestion.</p>
      <p style="margin:0 0 18px;text-align:center">
        <a href="${p.lien}" style="display:inline-block;background:#0B2C6B;color:#fff;text-decoration:none;
          font-weight:800;font-size:16px;padding:15px 34px;border-radius:99px">Activer mon compte</a></p>
      <p style="margin:0 0 6px;font-size:13px;color:#5A6B85">Si le bouton ne fonctionne pas, copiez cette adresse
      dans votre navigateur :</p>
      <p style="margin:0;font-size:12px;color:#0B2C6B;word-break:break-all">${p.lien}</p>
      <p style="margin:18px 0 0;font-size:13px;color:#5A6B85">Ce lien est valable 7 jours et ne sert qu'une fois.
      Dès que vous aurez cliqué, votre page publique sera en ligne sur Konekte.</p>
      <p style="margin:10px 0 0;font-size:13px;color:#5A6B85">Si vous n'êtes pas à l'origine de cette inscription,
      ignorez simplement ce message.</p>`
  }),
  code_connexion: (p) => ({
    sujet: `${p.code} — votre code de connexion`,
    titre: 'Votre code de connexion',
    contenu: `<p style="margin:0 0 14px">Bonjour ${p.nom || ''},</p>
      <p style="margin:0 0 16px">Voici le code à saisir pour accéder à votre espace :</p>
      <p style="margin:0;text-align:center;font-size:34px;font-weight:800;letter-spacing:.22em;color:#0B2C6B;
        background:#F5F8FD;border-radius:12px;padding:16px 0">${p.code}</p>
      <p style="margin:16px 0 0;font-size:13px;color:#5A6B85">Ce code expire dans 10 minutes.
      Si vous n'êtes pas à l'origine de cette connexion, changez votre mot de passe sans tarder.</p>`
  }),
  mdp_change: (p) => ({
    sujet: 'Votre mot de passe a été changé',
    titre: 'Mot de passe modifié',
    contenu: `<p style="margin:0 0 14px">Bonjour ${p.nom || ''},</p>
      <p style="margin:0">Le mot de passe de votre espace Konekte vient d'être modifié.
      Toutes les sessions ouvertes ont été fermées.</p>
      <p style="margin:14px 0 0;font-size:13px;color:#5A6B85"><strong>Si vous n'êtes pas à l'origine de ce
      changement</strong>, écrivez-nous immédiatement sur WhatsApp au +1 514 226 1860.</p>`
  }),
  a2f_activee: (p) => ({
    sujet: 'Vérification en deux étapes activée',
    titre: 'Votre compte est mieux protégé',
    contenu: `<p style="margin:0 0 14px">Bonjour ${p.nom || ''},</p>
      <p style="margin:0">La vérification en deux étapes est désormais active sur votre espace.
      À chaque connexion, un code vous sera envoyé à ${p.destination}.</p>
      <p style="margin:14px 0 0;font-size:13px;color:#5A6B85">Si vous n'êtes pas à l'origine de ce changement,
      contactez-nous immédiatement.</p>`
  }),

  /* ========================================================
     Rendez-vous
     ======================================================== */
  rdv_recu: (p) => ({
    sujet: `Demande de rendez-vous reçue — ${p.entreprise}`,
    titre: 'Votre demande est bien arrivée',
    accent: p.couleur,
    contenu: `<p style="margin:0 0 6px">Bonjour ${ech(p.nom)},</p>
      <p style="margin:0">Votre demande de rendez-vous chez <strong>${ech(p.entreprise)}</strong> a été reçue.
      Vous recevrez un courriel dès qu'elle sera confirmée.</p>
      ${encadre([['Prestation', p.service], ['Date', p.date], ['Heure', p.heure],
                 p.adresse && ['Adresse', p.adresse]])}
      ${p.lien ? bouton('Voir l\'entreprise', p.lien, p.couleur) : ''}`
  }),
  rdv_statut: (p) => ({
    sujet: `Rendez-vous ${p.statut} — ${p.entreprise}`,
    titre: `Rendez-vous ${p.statut}`,
    accent: p.couleur,
    contenu: `<p style="margin:0 0 6px">Bonjour ${ech(p.nom)},</p>
      <p style="margin:0">Votre rendez-vous chez <strong>${ech(p.entreprise)}</strong> est
      <strong>${ech(p.statut)}</strong>.</p>
      ${encadre([['Date', p.date], ['Heure', p.heure], p.adresse && ['Adresse', p.adresse],
                 p.telephone && ['Téléphone', p.telephone]])}`
  }),
  rdv_rappel: (p) => ({
    sujet: `Rappel : rendez-vous demain — ${p.entreprise}`,
    titre: 'Votre rendez-vous est demain',
    accent: p.couleur,
    contenu: `<p style="margin:0 0 6px">Bonjour ${ech(p.nom)},</p>
      <p style="margin:0">Petit rappel : vous êtes attendu(e) <strong>demain ${ech(p.date)} à ${ech(p.heure)}</strong>
      chez <strong>${ech(p.entreprise)}</strong>.</p>
      ${encadre([p.service && ['Prestation', p.service], p.adresse && ['Adresse', p.adresse],
                 p.telephone && ['Téléphone', p.telephone]])}
      <p style="margin:0;font-size:13px;color:#5A6B85">Un empêchement ? Prévenez l'entreprise le plus tôt possible.</p>`
  }),

  /* ========================================================
     Séjours
     ======================================================== */
  sejour_recu: (p) => ({
    sujet: `Réservation reçue — ${p.entreprise}`,
    titre: 'Votre réservation est bien arrivée',
    accent: p.couleur,
    contenu: `<p style="margin:0 0 6px">Bonjour ${ech(p.nom)},</p>
      <p style="margin:0">Votre demande de séjour chez <strong>${ech(p.entreprise)}</strong> a été reçue.
      L'établissement la confirmera très bientôt.</p>
      ${encadre([p.chambre && ['Chambre', p.chambre], ['Arrivée', p.arrivee], ['Départ', p.depart],
                 ['Nuits', p.nuits], p.total && ['Total', htg(p.total)],
                 p.acompte && ['Acompte demandé', htg(p.acompte)]])}
      ${p.reference ? reference(p.reference) : ''}`
  }),
  sejour_statut: (p) => ({
    sujet: `Séjour ${p.statut} — ${p.entreprise}`,
    titre: `Séjour ${p.statut}`,
    accent: p.couleur,
    contenu: `<p style="margin:0 0 6px">Bonjour ${ech(p.nom)},</p>
      <p style="margin:0">Votre séjour chez <strong>${ech(p.entreprise)}</strong> est
      <strong>${ech(p.statut)}</strong>.</p>
      ${encadre([['Arrivée', p.arrivee], ['Départ', p.depart], ['Nuits', p.nuits],
                 p.adresse && ['Adresse', p.adresse]])}`
  }),
  sejour_rappel: (p) => ({
    sujet: `Rappel : votre arrivée demain — ${p.entreprise}`,
    titre: 'Votre séjour commence demain',
    accent: p.couleur,
    contenu: `<p style="margin:0 0 6px">Bonjour ${ech(p.nom)},</p>
      <p style="margin:0">Nous vous attendons <strong>demain ${ech(p.arrivee)}</strong> chez
      <strong>${ech(p.entreprise)}</strong>, pour ${ech(p.nuits)} nuit${p.nuits > 1 ? 's' : ''}
      (départ le ${ech(p.depart)}).</p>
      ${encadre([p.chambre && ['Chambre', p.chambre], p.adresse && ['Adresse', p.adresse],
                 p.telephone && ['Téléphone', p.telephone],
                 p.total && ['À régler sur place', htg(p.total)]])}
      ${p.reference ? reference(p.reference) : ''}`
  }),
  sejour_paye: (p) => ({
    sujet: `Paiement reçu — séjour chez ${p.entreprise}`,
    titre: 'Paiement reçu ✅',
    accent: p.couleur,
    contenu: `<p style="margin:0 0 6px">Bonjour ${ech(p.nom)},</p>
      <p style="margin:0">Nous avons bien reçu votre paiement pour votre séjour chez
      <strong>${ech(p.entreprise)}</strong>.</p>
      ${encadre([p.chambre && ['Chambre', p.chambre], ['Arrivée', p.arrivee], ['Départ', p.depart],
                 ['Montant réglé', htg(p.montant)]])}
      ${p.lienRecu ? bouton('Voir mon reçu', p.lienRecu, p.couleur) : ''}`
  }),

  /* ========================================================
     Commandes
     ======================================================== */
  commande_recue: (p) => ({
    sujet: `Commande ${p.reference} reçue — ${p.entreprise}`,
    titre: p.precommande ? 'Précommande enregistrée' : 'Commande enregistrée',
    accent: p.couleur,
    contenu: `<p style="margin:0 0 6px">Bonjour ${ech(p.nom)},</p>
      <p style="margin:0">Votre ${p.precommande ? 'précommande' : 'commande'} chez
      <strong>${ech(p.entreprise)}</strong> a bien été enregistrée.</p>
      ${encadre([['Total', htg(p.total)], ['Mode', p.mode],
                 p.delai && ['Délai annoncé', p.delai],
                 p.dateDispo && ['Disponible vers le', p.dateDispo]])}
      ${reference(p.reference)}
      ${p.lienSuivi ? bouton('Suivre ma commande', p.lienSuivi, p.couleur) : ''}`
  }),
  commande_statut: (p) => ({
    sujet: `Commande ${p.reference} — ${p.statut}`,
    titre: `Votre commande est ${String(p.statut || '').toLowerCase()}`,
    accent: p.couleur,
    contenu: `<p style="margin:0 0 6px">Bonjour ${ech(p.nom)},</p>
      <p style="margin:0">Votre commande chez <strong>${ech(p.entreprise)}</strong> vient de passer à
      l'étape <strong>${ech(p.statut)}</strong>.</p>
      ${encadre([['Référence', p.reference], ['Mode', p.mode], p.total && ['Total', htg(p.total)]])}
      ${p.lienSuivi ? bouton('Suivre ma commande', p.lienSuivi, p.couleur) : ''}`
  }),
  commande_payee: (p) => ({
    sujet: `Paiement reçu — commande ${p.reference}`,
    titre: 'Paiement reçu ✅',
    accent: p.couleur,
    contenu: `<p style="margin:0 0 6px">Bonjour ${ech(p.nom)},</p>
      <p style="margin:0">Votre paiement a bien été reçu par <strong>${ech(p.entreprise)}</strong>.
      Votre commande est confirmée.</p>
      ${encadre([['Référence', p.reference], ['Montant réglé', htg(p.total)], ['Mode', p.mode]])}
      ${p.lienRecu ? bouton('Voir mon reçu', p.lienRecu, p.couleur) : ''}`
  }),

  /* ========================================================
     Inscriptions scolaires
     ======================================================== */
  inscription_recue: (p) => ({
    sujet: `Demande d'inscription reçue — ${p.entreprise}`,
    titre: 'Demande d\'inscription reçue',
    accent: p.couleur,
    contenu: `<p style="margin:0 0 6px">Bonjour ${ech(p.nom)},</p>
      <p style="margin:0">La demande d'inscription de <strong>${ech(p.eleve)}</strong> chez
      <strong>${ech(p.entreprise)}</strong> a bien été reçue.</p>
      ${encadre([['Programme', p.programme],
                 p.frais && ['Frais d\'inscription', htg(p.frais)]])}
      <p style="margin:0;font-size:13px;color:#5A6B85">L'établissement examinera le dossier et vous répondra.</p>`
  }),
  inscription_statut: (p) => ({
    sujet: `Inscription ${p.statut} — ${p.entreprise}`,
    titre: `Inscription ${p.statut}`,
    accent: p.couleur,
    contenu: `<p style="margin:0 0 6px">Bonjour ${ech(p.nom)},</p>
      <p style="margin:0">La demande d'inscription de <strong>${ech(p.eleve)}</strong> au programme
      <strong>${ech(p.programme)}</strong> est <strong>${ech(p.statut)}</strong>.</p>
      ${p.consigne ? `<p style="margin:14px 0 0">${ech(p.consigne)}</p>` : ''}`
  }),

  /* ========================================================
     Suivi de dossiers
     ======================================================== */
  dossier_ouvert: (p) => ({
    sujet: `Dossier ouvert — ${p.entreprise}`,
    titre: 'Votre dossier est ouvert',
    accent: p.couleur,
    contenu: `<p style="margin:0 0 6px">Bonjour ${ech(p.nom)},</p>
      <p style="margin:0"><strong>${ech(p.entreprise)}</strong> a ouvert votre dossier :
      <strong>${ech(p.objet)}</strong>.</p>
      ${reference(p.reference)}
      <p style="margin:16px 0 0;font-size:13px;color:#5A6B85">Vous serez prévenu(e) à chaque étape.
      Cette référence et votre numéro de téléphone permettent de suivre le dossier en ligne.</p>
      ${p.lienSuivi ? bouton('Suivre mon dossier', p.lienSuivi, p.couleur) : ''}`
  }),
  dossier_etape: (p) => ({
    sujet: `Dossier ${p.reference} — ${p.etape}`,
    titre: 'Votre dossier avance',
    accent: p.couleur,
    contenu: `<p style="margin:0 0 6px">Bonjour ${ech(p.nom)},</p>
      <p style="margin:0">Votre dossier <strong>${ech(p.objet)}</strong> chez
      <strong>${ech(p.entreprise)}</strong> est passé à l'étape <strong>${ech(p.etape)}</strong>.</p>
      ${encadre([['Référence', p.reference]])}
      ${p.lienSuivi ? bouton('Suivre mon dossier', p.lienSuivi, p.couleur) : ''}`
  }),

  /* ========================================================
     Plateforme
     ======================================================== */
  message_recu: (p) => ({
    sujet: `Votre message est bien arrivé — ${p.sujet}`,
    titre: 'Message bien reçu',
    contenu: `<p style="margin:0 0 6px">Bonjour ${ech(p.nom)},</p>
      <p style="margin:0">Nous avons bien reçu votre message : <strong>${ech(p.sujet)}</strong>.
      Nous y répondons dans les meilleurs délais.</p>
      ${reference(p.reference)}`
  }),
  abonnement_regle: (p) => ({
    sujet: 'Abonnement réglé — merci',
    titre: 'Votre abonnement est à jour',
    contenu: `<p style="margin:0 0 6px">Bonjour,</p>
      <p style="margin:0">Le règlement de l'abonnement de <strong>${ech(p.entreprise)}</strong> a bien été
      enregistré.</p>
      ${encadre([['Forfait', p.forfait], ['Montant réglé', htg(p.montant)],
                 ['Prochaine échéance', p.prochain]])}`
  })
};

/**
 * Envoie un courriel à partir d'un modèle.
 * Retourne toujours une promesse résolue : un échec d'envoi ne doit
 * jamais interrompre le parcours de l'utilisateur.
 */
async function envoyer(destinataire, modele, parametres) {
  const m = MODELES[modele];
  if (!m) { console.error('[COURRIEL] modèle inconnu :', modele); return { ok: false }; }

  /* Un client qui n'a pas laissé d'adresse ne reçoit rien, et c'est normal :
     il voit sa référence à l'écran et l'entreprise a son numéro. On ne
     journalise pas cette absence comme une erreur. */
  if (!adresseValide(destinataire)) return { ok: false, sansAdresse: true };

  const { sujet, titre, contenu, accent } = m(parametres || {});

  if (!configure()) {
    console.log(`[COURRIEL simulation → ${destinataire}] ${sujet}`);
    if (parametres && parametres.code) console.log(`   code : ${parametres.code}`);
    return { ok: true, simule: true };
  }
  return appel({
    sender: { email: EXPEDITEUR, name: NOM_EXPEDITEUR },
    to: [{ email: destinataire }],
    subject: sujet,
    htmlContent: gabarit(titre, contenu, accent)
  });
}

function adresseValide(a) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(a || '').trim());
}

module.exports = { envoyer, configure, adresseValide, MODELES };
