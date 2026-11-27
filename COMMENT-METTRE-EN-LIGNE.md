# Mettre Konekte en ligne

Ce dossier contient **le projet entier, à jour**. Envoyez-le tel quel : il
remplace ce qui est sur GitHub, et plus rien ne peut manquer.

## ⚠️ À FAIRE EN PREMIER : déclarer l'adresse officielle

Sur **render.com** → votre service → **Environment** → **Add Environment
Variable** :

| Key | Value |
|---|---|
| `URL_PUBLIQUE` | `https://bizniskonekte.tech` |

**Sans cette variable, les liens que vos entreprises partagent portent
l'adresse par laquelle elles se sont connectées** — y compris l'ancienne
adresse `.onrender.com`. Avec elle, tous les liens, tous les codes QR et tous
les reçus portent la même adresse, quelle que soit la porte d'entrée, et les
visiteurs arrivés par l'ancienne adresse sont renvoyés automatiquement vers
la bonne.

Pas de barre oblique à la fin, et **pas de `www.`** : Render redirige déjà
`www.bizniskonekte.tech` vers l'adresse sans `www`. Mettre `www.` ici fait que
les deux redirections se renvoient la balle — le navigateur affiche alors
« ERR_TOO_MANY_REDIRECTS » et le site devient inaccessible.

C'est la méthode à retenir. Envoyer seulement « les fichiers modifiés » est
fragile : il suffit d'en oublier un pour que la mise à jour ne fasse rien, ou
pour que le serveur refuse de démarrer. Avec le dossier complet, la question
ne se pose plus.

## Les cinq étapes

1. Décompressez `konekte.zip` sur votre ordinateur.
2. Sur **github.com**, ouvrez votre dépôt → **Add file** → **Upload files**.
3. Ouvrez le dossier `konekte` et glissez **tout son contenu** : les dossiers
   `lib` et `public`, puis `server.js`, `package.json` et les fichiers `.md`.

   ⚠️ Glissez le **contenu** du dossier, pas le dossier lui-même :
   `server.js` doit se retrouver à la racine du dépôt, pas dans
   `konekte/server.js`.

   ⚠️ S'il existe un dossier `data`, ne l'envoyez pas : vos vraies données
   vivent sur le disque de Render, pas sur GitHub.

4. Descendez tout en bas de la page → bouton vert **Commit changes**.
   **C'est l'étape qu'on oublie.** Sans ce clic, rien n'est enregistré : la
   page se referme et les fichiers sont perdus.
5. Sur **render.com** → votre service → onglet **Events** : un déploiement
   démarre dans la minute. Attendez le point vert **Live** (1 à 2 minutes).

## Vérifier en dix secondes

Ouvrez dans votre navigateur :

**https://bizniskonekte.tech/sw.js**

La deuxième ligne doit afficher :

```
const CACHE = 'konekte-v68';
```

Si elle affiche encore `biznis-v55`, le déploiement n'a pas eu lieu — ne
cherchez pas ailleurs, reprenez à l'étape 4.

Gardez ce réflexe pour toutes les mises à jour : ce numéro change à chaque
livraison, et c'est le seul moyen fiable de savoir ce qui tourne réellement.

## Reprendre la main sur l'administration

Si vous ne pouvez plus entrer dans votre espace administrateur — mot de passe
oublié, adresse mal notée, ou vérification en deux étapes activée sur un canal
qui n'envoie rien — la porte de secours passe par Render, à laquelle vous seul
avez accès.

**render.com → votre service → Environment** → ajoutez temporairement :

| Key | Value |
|---|---|
| `ADMIN_EMAIL` | l'adresse de votre compte administrateur |
| `ADMIN_MOTDEPASSE` | un nouveau mot de passe, 8 caractères minimum |

**Save Changes** → le service redémarre. Au démarrage, le compte est créé s'il
n'existe pas, ou remis en état s'il existe : rôle administrateur rétabli, mot
de passe imposé, vérification en deux étapes retirée, sessions ouvertes
fermées. L'onglet **Logs** affiche `[ADMIN] Compte réinitialisé : …`.

Connectez-vous, puis **supprimez ces deux variables** : tant qu'elles sont là,
le mot de passe est réimposé à chaque redémarrage.

Aucune donnée n'est touchée : ni les entreprises, ni les rendez-vous, ni les
commandes, ni la comptabilité.

## Ce que contient cette version

**Les notifications passent par courriel, plus par WhatsApp.** L'envoi
automatique par l'API de Meta demandait un jeton permanent, une vérification
d'entreprise et l'approbation de chaque modèle de message. Tout cela est
retiré : confirmations de rendez-vous, de séjour, de commande, changements de
statut, rappels de la veille, inscriptions, dossiers, codes de connexion —
dix-neuf messages partent désormais par courriel, avec la couleur de
l'entreprise concernée.

Deux variables suffisent, et vous les avez déjà :

| Key | Value |
|---|---|
| `BREVO_API_KEY` | votre clé Brevo (`xkeysib-…`) |
| `COURRIEL_EXPEDITEUR` | l'adresse vérifiée dans Brevo |

Vous pouvez **supprimer** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` et
`WHATSAPP_LANG` : elles ne servent plus à rien.

Les boutons **« Contacter sur WhatsApp »** restent partout. Ce sont des liens
`wa.me`, qui n'ont jamais rien demandé à Meta : vos clients continuent de
joindre les entreprises sur WhatsApp, et les entreprises leurs clients.

**Un compte ne peut plus s'enfermer tout seul.** La vérification en deux
étapes ne s'active plus sur un canal qui n'envoie rien : sans clé Brevo, le
code partait dans les journaux du serveur, et le compte devenait inaccessible.
Si un compte est déjà dans cette situation, la connexion le dit clairement au
lieu d'afficher une case de code que rien ne viendra remplir — et la porte de
secours ci-dessus le remet en état.

**Une seule adresse pour la plateforme.** Les liens partagés, les codes QR et
les reçus étaient fabriqués à partir de l'adresse affichée dans le navigateur :
une entreprise connectée par l'adresse Render diffusait des liens en
`.onrender.com` à ses clients, et son code QR imprimé pointait ailleurs que
son lien WhatsApp. C'est désormais le serveur qui dicte l'adresse, et toute
visite arrivée par une autre adresse est renvoyée vers la bonne — les codes QR
déjà imprimés continuent donc de fonctionner. Demande la variable
`URL_PUBLIQUE` ci-dessus.

**Le nom et le logo.** La plateforme s'appelle Konekte et porte le nouveau
symbole : en-têtes, icône de l'application, favicon, écrans de connexion,
reçus, courriels. L'ancien logo peint sur le mur de la photo d'accueil a été
remplacé.

**La comptabilité.** Module complet en partie double, mais avec une saisie en
langage ordinaire : recettes, dépenses, caisses, créances clients, dettes
fournisseurs, TCA, résultat mensuel, balance, clôture et export pour votre
comptable. Les ventes encaissées par la plateforme s'y inscrivent toutes
seules. Compris dans le forfait Pro.

**Les précommandes.** Un produit peut être annoncé « Bientôt disponible »,
avec une date d'arrivée, et ouvert à la précommande.

**La répartition des fonctions.** Le métier décide ce que l'entreprise voit,
le forfait décide le volume et les options de croissance. Les cases à cocher
des fonctions ont disparu.

**La commission Découverte** passe à 7,5 %, ce qui place la bascule vers Pro
à exactement 20 000 HTG encaissés par mois.

## Ce qu'apporte la v64

**Le compte s'active par courriel, sans approbation manuelle.** À l'inscription,
le responsable reçoit un lien « Activer mon compte ». Tant qu'il n'a pas cliqué,
la connexion est refusée avec un message clair et un bouton pour renvoyer le
lien, et son entreprise n'apparaît nulle part. **Le clic ouvre son espace et met
sa page publique en ligne dans la foulée** : vous n'avez plus rien à valider.

Vous gardez la main après coup : dans `/admin.html`, le menu de statut permet de
suspendre une entreprise à tout moment. La colonne Contact affiche « courriel
non vérifié » pour celles dont le lien n'a jamais servi.

Les comptes créés avant cette version ne sont pas concernés : ils se
connectent exactement comme avant.

Si la clé Brevo venait à manquer, le lien ne pourrait pas partir : dans ce cas
le compte s'ouvre directement, pour que personne ne reste devant une porte
dont personne n'a la clé.

**L'envoi vers GitHub en un double-clic.** Le fichier `envoyer-sur-github.bat`,
placé à côté de `server.js`, remplace l'envoi manuel des fichiers dans le
navigateur : il enregistre le dossier et le pousse vers
`Michaeljacques-ht/Konekte`. Il **remplace entièrement** le contenu du dépôt par
celui de votre dossier — c'est voulu, votre dossier fait foi.

**Les réseaux sociaux de Konekte** sont reliés dans le pied de page :
facebook.com/konekte2026, instagram.com/konekte2026, t.me/Mike2334 et le
WhatsApp de la plateforme.

**Le numéro de contact** devient le +1 514 226 1860, partout : pages, boutons
WhatsApp, courriels.

**Un bouton Boutique** apparaît en haut à droite sur téléphone, à côté du
sélecteur de langue.

**Un bouton Partager** sur l'accueil : partage natif sur téléphone, menu
WhatsApp / Facebook / Telegram / X / copier le lien sur ordinateur. Les pages
d'entreprise et le tableau de bord en avaient déjà un.

**Les rappels WhatsApp automatiques** ne figurent plus dans les forfaits : les
rappels de la veille partent par courriel depuis la v63, cette ligne n'avait
plus lieu d'être.

**Un logo corrigé.** Le fichier `logos/whatsapp.png` contenait en réalité le
logo de Threads : tous les boutons WhatsApp du site affichaient donc la
mauvaise marque. Il porte désormais une icône de discussion neutre. Si vous
voulez le vrai logo, déposez le fichier officiel de WhatsApp sous ce même nom
dans `public/logos/`, rien d'autre à changer.

## Ce qu'apporte la v65

**Supprimer une entreprise.** Dans `/admin.html`, chaque ligne porte une
corbeille. Le dialogue annonce combien d'enregistrements vont disparaître et
exige que vous recopiiez le nom exact : une requête partie par mégarde ne peut
pas le deviner. La suppression emporte tout ce qui dépend de l'entreprise —
rendez-vous, commandes, séjours, dossiers, services, produits, employés,
écritures comptables, comptes et sessions ouvertes — sans laisser d'orphelins.
C'est **irréversible** : téléchargez une sauvegarde avant, par « 💾 Sauvegarde
des données ».

**Voir le dossier d'inscription.** Le bouton « 📋 Dossier » ouvre la fiche
complète telle qu'elle a été remplie : responsable et adresse, métier déclaré,
coordonnées, forfait choisi, acceptation de la politique, signature du contrat
avec sa qualité et sa date, et le volume de données accumulées depuis.

**Logo et photo d'en-tête dès l'inscription.** Deux champs facultatifs au
premier écran du formulaire. Les images sont réduites dans le navigateur avant
l'envoi, avec un aperçu immédiat. L'entreprise arrive donc avec sa page déjà
habillée, au lieu d'un carré de couleur.

**Messages WhatsApp pré-enregistrés.** Sur chaque fiche client — rendez-vous,
séjour, commande, dossier, inscription scolaire — un bouton 💬 ouvre une
fenêtre listant les messages prêts à l'emploi. Un clic remplit le texte avec le
nom du client, la date, l'heure, le service, la référence et le montant, puis
WhatsApp s'ouvre avec le message déjà écrit. Le texte reste modifiable avant
l'envoi.

Neuf messages sont fournis au départ : confirmer un rendez-vous, rappeler la
veille, prévenir d'un retard, annoncer une commande prête ou en route, signaler
un problème, demander à reporter, rappeler un paiement, remercier après le
passage. Chaque entreprise les modifie dans **Paramètres → Messages WhatsApp
pré-enregistrés**, et peut revenir aux textes d'origine d'un bouton. Les
mentions `{client}`, `{entreprise}`, `{date}`, `{heure}`, `{service}`,
`{reference}` et `{montant}` sont remplacées au moment de l'envoi ; une mention
sans valeur disparaît plutôt que de rester en clair dans le message.

## Ce qu'apporte la v67 — sécurité

Cette version ne change rien à ce que vous voyez. Elle ferme trois défauts qui
auraient posé problème dès que la plateforme quitte le cercle des gens que vous
connaissez.

**Les mots de passe ne sont plus conservés en clair.** Jusqu'ici, `db.json`
contenait le mot de passe de chaque entrepreneur tel qu'il l'avait tapé :
quiconque obtenait une copie du fichier — une sauvegarde téléchargée et
oubliée, un accès au disque — pouvait tous les lire, et s'en servir ailleurs
puisque les gens réutilisent leurs mots de passe. Seule leur empreinte scrypt
est désormais enregistrée, et une empreinte ne se remonte pas.

**Vos comptes existants ne sont pas touchés.** Chacun continue avec son mot de
passe habituel ; il est converti en silence à sa première connexion. Personne
n'a rien à faire, personne n'est déconnecté.

**Les tentatives de connexion sont freinées.** Après cinq échecs, le couple
(appareil, compte) attend un quart d'heure. Un autre compte depuis le même
appareil n'est pas gêné, et un inconnu ne peut pas verrouiller une entreprise
en se trompant exprès puisque son propre appareil est ce qui est bloqué. Les
inscriptions sont freinées de la même façon, à huit par appareil.

**Les reçus restent vérifiables après un redéploiement.** Sans la variable
`SEL_RECUS`, la clé qui signe les reçus était tirée au hasard à chaque
démarrage : tous les reçus déjà remis aux clients devenaient invalides au
redéploiement suivant, et `/verifier.html` les déclarait faux. Cette clé est
maintenant conservée sur le disque persistant, à côté de la base. Poser
`SEL_RECUS` reste possible et prend le dessus.

**Plus de mot de passe administrateur connu d'avance.** `admin123` était
inscrit dans le code et dans le guide, tous deux publics. Sur une base neuve,
le mot de passe est désormais tiré au hasard et affiché **une seule fois** au
premier démarrage. Votre base existante n'est pas concernée.

**La base ne peut plus être tronquée.** Elle était réécrite en entier à chaque
enregistrement : une coupure au mauvais moment pouvait laisser un fichier
incomplet, c'est-à-dire tout perdre. L'écriture passe maintenant par un fichier
temporaire renommé ensuite par-dessus — une opération indivisible. Et à l'arrêt
du service, ce qui attendait encore est enregistré avant de rendre la main.

## Ce qu'apporte la v68 — horaires à l'épreuve

Une entreprise dont les horaires étaient incomplets faisait planter sa propre
page publique : le navigateur tentait de lire un jour qui n'existait pas, et
l'affichage s'arrêtait net. Impossible par le formulaire d'inscription, qui
écrit toujours les sept jours — mais un envoi mal formé vers l'interface de
modification suffisait à le provoquer.

Désormais, tout ce qui entre et tout ce qui est relu passe par un filtre :
sept jours, toujours, avec des heures valables. Les bases déjà abîmées se
réparent au démarrage, et le journal indique combien d'entreprises ont été
remises en forme.

**Un jour manquant est déclaré fermé, jamais ouvert.** Le réflexe inverse
serait pire : la plateforme prendrait des rendez-vous un jour que l'entreprise
n'a pas déclaré, et le client trouverait porte close. Une journée fermée à tort
se voit dans les Paramètres et se corrige en un clic.

Les entreprises dont les horaires sont déjà complets ne sont pas touchées,
même avec des plages inhabituelles.

## Si le déploiement échoue

Onglet **Logs** de votre service Render :

| Message | Cause |
|---|---|
| `Cannot find module './lib/compta.js'` | le dossier `lib` n'est pas monté |
| `Build failed` | `server.js` n'est pas à la racine du dépôt |
| `Cannot find module` (autre) | un dossier a été envoyé incomplet — refaites l'envoi |

## Sur votre téléphone

L'application déjà installée garde l'ancien nom et l'ancienne icône :
Android et iOS les figent au moment de l'ajout à l'écran d'accueil. Pour voir
Konekte, supprimez l'icône, rouvrez le site dans le navigateur, puis
**Ajouter à l'écran d'accueil**. Le site dans le navigateur, lui, se met à
jour tout seul.

## Reste à faire quand vous voudrez

- Les **flyers** portent encore l'ancienne identité : demandez-les-moi, ils se
  régénèrent en une fois. Les guides PDF, eux, ont été retirés de la plateforme.
- Les **variables d'environnement** sur Render (`BREVO_API_KEY`, `VAPID_*`,
  `SEL_RECUS`, `DATA_DIR`) — voir `LISEZMOI.md`.
- Un **domaine `konekte`**, si vous voulez que l'adresse suive le nom. On
  l'ajoute à côté de l'actuel, les deux mènent au même site.
