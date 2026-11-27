/* ==========================================================
   Messages WhatsApp pré-enregistrés de l'administration
   ----------------------------------------------------------
   Konekte n'envoie pas elle-même ces messages : elle prépare
   le texte et ouvre WhatsApp sur le numéro du responsable.
   L'administrateur relit, corrige si besoin, puis envoie de
   son propre compte. C'est volontaire — l'API de Meta demande
   une vérification d'entreprise et des modèles approuvés un
   par un, alors qu'un lien wa.me fonctionne tout de suite, et
   qu'un message parti d'un vrai numéro obtient plus de
   réponses qu'un numéro automatique.

   Le modèle vit ici ; l'administration peut le réécrire depuis
   son écran, et ce qu'elle enregistre remplace le texte livré.
   Un modèle vidé revient au texte d'origine, de sorte qu'une
   mauvaise manipulation ne laisse jamais l'écran sans message.
   ========================================================== */

/* Variables reconnues dans le texte. Toute autre accolade est
   laissée telle quelle : mieux vaut un {truc} visible dans
   l'aperçu qu'un trou silencieux dans le message envoyé. */
const VARIABLES = [
  { cle: 'responsable', fr: 'Prénom et nom du responsable' },
  { cle: 'entreprise',  fr: 'Nom de l\'entreprise' },
  { cle: 'activite',    fr: 'Type d\'activité (salon de beauté, hôtel…)' },
  { cle: 'lien',        fr: 'Adresse de la page publique' },
  { cle: 'espace',      fr: 'Adresse de connexion à l\'espace de gestion' },
  { cle: 'aConfigurer', fr: 'Liste de ce qui reste à préparer, selon l\'activité' },
  { cle: 'forfait',     fr: 'Nom du forfait choisi' },
  { cle: 'joursEssai',  fr: 'Nombre de jours d\'essai gratuit' }
];

const DEFAUT = {
  approbation: {
    fr: `Bonjour {responsable}, ici l'équipe Konekte.

Bonne nouvelle : votre activité {entreprise} est approuvée, et votre page est en ligne.
👉 {lien}

Il reste une étape, et c'est elle qui fait la différence : préparer votre espace. Une page sans photo ni prix ne fait venir personne.

{aConfigurer}

Connectez-vous sur {espace} pour tout mettre en place. Comptez une quinzaine de minutes.

Vos {joursEssai} jours d'essai sont ouverts, toutes fonctions comprises. Écrivez-nous ici dès que vous avez une question — nous répondons.`,
    ht: `Bonjou {responsable}, se ekip Konekte.

Bon nouvèl : aktivite ou {entreprise} apwouve, epi paj ou an sou entènèt.
👉 {lien}

Gen yon etap ki rete, epi se li ki fè diferans lan : prepare espas ou. Yon paj san foto ak san pri pa fè pèsonn vini.

{aConfigurer}

Konekte sou {espace} pou w mete tout bagay an plas. Sa pran yon kenzèn minit.

{joursEssai} jou esè ou yo louvri, ak tout fonksyon yo. Ekri nou isit la depi w gen yon kesyon — n ap reponn.`
  }
};

/* Ce qu'il reste à préparer. La liste suit les fonctions du métier :
   proposer des chambres à un barbier, ou une carte à un notaire, c'est
   le genre de détail qui fait douter le commerçant de tout le reste. */
const LIGNES = {
  base: {
    fr: ['Votre logo et votre bannière, à vos couleurs',
         'Deux lignes de description, votre adresse et vos horaires'],
    ht: ['Logo ou ak banyè ou, nan koulè pa ou',
         'De liy deskripsyon, adrès ou ak orè ou']
  },
  rdv:          { fr: ['Vos prestations, avec leur prix et leur durée'], ht: ['Prestasyon ou yo, ak pri ak dire yo'] },
  catalogue:    { fr: ['Vos produits, avec photo, prix et quantité en stock'], ht: ['Pwodwi ou yo, ak foto, pri ak kantite nan stòk'] },
  commandes:    { fr: ['Vos zones de livraison et vos moyens de paiement'], ht: ['Zòn livrezon ou yo ak mwayen pèyman ou yo'] },
  hotellerie:   { fr: ['Vos chambres, avec photos, tarifs et heures d\'arrivée'], ht: ['Chanm ou yo, ak foto, tarif ak lè pou rive'] },
  carte:        { fr: ['Votre carte, avec les prix'], ht: ['Kat ou, ak pri yo'] },
  equipe:       { fr: ['Les membres de votre équipe'], ht: ['Manm ekip ou yo'] },
  inscriptions: { fr: ['Vos programmes et leurs frais d\'inscription'], ht: ['Pwogram ou yo ak frè enskripsyon yo'] },
  dossiers:     { fr: ['Vos honoraires, pour que le client sache à quoi s\'attendre'], ht: ['Onorè ou yo, pou kliyan an konnen sa pou l tann'] },
  urgences:     { fr: ['Votre numéro d\'urgence et vos capacités d\'accueil'], ht: ['Nimewo ijans ou ak kapasite akèy ou'] },
  fin: {
    fr: ['Votre code QR à coller sur la porte, à imprimer depuis votre espace'],
    ht: ['Kòd QR ou pou kole sou pòt la, enprime l depi nan espas ou']
  }
};

/** Liste à puces de ce qui reste à préparer, dans l'ordre d'importance. */
function aConfigurer(modules, langue) {
  const l = langue === 'ht' ? 'ht' : 'fr';
  const lignes = [...LIGNES.base[l]];
  /* Ordre volontaire : ce qui se vend d'abord, l'intendance ensuite. */
  for (const m of ['catalogue', 'rdv', 'hotellerie', 'carte', 'inscriptions', 'dossiers', 'commandes', 'equipe', 'urgences'])
    if ((modules || []).includes(m) && LIGNES[m]) lignes.push(...LIGNES[m][l]);
  lignes.push(...LIGNES.fin[l]);
  return lignes.map((x) => '• ' + x).join('\n');
}

/** Remplace les variables connues ; laisse les autres accolades visibles. */
function remplir(texte, valeurs) {
  return String(texte || '').replace(/\{(\w+)\}/g, (brut, cle) =>
    (valeurs && valeurs[cle] !== undefined && valeurs[cle] !== null) ? String(valeurs[cle]) : brut);
}

/** Modèle effectif : celui de l'administration, sinon celui d'origine. */
function modele(enregistres, cle, langue) {
  const l = langue === 'ht' ? 'ht' : 'fr';
  const perso = enregistres && enregistres[cle] && enregistres[cle][l];
  const t = String(perso || '').trim();
  return t || DEFAUT[cle][l];
}

/* Un message WhatsApp passe dans une URL : au-delà de quelques milliers de
   caractères, les navigateurs et l'application tronquent sans prévenir. On
   borne à l'écriture plutôt que de laisser partir un texte coupé net. */
const LONGUEUR_MAX = 2000;
function nettoyerModele(v) {
  return String(v === undefined || v === null ? '' : v).replace(/\r\n/g, '\n').slice(0, LONGUEUR_MAX);
}

module.exports = { VARIABLES, DEFAUT, LONGUEUR_MAX, aConfigurer, remplir, modele, nettoyerModele };
