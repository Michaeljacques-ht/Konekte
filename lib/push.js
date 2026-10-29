'use strict';
/* ==========================================================
   Notifications poussées (Web Push)
   ----------------------------------------------------------
   Sans bibliothèque externe. Trois mécanismes normalisés :

   - VAPID (RFC 8292) : un jeton signé ES256 qui identifie le
     serveur auprès du service de notification.
   - Chiffrement aes128gcm (RFC 8291) : le contenu est chiffré
     pour l'appareil destinataire. Ni Google ni Apple ne peuvent
     le lire.
   - Envoi HTTPS vers l'adresse fournie par le navigateur.

   Le chiffrement est vérifié contre les vecteurs de test de la
   RFC 8291 : voir verifier() plus bas.
   ========================================================== */
const crypto = require('crypto');
const https = require('https');
const { URL } = require('url');

/** Base64 sans remplissage, variante URL (RFC 4648 §5). */
const b64 = (buf) => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deb64 = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/** Dérivation de clé HKDF (RFC 5869). */
function hkdf(sel, ikm, info, longueur) {
  const prk = crypto.createHmac('sha256', sel).update(ikm).digest();
  return crypto.createHmac('sha256', prk)
    .update(Buffer.concat([info, Buffer.from([1])])).digest().slice(0, longueur);
}

/** Point public non compressé d'une clé EC P-256. */
function pointPublic(ecdh) { return ecdh.getPublicKey(); }

/**
 * Chiffre une charge utile selon RFC 8291.
 * `cleClient` et `authClient` viennent de l'abonnement du navigateur.
 * `serveurECDH` et `sel` sont fournis pour permettre la vérification
 * contre les vecteurs de test ; en production ils sont tirés au sort.
 */
function chiffrer(charge, cleClient, authClient, serveurECDH, sel) {
  const ecdh = serveurECDH || (() => { const e = crypto.createECDH('prime256v1'); e.generateKeys(); return e; })();
  const salt = sel || crypto.randomBytes(16);
  const partage = ecdh.computeSecret(cleClient);

  // Clé et nonce, dérivés du secret partagé et des deux clés publiques
  const infoPRK = Buffer.concat([
    Buffer.from('WebPush: info\0'), cleClient, pointPublic(ecdh)
  ]);
  const ikm = hkdf(authClient, partage, infoPRK, 32);
  const cle = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);

  // Le contenu est suivi d'un octet 0x02 (dernier enregistrement)
  const texte = Buffer.concat([Buffer.from(charge, 'utf8'), Buffer.from([2])]);
  const chiffreur = crypto.createCipheriv('aes-128-gcm', cle, nonce);
  const chiffre = Buffer.concat([chiffreur.update(texte), chiffreur.final(), chiffreur.getAuthTag()]);

  // En-tête : sel (16) + taille d'enregistrement (4) + longueur clé (1) + clé publique (65)
  const pub = pointPublic(ecdh);
  const entete = Buffer.alloc(21);
  salt.copy(entete, 0);
  entete.writeUInt32BE(4096, 16);
  entete.writeUInt8(pub.length, 20);

  return Buffer.concat([entete, pub, chiffre]);
}

/** Jeton VAPID : un JWT signé ES256, valable 12 heures. */
function jetonVapid(origine, clePriveeB64, sujet) {
  const entete = b64(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const charge = b64(JSON.stringify({
    aud: origine,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: sujet || 'mailto:contact@bizniskonekte.tech'
  }));
  const aSigner = `${entete}.${charge}`;

  // La clé privée brute doit être habillée au format PKCS#8 pour Node
  const priv = deb64(clePriveeB64);
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(priv);
  const cleObjet = crypto.createPrivateKey({
    key: Buffer.concat([
      Buffer.from('308141020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420', 'hex'),
      priv
    ]),
    format: 'der', type: 'pkcs8'
  });

  // ES256 attend une signature brute r||s, pas le format DER
  const der = crypto.sign('sha256', Buffer.from(aSigner), { key: cleObjet, dsaEncoding: 'ieee-p1363' });
  return `${aSigner}.${b64(der)}`;
}

/** Paire de clés VAPID, à générer une fois et à conserver. */
function genererClesVapid() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { publique: b64(ecdh.getPublicKey()), privee: b64(ecdh.getPrivateKey()) };
}

/**
 * Envoie une notification à un abonnement.
 * Ne rejette jamais : un échec d'envoi ne doit pas interrompre
 * le traitement d'une commande ou d'un rendez-vous.
 */
function envoyer(abonnement, charge, options) {
  const o = options || {};
  const clePub = o.clePublique || process.env.VAPID_PUBLIQUE;
  const clePriv = o.clePrivee || process.env.VAPID_PRIVEE;
  if (!clePub || !clePriv) return Promise.resolve({ ok: false, raison: 'VAPID non configuré' });

  return new Promise((resoudre) => {
    let cible, corps, jeton;
    try {
      cible = new URL(abonnement.endpoint);
      corps = chiffrer(
        JSON.stringify(charge),
        deb64(abonnement.keys.p256dh),
        deb64(abonnement.keys.auth)
      );
      jeton = jetonVapid(`${cible.protocol}//${cible.host}`, clePriv, o.sujet);
    } catch (e) {
      return resoudre({ ok: false, raison: 'préparation : ' + e.message });
    }

    const req = https.request({
      hostname: cible.hostname,
      path: cible.pathname + cible.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Content-Length': corps.length,
        'TTL': String(o.ttl || 86400),
        'Urgency': o.urgence || 'normal',
        'Authorization': `vapid t=${jeton}, k=${clePub}`
      },
      timeout: 12000
    }, (rep) => {
      rep.resume();
      rep.on('end', () => {
        // 404 et 410 : l'abonnement n'est plus valable, il faut le retirer
        const perime = rep.statusCode === 404 || rep.statusCode === 410;
        resoudre({ ok: rep.statusCode >= 200 && rep.statusCode < 300, code: rep.statusCode, perime });
      });
    });
    req.on('error', (e) => resoudre({ ok: false, raison: e.message }));
    req.on('timeout', () => { req.destroy(); resoudre({ ok: false, raison: 'délai dépassé' }); });
    req.write(corps);
    req.end();
  });
}

/**
 * Vérifie le chiffrement contre le vecteur de test de la RFC 8291 §5.
 * Retourne true si la sortie correspond exactement à celle publiée.
 * Sans accès réseau, c'est la seule preuve possible que le
 * chiffrement est conforme.
 */
function verifier() {
  try {
    const texte = 'When I grow up, I want to be a watermelon';
    const clePubClient = deb64('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4');
    const authClient = deb64('BTBZMqHH6r4Tts7J_aSIgg');
    const selEssai = deb64('DGv6ra1nlYgDCS1FRnbzlw');
    const privServeur = deb64('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw');

    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(privServeur);

    const sortie = chiffrer(texte, clePubClient, authClient, ecdh, selEssai);
    const attendu = 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';
    return { ok: b64(sortie) === attendu, obtenu: b64(sortie).slice(0, 40), attendu: attendu.slice(0, 40) };
  } catch (e) {
    return { ok: false, erreur: e.message };
  }
}

function configure() { return !!(process.env.VAPID_PUBLIQUE && process.env.VAPID_PRIVEE); }

module.exports = { envoyer, genererClesVapid, verifier, configure, chiffrer, jetonVapid, b64, deb64 };
