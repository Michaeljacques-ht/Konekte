'use strict';
/* ============================================================
   KONEKTE — Équipe, planning et recrutement
   ------------------------------------------------------------
   Un salon recrute une fois par an ; il fait ses horaires toutes
   les semaines et paie son monde tous les quinze jours. Ce module
   suit donc cet ordre d'importance : la fiche de l'employé et son
   planning d'abord, le recrutement ensuite.

   Ce qu'il ne fait pas, et sciemment : aucun dépôt de CV. Un
   candidat laisse son nom, son téléphone et quelques phrases, rien
   de plus. Stocker les CV de gens qui ne sont pas inscrits sur la
   plateforme — qui ne peuvent donc ni les consulter, ni les
   corriger, ni les effacer — serait une responsabilité lourde pour
   un service qu'une boutique utilisera deux fois l'an.

   Les écoles, elles, relèvent d'ÉDUCA RH : Konekte ne leur propose
   pas ce volet, elle les y renvoie.
   ============================================================ */

/* La famille de métiers servie par ÉDUCA RH. Konekte s'en écarte. */
const FAMILLE_ECOLES = 'Formation';

/* ---------- Fiches employés ---------- */

const CONTRATS = {
  permanent:   'Permanent',
  temporaire:  'Temporaire',
  journalier:  'Journalier',
  apprenti:    'Apprenti / stagiaire',
  prestataire: 'Prestataire'
};

const MODES_PAIE = {
  mensuel:    { nom: 'Au mois',     unite: 'par mois' },
  quinzaine:  { nom: 'À la quinzaine', unite: 'par quinzaine' },
  journalier: { nom: 'À la journée', unite: 'par jour' },
  horaire:    { nom: "À l'heure",   unite: "par heure" }
};

/* ---------- Planning ---------- */

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/* Un créneau est prévu, puis constaté. La distinction compte : les heures
   payées sont celles qui ont été faites, pas celles qui étaient prévues. */
const ETATS_CRENEAU = {
  prevu:   { nom: 'Prévu',   compte: true },
  fait:    { nom: 'Fait',    compte: true },
  absent:  { nom: 'Absent',  compte: false },
  annule:  { nom: 'Annulé',  compte: false }
};

/** Le lundi de la semaine contenant cette date, au format AAAA-MM-JJ. */
function lundiDe(date) {
  const d = new Date(date + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '';
  /* getDay() rend 0 pour dimanche : on ramène la semaine au lundi, qui est
     le premier jour ouvré partout où cette application sert. */
  const decalage = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - decalage);
  return d.toISOString().slice(0, 10);
}

/** Les sept dates d'une semaine, à partir de son lundi. */
function semaineDe(lundi) {
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(lundi + 'T12:00:00');
    d.setDate(d.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Durée d'un créneau en heures, les nuits comprises. */
function dureeHeures(debut, fin) {
  const m = (h) => {
    const x = /^(\d{1,2}):(\d{2})$/.exec(String(h || ''));
    return x ? Number(x[1]) * 60 + Number(x[2]) : null;
  };
  const a = m(debut), b = m(fin);
  if (a === null || b === null) return 0;
  /* Une veille de nuit finit le lendemain matin : 22:00 → 06:00 fait huit
     heures, pas moins seize. Un hôtel en a besoin tous les jours. */
  const minutes = b > a ? b - a : (1440 - a) + b;
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Heures et rémunération d'un employé sur une période.
 * Les heures comptées sont celles des créneaux tenus ; une absence ne se
 * paie pas d'elle-même, et c'est au responsable d'en décider autrement.
 */
function recapEmploye(employe, creneaux, du, au) {
  const siens = creneaux.filter((c) => c.employeId === employe.id && c.date >= du && c.date <= au);
  let heures = 0, jours = new Set(), absences = 0;
  for (const c of siens) {
    const etat = ETATS_CRENEAU[c.etat] || ETATS_CRENEAU.prevu;
    if (!etat.compte) { if (c.etat === 'absent') absences++; continue; }
    heures += dureeHeures(c.debut, c.fin);
    jours.add(c.date);
  }
  heures = Math.round(heures * 100) / 100;
  const r = employe.remuneration || {};
  const taux = Number(r.montant) > 0 ? Number(r.montant) : 0;
  let brut = 0;
  if (r.mode === 'horaire') brut = taux * heures;
  else if (r.mode === 'journalier') brut = taux * jours.size;
  else brut = taux;                     // au mois ou à la quinzaine : fixe
  return {
    employeId: employe.id, nom: employe.nom, poste: employe.poste || '',
    heures, jours: jours.size, absences, creneaux: siens.length,
    mode: r.mode || 'mensuel', taux,
    brut: Math.round(brut),
    /* Les avances déjà versées se déduisent du net à payer : c'est la
       pratique courante, et l'oublier fait payer deux fois. */
    avances: 0, net: Math.round(brut)
  };
}

/** Applique les avances d'une période à un récapitulatif. */
function appliquerAvances(recap, avances) {
  const total = avances.reduce((s, a) => s + (Number(a.montant) || 0), 0);
  recap.avances = Math.round(total);
  recap.net = Math.max(0, Math.round(recap.brut - total));
  return recap;
}

/* ---------- Recrutement ---------- */

const TYPES_OFFRE = {
  plein:      'Temps plein',
  partiel:    'Temps partiel',
  journalier: 'Journalier',
  saisonnier: 'Saisonnier',
  stage:      'Stage / apprentissage'
};

const ETATS_CANDIDATURE = {
  nouvelle: 'Nouvelle',
  vue:      'Vue',
  entretien: 'Entretien',
  retenue:  'Retenue',
  ecartee:  'Écartée'
};

/** Nettoie une offre reçue de l'espace de gestion. */
function nettoyerOffre(corps) {
  const t = (v, n) => (typeof v === 'string' ? v.slice(0, n).trim() : '');
  const type = Object.keys(TYPES_OFFRE).includes(corps.type) ? corps.type : 'plein';
  return {
    titre: t(corps.titre, 80),
    type,
    description: t(corps.description, 1200),
    /* Ni fourchette imposée ni champ obligatoire : beaucoup d'employeurs
       haïtiens préfèrent en parler de vive voix, et un champ vide valant
       « à discuter » vaut mieux qu'un chiffre inventé pour remplir. */
    remuneration: t(corps.remuneration, 80),
    lieu: t(corps.lieu, 80),
    profil: t(corps.profil, 600),
    actif: corps.actif !== false
  };
}

/** Nettoie une candidature reçue du public. */
function nettoyerCandidature(corps) {
  const t = (v, n) => (typeof v === 'string' ? v.slice(0, n).trim() : '');
  return {
    nom: t(corps.nom, 80),
    telephone: t(corps.telephone, 25),
    email: t(corps.email, 120),
    experience: t(corps.experience, 400),
    message: t(corps.message, 1200)
  };
}

module.exports = {
  FAMILLE_ECOLES, CONTRATS, MODES_PAIE, JOURS, ETATS_CRENEAU,
  TYPES_OFFRE, ETATS_CANDIDATURE,
  lundiDe, semaineDe, dureeHeures, recapEmploye, appliquerAvances,
  nettoyerOffre, nettoyerCandidature
};
