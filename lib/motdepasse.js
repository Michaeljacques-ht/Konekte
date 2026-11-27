/* ============================================================
   Konekte — Mots de passe
   ------------------------------------------------------------
   Hachage par scrypt, fourni par Node lui-même : aucune
   dépendance à installer, fidèle au principe du projet.

   Un mot de passe n'est jamais conservé en clair. Ce qui est
   enregistré ressemble à :

     scrypt$16384$8$1$<sel en hexadécimal>$<empreinte>

   Le sel est tiré au hasard pour chaque compte : deux personnes
   ayant le même mot de passe n'ont pas la même empreinte, et une
   table pré-calculée ne sert à rien.

   Les comptes créés avant cette version portent encore leur mot
   de passe en clair. `verifier` les accepte, et `doitEtreMigre`
   indique au serveur de les ré-enregistrer hachés dès leur
   première connexion réussie — personne n'est déconnecté.
   ============================================================ */

const crypto = require('crypto');

/* Coût du calcul. 16384 demande environ 16 Mo et quelques
   dizaines de millisecondes : assez lent pour décourager une
   attaque par dictionnaire, assez rapide pour une connexion. */
const N = 16384;
const R = 8;
const P = 1;
const LONGUEUR = 32;
const PREFIXE = 'scrypt$';

function estHache(valeur) {
  return typeof valeur === 'string' && valeur.startsWith(PREFIXE);
}

function assembler(sel, cle) {
  return `${PREFIXE}${N}$${R}$${P}$${sel.toString('hex')}$${cle.toString('hex')}`;
}

/* Version synchrone, pour les deux moments où le serveur n'est pas
   encore en train de répondre à quelqu'un : la création de la base
   et la porte de secours administrateur au démarrage. */
function hacherSync(motdepasse) {
  const sel = crypto.randomBytes(16);
  const cle = crypto.scryptSync(String(motdepasse), sel, LONGUEUR, { N, r: R, p: P });
  return assembler(sel, cle);
}

/* Version asynchrone, pour les requêtes : scrypt est volontairement
   coûteux, et le calculer sans rendre la main figerait le serveur
   pour tous les autres visiteurs pendant ce temps. */
function hacher(motdepasse) {
  return new Promise((resoudre, rejeter) => {
    const sel = crypto.randomBytes(16);
    crypto.scrypt(String(motdepasse), sel, LONGUEUR, { N, r: R, p: P }, (err, cle) => {
      if (err) return rejeter(err);
      resoudre(assembler(sel, cle));
    });
  });
}

/* Comparaison à durée constante : un attaquant ne doit rien
   apprendre du temps que met la réponse à revenir. */
function memeContenu(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function verifier(motdepasse, enregistre) {
  return new Promise((resoudre) => {
    if (typeof enregistre !== 'string' || !enregistre) return resoudre(false);

    // Compte d'avant le hachage : le mot de passe est encore en clair.
    if (!estHache(enregistre)) return resoudre(memeContenu(String(motdepasse), enregistre));

    const parts = enregistre.split('$');
    if (parts.length !== 6) return resoudre(false);
    const [, sN, sR, sP, selHex, cleHex] = parts;
    let sel, attendue;
    try {
      sel = Buffer.from(selHex, 'hex');
      attendue = Buffer.from(cleHex, 'hex');
    } catch { return resoudre(false); }
    if (!sel.length || !attendue.length) return resoudre(false);

    crypto.scrypt(
      String(motdepasse), sel, attendue.length,
      { N: Number(sN) || N, r: Number(sR) || R, p: Number(sP) || P },
      (err, calculee) => {
        if (err) return resoudre(false);
        resoudre(calculee.length === attendue.length && crypto.timingSafeEqual(calculee, attendue));
      }
    );
  });
}

/* Vrai pour un mot de passe encore en clair : le serveur doit le
   remplacer par son empreinte après une connexion réussie. */
function doitEtreMigre(enregistre) {
  return typeof enregistre === 'string' && enregistre.length > 0 && !estHache(enregistre);
}

module.exports = { hacher, hacherSync, verifier, estHache, doitEtreMigre };
