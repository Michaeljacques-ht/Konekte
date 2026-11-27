/* ==========================================================
   Aide contextuelle du tableau de bord
   ----------------------------------------------------------
   Une page d'aide que l'on visite une fois, puis jamais, ne
   forme personne. Ce qui marche, c'est la marche à suivre
   disponible dans l'écran où le geste se fait, au moment où
   la question se pose.

   D'où ce format volontairement court : trois à cinq lignes
   par écran, à l'impératif, plus une astuce — celle qu'un
   commerçant découvre d'ordinaire au bout de six mois. Rien
   qui ressemble à un cours : quelqu'un qui lit cette aide est
   en train de travailler, pas d'étudier.

   Les écrans absents de cette liste n'affichent pas de bouton
   d'aide, plutôt qu'un panneau vide.
   ========================================================== */

const AIDE = {
  bord: {
    titre: { fr: 'Votre tableau de bord', ht: 'Tablo bò ou' },
    etapes: {
      fr: ['Suivez la liste de démarrage en haut : chaque ligne cochée rapproche votre page de sa première réservation.',
           'Les chiffres du jour se mettent à jour tout seuls, sans rien rafraîchir.',
           'Partagez votre lien sur WhatsApp depuis les boutons du haut — c\'est le canal qui amène le plus de monde.'],
      ht: ['Swiv lis demaraj la anwo a : chak liy ou koche pwoche paj ou de premye rezèvasyon l.',
           'Chif jounen an mete ajou pou kont yo, san ou pa bezwen rafrechi.',
           'Pataje lyen ou sou WhatsApp ak bouton anwo yo — se kanal ki pote plis moun.']
    },
    astuce: {
      fr: 'Mettez votre lien dans la description de votre page Facebook et dans votre statut WhatsApp : il travaille pour vous pendant que vous servez vos clients.',
      ht: 'Mete lyen ou nan deskripsyon paj Facebook ou ak nan estati WhatsApp ou : l ap travay pou ou pandan w ap sèvi kliyan ou yo.'
    }
  },
  perso: {
    titre: { fr: 'Logo, bannière et couleurs', ht: 'Logo, banyè ak koulè' },
    etapes: {
      fr: ['Déposez votre logo : carré, lisible en petit, sans texte fin.',
           'Déposez une bannière large : votre devanture, votre salle, vos produits en rayon.',
           'Choisissez vos deux couleurs — elles habillent votre page, vos reçus et votre flyer.',
           'Enregistrez, puis ouvrez votre page publique pour vérifier le rendu.'],
      ht: ['Mete logo ou : kare, lizib an piti, san ti tèks fen.',
           'Mete yon banyè laj : devanti ou, sal ou, pwodwi ou yo nan etajè.',
           'Chwazi de koulè ou yo — yo abiye paj ou, resi ou yo ak flyer ou.',
           'Anrejistre, epi louvri paj piblik ou pou verifye rezilta a.']
    },
    astuce: {
      fr: 'Une photo prise au téléphone en plein jour, devant la porte ouverte, vaut mieux qu\'une image trouvée sur internet : le client reconnaît l\'endroit en arrivant.',
      ht: 'Yon foto ou pran ak telefòn nan gwo lajounen, devan pòt la louvri, pi bon pase yon imaj ou jwenn sou entènèt : kliyan an rekonèt kote a lè l rive.'
    }
  },
  param: {
    titre: { fr: 'Paramètres et horaires', ht: 'Paramèt ak orè' },
    etapes: {
      fr: ['Écrivez deux lignes sur votre activité : ce que vous faites, ce qui vous distingue.',
           'Renseignez votre adresse et votre ville — sans ville, pas de « près de moi ».',
           'Vérifiez chaque jour de la semaine : un jour laissé ouvert par erreur amène des clients porte close.',
           'Placez votre position sur la carte pour que l\'itinéraire fonctionne.'],
      ht: ['Ekri de liy sou aktivite ou : sa w ap fè, sa ki fè ou diferan.',
           'Mete adrès ou ak vil ou — san vil, pa gen « toupre m ».',
           'Verifye chak jou nan semèn nan : yon jou ou kite louvri pa erè mennen kliyan devan pòt fèmen.',
           'Mete pozisyon ou sou kat la pou itinerè a mache.']
    },
    astuce: {
      fr: 'Fermez vos horaires une demi-heure avant la vraie fermeture : le dernier rendez-vous a besoin de temps pour se terminer.',
      ht: 'Fèmen orè ou yon demi-èdtan anvan vrè fèmti a : dènye randevou an bezwen tan pou l fini.'
    }
  },
  services: {
    titre: { fr: 'Vos prestations', ht: 'Prestasyon ou yo' },
    etapes: {
      fr: ['Ajoutez une prestation par ligne, avec son prix et sa durée réelle.',
           'La durée réserve le créneau : trop courte, les rendez-vous se chevauchent.',
           'Désactivez une prestation au lieu de la supprimer si elle revient plus tard.'],
      ht: ['Ajoute yon prestasyon pa liy, ak pri l ak vrè dire l.',
           'Dire a rezève kreno a : si l twò kout, randevou yo kole youn sou lòt.',
           'Dezaktive yon prestasyon olye ou efase l si l ap retounen pita.']
    },
    astuce: {
      fr: 'Comptez le nettoyage et l\'installation dans la durée. Une coupe de 30 minutes en occupe 40 dans la réalité.',
      ht: 'Konte netwayaj ak enstalasyon nan dire a. Yon koup 30 minit pran 40 minit nan reyalite.'
    }
  },
  catalogue: {
    titre: { fr: 'Votre catalogue', ht: 'Katalòg ou' },
    etapes: {
      fr: ['Ajoutez un produit : photo, prix, quantité en stock.',
           'Rangez-le dans un rayon pour que le client s\'y retrouve.',
           'Le stock baisse tout seul à chaque commande payée.',
           'Un produit épuisé reste visible, marqué indisponible — c\'est ce qui fait revenir le client.'],
      ht: ['Ajoute yon pwodwi : foto, pri, kantite nan stòk.',
           'Mete l nan yon reyon pou kliyan an jwenn li.',
           'Stòk la desann pou kont li chak fwa yon kòmand peye.',
           'Yon pwodwi ki fini rete vizib, make endisponib — se sa ki fè kliyan an retounen.']
    },
    astuce: {
      fr: 'Photographiez vos produits sur un fond uni, au même endroit et à la même heure. Votre catalogue paraît tenu par un professionnel.',
      ht: 'Pran foto pwodwi ou yo sou yon fon inifòm, menm kote a ak menm lè a. Katalòg ou parèt tankou yon pwofesyonèl ki okipe l.'
    }
  },
  commandes: {
    titre: { fr: 'Vos commandes', ht: 'Kòmand ou yo' },
    etapes: {
      fr: ['Une commande arrive : vérifiez le paiement avant de préparer.',
           'Faites-la avancer étape par étape — le client voit le même suivi que vous.',
           'Un paiement déclaré avec photo se vérifie dans l\'onglet Portefeuille.'],
      ht: ['Yon kòmand rive : verifye pèyman an anvan ou prepare.',
           'Fè l avanse etap pa etap — kliyan an wè menm swivi ak ou.',
           'Yon pèyman deklare ak foto, ou verifye l nan onglè Pòtfèy la.']
    },
    astuce: {
      fr: 'Changez le statut dès que vous agissez, pas en fin de journée : c\'est ce suivi en direct qui évite les appels « où est ma commande ? ».',
      ht: 'Chanje estati a depi w aji, pa nan fen jounen an : se swivi an dirèk sa a ki evite apèl « kote kòmand mwen an ? ».'
    }
  },
  chambres: {
    titre: { fr: 'Chambres et séjours', ht: 'Chanm ak sejou' },
    etapes: {
      fr: ['Créez une chambre par type, pas une par numéro, puis indiquez combien vous en avez.',
           'Ajoutez plusieurs photos : la chambre, la salle de bain, la vue.',
           'Cochez les équipements — climatiseur, internet, téléviseur : ce sont eux qui décident.',
           'Fixez le tarif de base, puis vos saisons dans Tarifs & saisons.'],
      ht: ['Kreye yon chanm pa tip, pa youn pa nimewo, epi di konbyen ou genyen.',
           'Mete plizyè foto : chanm nan, saldeben an, vi a.',
           'Koche ekipman yo — klimatizè, entènèt, televizyon : se yo ki deside.',
           'Mete tarif debaz la, epi sezon ou yo nan Tarif ak sezon.']
    },
    astuce: {
      fr: 'La première photo est celle qui fait cliquer. Prenez-la depuis la porte, lit fait, rideaux ouverts.',
      ht: 'Premye foto a se li ki fè moun klike. Pran l depi nan pòt la, kabann nan fèt, rido yo louvri.'
    }
  },
  planning: {
    titre: { fr: "Planning d'occupation", ht: 'Planning okipasyon' },
    etapes: {
      fr: ['Chaque ligne est une chambre, chaque colonne un jour.',
           'Une case pleine est un séjour réservé ; cliquez dessus pour l\'ouvrir.',
           'Changez la date de départ pour avancer de semaine en semaine.'],
      ht: ['Chak liy se yon chanm, chak kolòn se yon jou.',
           'Yon kazye plen se yon sejou rezève ; klike sou li pou louvri l.',
           'Chanje dat depa a pou avanse semèn apre semèn.']
    },
    astuce: {
      fr: 'Regardez ce planning le matin avant d\'accepter une réservation au téléphone : c\'est lui qui dit la vérité, pas votre mémoire.',
      ht: 'Gade planning sa a nan maten anvan w aksepte yon rezèvasyon nan telefòn : se li ki di verite a, pa memwa ou.'
    }
  },
  carte: {
    titre: { fr: 'Restaurant et bar', ht: 'Restoran ak ba' },
    etapes: {
      fr: ['Créez vos sections : entrées, plats, boissons.',
           'Ajoutez un plat par ligne, avec son prix.',
           'Masquez un plat indisponible du jour au lieu de l\'effacer.'],
      ht: ['Kreye seksyon ou yo : antre, plat, bwason.',
           'Ajoute yon plat pa liy, ak pri l.',
           'Kache yon plat ki pa disponib jodi a olye ou efase l.']
    },
    astuce: {
      fr: 'Un client logé dans l\'hôtel peut commander depuis sa chambre en indiquant son numéro. Dites-le sur la carte posée dans les chambres.',
      ht: 'Yon kliyan ki lojé nan otèl la ka kòmande depi nan chanm li ak nimewo l. Di sa sou kat ki nan chanm yo.'
    }
  },
  programmes: {
    titre: { fr: 'Programmes et niveaux', ht: 'Pwogram ak nivo' },
    etapes: {
      fr: ['Créez un programme par filière ou par niveau.',
           'Indiquez les frais d\'inscription et la durée.',
           'Les demandes arrivent dans Inscriptions, avec les pièces demandées.'],
      ht: ['Kreye yon pwogram pa filyè oswa pa nivo.',
           'Mete frè enskripsyon an ak dire a.',
           'Demann yo rive nan Enskripsyon, ak pyès ou mande yo.']
    },
    astuce: {
      fr: 'Ouvrez les inscriptions en ligne un mois avant la rentrée : les parents s\'y prennent tôt, et vous connaissez vos effectifs à l\'avance.',
      ht: 'Louvri enskripsyon an liy yon mwa anvan larantre : paran yo kòmanse bonè, epi ou konnen efektif ou alavans.'
    }
  },
  dossiers: {
    titre: { fr: 'Dossiers clients', ht: 'Dosye kliyan' },
    etapes: {
      fr: ['Ouvrez un dossier : il reçoit une référence que vous donnez au client.',
           'Avancez les étapes à mesure ; le client suit son dossier avec cette référence.',
           'Cochez les pièces reçues pour savoir ce qui manque encore.'],
      ht: ['Louvri yon dosye : li resevwa yon referans ou bay kliyan an.',
           'Fè etap yo avanse apiyapi ; kliyan an swiv dosye l ak referans sa a.',
           'Koche pyès ou resevwa yo pou konnen sa ki manke toujou.']
    },
    astuce: {
      fr: 'Donnez la référence dès le premier rendez-vous. Elle remplace les appels « où en est mon affaire ? » par une page que le client consulte seul.',
      ht: 'Bay referans lan depi premye randevou a. Li ranplase apèl « kote zafè m ye ? » ak yon paj kliyan an gade pou kont li.'
    }
  },
  portefeuille: {
    titre: { fr: 'Portefeuille et paiements', ht: 'Pòtfèy ak pèyman' },
    etapes: {
      fr: ['Publiez vos comptes MonCash ou NatCash : le client y paie directement, sans commission.',
           'Un paiement déclaré avec photo attend votre vérification — contrôlez avant de valider.',
           'Le solde de la passerelle se retire à partir de 1 000 HTG.'],
      ht: ['Pibliye kont MonCash oswa NatCash ou : kliyan an peye dirèk, san komisyon.',
           'Yon pèyman deklare ak foto ap tann verifikasyon ou — kontwole anvan ou valide.',
           'Balans pasrèl la, ou ka retire l apati 1 000 HTG.']
    },
    astuce: {
      fr: 'Un paiement reçu sur votre propre compte ne porte aucune commission. Publier vos numéros est la façon la plus simple de réduire ce que vous payez.',
      ht: 'Yon pèyman ou resevwa sou pwòp kont ou pa gen okenn komisyon. Pibliye nimewo ou yo se fason ki pi senp pou w peye mwens.'
    }
  },
  compta: {
    titre: { fr: 'Votre comptabilité', ht: 'Kontablite ou' },
    etapes: {
      fr: ['Les ventes encaissées sur la plateforme s\'inscrivent toutes seules.',
           'Ajoutez vos dépenses à la main : loyer, marchandise, transport, salaires.',
           'Le résultat du mois se lit en haut — c\'est lui qui dit si vous gagnez.'],
      ht: ['Lavant ou ankese sou platfòm nan antre pou kont yo.',
           'Ajoute depans ou yo alamen : lwaye, machandiz, transpò, salè.',
           'Rezilta mwa a li anwo a — se li ki di si w ap fè lajan.']
    },
    astuce: {
      fr: 'Saisissez vos dépenses le jour même, en deux lignes. Un mois de retard et plus personne ne se souvient de rien.',
      ht: 'Antre depans ou yo menm jou a, an de liy. Yon mwa reta epi pèsonn pa sonje anyen ankò.'
    }
  },
  employes: {
    titre: { fr: 'Vos employés', ht: 'Anplwaye ou yo' },
    etapes: {
      fr: ['Créez une fiche par employé, avec son poste et son mode de paie.',
           'Indiquez le taux : mensuel, quinzaine, journalier ou horaire.',
           'Les heures se saisissent dans Planning de l\'équipe, la paie se calcule dans Heures & paie.'],
      ht: ['Kreye yon fich pa anplwaye, ak pòs li ak mòd pèyman l.',
           'Mete to a : mansyèl, kenzèn, jounalye oswa pa èdtan.',
           'Èdtan yo antre nan Planning ekip la, pèyman an kalkile nan Èdtan ak pèy.']
    },
    astuce: {
      fr: 'Enregistrez les avances au moment où vous les donnez : elles se déduisent toutes seules du net à payer, et la discussion de fin de mois n\'a plus lieu.',
      ht: 'Anrejistre avans yo lè w ap bay yo : yo dedui pou kont yo nan nèt pou peye a, epi diskisyon fen mwa a pa gen rezon pou fèt.'
    }
  },
  'planning-equipe': {
    titre: { fr: "Planning de l'équipe", ht: 'Planning ekip la' },
    etapes: {
      fr: ['Posez les créneaux de la semaine, un employé par ligne.',
           'Marquez fait, absent ou annulé à mesure : seuls les créneaux faits comptent dans la paie.',
           'Copiez la semaine précédente quand le rythme ne change pas.'],
      ht: ['Mete kreno semèn nan, yon anplwaye pa liy.',
           'Make fèt, absan oswa anile apiyapi : se kreno ki fèt yo sèlman ki konte nan pèy la.',
           'Kopye semèn anvan an lè ritm nan pa chanje.']
    },
    astuce: {
      fr: 'Un horaire de nuit qui passe minuit est compté correctement : 22 h → 6 h font bien huit heures.',
      ht: 'Yon orè lannwit ki pase minwi konte kòrèkteman : 22 è → 6 è fè uit èdtan vre.'
    }
  },
  qr: {
    titre: { fr: 'Code QR et flyer', ht: 'Kòd QR ak flyer' },
    etapes: {
      fr: ['Téléchargez votre code QR : le fichier reste net à toutes les tailles.',
           'Collez-le sur votre porte, votre comptoir, votre moto.',
           'Créez votre flyer et imprimez-le, ou enregistrez-le en PDF pour WhatsApp.'],
      ht: ['Telechaje kòd QR ou : fichye a rete nèt nan tout gwosè.',
           'Kole l sou pòt ou, kontwa ou, moto ou.',
           'Kreye flyer ou epi enprime l, oswa anrejistre l an PDF pou WhatsApp.']
    },
    astuce: {
      fr: 'Collez le code à hauteur des yeux, pas au ras du sol : on scanne ce qu\'on lit sans se baisser.',
      ht: 'Kole kòd la nan wotè je, pa atè : moun eskane sa yo li san bese.'
    }
  },
  avis: {
    titre: { fr: 'Avis et notes', ht: 'Avi ak nòt' },
    etapes: {
      fr: ['Les clients notent après leur passage ; la moyenne s\'affiche sur votre page.',
           'Répondez aux avis, surtout aux mauvais : la réponse se lit autant que l\'avis.'],
      ht: ['Kliyan yo bay nòt apre vizit yo ; mwayèn nan parèt sou paj ou.',
           'Reponn avi yo, sitou move yo : repons lan li otan ke avi a.']
    },
    astuce: {
      fr: 'Demandez l\'avis au moment où le client est satisfait, devant vous, pas trois jours après par message.',
      ht: 'Mande avi a lè kliyan an kontan, devan ou, pa twa jou apre nan mesaj.'
    }
  },
  abonnement: {
    titre: { fr: 'Votre abonnement', ht: 'Abònman ou' },
    etapes: {
      fr: ['L\'essai dure 30 jours, toutes fonctions comprises.',
           'Le forfait fixe vos limites et votre commission sur les paiements en ligne.',
           'Changez de forfait quand vos limites vous gênent, pas avant.'],
      ht: ['Esè a dire 30 jou, ak tout fonksyon yo.',
           'Fòfè a fikse limit ou yo ak komisyon ou sou pèyman an liy.',
           'Chanje fòfè lè limit yo jennen ou, pa anvan.']
    },
    astuce: {
      fr: 'Les paiements reçus sur vos propres comptes ne portent pas de commission : le forfait Découverte suffit plus longtemps qu\'on ne croit.',
      ht: 'Pèyman ou resevwa sou pwòp kont ou pa gen komisyon : fòfè Dekouvèt la ase pi lontan pase sa moun kwè.'
    }
  }
};

/** Aide d'un écran, dans la langue demandée. Rien si l'écran n'en a pas. */
function pour(section, langue) {
  const a = AIDE[section];
  if (!a) return null;
  const l = langue === 'ht' ? 'ht' : 'fr';
  /* Le créole retombe sur le français quand il manque : c'est la règle
     déjà suivie par les traductions de la plateforme, et une aide en
     français vaut mieux qu'un panneau vide. */
  const prendre = (v) => (v && (v[l] || v.fr)) || null;
  return {
    section,
    titre: prendre(a.titre),
    etapes: prendre(a.etapes) || [],
    astuce: prendre(a.astuce)
  };
}

/** Écrans disposant d'une aide : le tableau de bord n'affiche le bouton que pour eux. */
const SECTIONS = Object.keys(AIDE);

module.exports = { AIDE, SECTIONS, pour };
