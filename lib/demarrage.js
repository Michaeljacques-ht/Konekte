/* ==========================================================
   Liste de démarrage
   ----------------------------------------------------------
   Le point faible de la plateforme n'est pas l'inscription :
   c'est ce qui suit. Une entreprise s'inscrit, sa page part en
   ligne vide, personne ne réserve, et au bout d'un mois le
   commerçant conclut que « ça ne marche pas ». Il n'a pourtant
   rien fait de travers — personne ne lui a dit, au bon moment
   et dans le bon écran, ce qui restait à faire.

   Ce fichier calcule cette liste à partir des données réelles
   de l'entreprise. Rien n'est déclaratif : une étape est faite
   parce que le logo existe, parce qu'il y a trois produits,
   pas parce que quelqu'un a coché une case.

   Les étapes suivent le métier. Proposer des chambres à un
   barbier, ou une carte à un notaire, discrédite tout le
   reste ; le commerçant se dit que la plateforme ne sait pas
   ce qu'il fait.
   ========================================================== */

/* Chaque étape porte son « pourquoi ». Une liste de tâches sans raison
   se referme ; une raison concrète — ce que le client voit, ce qu'on
   perd sans elle — se suit jusqu'au bout. */
const ETAPES = {
  logo: {
    titre: { fr: 'Votre logo', ht: 'Logo ou' },
    pourquoi: {
      fr: 'Il apparaît sur votre page, sur vos reçus et sur votre flyer. Sans lui, vos initiales en tiennent lieu.',
      ht: 'Li parèt sou paj ou, sou resi ou yo ak sou flyer ou. San li, se inisyal ou ki la.'
    },
    section: 'perso'
  },
  banniere: {
    titre: { fr: 'Votre bannière', ht: 'Banyè ou' },
    pourquoi: {
      fr: 'C\'est la première image que voit un client. Une devanture, votre salle, vos produits en rayon.',
      ht: 'Se premye imaj yon kliyan wè. Devanti ou, sal ou, pwodwi ou yo nan etajè.'
    },
    section: 'perso'
  },
  description: {
    titre: { fr: 'Deux lignes sur votre activité', ht: 'De liy sou aktivite ou' },
    pourquoi: {
      fr: 'Dites ce que vous faites et ce qui vous distingue. C\'est aussi ce que lisent les moteurs de recherche.',
      ht: 'Di sa w ap fè ak sa ki fè ou diferan. Se sa motè rechèch yo li tou.'
    },
    section: 'param'
  },
  adresse: {
    titre: { fr: 'Votre adresse et votre ville', ht: 'Adrès ou ak vil ou' },
    pourquoi: {
      fr: 'Sans ville, vous n\'apparaissez pas dans les recherches « près de moi » ni sur la carte.',
      ht: 'San vil, ou pa parèt nan rechèch « toupre m » yo ni sou kat la.'
    },
    section: 'param'
  },
  paiement: {
    titre: { fr: 'Comment vous êtes payé', ht: 'Kijan yo peye ou' },
    pourquoi: {
      fr: 'Publiez votre MonCash ou votre NatCash, ou activez le paiement en ligne. Sans cela, le client ne peut que vous appeler.',
      ht: 'Pibliye MonCash ou oswa NatCash ou, oswa aktive pèyman an liy. San sa, kliyan an ka sèlman rele ou.'
    },
    section: 'portefeuille'
  },
  qr: {
    titre: { fr: 'Votre code QR, imprimé', ht: 'Kòd QR ou, enprime' },
    pourquoi: {
      fr: 'Collé sur votre porte ou votre comptoir, il transforme les passants en clients qui réservent.',
      ht: 'Kole sou pòt ou oswa kontwa ou, li fè moun k ap pase vin kliyan ki rezève.'
    },
    section: 'qr'
  }
};

/* L'étape « contenu » change de nature selon le métier : c'est le cœur
   de ce que l'entreprise vend, et le seul élément sans lequel la page
   ne sert à rien. Premier module trouvé, dans cet ordre : on commence
   par ce qui se vend, l'intendance vient après. */
const CONTENUS = [
  { module: 'catalogue', cle: 'produits', section: 'catalogue',
    titre: { fr: 'Vos premiers produits', ht: 'Premye pwodwi ou yo' },
    pourquoi: { fr: 'Photo, prix et quantité. Trois produits suffisent pour commencer à vendre.',
                ht: 'Foto, pri ak kantite. Twa pwodwi ase pou kòmanse vann.' } },
  { module: 'hotellerie', cle: 'chambres', section: 'chambres',
    titre: { fr: 'Vos chambres', ht: 'Chanm ou yo' },
    pourquoi: { fr: 'Photos, tarifs et équipements. Un voyageur ne réserve jamais une chambre qu\'il n\'a pas vue.',
                ht: 'Foto, tarif ak ekipman. Yon vwayajè pa janm rezève yon chanm li pa wè.' } },
  { module: 'rdv', cle: 'services', section: 'services',
    titre: { fr: 'Vos prestations', ht: 'Prestasyon ou yo' },
    pourquoi: { fr: 'Avec leur prix et leur durée : c\'est ce que le client choisit pour prendre rendez-vous.',
                ht: 'Ak pri ak dire yo : se sa kliyan an chwazi pou pran randevou.' } },
  { module: 'inscriptions', cle: 'programmes', section: 'programmes',
    titre: { fr: 'Vos programmes', ht: 'Pwogram ou yo' },
    pourquoi: { fr: 'Niveaux et frais d\'inscription, pour que les parents s\'inscrivent sans se déplacer.',
                ht: 'Nivo ak frè enskripsyon, pou paran yo enskri san deplase.' } },
  { module: 'carte', cle: 'carte', section: 'carte',
    titre: { fr: 'Votre carte', ht: 'Kat ou' },
    pourquoi: { fr: 'Plats et boissons, avec les prix. C\'est la page la plus consultée d\'un restaurant.',
                ht: 'Manje ak bwason, ak pri yo. Se paj yon restoran moun gade plis la.' } },
  { module: 'dossiers', cle: 'dossiers', section: 'dossiers',
    titre: { fr: 'Vos honoraires', ht: 'Onorè ou yo' },
    pourquoi: { fr: 'Annoncez vos tarifs : un client qui ignore le prix n\'ouvre pas de dossier.',
                ht: 'Anonse tarif ou yo : yon kliyan ki pa konnen pri a pa louvri yon dosye.' } }
];

const texte = (v) => String(v === undefined || v === null ? '' : v).trim();

/**
 * Étapes de démarrage d'une entreprise.
 * `compteurs` porte ce que le serveur sait compter : produits, chambres,
 * services, programmes, plats. Le fichier ne touche pas à la base.
 */
function etapes(e, metier, compteurs) {
  const c = compteurs || {};
  const mods = (metier && metier.modules) || [];
  const liste = [];
  const ajouter = (cle, def, fait) => liste.push({
    cle, titre: def.titre, pourquoi: def.pourquoi, section: def.section, fait: !!fait
  });

  ajouter('logo', ETAPES.logo, texte(e.logoImage));
  ajouter('banniere', ETAPES.banniere, texte(e.photoFond));
  /* Quarante caractères : en dessous, c'est un nom répété, pas une
     description — et le client n'y apprend rien. */
  ajouter('description', ETAPES.description, texte(e.description).length >= 40);
  ajouter('adresse', ETAPES.adresse, texte(e.adresse) && texte(e.ville));

  const contenu = CONTENUS.find((x) => mods.includes(x.module));
  if (contenu) ajouter('contenu', contenu, (c[contenu.cle] || 0) > 0);

  /* Le paiement n'est demandé qu'aux métiers qui encaissent sur la
     plateforme. Un notaire qui suit des dossiers n'a rien à publier. */
  if (mods.some((m) => ['catalogue', 'commandes', 'rdv', 'hotellerie', 'inscriptions'].includes(m)))
    ajouter('paiement', ETAPES.paiement,
      (e.comptesPaiement || []).some((x) => x && x.actif) || (e.vente && e.vente.paiementEnLigne));

  ajouter('qr', ETAPES.qr, e.qrTelecharge);
  return liste;
}

/** Progression : ce que l'écran affiche, et ce que l'administration trie. */
function progression(e, metier, compteurs) {
  const liste = etapes(e, metier, compteurs);
  const faits = liste.filter((x) => x.fait).length;
  return {
    etapes: liste,
    faits,
    total: liste.length,
    pourcent: liste.length ? Math.round((faits / liste.length) * 100) : 100,
    termine: faits === liste.length
  };
}

module.exports = { ETAPES, CONTENUS, etapes, progression };
