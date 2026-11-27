'use strict';
/* ============================================================
   KONEKTE — Découpage géographique d'Haïti
   ------------------------------------------------------------
   Dix départements, et pour chacun ses principales communes.
   Elles servent de suggestions : la ville reste un champ libre,
   parce qu'un commerçant peut travailler dans une localité qui
   ne figure sur aucune liste, et qu'un formulaire qui refuse
   son village le renvoie chez le concurrent.

   La comparaison, elle, doit être sûre : « Saint-Marc »,
   « saint marc », « ST-MARC » et « Sen Mak » désignent la même
   ville, et c'est de cette égalité que dépend l'accès au
   financement de Micro Crédit Solidarité.
   ============================================================ */

const DEPARTEMENTS = {
  artibonite: {
    nom: 'Artibonite', chef: 'Gonaïves',
    communes: ['Gonaïves', 'Saint-Marc', 'Dessalines', 'Gros-Morne', 'Verrettes',
               'Petite-Rivière-de-l\'Artibonite', 'Marmelade', 'Saint-Michel-de-l\'Attalaye',
               'Anse-Rouge', 'Ennery', 'Desdunes', 'Grande-Saline', 'La Chapelle',
               'Liancourt', 'Terre-Neuve', 'Montrouis']
  },
  centre: {
    nom: 'Centre', chef: 'Hinche',
    communes: ['Hinche', 'Mirebalais', 'Lascahobas', 'Cerca-la-Source', 'Thomassique',
               'Thomonde', 'Maïssade', 'Savanette', 'Belladère', 'Boucan-Carré', 'Saut-d\'Eau']
  },
  grandanse: {
    nom: "Grand'Anse", chef: 'Jérémie',
    communes: ['Jérémie', 'Anse-d\'Hainault', 'Dame-Marie', 'Corail', 'Pestel',
               'Beaumont', 'Roseaux', 'Abricots', 'Bonbon', 'Chambellan', 'Moron', 'Les Irois']
  },
  nippes: {
    nom: 'Nippes', chef: 'Miragoâne',
    communes: ['Miragoâne', 'Anse-à-Veau', 'Petite-Rivière-de-Nippes', 'Baradères',
               'Petit-Trou-de-Nippes', 'Fonds-des-Nègres', 'L\'Asile', 'Plaisance-du-Sud',
               'Arnaud', 'Paillant', 'Grand-Boucan']
  },
  nord: {
    nom: 'Nord', chef: 'Cap-Haïtien',
    communes: ['Cap-Haïtien', 'Limbé', 'Plaisance', 'Grande-Rivière-du-Nord', 'Saint-Raphaël',
               'Borgne', 'Acul-du-Nord', 'Milot', 'Dondon', 'Limonade', 'Quartier-Morin',
               'Pignon', 'Bahon', 'Plaine-du-Nord', 'Port-Margot', 'Ranquitte']
  },
  nordest: {
    nom: 'Nord-Est', chef: 'Fort-Liberté',
    communes: ['Fort-Liberté', 'Ouanaminthe', 'Trou-du-Nord', 'Vallières', 'Terrier-Rouge',
               'Caracol', 'Ferrier', 'Capotille', 'Mont-Organisé', 'Sainte-Suzanne',
               'Carice', 'Perches', 'Mombin-Crochu']
  },
  nordouest: {
    nom: 'Nord-Ouest', chef: 'Port-de-Paix',
    communes: ['Port-de-Paix', 'Saint-Louis-du-Nord', 'Jean-Rabel', 'Môle-Saint-Nicolas',
               'Bombardopolis', 'Baie-de-Henne', 'Anse-à-Foleur', 'Chansolme',
               'Bassin-Bleu', 'La Tortue']
  },
  ouest: {
    nom: 'Ouest', chef: 'Port-au-Prince',
    communes: ['Port-au-Prince', 'Delmas', 'Pétion-Ville', 'Carrefour', 'Croix-des-Bouquets',
               'Tabarre', 'Cité Soleil', 'Gressier', 'Léogâne', 'Kenscoff', 'Arcahaie',
               'Cabaret', 'Grand-Goâve', 'Petit-Goâve', 'Thomazeau', 'Ganthier',
               'Fonds-Verrettes', 'Anse-à-Galets', 'Pointe-à-Raquette']
  },
  sud: {
    nom: 'Sud', chef: 'Les Cayes',
    communes: ['Les Cayes', 'Aquin', 'Port-Salut', 'Camp-Perrin', 'Torbeck', 'Chantal',
               'Saint-Louis-du-Sud', 'Cavaillon', 'Les Anglais', 'Chardonnières',
               'Tiburon', 'Côteaux', 'Port-à-Piment', 'Roche-à-Bateau', 'Maniche',
               'Île-à-Vache']
  },
  sudest: {
    nom: 'Sud-Est', chef: 'Jacmel',
    communes: ['Jacmel', 'Marigot', 'Bainet', 'Belle-Anse', 'Côtes-de-Fer', 'Cayes-Jacmel',
               'La Vallée-de-Jacmel', 'Thiotte', 'Anse-à-Pitre', 'Grand-Gosier']
  }
};

const CLES = Object.keys(DEPARTEMENTS);

/* Forme comparable d'un nom de lieu : sans accents, sans ponctuation,
   sans espaces superflus. « Saint-Marc », « st marc » et « SEN MAK »
   se ramènent à la même chose. */
function normaliser(v) {
  return String(v || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // accents
    .toLowerCase()
    .replace(/\bst\b\.?/g, 'saint')                      // St-Marc → Saint-Marc
    .replace(/\bsen\b/g, 'saint')                        // Sen Mak (créole)
    .replace(/\bmak\b/g, 'marc')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Deux noms de lieu désignent-ils le même endroit ? */
const memeLieu = (a, b) => !!normaliser(a) && normaliser(a) === normaliser(b);

/** La clé d'un département, à partir de sa clé ou de son nom. */
function cleDepartement(v) {
  const n = normaliser(v);
  if (!n) return '';
  if (DEPARTEMENTS[n]) return n;
  for (const [cle, d] of Object.entries(DEPARTEMENTS))
    if (normaliser(cle) === n || normaliser(d.nom) === n) return cle;
  return '';
}

/** Nom lisible d'un département. */
function nomDepartement(cle) {
  const c = cleDepartement(cle);
  return c ? DEPARTEMENTS[c].nom : '';
}

/**
 * L'entreprise est-elle dans cette commune ?
 * La ville déclarée fait foi. À défaut — entreprise inscrite avant que
 * le champ existe — on regarde son adresse écrite, pour ne pas la
 * priver d'un droit auquel elle a manifestement accès.
 */
function estDansCommune(entreprise, commune) {
  if (!entreprise) return false;
  if (entreprise.ville) return memeLieu(entreprise.ville, commune);
  const adresse = normaliser(entreprise.adresse);
  const cible = normaliser(commune);
  return !!cible && !!adresse && adresse.includes(cible);
}

/** Référentiel pour les formulaires : départements, communes, chefs-lieux. */
function referentiel() {
  const o = {};
  for (const [cle, d] of Object.entries(DEPARTEMENTS))
    o[cle] = { nom: d.nom, chef: d.chef, communes: d.communes };
  return o;
}

module.exports = { DEPARTEMENTS, CLES, referentiel, normaliser, memeLieu,
                   cleDepartement, nomDepartement, estDansCommune };
