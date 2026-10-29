'use strict';
/* ==========================================================
   Comptabilité
   ----------------------------------------------------------
   Une comptabilité en partie double, mais que l'entreprise
   n'a jamais besoin de comprendre comme telle.

   LE PRINCIPE
   Chaque opération touche deux comptes : l'un reçoit (débit),
   l'autre donne (crédit), du même montant. C'est ce qui rend
   la comptabilité vérifiable : si le total des débits n'égale
   pas le total des crédits, quelque chose est faux, et on le
   sait tout de suite.

   CE QUE VOIT L'ENTREPRISE
   Pas des comptes à numéros. Elle choisit une OPÉRATION —
   « j'ai vendu et encaissé », « j'ai payé le loyer », « un
   client m'a réglé sa dette » — une catégorie, un montant et
   une caisse. Les deux comptes sont déduits de ce choix. Un
   commerçant de Saint-Marc n'a pas à savoir que son loyer est
   un compte 613 pour tenir sa comptabilité correctement.

   POURQUOI LA PARTIE DOUBLE QUAND MÊME
   Parce qu'un simple carnet de recettes et de dépenses ne
   répond pas aux questions qui comptent : combien mes clients
   me doivent, combien je dois à mes fournisseurs, quelle part
   de mon encaisse est de la TCA qui n'est pas à moi, et
   est-ce que mon bénéfice du mois est réel ou seulement de la
   trésorerie empruntée. Ce fichier tient les deux à la fois :
   une saisie simple, des états justes.
   ========================================================== */

/* ----------------------------------------------------------
   TCA — Taxe sur le chiffre d'affaires (Haïti)
   Le taux de droit commun est de 10 %. Il est configurable
   par entreprise : une loi de finances peut le changer, et
   toutes les entreprises n'y sont pas assujetties.
   ---------------------------------------------------------- */
const TCA_TAUX_DEFAUT = 0.10;

/* ----------------------------------------------------------
   Plan comptable simplifié
   Classes 1 à 7, dans la logique du plan comptable général.
   Volontairement court : une trentaine de comptes couvrent
   l'activité d'une PME haïtienne. Un plan de 400 lignes ne
   serait jamais utilisé.
   ---------------------------------------------------------- */
const COMPTES = {
  // ---- Classe 1 : capitaux propres ----
  '101': { nom: { fr: 'Capital de l\'entreprise', ht: 'Kapital biznis la' }, classe: 1, sens: 'passif' },
  '108': { nom: { fr: 'Prélèvements du propriétaire', ht: 'Lajan pwopriyetè a pran' }, classe: 1, sens: 'passif' },
  '120': { nom: { fr: 'Résultat de l\'exercice', ht: 'Rezilta ane a' }, classe: 1, sens: 'passif' },
  '164': { nom: { fr: 'Emprunts et microcrédits', ht: 'Prè ak mikwokredi' }, classe: 1, sens: 'passif' },

  // ---- Classe 2 : ce que l'entreprise possède durablement ----
  '213': { nom: { fr: 'Local et aménagements', ht: 'Lokal ak amenajman' }, classe: 2, sens: 'actif' },
  '215': { nom: { fr: 'Matériel et équipement', ht: 'Materyèl ak ekipman' }, classe: 2, sens: 'actif' },
  '2182': { nom: { fr: 'Véhicule', ht: 'Machin' }, classe: 2, sens: 'actif' },
  '2184': { nom: { fr: 'Mobilier', ht: 'Mèb' }, classe: 2, sens: 'actif' },
  '281': { nom: { fr: 'Amortissements', ht: 'Amòtisman' }, classe: 2, sens: 'passif' },

  // ---- Classe 3 : stocks ----
  '370': { nom: { fr: 'Stock de marchandises', ht: 'Stòk machandiz' }, classe: 3, sens: 'actif' },

  // ---- Classe 4 : ce qu'on doit et ce qu'on nous doit ----
  '401': { nom: { fr: 'Fournisseurs à payer', ht: 'Founisè pou peye' }, classe: 4, sens: 'passif' },
  '411': { nom: { fr: 'Clients à encaisser', ht: 'Kliyan pou ankese' }, classe: 4, sens: 'actif' },
  '421': { nom: { fr: 'Salaires à payer', ht: 'Salè pou peye' }, classe: 4, sens: 'passif' },
  '431': { nom: { fr: 'ONA / OFATMA à payer', ht: 'ONA / OFATMA pou peye' }, classe: 4, sens: 'passif' },
  '4456': { nom: { fr: 'TCA déductible sur achats', ht: 'TCA dedoktib sou acha' }, classe: 4, sens: 'actif' },
  '4457': { nom: { fr: 'TCA collectée sur ventes', ht: 'TCA kolekte sou vant' }, classe: 4, sens: 'passif' },
  '4458': { nom: { fr: 'TCA à verser à la DGI', ht: 'TCA pou peye DGI' }, classe: 4, sens: 'passif' },
  '447': { nom: { fr: 'Autres impôts et patente', ht: 'Lòt taks ak patant' }, classe: 4, sens: 'passif' },

  // ---- Classe 5 : où est l'argent ----
  '512': { nom: { fr: 'Compte bancaire', ht: 'Kont labank' }, classe: 5, sens: 'actif', tresorerie: true },
  '5151': { nom: { fr: 'MonCash', ht: 'MonCash' }, classe: 5, sens: 'actif', tresorerie: true },
  '5152': { nom: { fr: 'NatCash', ht: 'NatCash' }, classe: 5, sens: 'actif', tresorerie: true },
  '5153': { nom: { fr: 'Portefeuille Konekte', ht: 'Pòtfèy Konekte' }, classe: 5, sens: 'actif', tresorerie: true },
  '530': { nom: { fr: 'Caisse (espèces)', ht: 'Kès (kach)' }, classe: 5, sens: 'actif', tresorerie: true },

  // ---- Classe 6 : charges, ce que l'activité coûte ----
  '601': { nom: { fr: 'Achats de marchandises', ht: 'Acha machandiz' }, classe: 6, sens: 'charge' },
  '602': { nom: { fr: 'Fournitures et petit matériel', ht: 'Founiti ak ti materyèl' }, classe: 6, sens: 'charge' },
  '605': { nom: { fr: 'Électricité, eau, carburant', ht: 'Kouran, dlo, gazolin' }, classe: 6, sens: 'charge' },
  '611': { nom: { fr: 'Sous-traitance et prestataires', ht: 'Sou-trètans ak prestatè' }, classe: 6, sens: 'charge' },
  '613': { nom: { fr: 'Loyer', ht: 'Lwaye' }, classe: 6, sens: 'charge' },
  '615': { nom: { fr: 'Entretien et réparations', ht: 'Antretyen ak reparasyon' }, classe: 6, sens: 'charge' },
  '616': { nom: { fr: 'Assurances', ht: 'Asirans' }, classe: 6, sens: 'charge' },
  '622': { nom: { fr: 'Commissions et frais de plateforme', ht: 'Komisyon ak frè platfòm' }, classe: 6, sens: 'charge' },
  '623': { nom: { fr: 'Publicité et promotion', ht: 'Piblisite ak pwomosyon' }, classe: 6, sens: 'charge' },
  '624': { nom: { fr: 'Transport et livraison', ht: 'Transpò ak livrezon' }, classe: 6, sens: 'charge' },
  '626': { nom: { fr: 'Téléphone et internet', ht: 'Telefòn ak entènèt' }, classe: 6, sens: 'charge' },
  '627': { nom: { fr: 'Frais bancaires et de transfert', ht: 'Frè labank ak transfè' }, classe: 6, sens: 'charge' },
  '631': { nom: { fr: 'Impôts, patente et taxes', ht: 'Taks, patant' }, classe: 6, sens: 'charge' },
  '641': { nom: { fr: 'Salaires et rémunérations', ht: 'Salè ak remunerasyon' }, classe: 6, sens: 'charge' },
  '645': { nom: { fr: 'Charges sociales (ONA, OFATMA)', ht: 'Chaj sosyal (ONA, OFATMA)' }, classe: 6, sens: 'charge' },
  '661': { nom: { fr: 'Intérêts d\'emprunt', ht: 'Enterè sou prè' }, classe: 6, sens: 'charge' },
  '681': { nom: { fr: 'Dotation aux amortissements', ht: 'Dotasyon amòtisman' }, classe: 6, sens: 'charge' },
  '658': { nom: { fr: 'Pertes, vols et casse', ht: 'Pèt, vòl ak kraze' }, classe: 6, sens: 'charge' },
  '698': { nom: { fr: 'Autres dépenses', ht: 'Lòt depans' }, classe: 6, sens: 'charge' },

  // ---- Classe 7 : produits, ce que l'activité rapporte ----
  '701': { nom: { fr: 'Ventes de marchandises', ht: 'Vant machandiz' }, classe: 7, sens: 'produit' },
  '706': { nom: { fr: 'Prestations de services', ht: 'Prestasyon sèvis' }, classe: 7, sens: 'produit' },
  '7061': { nom: { fr: 'Hébergement', ht: 'Lojman' }, classe: 7, sens: 'produit' },
  '7062': { nom: { fr: 'Restaurant et bar', ht: 'Restoran ak ba' }, classe: 7, sens: 'produit' },
  '7063': { nom: { fr: 'Scolarité et inscriptions', ht: 'Eskolarite ak enskripsyon' }, classe: 7, sens: 'produit' },
  '7064': { nom: { fr: 'Honoraires et dossiers', ht: 'Onorè ak dosye' }, classe: 7, sens: 'produit' },
  '708': { nom: { fr: 'Livraison facturée au client', ht: 'Livrezon fakti bay kliyan' }, classe: 7, sens: 'produit' },
  '758': { nom: { fr: 'Autres recettes', ht: 'Lòt antre lajan' }, classe: 7, sens: 'produit' }
};

/** Comptes de trésorerie, dans l'ordre d'usage courant. */
const TRESORERIE = ['530', '5151', '5152', '512', '5153'];

/* ----------------------------------------------------------
   Catégories proposées à la saisie
   C'est le vocabulaire de l'entreprise, pas celui du
   comptable. Chaque catégorie sait à quel compte elle mène.
   ---------------------------------------------------------- */
const RECETTES = [
  { cle: 'marchandises', compte: '701', nom: { fr: 'Vente de marchandises', ht: 'Vant machandiz' } },
  { cle: 'services', compte: '706', nom: { fr: 'Prestation de service', ht: 'Prestasyon sèvis' } },
  { cle: 'hebergement', compte: '7061', nom: { fr: 'Hébergement / chambres', ht: 'Lojman / chanm' } },
  { cle: 'restauration', compte: '7062', nom: { fr: 'Restaurant et bar', ht: 'Restoran ak ba' } },
  { cle: 'scolarite', compte: '7063', nom: { fr: 'Scolarité et inscriptions', ht: 'Eskolarite ak enskripsyon' } },
  { cle: 'honoraires', compte: '7064', nom: { fr: 'Honoraires et dossiers', ht: 'Onorè ak dosye' } },
  { cle: 'livraison', compte: '708', nom: { fr: 'Frais de livraison encaissés', ht: 'Frè livrezon ankese' } },
  { cle: 'autre_recette', compte: '758', nom: { fr: 'Autre recette', ht: 'Lòt antre lajan' } }
];

const DEPENSES = [
  { cle: 'achat_marchandises', compte: '601', nom: { fr: 'Achat de marchandises', ht: 'Acha machandiz' } },
  { cle: 'fournitures', compte: '602', nom: { fr: 'Fournitures et petit matériel', ht: 'Founiti ak ti materyèl' } },
  { cle: 'energie', compte: '605', nom: { fr: 'Électricité, eau, carburant', ht: 'Kouran, dlo, gazolin' } },
  { cle: 'sous_traitance', compte: '611', nom: { fr: 'Sous-traitance', ht: 'Sou-trètans' } },
  { cle: 'loyer', compte: '613', nom: { fr: 'Loyer', ht: 'Lwaye' } },
  { cle: 'entretien', compte: '615', nom: { fr: 'Entretien et réparations', ht: 'Antretyen ak reparasyon' } },
  { cle: 'assurance', compte: '616', nom: { fr: 'Assurance', ht: 'Asirans' } },
  { cle: 'commission', compte: '622', nom: { fr: 'Commission de plateforme', ht: 'Komisyon platfòm' } },
  { cle: 'publicite', compte: '623', nom: { fr: 'Publicité et promotion', ht: 'Piblisite ak pwomosyon' } },
  { cle: 'transport', compte: '624', nom: { fr: 'Transport et livraison', ht: 'Transpò ak livrezon' } },
  { cle: 'telephone', compte: '626', nom: { fr: 'Téléphone et internet', ht: 'Telefòn ak entènèt' } },
  { cle: 'frais_bancaires', compte: '627', nom: { fr: 'Frais bancaires et de transfert', ht: 'Frè labank ak transfè' } },
  { cle: 'impots', compte: '631', nom: { fr: 'Impôts, patente et taxes', ht: 'Taks, patant' } },
  { cle: 'salaires', compte: '641', nom: { fr: 'Salaires', ht: 'Salè' } },
  { cle: 'charges_sociales', compte: '645', nom: { fr: 'ONA / OFATMA', ht: 'ONA / OFATMA' } },
  { cle: 'interets', compte: '661', nom: { fr: 'Intérêts d\'emprunt', ht: 'Enterè sou prè' } },
  { cle: 'pertes', compte: '658', nom: { fr: 'Perte, vol ou casse', ht: 'Pèt, vòl oswa kraze' } },
  { cle: 'autre_depense', compte: '698', nom: { fr: 'Autre dépense', ht: 'Lòt depans' } }
];

const IMMOBILISATIONS = [
  { cle: 'local', compte: '213', nom: { fr: 'Local et aménagements', ht: 'Lokal ak amenajman' } },
  { cle: 'materiel', compte: '215', nom: { fr: 'Matériel et équipement', ht: 'Materyèl ak ekipman' } },
  { cle: 'vehicule', compte: '2182', nom: { fr: 'Véhicule', ht: 'Machin' } },
  { cle: 'mobilier', compte: '2184', nom: { fr: 'Mobilier', ht: 'Mèb' } }
];

/* ----------------------------------------------------------
   Opérations types
   Le choix que fait l'entreprise. Chacune sait quels comptes
   mouvementer : `debit` et `credit` désignent soit un compte
   fixe, soit une source — la catégorie choisie (`categorie`)
   ou la caisse choisie (`tresorerie`) ou le tiers (`tiers`).
   ---------------------------------------------------------- */
const OPERATIONS = {
  vente_encaissee: {
    nom: { fr: 'Vente encaissée', ht: 'Vant ankese' },
    aide: { fr: 'Le client a payé tout de suite.', ht: 'Kliyan an peye lamenm.' },
    debit: 'tresorerie', credit: 'categorie', categories: 'recettes', tca: 'collectee', signe: 1
  },
  vente_a_credit: {
    nom: { fr: 'Vente à crédit', ht: 'Vant a kredi' },
    aide: { fr: 'Le client emporte et paiera plus tard.', ht: 'Kliyan an pran l, l ap peye pita.' },
    debit: '411', credit: 'categorie', categories: 'recettes', tca: 'collectee', tiersRequis: 'client', signe: 1
  },
  encaissement_client: {
    nom: { fr: 'Un client règle sa dette', ht: 'Yon kliyan peye dèt li' },
    aide: { fr: 'Encaissement d\'une vente déjà enregistrée à crédit.', ht: 'Ankese yon vant ki te deja anrejistre a kredi.' },
    debit: 'tresorerie', credit: '411', tiersRequis: 'client', signe: 0
  },
  achat_paye: {
    nom: { fr: 'Dépense payée', ht: 'Depans peye' },
    aide: { fr: 'Vous avez payé au moment de l\'achat.', ht: 'Ou peye lè ou achte a.' },
    debit: 'categorie', credit: 'tresorerie', categories: 'depenses', tca: 'deductible', signe: -1
  },
  achat_a_credit: {
    nom: { fr: 'Dépense à crédit', ht: 'Depans a kredi' },
    aide: { fr: 'Le fournisseur sera payé plus tard.', ht: 'N ap peye founisè a pita.' },
    debit: 'categorie', credit: '401', categories: 'depenses', tca: 'deductible', tiersRequis: 'fournisseur', signe: -1
  },
  reglement_fournisseur: {
    nom: { fr: 'Payer un fournisseur', ht: 'Peye yon founisè' },
    aide: { fr: 'Règlement d\'une dette déjà enregistrée.', ht: 'Peye yon dèt ki deja anrejistre.' },
    debit: '401', credit: 'tresorerie', tiersRequis: 'fournisseur', signe: 0
  },
  salaire: {
    nom: { fr: 'Paiement de salaire', ht: 'Peye salè' },
    aide: { fr: 'Salaire versé à un employé.', ht: 'Salè bay yon anplwaye.' },
    debit: '641', credit: 'tresorerie', signe: -1
  },
  immobilisation: {
    nom: { fr: 'Achat d\'équipement durable', ht: 'Acha ekipman ki dire' },
    aide: { fr: 'Matériel, véhicule, mobilier : ce n\'est pas une dépense du mois mais un bien qui reste.',
            ht: 'Materyèl, machin, mèb : se pa yon depans mwa a, se yon byen ki rete.' },
    debit: 'categorie', credit: 'tresorerie', categories: 'immobilisations', tca: 'deductible', signe: 0
  },
  apport: {
    nom: { fr: 'Apport du propriétaire', ht: 'Lajan pwopriyetè a mete' },
    aide: { fr: 'Argent personnel mis dans l\'entreprise.', ht: 'Lajan pèsonèl mete nan biznis la.' },
    debit: 'tresorerie', credit: '101', signe: 0
  },
  prelevement: {
    nom: { fr: 'Prélèvement du propriétaire', ht: 'Lajan pwopriyetè a pran' },
    aide: { fr: 'Argent sorti pour vous, pas pour l\'entreprise. Ce n\'est pas une dépense.',
            ht: 'Lajan ki soti pou ou, pa pou biznis la. Se pa yon depans.' },
    debit: '108', credit: 'tresorerie', signe: 0
  },
  emprunt_recu: {
    nom: { fr: 'Microcrédit ou prêt reçu', ht: 'Mikwokredi oswa prè resevwa' },
    aide: { fr: 'L\'argent entre, mais ce n\'est pas une recette : il faudra le rendre.',
            ht: 'Lajan an antre, men se pa yon antre lajan : w ap gen pou remèt li.' },
    debit: 'tresorerie', credit: '164', signe: 0
  },
  remboursement_emprunt: {
    nom: { fr: 'Remboursement de prêt (capital)', ht: 'Remèt prè (kapital)' },
    aide: { fr: 'La part de capital remboursée. Les intérêts se saisissent en dépense.',
            ht: 'Pati kapital la. Enterè yo antre kòm depans.' },
    debit: '164', credit: 'tresorerie', signe: 0
  },
  virement_interne: {
    nom: { fr: 'Transfert entre mes caisses', ht: 'Transfè ant kès mwen yo' },
    aide: { fr: 'De la caisse vers MonCash, de MonCash vers la banque…',
            ht: 'Soti nan kès ale MonCash, soti MonCash ale labank…' },
    debit: 'tresorerieArrivee', credit: 'tresorerie', signe: 0
  },
  tca_versee: {
    nom: { fr: 'TCA versée à la DGI', ht: 'TCA peye DGI' },
    aide: { fr: 'Règlement de la déclaration de TCA.', ht: 'Peye deklarasyon TCA a.' },
    debit: '4458', credit: 'tresorerie', signe: 0
  },
  amortissement: {
    nom: { fr: 'Amortissement de l\'équipement', ht: 'Amòtisman ekipman' },
    aide: { fr: 'Constate l\'usure annuelle du matériel. Aucun argent ne bouge.',
            ht: 'Konstate izay materyèl la chak ane. Pa gen lajan ki bouje.' },
    debit: '681', credit: '281', signe: -1
  }
};

const CLES_OPERATIONS = Object.keys(OPERATIONS);

/* ----------------------------------------------------------
   Outils
   ---------------------------------------------------------- */

/** Arrondi à la gourde : la comptabilité ne manipule pas de centimes ici. */
function g(n) { return Math.round(+n || 0); }

function aujourdhui() { return new Date().toISOString().slice(0, 10); }

/** Premier et dernier jour du mois d'une date AAAA-MM-JJ. */
function moisDe(jour) {
  const m = String(jour || aujourdhui()).slice(0, 7);
  const [a, mo] = m.split('-').map(Number);
  const fin = new Date(Date.UTC(a, mo, 0)).toISOString().slice(0, 10);
  return { debut: m + '-01', fin, mois: m };
}

/** Les catégories d'une famille, pour l'affichage et la validation. */
function categoriesDe(famille) {
  if (famille === 'recettes') return RECETTES;
  if (famille === 'depenses') return DEPENSES;
  if (famille === 'immobilisations') return IMMOBILISATIONS;
  return [];
}

function categorie(famille, cle) {
  return categoriesDe(famille).find((c) => c.cle === cle) || null;
}

/** Paramètres comptables de l'entreprise, avec des valeurs par défaut sûres. */
function reglages(e) {
  const c = (e && e.compta) || {};
  return {
    tcaAssujetti: !!c.tcaAssujetti,
    tcaTaux: c.tcaTaux > 0 ? c.tcaTaux : TCA_TAUX_DEFAUT,
    debutExercice: c.debutExercice || (new Date().getFullYear() + '-01-01'),
    clotureJusquau: c.clotureJusquau || '',
    caisseDefaut: COMPTES[c.caisseDefaut] ? c.caisseDefaut : '530',
    caissesActives: Array.isArray(c.caissesActives) && c.caissesActives.length
      ? c.caissesActives.filter((x) => COMPTES[x] && COMPTES[x].tresorerie)
      : ['530', '5151']
  };
}

/**
 * Construit une écriture à partir du choix de l'entreprise.
 * Retourne { ecriture } ou { erreur } — jamais une écriture
 * déséquilibrée : c'est la seule porte d'entrée du journal.
 */
function construire(e, saisie, uid) {
  const r = reglages(e);
  const op = OPERATIONS[saisie.operation];
  if (!op) return { erreur: 'Type d\'opération inconnu.' };

  const date = String(saisie.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { erreur: 'Date invalide.' };
  if (date > aujourdhui()) return { erreur: 'Une opération ne peut pas être datée dans le futur.' };
  if (r.clotureJusquau && date <= r.clotureJusquau)
    return { erreur: `La période jusqu'au ${r.clotureJusquau} est clôturée. Saisissez à une date postérieure, ou rouvrez la période.` };

  const montant = g(saisie.montant);
  if (!(montant > 0)) return { erreur: 'Le montant doit être supérieur à zéro.' };

  // Catégorie, quand l'opération en demande une
  let cat = null;
  if (op.categories) {
    cat = categorie(op.categories, saisie.categorie);
    if (!cat) return { erreur: 'Choisissez une catégorie.' };
  }

  // Caisse mouvementée
  const besoinTreso = op.debit === 'tresorerie' || op.credit === 'tresorerie' || op.debit === 'tresorerieArrivee';
  let treso = saisie.tresorerie || r.caisseDefaut;
  if (besoinTreso) {
    if (!COMPTES[treso] || !COMPTES[treso].tresorerie) return { erreur: 'Choisissez une caisse valide.' };
  }
  let tresoArrivee = saisie.tresorerieArrivee || '';
  if (op.debit === 'tresorerieArrivee') {
    if (!COMPTES[tresoArrivee] || !COMPTES[tresoArrivee].tresorerie)
      return { erreur: 'Choisissez la caisse de destination.' };
    if (tresoArrivee === treso) return { erreur: 'Les deux caisses doivent être différentes.' };
  }

  // Tiers, quand l'opération suit une créance ou une dette
  if (op.tiersRequis && !String(saisie.tiersNom || '').trim())
    return { erreur: op.tiersRequis === 'client' ? 'Indiquez le nom du client.' : 'Indiquez le nom du fournisseur.' };

  /* TCA. Le montant saisi est toujours celui réellement payé ou
     encaissé, TCA comprise : c'est ce que l'entreprise a sous les
     yeux sur son reçu. On en extrait la part de taxe, qui ne lui
     appartient pas (collectée) ou qu'elle récupérera (déductible). */
  let tca = 0, base = montant;
  const avecTca = r.tcaAssujetti && op.tca && saisie.tca !== false;
  if (avecTca) {
    tca = g(montant - montant / (1 + r.tcaTaux));
    base = montant - tca;
  }

  const resoudre = (cible) => {
    if (cible === 'tresorerie') return treso;
    if (cible === 'tresorerieArrivee') return tresoArrivee;
    if (cible === 'categorie') return cat.compte;
    return cible;
  };
  const cDebit = resoudre(op.debit);
  const cCredit = resoudre(op.credit);
  if (!COMPTES[cDebit] || !COMPTES[cCredit]) return { erreur: 'Comptes introuvables pour cette opération.' };

  /* Les lignes. Sans TCA, deux lignes qui s'équilibrent. Avec TCA,
     trois : le montant total d'un côté, la base et la taxe de l'autre. */
  const lignes = [];
  if (!avecTca || tca === 0) {
    lignes.push({ compte: cDebit, debit: montant, credit: 0 });
    lignes.push({ compte: cCredit, debit: 0, credit: montant });
  } else if (op.tca === 'collectee') {
    // Encaissement total au débit ; produit hors taxe et TCA collectée au crédit
    lignes.push({ compte: cDebit, debit: montant, credit: 0 });
    lignes.push({ compte: cCredit, debit: 0, credit: base });
    lignes.push({ compte: '4457', debit: 0, credit: tca });
  } else {
    // Charge hors taxe et TCA récupérable au débit ; paiement total au crédit
    lignes.push({ compte: cDebit, debit: base, credit: 0 });
    lignes.push({ compte: '4456', debit: tca, credit: 0 });
    lignes.push({ compte: cCredit, debit: 0, credit: montant });
  }

  const ecriture = {
    id: uid(),
    entrepriseId: e.id,
    date,
    operation: saisie.operation,
    categorie: cat ? cat.cle : '',
    libelle: String(saisie.libelle || (cat ? cat.nom.fr : op.nom.fr)).slice(0, 140),
    montant, base, tca, tcaTaux: avecTca ? r.tcaTaux : 0,
    tresorerie: besoinTreso ? treso : '',
    tresorerieArrivee: op.debit === 'tresorerieArrivee' ? tresoArrivee : '',
    tiersNom: String(saisie.tiersNom || '').slice(0, 90),
    tiersType: op.tiersRequis || '',
    piece: String(saisie.piece || '').slice(0, 40),
    note: String(saisie.note || '').slice(0, 300),
    echeance: /^\d{4}-\d{2}-\d{2}$/.test(String(saisie.echeance || '')) ? saisie.echeance : '',
    lignes,
    // Trace d'origine : une écriture produite par la plateforme ne
    // doit jamais être créée deux fois, ni modifiée à la main.
    source: saisie.source || null,
    auto: !!saisie.source,
    creeLe: new Date().toISOString()
  };

  const err = verifier(ecriture);
  if (err) return { erreur: err };
  return { ecriture };
}

/** Une écriture équilibrée, ou le motif du déséquilibre. */
function verifier(ec) {
  if (!Array.isArray(ec.lignes) || ec.lignes.length < 2) return 'Écriture incomplète.';
  let d = 0, c = 0;
  for (const l of ec.lignes) {
    if (!COMPTES[l.compte]) return `Compte inconnu : ${l.compte}`;
    d += g(l.debit); c += g(l.credit);
  }
  if (d !== c) return `Écriture déséquilibrée : ${d} au débit contre ${c} au crédit.`;
  return null;
}

/* ----------------------------------------------------------
   États
   ---------------------------------------------------------- */

const dansPeriode = (ec, du, au) => (!du || ec.date >= du) && (!au || ec.date <= au);

/** Soldes par compte, sur une période. */
function soldes(ecritures, du, au) {
  const s = {};
  for (const ec of ecritures) {
    if (!dansPeriode(ec, du, au)) continue;
    for (const l of ec.lignes) {
      if (!s[l.compte]) s[l.compte] = { debit: 0, credit: 0 };
      s[l.compte].debit += g(l.debit);
      s[l.compte].credit += g(l.credit);
    }
  }
  return s;
}

/**
 * Compte de résultat : ce que l'activité a rapporté et coûté.
 * Les produits sont au crédit, les charges au débit — un
 * remboursement ou un avoir vient donc en diminution, ce qui
 * est exactement ce qu'on veut.
 */
function resultat(ecritures, du, au, langue) {
  const s = soldes(ecritures, du, au);
  const lg = langue === 'ht' ? 'ht' : 'fr';
  const produits = [], charges = [];
  let totalProduits = 0, totalCharges = 0;

  for (const [compte, v] of Object.entries(s)) {
    const def = COMPTES[compte];
    if (!def) continue;
    if (def.sens === 'produit') {
      const m = v.credit - v.debit;
      if (m !== 0) { produits.push({ compte, nom: def.nom[lg], montant: m }); totalProduits += m; }
    } else if (def.sens === 'charge') {
      const m = v.debit - v.credit;
      if (m !== 0) { charges.push({ compte, nom: def.nom[lg], montant: m }); totalCharges += m; }
    }
  }
  produits.sort((a, b) => b.montant - a.montant);
  charges.sort((a, b) => b.montant - a.montant);

  return {
    du, au, produits, charges, totalProduits, totalCharges,
    resultat: totalProduits - totalCharges,
    /* Marge brute : ce que laissent les ventes une fois la
       marchandise payée. Pour un commerce, c'est le chiffre qui
       dit si les prix de vente tiennent. */
    margeBrute: totalProduits - ((s['601'] ? s['601'].debit - s['601'].credit : 0)),
    tauxMarge: totalProduits > 0
      ? Math.round((1 - ((s['601'] ? s['601'].debit - s['601'].credit : 0) / totalProduits)) * 1000) / 10
      : null
  };
}

/** Où est l'argent, caisse par caisse, à une date donnée. */
function tresorerie(ecritures, au, caisses) {
  const s = soldes(ecritures, '', au);
  const liste = (caisses && caisses.length ? caisses : TRESORERIE).filter((c) => COMPTES[c]);
  const comptes = liste.map((c) => {
    const v = s[c] || { debit: 0, credit: 0 };
    return { compte: c, nom: COMPTES[c].nom.fr, solde: v.debit - v.credit };
  });
  // Une caisse non déclarée mais déjà mouvementée doit rester visible
  for (const [c, v] of Object.entries(s)) {
    if (COMPTES[c] && COMPTES[c].tresorerie && !liste.includes(c) && v.debit - v.credit !== 0)
      comptes.push({ compte: c, nom: COMPTES[c].nom.fr, solde: v.debit - v.credit, horsListe: true });
  }
  return { au: au || aujourdhui(), comptes, total: comptes.reduce((t, c) => t + c.solde, 0) };
}

/** Balance générale : tous les comptes mouvementés, débit, crédit, solde. */
function balance(ecritures, du, au, langue) {
  const s = soldes(ecritures, du, au);
  const lg = langue === 'ht' ? 'ht' : 'fr';
  const lignes = Object.entries(s).map(([compte, v]) => ({
    compte, nom: (COMPTES[compte] || { nom: {} }).nom[lg] || compte,
    classe: (COMPTES[compte] || {}).classe || 0,
    debit: v.debit, credit: v.credit, solde: v.debit - v.credit
  })).sort((a, b) => a.compte.localeCompare(b.compte));
  return {
    du, au, lignes,
    totalDebit: lignes.reduce((t, l) => t + l.debit, 0),
    totalCredit: lignes.reduce((t, l) => t + l.credit, 0)
  };
}

/** Grand livre d'un compte : toutes ses lignes, avec solde progressif. */
function grandLivre(ecritures, compte, du, au) {
  const lignes = [];
  let solde = 0;
  const triees = ecritures.filter((ec) => dansPeriode(ec, du, au))
    .sort((a, b) => a.date.localeCompare(b.date) || a.creeLe.localeCompare(b.creeLe));
  for (const ec of triees) {
    for (const l of ec.lignes) {
      if (l.compte !== compte) continue;
      solde += g(l.debit) - g(l.credit);
      lignes.push({ date: ec.date, libelle: ec.libelle, piece: ec.piece,
                    tiers: ec.tiersNom, debit: g(l.debit), credit: g(l.credit), solde, ecritureId: ec.id });
    }
  }
  return { compte, nom: (COMPTES[compte] || { nom: {} }).nom.fr || compte, du, au, lignes, solde };
}

/**
 * Créances et dettes par tiers.
 * Un client dont les ventes à crédit sont soldées par ses
 * règlements n'apparaît plus : seul ce qui reste dû compte.
 */
function tiers(ecritures, type) {
  const compte = type === 'fournisseur' ? '401' : '411';
  const sens = type === 'fournisseur' ? -1 : 1;   // 411 est un actif, 401 un passif
  const parNom = {};
  for (const ec of ecritures) {
    for (const l of ec.lignes) {
      if (l.compte !== compte) continue;
      const nom = (ec.tiersNom || '—').trim();
      if (!parNom[nom]) parNom[nom] = { nom, solde: 0, operations: 0, derniere: '', echeance: '' };
      parNom[nom].solde += (g(l.debit) - g(l.credit)) * sens;
      parNom[nom].operations++;
      if (ec.date > parNom[nom].derniere) parNom[nom].derniere = ec.date;
      if (ec.echeance && (!parNom[nom].echeance || ec.echeance < parNom[nom].echeance))
        parNom[nom].echeance = ec.echeance;
    }
  }
  const jour = aujourdhui();
  const liste = Object.values(parNom).filter((t) => t.solde !== 0)
    .map((t) => Object.assign(t, { enRetard: !!(t.echeance && t.echeance < jour) }))
    .sort((a, b) => b.solde - a.solde);
  return { type, liste, total: liste.reduce((s, t) => s + t.solde, 0),
           enRetard: liste.filter((t) => t.enRetard).reduce((s, t) => s + t.solde, 0) };
}

/**
 * Déclaration de TCA d'une période.
 * À verser = collectée sur les ventes − déductible sur les achats.
 * Un résultat négatif n'est pas un remboursement immédiat : c'est
 * un crédit reportable, et le dire évite une mauvaise surprise.
 */
function tca(ecritures, du, au, taux) {
  const s = soldes(ecritures, du, au);
  const collectee = s['4457'] ? s['4457'].credit - s['4457'].debit : 0;
  const deductible = s['4456'] ? s['4456'].debit - s['4456'].credit : 0;
  const net = collectee - deductible;
  return { du, au, taux, collectee, deductible,
           aVerser: Math.max(0, net), creditReportable: Math.max(0, -net) };
}

/**
 * Tableau de bord : les chiffres qu'on regarde tous les jours.
 * Le mois en cours, le mois précédent pour comparer, la
 * trésorerie, les impayés et ce qui attend d'être réglé.
 */
function tableau(e, ecritures, jour) {
  const r = reglages(e);
  const m = moisDe(jour || aujourdhui());
  const [a, mo] = m.mois.split('-').map(Number);
  const moisAvant = moisDe(new Date(Date.UTC(a, mo - 2, 1)).toISOString().slice(0, 10));

  const ceMois = resultat(ecritures, m.debut, m.fin);
  const precedent = resultat(ecritures, moisAvant.debut, moisAvant.fin);
  const exercice = resultat(ecritures, r.debutExercice, m.fin);
  const tre = tresorerie(ecritures, m.fin, r.caissesActives);
  const clients = tiers(ecritures, 'client');
  const fournisseurs = tiers(ecritures, 'fournisseur');
  const taxe = r.tcaAssujetti ? tca(ecritures, m.debut, m.fin, r.tcaTaux) : null;

  const variation = (apres, avant) => (avant === 0 ? null : Math.round((apres - avant) / Math.abs(avant) * 1000) / 10);

  return {
    mois: m.mois, du: m.debut, au: m.fin,
    recettes: ceMois.totalProduits, depenses: ceMois.totalCharges, resultat: ceMois.resultat,
    variationRecettes: variation(ceMois.totalProduits, precedent.totalProduits),
    variationResultat: variation(ceMois.resultat, precedent.resultat),
    moisPrecedent: { recettes: precedent.totalProduits, depenses: precedent.totalCharges, resultat: precedent.resultat },
    exercice: { du: r.debutExercice, recettes: exercice.totalProduits, depenses: exercice.totalCharges, resultat: exercice.resultat },
    tresorerie: tre,
    creances: clients.total, creancesEnRetard: clients.enRetard,
    dettes: fournisseurs.total, dettesEnRetard: fournisseurs.enRetard,
    tca: taxe,
    margeBrute: ceMois.margeBrute, tauxMarge: ceMois.tauxMarge,
    topDepenses: ceMois.charges.slice(0, 5),
    topRecettes: ceMois.produits.slice(0, 5),
    ecritures: ecritures.filter((x) => dansPeriode(x, m.debut, m.fin)).length,
    clotureJusquau: r.clotureJusquau
  };
}

/** Évolution mensuelle sur N mois, pour le graphique. */
function evolution(ecritures, moisFin, n) {
  const [a, mo] = String(moisFin || aujourdhui()).slice(0, 7).split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = moisDe(new Date(Date.UTC(a, mo - 1 - i, 1)).toISOString().slice(0, 10));
    const r = resultat(ecritures, m.debut, m.fin);
    out.push({ mois: m.mois, recettes: r.totalProduits, depenses: r.totalCharges, resultat: r.resultat });
  }
  return out;
}

/* ----------------------------------------------------------
   Export
   Le point de sortie vers un comptable ou un tableur. Les
   écritures partent ligne par ligne, avec leurs comptes :
   c'est le format qu'un comptable sait relire.
   ---------------------------------------------------------- */
function exportCSV(ecritures, du, au) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const out = ['Date;Pièce;Libellé;Tiers;Compte;Intitulé du compte;Débit;Crédit'];
  const triees = ecritures.filter((ec) => dansPeriode(ec, du, au))
    .sort((a, b) => a.date.localeCompare(b.date) || a.creeLe.localeCompare(b.creeLe));
  for (const ec of triees) {
    for (const l of ec.lignes) {
      out.push([ec.date, ec.piece, ec.libelle, ec.tiersNom, l.compte,
                (COMPTES[l.compte] || { nom: {} }).nom.fr || '', g(l.debit) || '', g(l.credit) || ''].map(esc).join(';'));
    }
  }
  // BOM : sans lui, Excel en français affiche « Ã© » à la place des accents
  return '﻿' + out.join('\r\n') + '\r\n';
}

/** Vue du référentiel envoyée au navigateur. */
function referentiel() {
  return { COMPTES, TRESORERIE, RECETTES, DEPENSES, IMMOBILISATIONS, OPERATIONS, TCA_TAUX_DEFAUT };
}

module.exports = {
  COMPTES, TRESORERIE, RECETTES, DEPENSES, IMMOBILISATIONS, OPERATIONS, CLES_OPERATIONS,
  TCA_TAUX_DEFAUT, reglages, construire, verifier, categoriesDe, categorie,
  soldes, resultat, tresorerie, balance, grandLivre, tiers, tca, tableau, evolution,
  exportCSV, referentiel, moisDe, aujourdhui
};
