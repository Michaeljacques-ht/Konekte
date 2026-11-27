/* ==========================================================
   Registre des métiers
   ----------------------------------------------------------
   Source unique de vérité pour tout ce qui varie d'un type
   d'entreprise à l'autre. Ajouter un métier = ajouter une
   entrée ici ; aucune autre modification n'est nécessaire.

   Chaque métier déclare :
     nom       — libellé affiché (fr / ht)
     ico       — emoji de la catégorie
     famille   — regroupement pour les filtres publics
     mots      — vocabulaire : comment ce métier nomme les choses
     modules   — fonctionnalités activées dans l'espace de gestion
     champs    — informations propres au métier (profil public)
     exemples  — suggestions affichées à la création d'un service
   ========================================================== */

// Modules disponibles. Un métier n'affiche que ceux qu'il déclare.
const MODULES = [
  'rdv',          // prise de rendez-vous sur créneaux
  'equipe',       // praticiens / employés rattachés aux prestations
  'hotellerie',   // chambres et séjours
  'carte',        // carte restaurant et bar
  'catalogue',    // produits présentés en vitrine, avec stock
  'commandes',    // panier, commandes en ligne, livraison ou retrait
  'inscriptions', // programmes et inscriptions (écoles)
  'dossiers',     // suivi de dossiers (notaire, arpenteur, avocat)
  'urgences'      // service d'urgence 24h/24
];

const METIERS = {
  // ---------- Beauté et soins ----------
  'salon-beaute': {
    nom: { fr: 'Salon de beauté', ht: 'Salon bote' }, ico: '💅', famille: 'Beauté',
    mots: { service: { fr: 'Prestation', ht: 'Prestasyon' }, servicePl: { fr: 'Prestations', ht: 'Prestasyon' },
            agent: { fr: 'Esthéticienne', ht: 'Estetisyèn' }, agentPl: { fr: 'Équipe', ht: 'Ekip' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'equipe', 'catalogue'],
    champs: ['domicile'],
    exemples: ['Manucure', 'Pédicure', 'Soin du visage', 'Épilation', 'Maquillage']
  },
  'coiffure-homme': {
    nom: { fr: 'Salon de coiffure homme', ht: 'Kwafè gason' }, ico: '💈', famille: 'Beauté',
    mots: { service: { fr: 'Prestation', ht: 'Prestasyon' }, servicePl: { fr: 'Prestations', ht: 'Prestasyon' },
            agent: { fr: 'Barbier', ht: 'Bab' }, agentPl: { fr: 'Barbiers', ht: 'Bab yo' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'equipe', 'catalogue'],
    champs: ['fileAttente', 'domicile'],
    exemples: ['Coupe classique', 'Dégradé', 'Taille de barbe', 'Rasage', 'Coupe enfant']
  },
  'coiffure-femme': {
    nom: { fr: 'Salon de coiffure femme', ht: 'Kwafè fanm' }, ico: '💇‍♀️', famille: 'Beauté',
    mots: { service: { fr: 'Prestation', ht: 'Prestasyon' }, servicePl: { fr: 'Prestations', ht: 'Prestasyon' },
            agent: { fr: 'Coiffeuse', ht: 'Kwafèz' }, agentPl: { fr: 'Équipe', ht: 'Ekip' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'equipe', 'catalogue'],
    champs: ['domicile'],
    exemples: ['Tresses', 'Défrisage', 'Tissage', 'Coloration', 'Brushing', 'Locks']
  },
  'coiffure-mixte': {
    nom: { fr: 'Salon de coiffure mixte', ht: 'Kwafè mikst' }, ico: '💇', famille: 'Beauté',
    mots: { service: { fr: 'Prestation', ht: 'Prestasyon' }, servicePl: { fr: 'Prestations', ht: 'Prestasyon' },
            agent: { fr: 'Coiffeur·euse', ht: 'Kwafè' }, agentPl: { fr: 'Équipe', ht: 'Ekip' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'equipe', 'catalogue'],
    champs: ['fileAttente', 'domicile'],
    exemples: ['Coupe homme', 'Coupe femme', 'Tresses', 'Coloration', 'Coupe enfant']
  },
  'barbier': {
    nom: { fr: 'Barbier', ht: 'Bab' }, ico: '🪒', famille: 'Beauté',
    mots: { service: { fr: 'Prestation', ht: 'Prestasyon' }, servicePl: { fr: 'Prestations', ht: 'Prestasyon' },
            agent: { fr: 'Barbier', ht: 'Bab' }, agentPl: { fr: 'Barbiers', ht: 'Bab yo' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'equipe'],
    champs: ['fileAttente'],
    exemples: ['Coupe', 'Barbe', 'Rasage à l\'ancienne', 'Contour']
  },
  'spa': {
    nom: { fr: 'Spa et massage', ht: 'Espa ak masaj' }, ico: '💆', famille: 'Beauté',
    mots: { service: { fr: 'Soin', ht: 'Swen' }, servicePl: { fr: 'Soins', ht: 'Swen' },
            agent: { fr: 'Praticien·ne', ht: 'Pratisyen' }, agentPl: { fr: 'Équipe', ht: 'Ekip' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'equipe', 'catalogue'],
    champs: ['domicile'],
    exemples: ['Massage relaxant', 'Massage sportif', 'Sauna', 'Soin du corps']
  },

  // ---------- Santé ----------
  'clinique': {
    nom: { fr: 'Clinique', ht: 'Klinik' }, ico: '🏥', famille: 'Santé',
    mots: { service: { fr: 'Consultation', ht: 'Konsiltasyon' }, servicePl: { fr: 'Consultations', ht: 'Konsiltasyon' },
            agent: { fr: 'Médecin', ht: 'Doktè' }, agentPl: { fr: 'Praticiens', ht: 'Doktè yo' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'equipe', 'urgences'],
    champs: ['specialites', 'assurances', 'urgence24', 'laboratoire', 'pharmacie'],
    exemples: ['Consultation générale', 'Pédiatrie', 'Gynécologie', 'Cardiologie', 'Échographie']
  },
  'hopital': {
    nom: { fr: 'Hôpital', ht: 'Lopital' }, ico: '🏥', famille: 'Santé',
    mots: { service: { fr: 'Service', ht: 'Sèvis' }, servicePl: { fr: 'Services', ht: 'Sèvis' },
            agent: { fr: 'Médecin', ht: 'Doktè' }, agentPl: { fr: 'Corps médical', ht: 'Kò medikal' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'equipe', 'urgences'],
    champs: ['specialites', 'assurances', 'urgence24', 'laboratoire', 'pharmacie', 'ambulance', 'litsHospitalisation'],
    exemples: ['Médecine générale', 'Chirurgie', 'Maternité', 'Radiologie', 'Urgences']
  },
  'cabinet-medical': {
    nom: { fr: 'Cabinet médical', ht: 'Kabinè medikal' }, ico: '🩺', famille: 'Santé',
    mots: { service: { fr: 'Consultation', ht: 'Konsiltasyon' }, servicePl: { fr: 'Consultations', ht: 'Konsiltasyon' },
            agent: { fr: 'Praticien', ht: 'Pratisyen' }, agentPl: { fr: 'Praticiens', ht: 'Pratisyen yo' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'equipe'],
    champs: ['specialites', 'assurances', 'domicile'],
    exemples: ['Consultation', 'Suivi', 'Vaccination', 'Certificat médical']
  },
  'dentiste': {
    nom: { fr: 'Cabinet dentaire', ht: 'Kabinè dantis' }, ico: '🦷', famille: 'Santé',
    mots: { service: { fr: 'Soin', ht: 'Swen' }, servicePl: { fr: 'Soins', ht: 'Swen' },
            agent: { fr: 'Dentiste', ht: 'Dantis' }, agentPl: { fr: 'Praticiens', ht: 'Dantis yo' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'equipe'],
    champs: ['assurances'],
    exemples: ['Détartrage', 'Extraction', 'Plombage', 'Blanchiment', 'Appareil dentaire']
  },
  'pharmacie': {
    nom: { fr: 'Pharmacie', ht: 'Famasi' }, ico: '💊', famille: 'Santé',
    mots: { service: { fr: 'Service', ht: 'Sèvis' }, servicePl: { fr: 'Services', ht: 'Sèvis' },
            agent: { fr: 'Pharmacien', ht: 'Famasyen' }, agentPl: { fr: 'Équipe', ht: 'Ekip' },
            rdv: { fr: 'Demande', ht: 'Demann' }, action: { fr: 'Acheter', ht: 'Achte' } },
    modules: ['catalogue', 'urgences'],
    champs: ['garde', 'livraison', 'urgence24'],
    exemples: ['Prise de tension', 'Test rapide', 'Conseil pharmaceutique']
  },
  'laboratoire': {
    nom: { fr: 'Laboratoire d\'analyses', ht: 'Laboratwa analiz' }, ico: '🔬', famille: 'Santé',
    mots: { service: { fr: 'Analyse', ht: 'Analiz' }, servicePl: { fr: 'Analyses', ht: 'Analiz' },
            agent: { fr: 'Technicien', ht: 'Teknisyen' }, agentPl: { fr: 'Équipe', ht: 'Ekip' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'equipe'],
    champs: ['assurances', 'domicile', 'delaiResultats'],
    exemples: ['Hémogramme', 'Glycémie', 'Test de grossesse', 'Bilan lipidique']
  },

  // ---------- Professions libérales ----------
  'notaire': {
    nom: { fr: 'Notaire', ht: 'Notè' }, ico: '📜', famille: 'Juridique',
    mots: { service: { fr: 'Acte', ht: 'Ak' }, servicePl: { fr: 'Actes', ht: 'Ak' },
            agent: { fr: 'Notaire', ht: 'Notè' }, agentPl: { fr: 'Étude', ht: 'Etid' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'dossiers'],
    champs: ['langues', 'deplacement'],
    exemples: ['Acte de vente', 'Titre de propriété', 'Contrat de mariage', 'Succession', 'Procuration']
  },
  'avocat': {
    nom: { fr: 'Cabinet d\'avocat', ht: 'Kabinè avoka' }, ico: '⚖️', famille: 'Juridique',
    mots: { service: { fr: 'Consultation', ht: 'Konsiltasyon' }, servicePl: { fr: 'Consultations', ht: 'Konsiltasyon' },
            agent: { fr: 'Avocat', ht: 'Avoka' }, agentPl: { fr: 'Cabinet', ht: 'Kabinè' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'dossiers'],
    champs: ['specialites', 'langues', 'deplacement'],
    exemples: ['Consultation juridique', 'Droit du travail', 'Droit foncier', 'Divorce', 'Rédaction de contrat']
  },
  'arpenteur': {
    nom: { fr: 'Arpenteur', ht: 'Apantè' }, ico: '📐', famille: 'Juridique',
    mots: { service: { fr: 'Intervention', ht: 'Entèvansyon' }, servicePl: { fr: 'Interventions', ht: 'Entèvansyon' },
            agent: { fr: 'Arpenteur', ht: 'Apantè' }, agentPl: { fr: 'Équipe', ht: 'Ekip' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'dossiers'],
    champs: ['zonesIntervention', 'deplacement', 'delaiRapport'],
    exemples: ['Arpentage de terrain', 'Bornage', 'Plan cadastral', 'Levé topographique']
  },
  'comptable': {
    nom: { fr: 'Comptable', ht: 'Kontab' }, ico: '🧮', famille: 'Juridique',
    mots: { service: { fr: 'Prestation', ht: 'Prestasyon' }, servicePl: { fr: 'Prestations', ht: 'Prestasyon' },
            agent: { fr: 'Comptable', ht: 'Kontab' }, agentPl: { fr: 'Cabinet', ht: 'Kabinè' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'dossiers'],
    champs: ['langues', 'deplacement'],
    exemples: ['Déclaration fiscale', 'Tenue de livres', 'Bilan annuel', 'Conseil fiscal']
  },

  // ---------- Éducation ----------
  'ecole': {
    nom: { fr: 'École classique', ht: 'Lekòl klasik' }, ico: '🏫', famille: 'Formation',
    mots: { service: { fr: 'Niveau', ht: 'Nivo' }, servicePl: { fr: 'Niveaux', ht: 'Nivo' },
            agent: { fr: 'Enseignant', ht: 'Pwofesè' }, agentPl: { fr: 'Corps enseignant', ht: 'Pwofesè yo' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'equipe', 'inscriptions'],
    champs: ['niveaux', 'anneeScolaire', 'cantine', 'transport', 'uniforme', 'languesEnseignement'],
    exemples: ['Préscolaire', 'Fondamental 1', 'Fondamental 2', 'Secondaire', 'Philo']
  },
  'ecole-professionnelle': {
    nom: { fr: 'École professionnelle', ht: 'Lekòl pwofesyonèl' }, ico: '🛠️', famille: 'Formation',
    mots: { service: { fr: 'Formation', ht: 'Fòmasyon' }, servicePl: { fr: 'Formations', ht: 'Fòmasyon' },
            agent: { fr: 'Formateur', ht: 'Fòmatè' }, agentPl: { fr: 'Formateurs', ht: 'Fòmatè yo' },
            rdv: { fr: 'Inscription', ht: 'Enskripsyon' } },
    modules: ['rdv', 'equipe', 'inscriptions'],
    champs: ['dureeFormation', 'certification', 'stage', 'anneeScolaire'],
    exemples: ['Informatique', 'Couture', 'Électricité', 'Plomberie', 'Cuisine', 'Mécanique']
  },
  'universite': {
    nom: { fr: 'Université', ht: 'Inivèsite' }, ico: '🎓', famille: 'Formation',
    mots: { service: { fr: 'Filière', ht: 'Filyè' }, servicePl: { fr: 'Filières', ht: 'Filyè' },
            agent: { fr: 'Professeur', ht: 'Pwofesè' }, agentPl: { fr: 'Corps professoral', ht: 'Pwofesè yo' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'equipe', 'inscriptions'],
    champs: ['facultes', 'diplomes', 'anneeScolaire', 'campus', 'languesEnseignement'],
    exemples: ['Droit', 'Sciences économiques', 'Médecine', 'Informatique', 'Agronomie']
  },
  'centre-formation': {
    nom: { fr: 'Centre de formation', ht: 'Sant fòmasyon' }, ico: '📚', famille: 'Formation',
    mots: { service: { fr: 'Cours', ht: 'Kou' }, servicePl: { fr: 'Cours', ht: 'Kou' },
            agent: { fr: 'Formateur', ht: 'Fòmatè' }, agentPl: { fr: 'Formateurs', ht: 'Fòmatè yo' },
            rdv: { fr: 'Inscription', ht: 'Enskripsyon' } },
    modules: ['rdv', 'equipe', 'inscriptions'],
    champs: ['dureeFormation', 'certification', 'coursEnLigne'],
    exemples: ['Anglais', 'Espagnol', 'Bureautique', 'Comptabilité', 'Marketing digital']
  },

  // ---------- Commerce ----------
  'boutique': {
    nom: { fr: 'Boutique dépanneur', ht: 'Boutik depanè' }, ico: '🏪', famille: 'Commerce',
    mots: { service: { fr: 'Service', ht: 'Sèvis' }, servicePl: { fr: 'Services', ht: 'Sèvis' },
            agent: { fr: 'Vendeur', ht: 'Vandè' }, agentPl: { fr: 'Équipe', ht: 'Ekip' },
            rdv: { fr: 'Commande', ht: 'Kòmand' }, action: { fr: 'Acheter', ht: 'Achte' } },
    modules: ['catalogue', 'commandes'],
    champs: ['livraison', 'horaireEtendu', 'transfertArgent'],
    exemples: ['Livraison à domicile', 'Recharge téléphone', 'Transfert d\'argent']
  },
  'magasin': {
    nom: { fr: 'Magasin', ht: 'Magazen' }, ico: '🛍️', famille: 'Commerce',
    mots: { service: { fr: 'Service', ht: 'Sèvis' }, servicePl: { fr: 'Services', ht: 'Sèvis' },
            agent: { fr: 'Vendeur', ht: 'Vandè' }, agentPl: { fr: 'Équipe', ht: 'Ekip' },
            rdv: { fr: 'Commande', ht: 'Kòmand' }, action: { fr: 'Acheter', ht: 'Achte' } },
    modules: ['catalogue', 'commandes'],
    champs: ['livraison', 'retraitMagasin', 'garantie'],
    exemples: ['Livraison', 'Installation', 'Réparation sous garantie']
  },
  'supermarche': {
    nom: { fr: 'Supermarché', ht: 'Sipèmakèt' }, ico: '🛒', famille: 'Commerce',
    mots: { service: { fr: 'Service', ht: 'Sèvis' }, servicePl: { fr: 'Services', ht: 'Sèvis' },
            agent: { fr: 'Employé', ht: 'Anplwaye' }, agentPl: { fr: 'Équipe', ht: 'Ekip' },
            rdv: { fr: 'Commande', ht: 'Kòmand' }, action: { fr: 'Acheter', ht: 'Achte' } },
    modules: ['catalogue', 'commandes'],
    champs: ['livraison', 'retraitMagasin', 'horaireEtendu'],
    exemples: ['Livraison à domicile', 'Commande par WhatsApp']
  },

  // ---------- Hôtellerie et restauration ----------
  'hotel': {
    nom: { fr: 'Hôtel', ht: 'Otèl' }, ico: '🏨', famille: 'Hôtellerie',
    mots: { service: { fr: 'Service', ht: 'Sèvis' }, servicePl: { fr: 'Services', ht: 'Sèvis' },
            agent: { fr: 'Employé', ht: 'Anplwaye' }, agentPl: { fr: 'Équipe', ht: 'Ekip' },
            rdv: { fr: 'Réservation', ht: 'Rezèvasyon' }, action: { fr: 'Réserver', ht: 'Rezève' } },
    modules: ['hotellerie', 'carte', 'rdv', 'equipe'],
    champs: ['formule', 'checkin', 'checkout'],
    exemples: ['Navette aéroport', 'Blanchisserie', 'Location de salle']
  },
  'restaurant': {
    nom: { fr: 'Restaurant', ht: 'Restoran' }, ico: '🍽️', famille: 'Hôtellerie',
    mots: { service: { fr: 'Service', ht: 'Sèvis' }, servicePl: { fr: 'Services', ht: 'Sèvis' },
            agent: { fr: 'Serveur', ht: 'Sèvè' }, agentPl: { fr: 'Équipe', ht: 'Ekip' },
            rdv: { fr: 'Réservation de table', ht: 'Rezèvasyon tab' }, action: { fr: 'Commander', ht: 'Kòmande' } },
    modules: ['carte', 'rdv', 'equipe'],
    champs: ['livraison', 'emporter', 'terrasse', 'nbCouverts'],
    exemples: ['Réservation de table', 'Location pour événement', 'Traiteur']
  },
  'bar': {
    nom: { fr: 'Bar et lounge', ht: 'Ba ak loudj' }, ico: '🍹', famille: 'Hôtellerie',
    mots: { service: { fr: 'Service', ht: 'Sèvis' }, servicePl: { fr: 'Services', ht: 'Sèvis' },
            agent: { fr: 'Barman', ht: 'Barman' }, agentPl: { fr: 'Équipe', ht: 'Ekip' },
            rdv: { fr: 'Réservation', ht: 'Rezèvasyon' }, action: { fr: 'Commander', ht: 'Kòmande' } },
    modules: ['carte', 'rdv'],
    champs: ['terrasse', 'musiqueLive', 'nbCouverts'],
    exemples: ['Réservation de table', 'Privatisation', 'Soirée événement']
  },

  // ---------- Services ----------
  'garage': {
    nom: { fr: 'Garage automobile', ht: 'Garaj machin' }, ico: '🚗', famille: 'Auto',
    mots: { service: { fr: 'Intervention', ht: 'Entèvansyon' }, servicePl: { fr: 'Interventions', ht: 'Entèvansyon' },
            agent: { fr: 'Mécanicien', ht: 'Mekanisyen' }, agentPl: { fr: 'Équipe', ht: 'Ekip' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'equipe', 'catalogue'],
    champs: ['depannage', 'marques', 'garantie'],
    exemples: ['Vidange', 'Freins', 'Diagnostic', 'Climatisation', 'Carrosserie']
  },
  'artisan': {
    nom: { fr: 'Artisan et dépannage', ht: 'Atizan ak depanaj' }, ico: '🔧', famille: 'Maison',
    mots: { service: { fr: 'Intervention', ht: 'Entèvansyon' }, servicePl: { fr: 'Interventions', ht: 'Entèvansyon' },
            agent: { fr: 'Artisan', ht: 'Atizan' }, agentPl: { fr: 'Équipe', ht: 'Ekip' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'equipe'],
    champs: ['zonesIntervention', 'deplacement', 'depannage'],
    exemples: ['Plomberie', 'Électricité', 'Menuiserie', 'Peinture', 'Maçonnerie']
  },
  'autre': {
    nom: { fr: 'Autre activité', ht: 'Lòt aktivite' }, ico: '✨', famille: 'Autre',
    mots: { service: { fr: 'Service', ht: 'Sèvis' }, servicePl: { fr: 'Services', ht: 'Sèvis' },
            agent: { fr: 'Membre', ht: 'Manm' }, agentPl: { fr: 'Équipe', ht: 'Ekip' },
            rdv: { fr: 'Rendez-vous', ht: 'Randevou' } },
    modules: ['rdv', 'equipe'],
    champs: [],
    exemples: []
  }
};

/* ----------------------------------------------------------
   Champs propres aux métiers.
   type : 'bool' (case à cocher), 'texte' (ligne libre),
          'liste' (valeurs séparées par des virgules),
          'nombre', 'heure'
   ---------------------------------------------------------- */
const CHAMPS = {
  // Santé
  specialites:    { type: 'liste',  fr: 'Spécialités', ht: 'Espesyalite', aide: { fr: 'Séparez par des virgules', ht: 'Separe ak vigil' } },
  assurances:     { type: 'liste',  fr: 'Assurances acceptées', ht: 'Asirans yo aksepte' },
  urgence24:      { type: 'bool',   fr: 'Urgences 24h/24', ht: 'Ijans 24è sou 24' },
  laboratoire:    { type: 'bool',   fr: 'Laboratoire sur place', ht: 'Laboratwa sou plas' },
  pharmacie:      { type: 'bool',   fr: 'Pharmacie sur place', ht: 'Famasi sou plas' },
  ambulance:      { type: 'bool',   fr: 'Service d\'ambulance', ht: 'Sèvis anbilans' },
  litsHospitalisation: { type: 'nombre', fr: 'Lits d\'hospitalisation', ht: 'Kabann pou entène' },
  delaiResultats: { type: 'texte',  fr: 'Délai des résultats', ht: 'Delè rezilta yo', aide: { fr: 'Ex : 24 à 48 heures', ht: 'Egz : 24 a 48 èdtan' } },
  garde:          { type: 'bool',   fr: 'Pharmacie de garde', ht: 'Famasi de gad' },

  // Professions libérales
  langues:        { type: 'liste',  fr: 'Langues parlées', ht: 'Lang yo pale' },
  deplacement:    { type: 'bool',   fr: 'Se déplace chez le client', ht: 'Deplase kay kliyan an' },
  zonesIntervention: { type: 'liste', fr: 'Zones d\'intervention', ht: 'Zòn entèvansyon' },
  delaiRapport:   { type: 'texte',  fr: 'Délai de remise du rapport', ht: 'Delè pou bay rapò a' },

  // Éducation
  niveaux:        { type: 'liste',  fr: 'Niveaux enseignés', ht: 'Nivo yo anseye' },
  facultes:       { type: 'liste',  fr: 'Facultés', ht: 'Fakilte' },
  diplomes:       { type: 'liste',  fr: 'Diplômes délivrés', ht: 'Diplòm yo bay' },
  anneeScolaire:  { type: 'texte',  fr: 'Année scolaire en cours', ht: 'Ane eskolè aktyèl', aide: { fr: 'Ex : 2026-2027', ht: 'Egz : 2026-2027' } },
  cantine:        { type: 'bool',   fr: 'Cantine', ht: 'Kantin' },
  transport:      { type: 'bool',   fr: 'Transport scolaire', ht: 'Transpò lekòl' },
  uniforme:       { type: 'bool',   fr: 'Uniforme obligatoire', ht: 'Inifòm obligatwa' },
  languesEnseignement: { type: 'liste', fr: 'Langues d\'enseignement', ht: 'Lang ansèyman' },
  dureeFormation: { type: 'texte',  fr: 'Durée des formations', ht: 'Dire fòmasyon yo' },
  certification:  { type: 'bool',   fr: 'Certificat délivré', ht: 'Sètifika bay' },
  stage:          { type: 'bool',   fr: 'Stage en entreprise', ht: 'Estaj nan antrepriz' },
  coursEnLigne:   { type: 'bool',   fr: 'Cours en ligne', ht: 'Kou an liy' },
  campus:         { type: 'liste',  fr: 'Campus', ht: 'Kanpis' },

  // Commerce
  livraison:      { type: 'bool',   fr: 'Livraison à domicile', ht: 'Livrezon lakay' },
  retraitMagasin: { type: 'bool',   fr: 'Retrait en magasin', ht: 'Pran nan magazen' },
  horaireEtendu:  { type: 'bool',   fr: 'Ouvert tard le soir', ht: 'Louvri ta nan aswè' },
  transfertArgent:{ type: 'bool',   fr: 'Transfert d\'argent', ht: 'Transfè lajan' },
  garantie:       { type: 'texte',  fr: 'Garantie proposée', ht: 'Garanti yo bay' },

  // Hôtellerie
  checkin:        { type: 'heure',  fr: 'Heure d\'arrivée', ht: 'Lè pou rive' },
  checkout:       { type: 'heure',  fr: 'Heure de départ', ht: 'Lè pou ale' },
  emporter:       { type: 'bool',   fr: 'Vente à emporter', ht: 'Vann pou pote ale' },
  terrasse:       { type: 'bool',   fr: 'Terrasse', ht: 'Teras' },
  musiqueLive:    { type: 'bool',   fr: 'Musique live', ht: 'Mizik an dirèk' },
  nbCouverts:     { type: 'nombre', fr: 'Nombre de couverts', ht: 'Kantite plas' },

  // Divers
  domicile:       { type: 'bool',   fr: 'Prestation à domicile', ht: 'Sèvis lakay kliyan' },
  fileAttente:    { type: 'bool',   fr: 'Accepte sans rendez-vous', ht: 'Aksepte san randevou' },
  depannage:      { type: 'bool',   fr: 'Dépannage d\'urgence', ht: 'Depanaj ijans' },
  marques:        { type: 'liste',  fr: 'Marques traitées', ht: 'Mak yo travay' },
  formule:        { type: 'interne', fr: 'Formule d\'hébergement', ht: 'Fòmil ebèjman' }
};


/* ----------------------------------------------------------
   Module dossiers : étapes et pièces attendues par métier.
   Chaque profession suit son propre parcours.
   ---------------------------------------------------------- */
const ETAPES_DOSSIER = {
  notaire: [
    { cle: 'ouverture',   fr: 'Dossier ouvert',          ht: 'Dosye louvri' },
    { cle: 'pieces',      fr: 'Réunion des pièces',      ht: 'Rasanble papye yo' },
    { cle: 'verification',fr: 'Vérification des titres', ht: 'Verifikasyon tit yo' },
    { cle: 'redaction',   fr: 'Rédaction de l\'acte',     ht: 'Redaksyon ak la' },
    { cle: 'signature',   fr: 'Signature des parties',   ht: 'Siyati pati yo' },
    { cle: 'enregistrement', fr: 'Enregistrement',       ht: 'Anrejistreman' },
    { cle: 'remise',      fr: 'Remise au client',        ht: 'Remèt bay kliyan an' }
  ],
  arpenteur: [
    { cle: 'ouverture',   fr: 'Demande reçue',           ht: 'Demann resevwa' },
    { cle: 'pieces',      fr: 'Documents du terrain',    ht: 'Dokiman tè a' },
    { cle: 'reconnaissance', fr: 'Reconnaissance du site', ht: 'Rekonesans teren an' },
    { cle: 'leve',        fr: 'Levé topographique',      ht: 'Leve topografik' },
    { cle: 'bornage',     fr: 'Bornage et piquetage',    ht: 'Bònaj ak pikèt' },
    { cle: 'plan',        fr: 'Établissement du plan',   ht: 'Fè plan an' },
    { cle: 'remise',      fr: 'Remise du rapport',       ht: 'Remèt rapò a' }
  ],
  avocat: [
    { cle: 'ouverture',   fr: 'Dossier ouvert',          ht: 'Dosye louvri' },
    { cle: 'pieces',      fr: 'Collecte des pièces',     ht: 'Rasanble prèv yo' },
    { cle: 'analyse',     fr: 'Analyse juridique',       ht: 'Analiz jiridik' },
    { cle: 'procedure',   fr: 'Procédure engagée',       ht: 'Pwosedi angaje' },
    { cle: 'audience',    fr: 'Audience',                ht: 'Odyans' },
    { cle: 'decision',    fr: 'Décision rendue',         ht: 'Desizyon rann' },
    { cle: 'cloture',     fr: 'Dossier clos',            ht: 'Dosye fèmen' }
  ],
  comptable: [
    { cle: 'ouverture',   fr: 'Dossier ouvert',          ht: 'Dosye louvri' },
    { cle: 'pieces',      fr: 'Réception des pièces',    ht: 'Resepsyon papye yo' },
    { cle: 'saisie',      fr: 'Saisie comptable',        ht: 'Sezi kontab' },
    { cle: 'controle',    fr: 'Contrôle et rapprochement', ht: 'Kontwòl ak rapwochman' },
    { cle: 'etats',       fr: 'États financiers',        ht: 'Eta finansye' },
    { cle: 'depot',       fr: 'Dépôt aux impôts',        ht: 'Depoze nan enpo' },
    { cle: 'remise',      fr: 'Remise au client',        ht: 'Remèt bay kliyan an' }
  ]
};

// Pièces couramment demandées, proposées à la création d'un dossier
const PIECES_DOSSIER = {
  notaire:   ['Titre de propriété', 'Pièce d\'identité', 'Plan d\'arpentage', 'Quittance de taxe', 'Acte de mariage'],
  arpenteur: ['Titre de propriété', 'Pièce d\'identité', 'Ancien plan', 'Acte de vente', 'Attestation de voisinage'],
  avocat:    ['Pièce d\'identité', 'Contrat', 'Correspondances', 'Preuves', 'Décision antérieure'],
  comptable: ['Registre des ventes', 'Factures d\'achat', 'Relevés bancaires', 'Fiches de paie', 'Patente']
};

const STATUTS_DOSSIER = [
  { cle: 'ouvert',    fr: 'Ouvert',              ht: 'Louvri',        badge: 'badge-bleu' },
  { cle: 'en_cours',  fr: 'En cours',            ht: 'An kou',        badge: 'badge-orange' },
  { cle: 'attente',   fr: 'En attente de pièces', ht: 'Ap tann papye', badge: 'badge-gris' },
  { cle: 'pret',      fr: 'Prêt',                ht: 'Pare',          badge: 'badge-violet' },
  { cle: 'clos',      fr: 'Clos',                ht: 'Fèmen',         badge: 'badge-vert' },
  { cle: 'annule',    fr: 'Annulé',              ht: 'Anile',         badge: 'badge-rouge' }
];

/** Étapes du métier, avec repli générique. */
function etapesDe(metierCle) {
  return ETAPES_DOSSIER[metierCle] || [
    { cle: 'ouverture', fr: 'Dossier ouvert', ht: 'Dosye louvri' },
    { cle: 'en_cours',  fr: 'En cours',       ht: 'An kou' },
    { cle: 'remise',    fr: 'Terminé',        ht: 'Fini' }
  ];
}


/* ----------------------------------------------------------
   Module urgences.
   Objectif : permettre au public de joindre l'établissement
   immédiatement. Ce module ne fait aucun tri médical et ne
   remplace jamais un appel aux secours.
   ---------------------------------------------------------- */
const CAPACITES_URGENCE = {
  reanimation:  { fr: 'Réanimation',              ht: 'Reyanimasyon',        ico: '🫀' },
  chirurgie:    { fr: 'Chirurgie d\'urgence',      ht: 'Chiriji ijans',       ico: '🔪' },
  maternite:    { fr: 'Maternité et accouchement', ht: 'Matènite ak akouchman', ico: '👶' },
  pediatrie:    { fr: 'Pédiatrie',                ht: 'Pedyatri',            ico: '🧒' },
  traumatologie:{ fr: 'Traumatologie',            ht: 'Twomatoloji',         ico: '🦴' },
  radiologie:   { fr: 'Radiologie',               ht: 'Radyoloji',           ico: '📷' },
  laboratoire:  { fr: 'Laboratoire d\'urgence',    ht: 'Laboratwa ijans',     ico: '🔬' },
  sang:         { fr: 'Banque de sang',           ht: 'Bank san',            ico: '🩸' },
  oxygene:      { fr: 'Oxygène',                  ht: 'Oksijèn',             ico: '💨' },
  dialyse:      { fr: 'Dialyse',                  ht: 'Dyaliz',              ico: '💧' },
  brulures:     { fr: 'Brûlures',                 ht: 'Boule',               ico: '🔥' },
  morsures:     { fr: 'Morsures et intoxications', ht: 'Mòde ak entoksikasyon', ico: '🐍' }
};

// État déclaré par l'établissement, mis à jour manuellement
const ETATS_URGENCE = [
  { cle: 'ouvert',   fr: 'Ouvert — accueil normal', ht: 'Louvri — akèy nòmal',    badge: 'badge-vert',   ico: '🟢' },
  { cle: 'charge',   fr: 'Forte affluence',          ht: 'Anpil moun',             badge: 'badge-orange', ico: '🟠' },
  { cle: 'sature',   fr: 'Saturé — orientez-vous ailleurs', ht: 'Konplè — ale yon lòt kote', badge: 'badge-rouge', ico: '🔴' },
  { cle: 'ferme',    fr: 'Fermé temporairement',     ht: 'Fèmen pou kounye a',     badge: 'badge-gris',   ico: '⚫' }
];

const CLES_CAPACITES = Object.keys(CAPACITES_URGENCE);
function nettoyerCapacites(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((k) => CLES_CAPACITES.includes(k)))];
}


/* ----------------------------------------------------------
   Module catalogue : rayons proposés selon le métier.
   L'entreprise reste libre de saisir ses propres rayons.
   ---------------------------------------------------------- */
const RAYONS_CATALOGUE = {
  boutique:   ['Boissons', 'Épicerie', 'Hygiène', 'Entretien', 'Téléphonie', 'Divers'],
  magasin:    ['Électroménager', 'Électronique', 'Meubles', 'Quincaillerie', 'Divers'],
  supermarche:['Fruits et légumes', 'Viandes et poissons', 'Produits laitiers', 'Épicerie', 'Boissons', 'Hygiène', 'Entretien', 'Surgelés'],
  pharmacie:  ['Hygiène et soins', 'Bébé et maternité', 'Vitamines et compléments', 'Matériel médical', 'Parapharmacie'],
  garage:     ['Huiles et lubrifiants', 'Filtres', 'Freinage', 'Batteries', 'Pneus', 'Accessoires'],
  'salon-beaute':   ['Soins visage', 'Soins corps', 'Ongles', 'Maquillage', 'Accessoires'],
  'coiffure-homme': ['Soins cheveux', 'Barbe', 'Coiffants', 'Accessoires'],
  'coiffure-femme': ['Soins cheveux', 'Coloration', 'Extensions et tissages', 'Coiffants', 'Accessoires'],
  'coiffure-mixte': ['Soins cheveux', 'Coloration', 'Barbe', 'Coiffants', 'Accessoires'],
  spa:        ['Huiles et massages', 'Soins corps', 'Bien-être', 'Accessoires']
};
function rayonsDe(metierCle) { return RAYONS_CATALOGUE[metierCle] || ['Général']; }

/* ----------------------------------------------------------
   Familles : icône et présentation.
   La page des catégories affichait jusqu'ici ses propres icônes
   et ses propres textes, en dur. Une famille créée par
   l'administration n'aurait donc eu ni l'un ni l'autre : elle
   les déclare ici, et la page lit ce référentiel.
   ---------------------------------------------------------- */
const FAMILLES_INFO = {
  'Santé':      { ico: '🩺', desc: { fr: 'Cliniques, cabinets, laboratoires et pharmacies, avec les services d\'urgence.', ht: 'Klinik, kabinè, laboratwa ak famasi, ak sèvis ijans.' } },
  'Beauté':     { ico: '💇', desc: { fr: 'Salons de coiffure, instituts de beauté, spas et barbiers.', ht: 'Salon kwafi, enstiti bote, espa ak babye.' } },
  'Formation':  { ico: '🎓', desc: { fr: 'Écoles, universités, centres professionnels et cours particuliers.', ht: 'Lekòl, inivèsite, sant pwofesyonèl ak kou patikilye.' } },
  'Auto':       { ico: '🚗', desc: { fr: 'Garages, lavage, pièces détachées et transport.', ht: 'Garaj, lavaj, pyès ak transpò.' } },
  'Maison':     { ico: '🏠', desc: { fr: 'Artisans, électriciens, plomberie, nettoyage et entretien.', ht: 'Atizan, elektrisyen, plonbri, netwayaj ak antretyen.' } },
  'Hôtellerie': { ico: '🏨', desc: { fr: 'Hôtels, auberges, restaurants et bars, avec réservation en ligne.', ht: 'Otèl, ojèj, restoran ak ba, ak rezèvasyon an liy.' } },
  'Commerce':   { ico: '🛍️', desc: { fr: 'Boutiques, magasins et supermarchés, avec achat et livraison.', ht: 'Boutik, magazen ak makèt, ak acha epi livrezon.' } },
  'Juridique':  { ico: '⚖️', desc: { fr: 'Notaires, avocats, arpenteurs et comptables, avec suivi de dossier.', ht: 'Notè, avoka, apantè ak kontab, ak swivi dosye.' } },
  'Autre':      { ico: '✨', desc: { fr: 'Toutes les autres activités de la plateforme.', ht: 'Tout lòt aktivite yo sou platfòm nan.' } }
};

const CLES_METIERS = Object.keys(METIERS);
const FAMILLES = [...new Set(Object.values(METIERS).map((m) => m.famille))];

/* ==========================================================
   Activités ajoutées par l'administration
   ----------------------------------------------------------
   Le registre ci-dessus reste la base livrée avec la
   plateforme. L'administration peut l'étendre : une nouvelle
   famille (une catégorie affichée au public) ou un nouveau
   métier rattaché à une famille existante ou nouvelle.

   Ces ajouts vivent en base, pas dans le code. Au démarrage et
   après chaque modification, `appliquer()` les réinjecte dans
   les mêmes objets — METIERS, FAMILLES, FAMILLES_INFO,
   CLES_METIERS, RAYONS_CATALOGUE. Ils sont modifiés sur place,
   jamais remplacés : tout le serveur tient déjà une référence
   vers eux, et un remplacement aurait laissé la moitié du code
   sur l'ancienne version sans rien signaler.

   Les entrées livrées avec la plateforme ne sont ni modifiées
   ni supprimées par cette mécanique : un métier d'origine garde
   ses modules et son vocabulaire, et le code qui s'appuie
   dessus (modèles de reçu, étapes de dossier, garde ÉDUCA RH)
   reste vrai.
   ========================================================== */

const CLES_BASE = Object.keys(METIERS);
const FAMILLES_BASE = [...FAMILLES];
const RAYONS_BASE = Object.keys(RAYONS_CATALOGUE);

/** Identifiant technique tiré d'un libellé : « Photo Studio » → « photo-studio ». */
function slug(v) {
  return String(v || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

const texte = (v, max) => String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
const listeTexte = (v, n, max) => {
  const arr = Array.isArray(v) ? v : String(v || '').split(',');
  return [...new Set(arr.map((x) => texte(x, max)).filter(Boolean))].slice(0, n);
};
/* Une icône est un caractère affiché, pas un texte : on la borne court.
   Les emoji composés (famille, drapeaux, métiers genrés) tiennent en
   plusieurs points de code, d'où une limite généreuse plutôt que 1. */
const icone = (v, repli) => texte(v, 12) || repli;

/** Paire fr/ht, le créole retombant sur le français s'il manque. */
function bilingue(v, max, repli) {
  if (typeof v === 'string') { const t = texte(v, max) || repli; return { fr: t, ht: t }; }
  const fr = texte(v && v.fr, max) || repli;
  return { fr, ht: texte(v && v.ht, max) || fr };
}

/** Famille proposée par l'administration, ramenée à ce qui est publiable. */
function nettoyerFamille(corps) {
  const nom = texte(corps && corps.nom, 40);
  if (!nom) return null;
  return {
    nom,
    ico: icone(corps.ico, '✨'),
    desc: bilingue(corps.desc, 200, ''),
    creeLe: texte(corps.creeLe, 30) || new Date().toISOString()
  };
}

const CLES_CHAMPS_PUBLICS = Object.keys(CHAMPS).filter((c) => CHAMPS[c].type !== 'interne');

/** Métier proposé par l'administration, ramené à ce qui est utilisable. */
function nettoyerMetier(corps) {
  const nomFr = texte(corps && corps.nom && (corps.nom.fr !== undefined ? corps.nom.fr : corps.nom), 50);
  if (!nomFr) return null;
  const cle = slug(corps.cle || nomFr);
  if (!cle) return null;
  const mots = corps.mots || {};
  const out = {
    cle,
    nom: bilingue(corps.nom, 50, nomFr),
    ico: icone(corps.ico, '✨'),
    famille: texte(corps.famille, 40) || 'Autre',
    modules: (Array.isArray(corps.modules) ? corps.modules : []).filter((m) => MODULES.includes(m)),
    champs: (Array.isArray(corps.champs) ? corps.champs : []).filter((c) => CLES_CHAMPS_PUBLICS.includes(c)),
    exemples: listeTexte(corps.exemples, 12, 60),
    rayons: listeTexte(corps.rayons, 20, 40),
    mots: {
      service:   bilingue(mots.service,   30, 'Service'),
      servicePl: bilingue(mots.servicePl, 30, 'Services'),
      agent:     bilingue(mots.agent,     30, 'Membre'),
      agentPl:   bilingue(mots.agentPl,   30, 'Équipe'),
      rdv:       bilingue(mots.rdv,       30, 'Rendez-vous')
    },
    creeLe: texte(corps.creeLe, 30) || new Date().toISOString()
  };
  /* Le verbe du bouton public n'est posé que s'il est demandé : sans
     lui, actionDe() dit « Réserver », ce qui convient à la plupart.
     Le formulaire l'envoie à plat, l'entrée déjà enregistrée le porte
     dans son vocabulaire — cette fonction repasse sur les deux, et
     ignorer le second effaçait le verbe à chaque relecture de la base. */
  const brut = corps.action !== undefined ? corps.action : mots.action;
  const action = texte(brut && brut.fr !== undefined ? brut.fr : brut, 24);
  if (action) out.mots.action = bilingue(brut, 24, action);
  /* Un métier sans aucune fonction donnerait un espace de gestion vide.
     Le rendez-vous est le plus petit dénominateur commun. */
  if (!out.modules.length) out.modules = ['rdv'];
  return out;
}

/**
 * Réinjecte les ajouts de l'administration dans le référentiel.
 * Appelée au démarrage, puis après chaque création, modification
 * ou suppression. Idempotente : elle repart toujours de la base
 * livrée, de sorte qu'une suppression retire bien ce qu'elle doit.
 */
function appliquer(source) {
  const famillesPerso = (source && Array.isArray(source.famillesPerso) ? source.famillesPerso : [])
    .map(nettoyerFamille).filter(Boolean);
  const metiersPerso = (source && Array.isArray(source.metiersPerso) ? source.metiersPerso : [])
    .map(nettoyerMetier).filter(Boolean);

  // Repartir de la base : retirer les ajouts de la passe précédente
  for (const cle of Object.keys(METIERS)) if (!CLES_BASE.includes(cle)) delete METIERS[cle];
  for (const cle of Object.keys(RAYONS_CATALOGUE)) if (!RAYONS_BASE.includes(cle)) delete RAYONS_CATALOGUE[cle];
  for (const nom of Object.keys(FAMILLES_INFO)) if (!FAMILLES_BASE.includes(nom)) delete FAMILLES_INFO[nom];

  for (const f of famillesPerso) {
    if (FAMILLES_BASE.includes(f.nom)) continue;   // une famille d'origine garde sa présentation
    FAMILLES_INFO[f.nom] = { ico: f.ico, desc: f.desc, perso: true };
  }
  for (const m of metiersPerso) {
    if (CLES_BASE.includes(m.cle)) continue;       // un métier d'origine n'est pas écrasé
    METIERS[m.cle] = {
      nom: m.nom, ico: m.ico, famille: m.famille,
      mots: m.mots, modules: m.modules, champs: m.champs,
      exemples: m.exemples, perso: true
    };
    if (m.rayons.length) RAYONS_CATALOGUE[m.cle] = m.rayons;
  }

  // Les tableaux exportés sont partagés : on les remplit sur place
  CLES_METIERS.length = 0;
  CLES_METIERS.push(...Object.keys(METIERS));
  FAMILLES.length = 0;
  FAMILLES.push(...new Set([
    ...FAMILLES_BASE,
    ...famillesPerso.map((f) => f.nom),
    /* Un métier peut nommer une famille qui n'a pas de fiche à elle :
       elle reste affichable, avec l'icône et la description par défaut. */
    ...Object.values(METIERS).map((m) => m.famille)
  ]));
  for (const nom of FAMILLES) if (!FAMILLES_INFO[nom]) FAMILLES_INFO[nom] = { ico: '✨', desc: { fr: '', ht: '' }, perso: true };
  return { familles: famillesPerso.length, metiers: metiersPerso.length };
}

/** Vrai pour une entrée ajoutée par l'administration, donc modifiable. */
function familleDeBase(nom) { return FAMILLES_BASE.includes(nom); }
function metierDeBase(cle) { return CLES_BASE.includes(cle); }

/** Verbe affiché sur les cartes publiques : Acheter, Commander, Réserver… */
function actionDe(e, langue) {
  const m = metierDe(e);
  const a = m.mots.action;
  if (a) return langue === 'ht' ? a.ht : a.fr;
  return langue === 'ht' ? 'Rezève' : 'Réserver';
}

/** Métier d'une entreprise, avec repli sûr. */
function metierDe(e) {
  return METIERS[e && e.metier] || METIERS['autre'];
}
/**
 * Le module est-il disponible pour cette entreprise ?
 *
 * Le métier seul décide. L'entreprise ne coche plus ses fonctions une
 * à une : un salon qui décochait « Rendez-vous » se retrouvait avec un
 * espace vide et une page publique sans bouton de réservation, sans
 * comprendre pourquoi. Le métier déclaré à l'inscription suffit — pour
 * changer ce qu'elle voit, l'entreprise change de métier.
 *
 * Les anciens réglages (modulesOn / modulesOff) restent en base mais
 * ne sont plus lus : les entreprises concernées retrouvent
 * simplement l'ensemble des fonctions de leur métier.
 */
function aModule(e, mod) {
  if (!e) return false;
  return metierDe(e).modules.includes(mod);
}
/** Modules réellement actifs, dans l'ordre du référentiel. */
function modulesActifs(e) {
  return MODULES.filter((m) => aModule(e, m));
}
/** Ne conserve que les champs déclarés par le métier, typés correctement. */
function nettoyerChamps(metierCle, valeurs) {
  const m = METIERS[metierCle] || METIERS['autre'];
  const sortie = {};
  if (!valeurs || typeof valeurs !== 'object') return sortie;
  for (const cle of m.champs) {
    const def = CHAMPS[cle];
    if (!def || def.type === 'interne' || valeurs[cle] === undefined) continue;
    const v = valeurs[cle];
    if (def.type === 'bool') sortie[cle] = !!v;
    else if (def.type === 'nombre') { const n = +v; if (Number.isFinite(n) && n >= 0) sortie[cle] = Math.min(n, 100000); }
    else if (def.type === 'liste') {
      const arr = Array.isArray(v) ? v : String(v).split(',');
      sortie[cle] = arr.map((x) => String(x).trim()).filter(Boolean).slice(0, 30).map((x) => x.slice(0, 60));
    } else sortie[cle] = String(v).slice(0, 120);
  }
  return sortie;
}
/** Référentiel envoyé au navigateur (sans logique serveur). */
function referentiel() {
  return { METIERS, CHAMPS, FAMILLES, FAMILLES_INFO, ETAPES_DOSSIER, PIECES_DOSSIER, STATUTS_DOSSIER, CAPACITES_URGENCE, ETATS_URGENCE, RAYONS_CATALOGUE };
}

module.exports = { METIERS, CHAMPS, MODULES, CLES_METIERS, FAMILLES, FAMILLES_INFO,
  ETAPES_DOSSIER, PIECES_DOSSIER, STATUTS_DOSSIER,
  CAPACITES_URGENCE, ETATS_URGENCE, nettoyerCapacites, RAYONS_CATALOGUE, rayonsDe,
  metierDe, actionDe, aModule, modulesActifs, nettoyerChamps, etapesDe, referentiel,
  slug, appliquer, nettoyerFamille, nettoyerMetier, familleDeBase, metierDeBase,
  CLES_BASE, FAMILLES_BASE };
