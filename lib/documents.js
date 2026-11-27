'use strict';
/* ============================================================
   KONEKTE — Reçus et contrats des entreprises
   ------------------------------------------------------------
   Le reçu de Konekte prouve un paiement, et c'est tout ce qu'il
   sait faire. Un hôtel doit remettre une fiche de séjour avec ses
   heures et sa politique d'annulation ; un avocat, une convention
   d'honoraires ; une école, un contrat d'inscription ; un garage,
   un ordre de réparation. Ces documents n'ont de commun que le
   papier : leur contenu tient au métier.

   Chaque métier reçoit donc un modèle de départ, écrit pour lui,
   que l'entreprise modifie ensuite à sa guise — c'est son
   document, pas le nôtre. Nous ne fournissons que la première
   version et la mise en page.

   AVERTISSEMENT QUI COMPTE : ces modèles sont des points de
   départ rédigés en bon sens commercial, pas des actes vérifiés
   par un juriste haïtien. Le texte le dit à l'entreprise, parce
   qu'un modèle présenté comme « conforme » ferait courir un
   risque réel à celui qui s'y fie.
   ============================================================ */

/* Les variables qu'une entreprise peut poser dans son texte. Elles
   sont remplacées au moment où le document s'affiche. */
const VARIABLES = [
  { cle: 'entreprise', libelle: "Nom de l'entreprise" },
  { cle: 'client', libelle: 'Nom du client' },
  { cle: 'montant', libelle: 'Montant (avec HTG)' },
  { cle: 'objet', libelle: "Objet (séjour, commande, service…)" },
  { cle: 'reference', libelle: 'Référence du document' },
  { cle: 'date', libelle: 'Date du document' },
  { cle: 'adresse', libelle: "Adresse de l'entreprise" },
  { cle: 'ville', libelle: "Ville de l'entreprise" },
  { cle: 'telephone', libelle: "Téléphone de l'entreprise" },
  { cle: 'arrivee', libelle: "Date d'arrivée (séjours)" },
  { cle: 'depart', libelle: 'Date de départ (séjours)' }
];

/* ------------------------------------------------------------
   Les modèles, par famille de métier.
   `recu.mentions` : ce qui s'imprime au bas du reçu.
   `contrat.titre` / `contrat.articles` : le document à signer.
   ------------------------------------------------------------ */
const MODELES = {

  'Hôtellerie': {
    nomRecu: 'Facture de séjour',
    recu: {
      mentions: "Les clés sont remises contre une pièce d'identité. "
        + "Le client répond des dégâts causés à la chambre pendant son séjour.",
      conditions: "Annulation sans frais jusqu'à 48 heures avant l'arrivée. "
        + "Passé ce délai, l'acompte reste acquis à l'établissement."
    },
    contrat: {
      titre: 'Fiche de séjour',
      actif: true,
      articles: [
        ['Objet', "La présente fiche constate la réservation de {objet} par {client} auprès de {entreprise}, pour un montant de {montant}."],
        ['Arrivée et départ', "Arrivée le {arrivee}, départ le {depart}. Les heures d'arrivée et de départ affichées sur la page de l'établissement s'appliquent ; tout dépassement peut être facturé en nuitée supplémentaire."],
        ['Occupation', "La chambre est réservée pour le nombre de personnes déclaré. Toute personne supplémentaire doit être annoncée et peut donner lieu à un supplément."],
        ['Dégâts et objets perdus', "Le client est responsable des dégradations qu'il cause. L'établissement n'est pas tenu des objets de valeur laissés en chambre hors coffre."],
        ['Annulation', "Annulation sans frais jusqu'à 48 heures avant l'arrivée. Au-delà, l'acompte reste acquis à l'établissement."],
        ['Paiement', "Le solde est exigible au plus tard au départ. Le reçu portant la référence {reference} fait foi des sommes versées."]
      ]
    }
  },

  'Juridique': {
    nomRecu: "Reçu d'honoraires",
    recu: {
      mentions: "Les sommes versées le sont à titre d'honoraires et de frais, selon la convention signée entre les parties.",
      conditions: "Les honoraires versés couvrent les diligences effectuées à la date du présent reçu."
    },
    contrat: {
      titre: "Convention d'honoraires",
      actif: true,
      articles: [
        ['Parties', "La présente convention est conclue entre {entreprise}, dont le cabinet est sis {adresse}, et {client}."],
        ['Mission', "Le cabinet est chargé de : {objet}. La mission s'entend des diligences nécessaires à son accomplissement, à l'exclusion de toute autre."],
        ['Honoraires', "Les honoraires sont fixés à {montant}, payables selon les modalités convenues. Les frais et débours engagés pour le compte du client s'y ajoutent sur justificatif."],
        ['Obligation de moyens', "Le cabinet s'engage à mettre en œuvre les moyens utiles à la défense des intérêts du client. Aucune garantie de résultat n'est donnée, l'issue d'une procédure ne dépendant pas de lui seul."],
        ['Confidentialité', "Le cabinet est tenu au secret professionnel sur tout ce qui lui est confié."],
        ['Fin de mission', "Chacune des parties peut mettre fin à la mission. Les honoraires correspondant aux diligences déjà accomplies restent dus."]
      ]
    }
  },

  'Formation': {
    nomRecu: 'Reçu de scolarité',
    recu: {
      mentions: "Ce reçu atteste du versement porté ci-dessus. Il est exigé pour toute réclamation.",
      conditions: "Les sommes versées au titre de l'inscription ne sont pas remboursables après le début des cours."
    },
    contrat: {
      titre: "Contrat d'inscription",
      actif: true,
      articles: [
        ['Inscription', "{client} est inscrit auprès de {entreprise} pour : {objet}, moyennant {montant}."],
        ['Engagement de l\'établissement', "L'établissement assure les enseignements annoncés, dans les locaux et aux horaires communiqués, et délivre l'attestation prévue au terme de la formation si les conditions d'assiduité et d'évaluation sont remplies."],
        ['Engagement de l\'élève', "L'élève ou l'étudiant s'engage à l'assiduité, au respect du règlement intérieur et au paiement des sommes dues aux échéances convenues."],
        ['Paiement', "Les frais peuvent être réglés par versements. Un retard prolongé peut suspendre l'accès aux cours et aux évaluations."],
        ['Abandon', "L'abandon en cours de formation ne donne lieu à aucun remboursement des sommes déjà versées."],
        ['Discipline', "Tout manquement grave au règlement intérieur peut entraîner l'exclusion, sans remboursement."]
      ]
    }
  },

  'Santé': {
    nomRecu: 'Reçu de consultation',
    recu: {
      mentions: "Ce reçu atteste du paiement des actes mentionnés. Aucun diagnostic n'y figure.",
      conditions: ''
    },
    contrat: {
      titre: 'Consentement et conditions de prise en charge',
      actif: false,
      articles: [
        ['Objet', "{client} est pris en charge par {entreprise} pour : {objet}."],
        ['Information', "Le patient a été informé de la nature des actes proposés, de leur déroulement et de leurs suites habituelles, et a pu poser ses questions."],
        ['Consentement', "Le patient consent aux actes convenus. Il peut revenir sur son consentement à tout moment avant leur exécution."],
        ['Honoraires', "Le montant de {montant} correspond aux actes convenus. Tout acte supplémentaire fait l'objet d'une information préalable."],
        ['Rendez-vous manqué', "Un rendez-vous non honoré et non annulé à l'avance peut être facturé."],
        ['Confidentialité', "Les informations recueillies sont couvertes par le secret médical."]
      ]
    }
  },

  'Commerce': {
    nomRecu: 'Reçu de vente',
    recu: {
      mentions: "Marchandise vendue vérifiée par l'acheteur au moment de la remise.",
      conditions: "Échange possible sous 7 jours sur présentation de ce reçu, article non utilisé et dans son emballage."
    },
    contrat: {
      titre: 'Bon de commande et conditions de vente',
      actif: false,
      articles: [
        ['Commande', "{client} commande auprès de {entreprise} : {objet}, pour un montant de {montant}."],
        ['Livraison ou retrait', "La marchandise est remise selon le mode choisi à la commande. Les délais annoncés sont donnés à titre indicatif."],
        ['Vérification', "L'acheteur vérifie la marchandise au moment de la remise. Toute réserve doit être formulée à ce moment-là."],
        ['Échange', "Échange possible sous 7 jours sur présentation du reçu portant la référence {reference}, article non utilisé et dans son emballage d'origine."],
        ['Garantie', "Les produits bénéficiant d'une garantie du fabricant sont pris en charge selon les conditions de celui-ci."],
        ['Paiement', "Pour une précommande, l'acompte versé est déduit du prix et n'est pas remboursable en cas d'annulation du fait de l'acheteur."]
      ]
    }
  },

  'Auto': {
    nomRecu: 'Reçu de réparation',
    recu: {
      mentions: "Véhicule restitué après vérification par le client. Les pièces remplacées sont tenues à sa disposition.",
      conditions: "Garantie de 30 jours sur la main-d'œuvre. Les pièces suivent la garantie du fabricant."
    },
    contrat: {
      titre: 'Ordre de réparation',
      actif: true,
      articles: [
        ['Objet', "{client} confie à {entreprise} l'intervention suivante : {objet}, pour un montant estimé à {montant}."],
        ['Devis et dépassement', "Toute intervention non prévue, ou tout dépassement de l'estimation, fait l'objet d'un accord préalable du client."],
        ['Pièces', "Les pièces remplacées sont tenues à la disposition du client, qui peut les récupérer à la restitution du véhicule."],
        ['Garantie', "La main-d'œuvre est garantie 30 jours. Les pièces suivent la garantie de leur fabricant."],
        ['Gardiennage', "Le véhicule non retiré dans les 15 jours suivant l'avis de fin de travaux peut donner lieu à des frais de gardiennage."],
        ['Paiement', "Le solde est exigible à la restitution du véhicule."]
      ]
    }
  },

  'Maison': {
    nomRecu: 'Reçu de prestation',
    recu: {
      mentions: "Travaux réceptionnés par le client au moment de la remise.",
      conditions: "Garantie de 30 jours sur la main-d'œuvre, hors usure normale et mauvaise utilisation."
    },
    contrat: {
      titre: 'Contrat de prestation',
      actif: true,
      articles: [
        ['Objet', "{client} confie à {entreprise} l'exécution des travaux suivants : {objet}, pour un montant de {montant}."],
        ['Délais', "Les délais annoncés courent à partir du versement de l'acompte et de la mise à disposition du chantier."],
        ['Matériaux', "Sauf mention contraire, les matériaux sont fournis par le prestataire et facturés en sus de la main-d'œuvre."],
        ['Travaux supplémentaires', "Toute demande nouvelle en cours de chantier fait l'objet d'un accord écrit sur le prix et le délai."],
        ['Réception', "Le client réceptionne les travaux au terme de l'intervention et formule ses réserves à ce moment."],
        ['Garantie', "La main-d'œuvre est garantie 30 jours, hors usure normale et mauvaise utilisation."]
      ]
    }
  },

  'Beauté': {
    nomRecu: 'Reçu de prestation',
    recu: {
      mentions: "Prestation réalisée en salon, réglée selon le détail ci-dessus.",
      conditions: "Tout rendez-vous annulé moins de 2 heures à l'avance peut être facturé."
    },
    contrat: {
      titre: 'Conditions de rendez-vous',
      actif: false,
      articles: [
        ['Objet', "{client} réserve auprès de {entreprise} la prestation suivante : {objet}, au prix de {montant}."],
        ['Ponctualité', "Un retard de plus de 15 minutes peut entraîner le report du rendez-vous, le temps réservé ne pouvant être garanti."],
        ['Annulation', "Toute annulation moins de 2 heures avant l'heure prévue peut être facturée."],
        ['Produits et allergies', "Le client signale toute allergie ou sensibilité connue avant la prestation."],
        ['Résultat', "La prestation est réalisée selon les règles de l'art. Le rendu dépend aussi de la nature du cheveu ou de la peau."]
      ]
    }
  },

  'Restauration': {
    nomRecu: 'Addition',
    recu: {
      mentions: 'Service compris. Merci de votre visite.',
      conditions: "Une table réservée est tenue 20 minutes au-delà de l'heure convenue."
    },
    contrat: {
      titre: 'Conditions de réservation',
      actif: false,
      articles: [
        ['Réservation', "{client} réserve auprès de {entreprise} : {objet}."],
        ['Tenue de la table', "La table réservée est tenue 20 minutes au-delà de l'heure convenue, après quoi elle peut être attribuée."],
        ['Groupes', "Pour les groupes, un acompte peut être demandé et reste acquis en cas d'annulation tardive."],
        ['Allergies', "Le client signale toute allergie alimentaire avant la commande."]
      ]
    }
  },

  'Autre': {
    nomRecu: 'Reçu',
    recu: {
      mentions: '',
      conditions: ''
    },
    contrat: {
      titre: 'Contrat de prestation',
      actif: false,
      articles: [
        ['Objet', "{client} et {entreprise} conviennent de la prestation suivante : {objet}, pour un montant de {montant}."],
        ['Exécution', "La prestation est exécutée selon les modalités convenues entre les parties."],
        ['Paiement', "Le montant est payable selon les modalités convenues. Le reçu portant la référence {reference} fait foi des sommes versées."],
        ['Annulation', "Les conditions d'annulation sont celles convenues entre les parties avant le début de la prestation."]
      ]
    }
  }
};

/* Quelques métiers s'écartent de leur famille : une pharmacie vend,
   un restaurant sert à table. On les redirige. */
const PAR_METIER = {
  pharmacie: 'Commerce',
  restaurant: 'Restauration',
  bar: 'Restauration'
};

/** Le modèle de départ qui convient à cette entreprise. */
function modelePour(entreprise, famille) {
  const cle = PAR_METIER[(entreprise && entreprise.metier) || ''] || famille || 'Autre';
  return MODELES[cle] || MODELES['Autre'];
}

/**
 * Les réglages effectifs : ce que l'entreprise a enregistré, complété
 * par le modèle de son métier pour tout ce qu'elle n'a pas touché.
 * Ainsi un hôtel qui n'a rien configuré remet quand même une fiche de
 * séjour tenant debout, et celui qui a tout réécrit garde son texte.
 */
function documentsDe(entreprise, famille) {
  const m = modelePour(entreprise, famille);
  const d = (entreprise && entreprise.documents) || {};
  const r = d.recu || {};
  const c = d.contrat || {};
  return {
    recu: {
      titre: r.titre !== undefined ? r.titre : m.nomRecu,
      /* Raison sociale et identifiant fiscal : ce qui distingue un reçu
         d'entreprise d'un bout de papier. Vides tant qu'ils ne sont pas
         renseignés — jamais inventés. */
      raisonSociale: r.raisonSociale || '',
      nif: r.nif || '',
      mentions: r.mentions !== undefined ? r.mentions : m.recu.mentions,
      conditions: r.conditions !== undefined ? r.conditions : m.recu.conditions,
      afficherAdresse: r.afficherAdresse !== false,
      afficherTelephone: r.afficherTelephone !== false,
      /* Ligne de signature et de cachet : indispensable là où le
         document se présente au guichet d'une banque ou d'une école. */
      ligneSignature: !!r.ligneSignature
    },
    contrat: {
      actif: c.actif !== undefined ? !!c.actif : !!m.contrat.actif,
      titre: c.titre !== undefined ? c.titre : m.contrat.titre,
      articles: Array.isArray(c.articles) && c.articles.length
        ? c.articles
        : m.contrat.articles.map(([t, corps]) => ({ titre: t, corps })),
      /* Faut-il demander au client d'accepter avant de lui délivrer son
         document ? Pour un séjour ou un chantier, oui ; pour une coupe
         de cheveux, l'imposer serait ridicule. */
      signatureClient: c.signatureClient !== undefined ? !!c.signatureClient : !!m.contrat.actif,
      pied: c.pied || ''
    },
    /* Le modèle d'origine, pour que l'écran de réglages puisse proposer
       « revenir au modèle de mon métier ». */
    modele: {
      nomRecu: m.nomRecu,
      recu: m.recu,
      contrat: { titre: m.contrat.titre,
                 articles: m.contrat.articles.map(([t, corps]) => ({ titre: t, corps })) }
    }
  };
}

/** Remplace {client}, {montant}… par leurs valeurs. Une variable sans
 *  valeur disparaît plutôt que de laisser son accolade sur le papier. */
function remplir(texte, vars) {
  return String(texte || '').replace(/\{(\w+)\}/g,
    (tout, cle) => (cle in vars && vars[cle] != null && vars[cle] !== '' ? String(vars[cle]) : ''));
}

/** Le contrat rendu, prêt à imprimer, pour un document donné. */
function contratRendu(reglages, vars) {
  const c = reglages.contrat;
  if (!c.actif) return null;
  return {
    titre: remplir(c.titre, vars),
    articles: (c.articles || []).map((a) => ({
      titre: remplir(a.titre, vars), corps: remplir(a.corps, vars)
    })).filter((a) => a.titre || a.corps),
    pied: remplir(c.pied, vars),
    signatureClient: !!c.signatureClient
  };
}

/** Nettoie ce que l'entreprise envoie, avant de l'enregistrer. */
function nettoyer(corps) {
  const t = (v, n) => String(v == null ? '' : v).slice(0, n).trim();
  const r = corps.recu || {};
  const c = corps.contrat || {};
  return {
    recu: {
      titre: t(r.titre, 60),
      raisonSociale: t(r.raisonSociale, 120),
      nif: t(r.nif, 40),
      mentions: t(r.mentions, 600),
      conditions: t(r.conditions, 600),
      afficherAdresse: r.afficherAdresse !== false,
      afficherTelephone: r.afficherTelephone !== false,
      ligneSignature: !!r.ligneSignature
    },
    contrat: {
      actif: !!c.actif,
      titre: t(c.titre, 90),
      /* Vingt articles suffisent largement ; au-delà, personne ne lit. */
      articles: (Array.isArray(c.articles) ? c.articles : []).slice(0, 20)
        .map((a) => ({ titre: t(a.titre, 90), corps: t(a.corps, 2500) }))
        .filter((a) => a.titre || a.corps),
      signatureClient: !!c.signatureClient,
      pied: t(c.pied, 400)
    }
  };
}

module.exports = { VARIABLES, MODELES, modelePour, documentsDe, contratRendu, remplir, nettoyer };
