/* ============================================================
   Konekte — Horaires d'ouverture
   ------------------------------------------------------------
   Sept jours, toujours, chacun avec `ouvert`, `debut` et `fin`.

   Une entreprise dont les horaires sont incomplets ferait planter
   sa propre page publique au moment de lire un jour manquant, et
   le calcul des créneaux ne saurait plus quoi proposer. Tout ce
   qui entre passe donc par ce filtre, et tout ce qui est relu
   aussi : une base déjà abîmée se répare d'elle-même.
   ============================================================ */

const JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

/* Plage de repli, quand un jour est absent ou illisible.

   Un jour manquant est déclaré FERMÉ, jamais ouvert. Le réflexe
   inverse serait pire : la plateforme prendrait des rendez-vous un
   jour que l'entreprise n'a pas déclaré, et le client trouverait
   porte close. Une journée fermée à tort se voit dans les
   Paramètres et se corrige en un clic ; un client devant un
   rideau baissé ne revient pas. */
const DEFAUT = {
  lun: '08:00-17:00', mar: '08:00-17:00', mer: '08:00-17:00',
  jeu: '08:00-17:00', ven: '08:00-17:00', sam: '09:00-14:00', dim: '09:00-13:00'
};

function heureValide(v, repli) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? String(v) : repli;
}

function normaliser(valeur) {
  const brut = (valeur && typeof valeur === 'object') ? valeur : {};
  const propres = {};
  for (const j of JOURS) {
    const [dd, df] = DEFAUT[j].split('-');
    const d = brut[j];
    if (!d || typeof d !== 'object') {
      propres[j] = { ouvert: false, debut: dd, fin: df };
      continue;
    }
    const debut = heureValide(d.debut, dd);
    let fin = heureValide(d.fin, df);
    // Une fin antérieure au début ne décrirait aucune plage exploitable
    if (fin <= debut) fin = df > debut ? df : '23:59';
    propres[j] = { ouvert: !!d.ouvert, debut, fin };
  }
  return propres;
}

/* Vrai si la valeur est déjà complète et bien formée : permet à la
   migration de ne réécrire que ce qui en a besoin. */
function estComplet(valeur) {
  if (!valeur || typeof valeur !== 'object') return false;
  return JOURS.every((j) => {
    const d = valeur[j];
    return d && typeof d === 'object'
      && typeof d.ouvert === 'boolean'
      && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(d.debut))
      && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(d.fin))
      && String(d.fin) > String(d.debut);
  });
}

module.exports = { JOURS, normaliser, estComplet };
