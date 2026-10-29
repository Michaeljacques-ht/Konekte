# Konekte — Konekte kliyan ak biznis yo

Plateforme haïtienne qui réunit, au même endroit, la prise de rendez-vous,
l'hôtellerie, la vente en ligne, le suivi de dossiers et la comptabilité des
entreprises.

Node.js seul, aucune dépendance npm à installer.

## Démarrage sur votre ordinateur (Windows)

1. Décompressez le dossier `konekte`, par exemple sur le Bureau.
2. Double-cliquez sur **demarrer.bat** (Node.js doit être installé).
3. Ouvrez votre navigateur sur **http://localhost:3000**

## Mise en ligne

Le site tourne sur Render, à l'adresse **bizniskonekte.tech**.
Pour déployer une nouvelle version : envoyez le contenu de ce dossier sur
GitHub (**Add file → Upload files**, puis le bouton vert **Commit changes**),
Render redéploie tout seul en une à deux minutes.

**Pour vérifier qu'une mise à jour est bien passée**, ouvrez
`https://bizniskonekte.tech/sw.js` : la deuxième ligne affiche la version
du cache, qui change à chaque livraison. Si elle n'a pas changé, le
déploiement n'a pas eu lieu — inutile de chercher ailleurs.

## Compte administrateur

Sur une base neuve, le compte `admin@bizniskonekte.tech` est créé avec un mot
de passe **tiré au hasard, affiché une seule fois** dans le journal au premier
démarrage. Notez-le à ce moment-là : il n'existe nulle part ailleurs.

Si vous l'avez manqué, ou si vous perdez l'accès, la porte de secours passe par
les variables `ADMIN_EMAIL` et `ADMIN_MOTDEPASSE` — voir
`COMMENT-METTRE-EN-LIGNE.md`.

**Les mots de passe ne sont jamais conservés en clair** : seule leur empreinte
scrypt est enregistrée. Les comptes antérieurs à la v67 sont convertis
automatiquement à leur première connexion, sans que personne ait à changer
quoi que ce soit.

Il n'y a aucun compte de démonstration : les entreprises s'inscrivent
elles-mêmes et activent leur compte par le lien reçu par courriel, ce qui met
leur page en ligne. L'administrateur n'a rien à valider ; il peut en revanche
suspendre une entreprise à tout moment depuis `/admin.html`.

## Les pages

| Adresse | Rôle |
|---|---|
| `/` | Accueil : recherche, catégories, entreprises populaires |
| `/categories.html` | Toutes les catégories d'activité |
| `/boutique.html` | Place de marché : les produits de tous les commerçants |
| `/nom-de-l-entreprise` | Page publique d'une entreprise (réserver, acheter) |
| `/forfaits.html` | Forfaits et tarifs |
| `/inscription.html` | Inscription d'une entreprise, en 5 étapes |
| `/connexion.html` | Connexion |
| `/dashboard.html` | Espace de gestion de l'entreprise |
| `/mes-achats.html` | Espace client : suivi des achats, sans création de compte |
| `/recu.html`, `/verifier.html` | Reçu et vérification d'authenticité |
| `/activer?j=…` | Activation d'un compte depuis le lien reçu par courriel |
| `/admin.html` | Administration : dossiers d'inscription, approbation, suppression |
| `/apropos.html`, `/contact.html`, `/partenaire.html`, `/question.html` | Pages d'information |

## Comment les fonctions sont réparties

Deux axes, à ne jamais confondre :

**Le métier décide la nature des fonctions.** Un restaurant a sa carte, une
école ses inscriptions, un notaire ses dossiers, un hôtel ses chambres. Ces
fonctions sont ouvertes dans tous les forfaits : on ne fait pas payer le droit
d'exercer son métier.

**Le forfait décide le volume et les options de croissance.** Combien de
services, de produits, de membres d'équipe, de chambres — et l'accès à la
vente en ligne, aux précommandes, au paiement en ligne et à la comptabilité.

| | Découverte | Pro | Hôtellerie & Commerce |
|---|---|---|---|
| Prix mensuel | 1 000 HTG | 1 500 HTG | 2 500 HTG |
| Commission | 7,5 % | 5 % | 3 % (max 500 HTG) |
| Fonctions du métier | toutes | toutes | toutes |
| Volume | 3 services, 20 produits, 1 équipier, 3 chambres | illimité | illimité |
| Vente en ligne, précommandes, comptabilité | — | ✅ | ✅ |

Tout commence par **90 jours offerts**.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `server.js` | Serveur et toutes les routes |
| `lib/db.js` | Base JSON et migrations |
| `lib/metiers.js` | Référentiel des métiers : vocabulaire, modules, champs |
| `lib/forfaits.js` | Forfaits, limites, commissions, options |
| `lib/compta.js` | Moteur comptable en partie double |
| `lib/motdepasse.js` | Hachage scrypt des mots de passe |
| `lib/horaires.js` | Mise en forme et contrôle des horaires d'ouverture |
| `lib/qr.js` | Générateur de codes QR, sans dépendance |
| `lib/push.js` | Notifications poussées (RFC 8291) |
| `lib/courriel.js` | Envoi de courriels via Brevo |
| `lib/visites.js` | Journal de fréquentation anonyme |
| `lib/taksi.js` | Passerelle vers Taksi Konekte |
| `public/` | Toutes les pages et les visuels |

## Les données

Base JSON créée automatiquement dans `data/db.json`.

**En production, la variable `DATA_DIR` doit pointer vers le disque persistant
de Render** (par exemple `/var/data`), sans quoi les données sont effacées à
chaque déploiement. L'administration propose aussi une sauvegarde et une
restauration manuelles.

## Variables d'environnement

| Variable | Rôle |
|---|---|
| `DATA_DIR` | Dossier des données — **indispensable en production** |
| `URL_PUBLIQUE` | Adresse publique, pour les liens et les codes QR |
| `BREVO_API_KEY`, `COURRIEL_EXPEDITEUR` | **Envoi des courriels — seul canal de notification** |
| `VAPID_PUBLIQUE`, `VAPID_PRIVEE` | Notifications poussées |
| `SEL_RECUS` | Signature des reçus — engendré et conservé automatiquement si absent |
| `FINANCEMENT_URL`, `FINANCEMENT_SEUIL` | Lien vers Micro Crédit Solidarité |
| `SEUIL_CHIFFRES` | Nombre d'entreprises à partir duquel l'accueil affiche ses chiffres |
| `ADMIN_EMAIL`, `ADMIN_MOTDEPASSE` | Accès de secours à l'administration — à retirer une fois connecté |

Sans ces variables, le site fonctionne normalement : les envois passent en
mode simulation, visibles dans les journaux de Render.
