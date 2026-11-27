# Audit de sécurité — Konekte v100

Audit du code de la plateforme (serveur, bibliothèques, pages) et correction
des failles trouvées. Chaque faille a été reproduite sur un serveur réel avant
correction, et le correctif vérifié de la même manière.

---

## Ce qui a été corrigé

### 1. Exécution de code dans le navigateur de vos visiteurs — *critique*

**Le défaut.** Une image n'était contrôlée que sur son préfixe : `data:image/`.
Or `data:image/svg+xml` est une image pour ce test, et un document exécutable
pour un navigateur. N'importe quelle entreprise inscrite pouvait déposer en
guise de logo un SVG contenant du JavaScript, que `/img/logo/<id>` servait
ensuite **depuis bizniskonekte.tech**, avec le type `image/svg+xml`.

**Ce que cela permettait.** Le script s'exécutait dans l'origine de la
plateforme, avec les droits de celui qui ouvrait l'adresse. Visant un
administrateur, il pouvait agir en son nom sur toute l'API : modifier des
entreprises, lire les messages, déclencher une restauration de base. Le lien
étant une simple image, il se transmettait sans éveiller de soupçon.

**Le correctif.** Seuls les formats matriciels sont acceptés — PNG, JPEG,
WebP, GIF — et ce qui suit l'en-tête doit être du base64 et rien d'autre. Le
contrôle est fait au dépôt *et* au moment de servir, pour les enregistrements
déjà en base. Le type de la réponse vient d'une liste fermée, plus d'un
morceau de la chaîne déposée.

### 2. Tous les plafonds de tentatives contournables — *élevée*

**Le défaut.** L'adresse du visiteur était lue dans le **premier** élément de
`X-Forwarded-For`, en-tête que le client écrit lui-même. L'hébergeur ajoutant
la vraie adresse à la suite, il suffisait d'envoyer `X-Forwarded-For: 1.2.3.4`
et de changer ce chiffre à chaque essai.

**Ce que cela permettait.** Plus aucune limite : force brute sur les mots de
passe, sur les codes à deux facteurs, sur les codes de réinitialisation,
inscriptions et messages en série.

**Le correctif.** L'en-tête n'est cru que s'il vient d'un intermédiaire de
confiance — c'est-à-dire si la connexion nous arrive d'une adresse privée,
le cas de Render — et l'adresse est alors lue **depuis la droite**, là où
écrivent les serveurs. Exposé directement, le serveur s'en tient à l'adresse
de la connexion, la seule que personne ne puisse inventer. Deux variables
permettent d'ajuster : `CONFIANCE_PROXY` (`auto`, `toujours`, `jamais`) et
`PROXYS_FIABLES`. Le mode retenu est annoncé au démarrage.

> **À vérifier au premier déploiement.** Dans les journaux Render, la ligne
> `Adresses : confiance proxy « auto »`. Si les plafonds vous semblent ne
> jamais se déclencher, c'est que Render présente une adresse publique :
> réglez alors `CONFIANCE_PROXY=toujours`.

Une seconde fonction faisait le même travail pour les plafonds de connexion.
Elle avait été oubliée au premier passage, et la faille restait entière : les
deux sont désormais une seule.

### 3. Corruption du portefeuille — *élevée*

**Le défaut.** Le montant d'un retrait était utilisé sans être converti.
`{}` n'étant ni plus grand ni plus petit qu'un nombre, les deux bornes
étaient franchies et le solde bloqué devenait `"0[object Object]"`.

**Ce que cela permettait.** Détruire la comptabilité du portefeuille d'une
entreprise par une seule requête, et contourner le contrôle de solde.

**Le correctif.** Les nombres reçus du dehors sont convertis et vérifiés
finis avant tout usage ; les textes doivent être des textes. Une demande de
retrait déjà en attente bloque la suivante, pour qu'un même argent ne soit
pas réservé deux fois.

### 4. Références de reçus devinables, sans limite d'essais — *élevée*

**Le défaut.** Les identifiants venaient de `Math.random()`, dont la suite se
reconstitue à partir de quelques tirages — et une entreprise en voit passer
des centaines. La référence d'un reçu en reprenait les huit derniers
caractères, dont deux d'horodatage. Aucune limite d'essais : 650 références
par seconde passaient.

**Ce que cela permettait.** Moissonner les reçus d'autres commerçants — noms
de clients, montants, articles achetés — et signer un contrat à la place d'un
client.

**Le correctif.** Tirage cryptographique, part aléatoire portée de 6 à 12
caractères (les identifiants déjà émis restent valables). Et un plafond par
adresse sur les points d'entrée qui fonctionnent à la référence : reçus,
signature de contrat, suivi de commande, état de règlement. Le plafond est
large à dessein — en Haïti, tout un quartier partage souvent une adresse.

### 5. Cookie de session — *moyenne*

Le cookie qui ouvre le tableau de bord, la comptabilité et le portefeuille
partait **sans l'attribut `Secure`**, là où les cookies de mesure et de client
l'avaient : sur une requête en clair il s'envoyait quand même. Et côté
serveur, un jeton ne portait aucune date : il restait valable indéfiniment,
bien après l'expiration annoncée au navigateur. Les deux sont corrigés, les
sessions déjà ouvertes restant acceptées le temps de leur renouvellement.

### 6. Appels sortants vers le réseau interne — *moyenne*

Une entreprise écrit elle-même l'adresse de sa passerelle, et c'est le serveur
de Konekte qui l'appelle. Rien n'empêchait de le faire interroger la machine
elle-même, le réseau privé de l'hébergeur ou les adresses de métadonnées des
fournisseurs de nuage, avec une partie de la réponse qui revenait par le champ
où elle indique quoi lire. HTTPS est maintenant obligatoire, les plages
privées sont refusées, et — puisqu'un nom public peut pointer vers une adresse
privée — **l'adresse réellement résolue est contrôlée** juste avant la
connexion.

### 7. Aucun en-tête de sécurité — *moyenne*

La plateforme n'en envoyait aucun. Le tableau de bord pouvait être chargé dans
un cadre invisible sur un site tiers et ses boutons détournés au clic ; et
surtout la référence d'un reçu — qui suffit à ouvrir le document — partait
dans l'en-tête `Referer` vers chaque site externe ouvert depuis la page, à
commencer par les passerelles de paiement. Sont désormais posés :
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`, `Content-Security-Policy`, et `Strict-Transport-Security`
derrière HTTPS.

La politique de contenu reste permissive sur les styles et scripts en ligne —
les pages sont écrites ainsi d'un bout à l'autre — mais ferme les deux portes
réellement utilisables : les scripts venus d'ailleurs et l'inclusion dans un
cadre. Les vidéos de produits ne s'intègrent plus que depuis YouTube, Vimeo et
Facebook ; un lien d'ailleurs ouvrait jusqu'ici un cadre sur n'importe quelle
adresse, à l'intérieur de la page que vos clients consultent.

### 8. Épuisement de la mémoire du serveur — *moyenne*

Sur un corps de requête dépassant 4 Mo, la connexion était coupée sans que
l'événement de fin ne survienne : la promesse restait pendante pour toujours,
et avec elle les quatre mégaoctets déjà reçus. Quelques centaines d'envois
suffisaient à épuiser la mémoire. La liste des notifications, elle, grossissait
sans fin, et un visiteur répétant une action notifiable la faisait grossir à
volonté — chaque ajout réécrivant toute la base. Corrigés tous les deux : la
promesse se dénoue dans tous les cas, et deux cents avis par entreprise
suffisent.

### 9. Points mineurs

- **En-tête `Host` de confiance** : sans `URL_PUBLIQUE`, l'adresse des liens
  d'activation et de réinitialisation venait d'un en-tête que le visiteur
  écrit. En production la variable est définie ; le repli n'accepte plus
  qu'un nom d'hôte bien formé.
- **Couleurs non validées** : elles sont posées en variables CSS sur la page
  publique, où une valeur libre permettait de faire charger une ressource
  extérieure à chaque visiteur. Format `#RRGGBB` exigé. Les champs texte de
  l'entreprise, recopiés tels quels, sont désormais bornés.
- **Relais de courriel** : l'accusé de réception d'un message partait vers
  n'importe quelle adresse, avec un texte en partie choisi par l'expéditeur.
  L'adresse doit maintenant être bien formée.
- **Chemin des fichiers statiques** : `startsWith` laissait passer un dossier
  voisin dont le nom commence pareil. Comparaison exacte au séparateur près.
- **Pollution de prototype** : sur la lecture d'un jeton de session et sur la
  restauration de sauvegarde.

---

## Ce qui était déjà correct

À noter, car cela n'allait pas de soi : les mots de passe sont hachés par
scrypt ; les codes à deux facteurs tirés cryptographiquement et comparés à
durée constante ; la signature des reçus est un HMAC ; **les prix et les
stocks sont revérifiés côté serveur** à chaque commande, de sorte qu'un prix
modifié dans le navigateur n'a aucun effet ; l'échappement HTML est appliqué
des deux côtés, et il échappe bien les guillemets ; les accès à
`/api/mon-entreprise/*` sont liés à la session, jamais à un identifiant fourni
par le client ; `SameSite=Lax` protégeait déjà des requêtes inter-sites.

## Ce qui reste à faire, et que je n'ai pas fait

- **Politique de contenu stricte.** Tant que `'unsafe-inline'` est permis, un
  défaut d'échappement resterait exploitable. L'éliminer demande de sortir
  tous les scripts et styles en ligne des pages — un chantier en soi.
- **Journal des accès administrateur.** Rien ne trace aujourd'hui qui a validé
  une entente, suspendu une entreprise ou restauré une sauvegarde.
- **Sauvegarde hors site automatique.** Le téléchargement manuel depuis
  `/admin.html` reste le seul filet.
- **Audit de `lib/compta.js` et `lib/qr.js`** : parcourus, mais sans le même
  examen ligne à ligne que le serveur.

---

*Audit mené le 13 novembre 2026 sur la version 99, corrections livrées en
version 100. Les 21 contrôles de non-régression et de vérification passent
depuis l'archive décompressée.*
