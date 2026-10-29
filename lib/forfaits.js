'use strict';
/* ==========================================================
   Forfaits et abonnements
   ----------------------------------------------------------
   Chaque entreprise choisit un forfait à l'inscription, mais
   ne paie qu'après une période d'essai gratuite. Pendant
   l'essai, toutes les fonctions du forfait sont ouvertes.

   La commission prélevée sur les encaissements dépend du
   forfait : c'est ce qui rend l'offre gratuite viable.

   DEUX AXES, JAMAIS MÉLANGÉS
   ----------------------------------------------------------
   1. Le MÉTIER décide la NATURE des fonctions : un restaurant
      a une carte, une école des inscriptions, un notaire des
      dossiers. C'est son travail, pas une option à vendre :
      ces fonctions-là — le SOCLE — sont ouvertes dans tous
      les forfaits, sans exception.

   2. Le FORFAIT décide le VOLUME (combien de services, de
      produits, de membres d'équipe) et les OPTIONS DE
      CROISSANCE : vendre en ligne, encaisser sur la
      plateforme, précommander, rappels automatiques.

   Pourquoi : verrouiller le socle revenait à fermer la porte
   à des métiers entiers — un restaurant sans sa carte, une
   école sans ses inscriptions n'ont aucune raison de
   s'inscrire. On ne fait plus payer le droit d'exercer son
   métier ; on fait payer le volume et la vente en ligne,
   c'est-à-dire là où la plateforme rapporte vraiment.
   ========================================================== */

/* Période d'essai comptée en jours : une durée en jours est une promesse
   plus nette qu'une durée en mois, dont la longueur varie selon le mois
   de départ. Cette constante fait foi — les textes des pages doivent la
   suivre, sans quoi la plateforme promet autre chose que ce qu'elle
   accorde. */
const JOURS_ESSAI = 30;
const MOIS_ESSAI = 1;   // conservé pour les textes qui parlent en mois

/* Le socle : le métier seul décide si l'entreprise les voit.
   Aucun forfait ne les ferme. */
const SOCLE = ['rdv', 'equipe', 'hotellerie', 'carte', 'catalogue', 'inscriptions', 'dossiers', 'urgences'];

/* Les options de croissance : c'est là que les forfaits diffèrent. */
const OPTIONS = {
  commandes: {
    nom: { fr: 'Commandes en ligne et livraison', ht: 'Kòmand an liy ak livrezon' },
    aide: { fr: 'Panier, commandes, livraison ou retrait, suivi du client.',
            ht: 'Panyen, kòmand, livrezon oswa ranmase, swivi kliyan an.' }
  },
  precommandes: {
    nom: { fr: 'Précommandes', ht: 'Prekòmand' },
    aide: { fr: 'Encaisser des commandes sur un produit à venir ou momentanément fini.',
            ht: 'Pran kòmand sou yon pwodwi k ap vini oswa ki fini pou kounye a.' }
  },
  paiementEnLigne: {
    nom: { fr: 'Paiement en ligne', ht: 'Peman an liy' },
    aide: { fr: 'MonCash et carte, encaissés pour vous sur la plateforme.',
            ht: 'MonCash ak kat, ankese pou ou sou platfòm nan.' }
  },
  comptabilite: {
    nom: { fr: 'Comptabilité', ht: 'Kontablite' },
    aide: { fr: 'Recettes, dépenses, caisses, créances, TCA, résultat mensuel et export pour votre comptable.',
            ht: 'Antre lajan, depans, kès, dèt kliyan, TCA, rezilta chak mwa ak ekspò pou kontab ou.' }
  }
};

const FORFAITS = {
  decouverte: {
    nom: { fr: 'Découverte', ht: 'Dekouvèt' },
    prixMois: 1000,
    commission: 0.075,
    resume: {
      fr: 'Pour démarrer simplement, avec l\'essentiel.',
      ht: 'Pou kòmanse senp, ak sa ki esansyèl.'
    },
    limites: { services: 3, employes: 1, produits: 20, chambres: 3, programmes: 2 },
    /* Aucune option de croissance : la vitrine, les rendez-vous et
       la commande par WhatsApp suffisent pour démarrer. */
    options: [],
    avantages: {
      fr: ['Toutes les fonctions de votre métier', 'Page publique et code QR',
           "Jusqu'à 3 services, 20 produits, 1 membre d'équipe",
           'Commande par WhatsApp', 'Commission 7,5 %'],
      ht: ['Tout fonksyon metye ou a', 'Paj piblik ak kòd QR',
           'Jiska 3 sèvis, 20 pwodwi, 1 moun nan ekip la',
           'Kòmand pa WhatsApp', 'Komisyon 7,5 %']
    }
  },
  pro: {
    nom: { fr: 'Pro', ht: 'Pro' },
    prixMois: 1500,
    commission: 0.05,
    populaire: true,
    resume: {
      fr: 'Pour les entreprises qui reçoivent régulièrement des clients.',
      ht: 'Pou biznis ki resevwa kliyan regilyèman.'
    },
    limites: { services: 0, employes: 0, produits: 0, chambres: 0, programmes: 0 },   // 0 = sans limite
    options: ['commandes', 'precommandes', 'paiementEnLigne', 'comptabilite'],
    avantages: {
      fr: ['Services, produits et équipe illimités', 'Vente et livraison en ligne',
           'Précommandes et « bientôt disponible »', 'Comptabilité complète et export comptable',
           'Paiement en ligne',
           'Commission 5 %'],
      ht: ['Sèvis, pwodwi ak ekip san limit', 'Vann ak livrezon an liy',
           'Prekòmand ak « byento disponib »', 'Kontablite konplè ak ekspò kontab',
           'Peman an liy',
           'Komisyon 5 %']
    }
  },
  hotellerie: {
    nom: { fr: 'Hôtellerie & Commerce', ht: 'Otèl & Komès' },
    prixMois: 2500,
    commission: 0.03,
    plafondCommission: 500,
    resume: {
      fr: 'Pour ceux qui encaissent beaucoup : la commission la plus basse.',
      ht: 'Pou moun ki ankese anpil : komisyon ki pi ba a.'
    },
    limites: { services: 0, employes: 0, produits: 0, chambres: 0, programmes: 0 },
    options: ['commandes', 'precommandes', 'paiementEnLigne', 'comptabilite'],
    avantages: {
      fr: ['Toutes les fonctions de Pro', 'Commission 3 % au lieu de 5 %', 'Plafonnée à 500 HTG par encaissement', 'Avantageux dès 50 000 HTG encaissés par mois', 'Support prioritaire'],
      ht: ['Tout fonksyon Pro yo', 'Komisyon 3 % olye 5 %', 'Maksimòm 500 goud pa peman', 'Pi avantaje apati 50 000 goud pa mwa', 'Sipò prioritè']
    }
  }
};

const CLES_FORFAITS = Object.keys(FORFAITS);

/** Ajoute des mois à une date, en gérant les fins de mois. */
function ajouterMois(date, n) {
  const d = new Date(date);
  const jour = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + n);
  if (d.getUTCDate() < jour) d.setUTCDate(0);   // 31 janvier + 1 mois = 28/29 février
  return d;
}

/** Abonnement initial, posé à l'inscription. */
function nouvelAbonnement(forfaitCle, maintenant) {
  const cle = FORFAITS[forfaitCle] ? forfaitCle : 'decouverte';
  const debut = maintenant || new Date();
  const fin = new Date(debut.getTime() + JOURS_ESSAI * 86400000);
  return {
    forfait: cle,
    essaiDebut: debut.toISOString().slice(0, 10),
    essaiFin: fin.toISOString().slice(0, 10),
    // Première échéance : le lendemain de la fin d'essai
    prochainPaiement: fin.toISOString().slice(0, 10),
    statut: 'essai',          // essai | actif | impaye | annule
    paiements: [],            // historique des règlements d'abonnement
    contrat: null             // rempli à la signature
  };
}

/** État courant, recalculé à la lecture : l'essai expire tout seul. */
function etatAbonnement(e, aujourdhui) {
  const a = e && e.abonnement;
  const jour = aujourdhui || new Date().toISOString().slice(0, 10);
  if (!a) return { forfait: 'decouverte', statut: 'essai', joursRestants: null, gratuit: true };
  const f = FORFAITS[a.forfait] || FORFAITS.decouverte;
  const enEssai = a.statut === 'essai' && jour <= a.essaiFin;
  const joursRestants = Math.max(0, Math.round(
    (new Date(a.essaiFin + 'T00:00:00Z') - new Date(jour + 'T00:00:00Z')) / 86400000));
  return {
    forfait: a.forfait,
    nom: f.nom,
    prixMois: f.prixMois,
    commission: f.commission,
    plafondCommission: f.plafondCommission || 0,
    statut: enEssai ? 'essai' : (a.statut === 'essai' ? 'a_regler' : a.statut),
    gratuit: enEssai || f.prixMois === 0,
    essaiDebut: a.essaiDebut,
    essaiFin: a.essaiFin,
    joursRestants: enEssai ? joursRestants : 0,
    prochainPaiement: a.prochainPaiement,
    contratSigne: !!(a.contrat && a.contrat.signature)
  };
}

/** Commission applicable à un encaissement, selon le forfait. */
function commissionPour(e, montant) {
  const a = e && e.abonnement;
  const f = (a && FORFAITS[a.forfait]) || FORFAITS.decouverte;
  let c = Math.round(montant * f.commission);
  if (f.plafondCommission) c = Math.min(c, f.plafondCommission);
  return c;
}

/** Limites du forfait (0 = illimité). */
function limitesDe(e) {
  const a = e && e.abonnement;
  const f = (a && FORFAITS[a.forfait]) || FORFAITS.decouverte;
  return f.limites;
}

/** Vue publique des forfaits, pour la page d'inscription. */
function catalogueForfaits() {
  return {
    moisEssai: MOIS_ESSAI,
    joursEssai: JOURS_ESSAI,
    forfaits: CLES_FORFAITS.map((cle) => Object.assign({ cle }, FORFAITS[cle]))
  };
}

/**
 * Le forfait de l'entreprise ouvre-t-il ce module ?
 *
 * Le socle est toujours ouvert : si le métier le propose, l'entreprise
 * l'a, quel que soit son forfait. Seules les options de croissance
 * dépendent de la formule choisie.
 */
function forfaitAutorise(entreprise, module) {
  if (SOCLE.includes(module)) return true;
  const cle = (entreprise && entreprise.abonnement && entreprise.abonnement.forfait) || 'decouverte';
  const f = FORFAITS[cle] || FORFAITS.decouverte;
  if (!Array.isArray(f.options)) return true;
  return f.options.includes(module);
}

/** Options de croissance du forfait, avec leur libellé, pour l'affichage. */
function optionsDe(entreprise) {
  const cle = (entreprise && entreprise.abonnement && entreprise.abonnement.forfait) || 'decouverte';
  const f = FORFAITS[cle] || FORFAITS.decouverte;
  const ouvertes = Array.isArray(f.options) ? f.options : Object.keys(OPTIONS);
  return Object.keys(OPTIONS).map((cleOpt) => ({
    cle: cleOpt,
    nom: OPTIONS[cleOpt].nom,
    aide: OPTIONS[cleOpt].aide,
    ouverte: ouvertes.includes(cleOpt)
  }));
}

/**
 * Vérifie qu'une création reste dans les limites du forfait.
 * Retourne null si c'est permis, sinon un message explicite.
 */
function limiteAtteinte(entreprise, quoi, nombreActuel) {
  const l = limitesDe(entreprise);
  const max = l[quoi];
  if (!max) return null;                    // 0 = illimité
  if (nombreActuel < max) return null;
  const noms = { services: 'services', employes: "membres d'équipe", produits: 'produits',
                 chambres: 'chambres', programmes: 'programmes' };
  return `Votre forfait est limité à ${max} ${noms[quoi] || quoi}. Passez à un forfait supérieur pour en ajouter davantage.`;
}

/* Chaque quota ne vaut que pour le module qui le consomme : annoncer
   « 0 / 3 chambres » à une boutique n'informe personne. */
const MODULE_DU_QUOTA = { services: 'rdv', employes: 'equipe', produits: 'catalogue',
                          chambres: 'hotellerie', programmes: 'inscriptions' };

/** Ce qui est ouvert et ce qui reste à débloquer, pour l'affichage. */
function etatFonctions(entreprise, nombres, modulesActifs) {
  const cle = (entreprise && entreprise.abonnement && entreprise.abonnement.forfait) || 'decouverte';
  const f = FORFAITS[cle] || FORFAITS.decouverte;
  const l = limitesDe(entreprise);
  const pertinent = (quoi) => !Array.isArray(modulesActifs)
    || modulesActifs.includes(MODULE_DU_QUOTA[quoi] || quoi);
  return {
    forfait: cle,
    nom: f.nom,
    /* Le socle n'est pas listé ici : il est acquis. Ce qui intéresse
       l'entreprise, c'est ce que son forfait ajoute ou retient. */
    options: optionsDe(entreprise),
    limites: Object.entries(l).filter(([quoi, max]) => max > 0 && pertinent(quoi)).map(([quoi, max]) => ({
      quoi, max, utilise: (nombres && nombres[quoi]) || 0
    }))
  };
}

module.exports = {
  forfaitAutorise, limiteAtteinte, etatFonctions, optionsDe,
  FORFAITS, CLES_FORFAITS, MOIS_ESSAI, JOURS_ESSAI, SOCLE, OPTIONS,
  nouvelAbonnement, etatAbonnement, commissionPour, limitesDe,
  catalogueForfaits, ajouterMois
};
