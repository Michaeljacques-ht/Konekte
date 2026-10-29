// Konekte — utilitaires partagés
async function api(url, methode = 'GET', corps) {
  const r = await fetch(url, {
    method: methode,
    headers: { 'Content-Type': 'application/json' },
    body: corps ? JSON.stringify(corps) : undefined
  });
  const data = await r.json().catch(() => ({}));
  /* L'erreur transporte aussi la réponse complète : certains refus portent des
     indications utiles — un compte à activer, par exemple — que le seul
     message ferait perdre. */
  if (!r.ok) {
    const err = new Error(data.erreur || 'Erreur serveur');
    err.statut = r.status;
    err.details = data;
    throw err;
  }
  return data;
}

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('visible'), 3200);
}

function ech(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function etoiles(n) {
  const p = Math.round(n);
  return '★'.repeat(p) + '☆'.repeat(5 - p);
}

const MOIS_FR = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const JOURS_FR = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

function dateFR(iso) {
  const d = new Date(iso + 'T12:00:00');
  return `${JOURS_FR[d.getDay()]} ${d.getDate()} ${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function htg(n) { return Number(n).toLocaleString('fr-FR') + ' HTG'; }

const BADGE_STATUT = {
  en_attente: '<span class="badge badge-orange">En attente</span>',
  confirme: '<span class="badge badge-vert">Confirmé</span>',
  annule: '<span class="badge badge-rouge">Annulé</span>',
  termine: '<span class="badge badge-gris">Terminé</span>'
};

const ICONES_CAT = { 'Santé': '🩺', 'Beauté': '💇', 'Formation': '🎓', 'Auto': '🚗', 'Maison': '🏠', 'Restaurant': '🍽️', 'Hôtels & Restaurants': '🏨', 'Juridique': '⚖️', 'Autre': '✨' };

const MOIS_HT = ['janvye','fevriye','mas','avril','me','jen','jiyè','out','septanm','oktòb','novanm','desanm'];

/* Date courte pour les étiquettes : « 12 mars ». L'année n'apparaît que
   si ce n'est pas l'année en cours. */
function dateCourte(iso, langue) {
  if (!iso) return '';
  const d = new Date(String(iso) + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '';
  const mois = (langue === 'ht' ? MOIS_HT : MOIS_FR)[d.getMonth()];
  const annee = d.getFullYear() === new Date().getFullYear() ? '' : ' ' + d.getFullYear();
  return `${d.getDate()} ${mois}${annee}`;
}

// ===== PWA (Play Store) : manifest + service worker =====
(function () {
  // Lien manifest + couleur de thème + icône iOS injectés sur toutes les pages
  const l = document.createElement('link');
  l.rel = 'manifest'; l.href = '/manifest.json';
  document.head.appendChild(l);
  const t = document.createElement('meta');
  t.name = 'theme-color'; t.content = '#2563EB';
  document.head.appendChild(t);
  const a = document.createElement('link');
  a.rel = 'apple-touch-icon'; a.href = '/icone-192.png';
  document.head.appendChild(a);
  const f = document.createElement('link');
  f.rel = 'icon'; f.type = 'image/png'; f.href = '/icone-192.png';
  document.head.appendChild(f);
  // Enregistrement du service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
})();

// Mesure de fréquentation : une seule fois par page chargée
(function mesurer(){
  try {
    const installee = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    fetch('/api/visite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Le consentement décide si un cookie de mesure est posé
        consentement: localStorage.getItem('bkConsent') === 'oui' ? true
                    : (localStorage.getItem('bkConsent') === 'non' ? false : null),
        chemin: location.pathname,
        referer: document.referrer || '',
        langue: navigator.language || '',
        fuseau: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        installee
      }),
      keepalive: true
    }).catch(() => {});
  } catch { /* sans conséquence pour la navigation */ }
})();

// Menu de navigation sur mobile
function basculerMenu(btn){
  const liens = document.querySelector('.nav-liens');
  if (!liens) return;
  const ouvert = liens.classList.toggle('ouvert');
  if (btn) { btn.textContent = ouvert ? '✕' : '☰'; btn.setAttribute('aria-expanded', ouvert); }
}
// Refermer après un clic sur un lien, sinon le panneau masque la page
document.addEventListener('click', (ev) => {
  const a = ev.target.closest('.nav-liens a');
  if (!a) return;
  const liens = document.querySelector('.nav-liens');
  const btn = document.querySelector('.burger');
  if (liens) liens.classList.remove('ouvert');
  if (btn) { btn.textContent = '☰'; btn.setAttribute('aria-expanded', 'false'); }
});

/* ---- Bandeau de consentement aux cookies ----
   Le cookie de mesure n'est posé qu'après un choix explicite.
   Tant que rien n'est décidé, la visite est comptée sans cookie. */
function consentementCookies(){
  if (localStorage.getItem('bkConsent')) return;
  document.addEventListener('DOMContentLoaded', () => {
    const lg = localStorage.getItem('langue') || 'fr';
    const b = document.createElement('div');
    b.className = 'bandeau-cookies';
    b.innerHTML = `
      <div class="bc-txt">
        <strong>${lg==='ht' ? 'Nou itilize yon ti cookie' : 'Nous utilisons un petit cookie'}</strong>
        <span>${lg==='ht'
          ? "Sèlman pou konte vizit yo epi amelyore sit la. Pa gen piblisite, pa gen pataj ak lòt moun."
          : "Uniquement pour compter les visites et améliorer le site. Aucune publicité, aucun partage avec des tiers."}
          <a href="/confidentialite.html">${lg==='ht' ? 'Konnen plis' : 'En savoir plus'}</a></span>
      </div>
      <div class="bc-btns">
        <button class="btn btn-contour btn-petit" id="bcRefus">${lg==='ht' ? 'Refize' : 'Refuser'}</button>
        <button class="btn btn-primaire btn-petit" id="bcOui">${lg==='ht' ? 'Aksepte' : 'Accepter'}</button>
      </div>`;
    document.body.appendChild(b);
    const repondre = (choix) => {
      localStorage.setItem('bkConsent', choix);
      b.remove();
      // On informe le serveur du choix, pour poser ou effacer le cookie
      fetch('/api/visite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentement: choix === 'oui', chemin: location.pathname,
          langue: navigator.language || '', fuseau: Intl.DateTimeFormat().resolvedOptions().timeZone || '' })
      }).catch(() => {});
    };
    b.querySelector('#bcOui').onclick = () => repondre('oui');
    b.querySelector('#bcRefus').onclick = () => repondre('non');
  });
}
consentementCookies();

/* Invitation à installer l'application.
   Sur Android, le navigateur propose lui-même l'installation : on capte
   l'événement pour l'offrir au bon moment. Sur iPhone, aucune interface
   n'existe — il faut décrire le geste. */
let invitationInstall = null;
window.addEventListener('beforeinstallprompt', (ev) => {
  ev.preventDefault();
  invitationInstall = ev;
  const b = document.getElementById('barreInstall');
  if (b && !localStorage.getItem('installRefuse')) b.style.display = '';
});

function estInstallee(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function estIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}
async function installerApp(){
  if (invitationInstall) {
    invitationInstall.prompt();
    const choix = await invitationInstall.userChoice;
    invitationInstall = null;
    if (choix.outcome === 'accepted') fermerInstall();
    return;
  }
  // iPhone : on montre la marche à suivre
  const lg = localStorage.getItem('langue') || 'fr';
  alert(lg === 'ht'
    ? "Pou enstale sou iPhone :\n\n1. Touche bouton Pataje a (yon kare ak yon flèch anlè)\n2. Desann epi chwazi « Sou ekran dakèy »\n3. Touche « Ajoute »"
    : "Pour installer sur iPhone :\n\n1. Touchez le bouton Partager (un carré avec une flèche vers le haut)\n2. Faites défiler et choisissez « Sur l'écran d'accueil »\n3. Touchez « Ajouter »");
}
function fermerInstall(){
  const b = document.getElementById('barreInstall');
  if (b) b.style.display = 'none';
  localStorage.setItem('installRefuse', '1');
}
// Sur iPhone, aucun événement n'est émis : on affiche l'invitation nous-mêmes
document.addEventListener('DOMContentLoaded', () => {
  const b = document.getElementById('barreInstall');
  if (b && estIOS() && !estInstallee() && !localStorage.getItem('installRefuse')) b.style.display = '';
});

// 🌐 Gestion des langues (sans effet si translations.js n'est pas chargé)
function basculerLangue() {
  if (typeof changerLangue !== 'function') return;
  const langueActuelle = localStorage.getItem('langue') || 'fr';
  changerLangue(langueActuelle === 'fr' ? 'ht' : 'fr');
}

// Mettre à jour le texte du bouton langue
window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnLangue');
  if (!btn) return;
  const langue = localStorage.getItem('langue') || 'fr';
  btn.textContent = langue === 'fr' ? '🌐 HT' : '🌐 FR';
});
