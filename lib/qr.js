'use strict';
/* ==========================================================
   Génération de codes QR — sans aucune dépendance
   ----------------------------------------------------------
   Encodage en mode octet (UTF-8), correction d'erreurs
   niveau M, versions 1 à 10. Suffisant pour une adresse web,
   qui dépasse rarement 150 caractères.

   Le résultat est un tableau de booléens (la matrice), que
   l'appelant transforme en SVG.
   ========================================================== */

// ---- Arithmétique dans le corps de Galois GF(256) ----
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(function tables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11D;   // polynôme générateur
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

/** Polynôme générateur pour n symboles de correction. */
function polyGenerateur(n) {
  let p = [1];
  for (let i = 0; i < n; i++) {
    const q = [1, EXP[i]];
    const r = new Array(p.length + 1).fill(0);
    for (let j = 0; j < p.length; j++) {
      r[j] ^= mul(p[j], q[0]);
      r[j + 1] ^= mul(p[j], q[1]);
    }
    p = r;
  }
  return p;
}

/** Symboles de correction d'erreurs d'un bloc de données. */
function correction(donnees, nbCorrection) {
  const gen = polyGenerateur(nbCorrection);
  const reste = new Array(nbCorrection).fill(0);
  for (const octet of donnees) {
    const facteur = octet ^ reste[0];
    reste.shift();
    reste.push(0);
    if (facteur !== 0) {
      for (let i = 0; i < nbCorrection; i++) reste[i] ^= mul(gen[i + 1], facteur);
    }
  }
  return reste;
}

/* ---- Tables de capacité, niveau M ----
   Pour chaque version : [octets de données, symboles de correction par bloc,
   nombre de blocs du groupe 1, nombre de blocs du groupe 2] */
const VERSIONS_M = {
  1:  [16,  10, 1, 0],
  2:  [28,  16, 1, 0],
  3:  [44,  26, 1, 0],
  4:  [64,  18, 2, 0],
  5:  [86,  24, 2, 0],
  6:  [108, 16, 4, 0],
  7:  [124, 18, 4, 0],
  8:  [154, 22, 2, 2],
  9:  [182, 22, 3, 2],
  10: [216, 26, 4, 1]
};
/* Contrôle de cohérence au chargement : le nombre total de codewords
   (données + correction) doit correspondre à la capacité du symbole.
   Une erreur ici produit un code illisible, sans message d'erreur. */
const CODEWORDS_TOTAL = { 1: 26, 2: 44, 3: 70, 4: 100, 5: 134, 6: 172, 7: 196, 8: 242, 9: 292, 10: 346 };
for (const [v, [donnees, ec, b1, b2]] of Object.entries(VERSIONS_M)) {
  const attendu = donnees + ec * (b1 + b2);
  if (attendu !== CODEWORDS_TOTAL[v]) {
    throw new Error(`Table QR incohérente en version ${v} : ${attendu} au lieu de ${CODEWORDS_TOTAL[v]}`);
  }
}
// Positions des motifs d'alignement, par version
const ALIGNEMENT = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
};

/** Plus petite version capable de contenir ces données. */
// Les versions 1 à 7 sont vérifiées par décodage ; au-delà, l'entrelacement
// à blocs inégaux n'est pas fiable, et une adresse web n'en a pas besoin.
const VERSION_MAX = 7;
function choisirVersion(nbOctets) {
  for (let v = 1; v <= VERSION_MAX; v++) {
    const [capacite] = VERSIONS_M[v];
    // 4 bits de mode + indicateur de longueur (8 bits jusqu'à v9, 16 ensuite)
    const bitsEntete = 4 + (v <= 9 ? 8 : 16);
    if (Math.floor((capacite * 8 - bitsEntete) / 8) >= nbOctets) return v;
  }
  return null;   // au-delà : raccourcir l'adresse
}

/** Suite de bits du message, avant correction d'erreurs. */
function bitsDonnees(octets, version) {
  const bits = [];
  const pousser = (valeur, longueur) => {
    for (let i = longueur - 1; i >= 0; i--) bits.push((valeur >> i) & 1);
  };
  pousser(0b0100, 4);                                  // mode octet
  pousser(octets.length, version <= 9 ? 8 : 16);       // longueur
  for (const o of octets) pousser(o, 8);

  const capaciteBits = VERSIONS_M[version][0] * 8;
  // Terminateur, puis alignement sur l'octet
  for (let i = 0; i < 4 && bits.length < capaciteBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  // Octets de remplissage alternés
  const remplissage = [0xEC, 0x11];
  let k = 0;
  while (bits.length < capaciteBits) {
    pousser(remplissage[k++ % 2], 8);
  }
  const octetsFinaux = [];
  for (let i = 0; i < bits.length; i += 8) {
    let o = 0;
    for (let j = 0; j < 8; j++) o = (o << 1) | bits[i + j];
    octetsFinaux.push(o);
  }
  return octetsFinaux;
}

/** Entrelacement des blocs de données et de correction. */
function messageComplet(octets, version) {
  const [total, nbCorr, blocs1, blocs2] = VERSIONS_M[version];
  const nbBlocs = blocs1 + blocs2;
  // Les blocs courts font tailleBase, les longs tailleBase + 1.
  // La division entière donne directement la taille des courts.
  const tailleBase = Math.floor(total / nbBlocs);
  const blocs = [];
  let pos = 0;
  for (let i = 0; i < nbBlocs; i++) {
    const taille = i < blocs1 ? tailleBase : tailleBase + 1;
    blocs.push(octets.slice(pos, pos + taille));
    pos += taille;
  }
  const corrections = blocs.map((b) => correction(b, nbCorr));

  const sortie = [];
  const maxTaille = Math.max(...blocs.map((b) => b.length));
  for (let i = 0; i < maxTaille; i++) {
    for (const b of blocs) if (i < b.length) sortie.push(b[i]);
  }
  for (let i = 0; i < nbCorr; i++) {
    for (const c of corrections) sortie.push(c[i]);
  }
  return sortie;
}

/** Matrice vide avec les motifs fixes déjà posés. */
function matriceBase(version) {
  const taille = version * 4 + 17;
  const m = Array.from({ length: taille }, () => new Array(taille).fill(null));

  const finder = (ligne, colonne) => {
    for (let i = -1; i <= 7; i++) {
      for (let j = -1; j <= 7; j++) {
        const l = ligne + i, c = colonne + j;
        if (l < 0 || l >= taille || c < 0 || c >= taille) continue;
        const dedans = (i >= 0 && i <= 6 && (j === 0 || j === 6)) ||
                       (j >= 0 && j <= 6 && (i === 0 || i === 6)) ||
                       (i >= 2 && i <= 4 && j >= 2 && j <= 4);
        m[l][c] = dedans;
      }
    }
  };
  finder(0, 0); finder(0, taille - 7); finder(taille - 7, 0);

  // Motifs d'alignement
  const pos = ALIGNEMENT[version];
  for (const l of pos) {
    for (const c of pos) {
      // Pas sur les détecteurs de position
      if ((l <= 8 && c <= 8) || (l <= 8 && c >= taille - 9) || (l >= taille - 9 && c <= 8)) continue;
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          m[l + i][c + j] = Math.max(Math.abs(i), Math.abs(j)) !== 1;
        }
      }
    }
  }
  // Motifs de synchronisation
  for (let i = 8; i < taille - 8; i++) {
    if (m[6][i] === null) m[6][i] = i % 2 === 0;
    if (m[i][6] === null) m[i][6] = i % 2 === 0;
  }
  m[taille - 8][8] = true;   // module toujours noir

  // À partir de la version 7, deux blocs 6×3 portent le numéro de version
  if (version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 3; j++) {
        if (m[i][taille - 11 + j] === null) m[i][taille - 11 + j] = false;
        if (m[taille - 11 + j][i] === null) m[taille - 11 + j][i] = false;
      }
    }
  }

  // Réservation des zones d'information de format
  for (let i = 0; i < 9; i++) {
    if (m[8][i] === null) m[8][i] = false;
    if (m[i][8] === null) m[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][taille - 1 - i] === null) m[8][taille - 1 - i] = false;
    if (m[taille - 1 - i][8] === null) m[taille - 1 - i][8] = false;
  }
  return m;
}

/** Cases réservées : celles déjà remplies dans la matrice de base. */
function matriceReservee(version) {
  const base = matriceBase(version);
  return base.map((ligne) => ligne.map((c) => c !== null));
}

const MASQUES = [
  (l, c) => (l + c) % 2 === 0,
  (l) => l % 2 === 0,
  (l, c) => c % 3 === 0,
  (l, c) => (l + c) % 3 === 0,
  (l, c) => (Math.floor(l / 2) + Math.floor(c / 3)) % 2 === 0,
  (l, c) => ((l * c) % 2) + ((l * c) % 3) === 0,
  (l, c) => ((((l * c) % 2) + ((l * c) % 3)) % 2) === 0,
  (l, c) => ((((l + c) % 2) + ((l * c) % 3)) % 2) === 0
];

/** Pose les bits du message en zigzag, en appliquant un masque. */
function poserDonnees(version, donnees, masque) {
  const m = matriceBase(version);
  const reserve = matriceReservee(version);
  const taille = m.length;
  const bits = [];
  for (const o of donnees) for (let i = 7; i >= 0; i--) bits.push((o >> i) & 1);

  let index = 0, montant = true;
  for (let colonne = taille - 1; colonne > 0; colonne -= 2) {
    if (colonne === 6) colonne--;   // on saute la colonne de synchronisation
    for (let n = 0; n < taille; n++) {
      const ligne = montant ? taille - 1 - n : n;
      for (let d = 0; d < 2; d++) {
        const c = colonne - d;
        if (reserve[ligne][c]) continue;
        let bit = index < bits.length ? bits[index++] : 0;
        if (MASQUES[masque](ligne, c)) bit ^= 1;
        m[ligne][c] = bit === 1;
      }
    }
    montant = !montant;
  }
  return m;
}

/** Information de format : niveau M et numéro de masque. */
function poserFormat(m, masque) {
  const taille = m.length;
  const donnees = (0b00 << 3) | masque;   // 00 = niveau M
  let reste = donnees << 10;
  for (let i = 4; i >= 0; i--) {
    if (reste & (1 << (i + 10))) reste ^= 0b10100110111 << i;
  }
  const bits = ((donnees << 10) | reste) ^ 0b101010000010010;

  // Le bit 0 est le plus significatif dans l'ordre de pose du format
  const bit = (i) => ((bits >> (14 - i)) & 1) === 1;

  // Première copie, autour du détecteur haut-gauche
  for (let i = 0; i <= 5; i++) m[8][i] = bit(i);
  m[8][7] = bit(6);
  m[8][8] = bit(7);
  m[7][8] = bit(8);
  for (let i = 9; i <= 14; i++) m[14 - i][8] = bit(i);

  // Seconde copie, répartie sous le détecteur haut-droit et à droite du bas-gauche
  for (let i = 0; i <= 7; i++) m[taille - 1 - i][8] = bit(i);
  for (let i = 8; i <= 14; i++) m[8][taille - 15 + i] = bit(i);
  m[taille - 8][8] = true;
  return m;
}

/** Information de version, obligatoire à partir de la version 7. */
function poserVersion(m, version) {
  if (version < 7) return m;
  const taille = m.length;
  let reste = version << 12;
  for (let i = 5; i >= 0; i--) {
    if (reste & (1 << (i + 12))) reste ^= 0b1111100100101 << i;
  }
  const bits = (version << 12) | reste;
  for (let i = 0; i < 18; i++) {
    const b = ((bits >> i) & 1) === 1;
    const ligne = Math.floor(i / 3);
    const colonne = i % 3;
    m[ligne][taille - 11 + colonne] = b;
    m[taille - 11 + colonne][ligne] = b;
  }
  return m;
}

/** Score de pénalité, pour choisir le masque le plus lisible. */
function penalite(m) {
  const n = m.length;
  let score = 0;
  // Suites de cinq modules identiques ou plus
  for (let i = 0; i < n; i++) {
    for (const parLigne of [true, false]) {
      let compte = 1;
      for (let j = 1; j < n; j++) {
        const a = parLigne ? m[i][j] : m[j][i];
        const b = parLigne ? m[i][j - 1] : m[j - 1][i];
        if (a === b) compte++;
        else { if (compte >= 5) score += 3 + (compte - 5); compte = 1; }
      }
      if (compte >= 5) score += 3 + (compte - 5);
    }
  }
  // Blocs 2×2 de même couleur
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      if (m[i][j] === m[i][j + 1] && m[i][j] === m[i + 1][j] && m[i][j] === m[i + 1][j + 1]) score += 3;
    }
  }
  // Proportion de noir
  let noirs = 0;
  for (const l of m) for (const c of l) if (c) noirs++;
  const pourcent = (noirs * 100) / (n * n);
  score += Math.floor(Math.abs(pourcent - 50) / 5) * 10;
  return score;
}

/** Matrice complète pour un texte donné. */
function matrice(texte) {
  const octets = Array.from(Buffer.from(String(texte), 'utf8'));
  const version = choisirVersion(octets.length);
  if (!version) throw new Error('Adresse trop longue pour un code QR (150 caractères maximum).');
  const donnees = messageComplet(bitsDonnees(octets, version), version);

  let meilleure = null, meilleurScore = Infinity;
  for (let masque = 0; masque < 8; masque++) {
    const m = poserVersion(poserFormat(poserDonnees(version, donnees, masque), masque), version);
    const s = penalite(m);
    if (s < meilleurScore) { meilleurScore = s; meilleure = m; }
  }
  return meilleure;
}

/** Rendu SVG, avec marge blanche obligatoire de 4 modules. */
function svg(texte, options) {
  const o = options || {};
  const m = matrice(texte);
  const n = m.length;
  const marge = 4;
  const total = n + marge * 2;
  const taille = o.taille || 320;
  const couleur = o.couleur || '#0B2C6B';

  let chemin = '';
  for (let l = 0; l < n; l++) {
    for (let c = 0; c < n; c++) {
      if (m[l][c]) chemin += `M${c + marge} ${l + marge}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">`
    + `<rect width="${total}" height="${total}" fill="#fff"/>`
    + `<path d="${chemin}" fill="${couleur}"/></svg>`;
}

module.exports = { matrice, svg };
