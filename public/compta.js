/* ==========================================================
   Comptabilité — interface du tableau de bord
   ----------------------------------------------------------
   Chargé après dashboard.html, dans la même portée : `api`,
   `ent`, `toast`, `ech` et `fermer` viennent de là.

   Parti pris d'affichage : aucun numéro de compte visible
   tant que l'entreprise ne va pas le chercher (Balance,
   Grand livre). Partout ailleurs, on parle en gourdes, en
   caisses et en catégories.
   ========================================================== */

let REF_COMPTA = null;        // comptes, catégories, opérations
let VUE_COMPTA = 'tableau';
let TIERS_CONNUS = [];        // pour l'autocomplétion de la saisie

const htgC = (n) => (Math.round(+n || 0)).toLocaleString('fr-HT') + ' HTG';
const moisLisible = (m) => {
  const [a, mo] = String(m).split('-').map(Number);
  return ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'][mo - 1] + ' ' + String(a).slice(2);
};

/* L'onglet Comptabilité n'existe que si le forfait l'ouvre. Plutôt
   que de le masquer sans explication, on le laisse visible et on
   explique à l'intérieur : c'est ainsi qu'une entreprise découvre
   ce qu'elle gagnerait à changer de forfait. */
function comptaOuverte(){
  return (ent.options || []).some(o => o.cle === 'comptabilite' && o.ouverte);
}

/* Appelé au chargement du fichier, et de nouveau quand le tableau de
   bord a fini de charger l'entreprise. Idempotent : on peut l'appeler
   dix fois sans brancher dix fois les mêmes écouteurs. */
let comptaPrete = false;
function initCompta(){
  if (comptaPrete) return;
  if (!document.getElementById('cpDu')) return;
  document.querySelectorAll('.onglet-compta').forEach(b => {
    b.onclick = () => {
      VUE_COMPTA = b.dataset.vue;
      document.querySelectorAll('.onglet-compta').forEach(x => x.classList.toggle('on', x === b));
      chargerVueCompta();
    };
  });
  periodeCompta('mois', true);
  comptaPrete = true;
}

/* Période affichée. Le mois en cours par défaut : c'est la question
   qu'une entreprise se pose tous les jours. */
function periodeCompta(quoi, silencieux){
  const d = new Date();
  let du, au;
  if (quoi === 'precedent') {
    du = new Date(Date.UTC(d.getFullYear(), d.getMonth() - 1, 1));
    au = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 0));
  } else if (quoi === 'exercice') {
    du = new Date(Date.UTC(d.getFullYear(), 0, 1));
    au = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0));
  } else {
    du = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
    au = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0));
  }
  document.getElementById('cpDu').value = du.toISOString().slice(0, 10);
  document.getElementById('cpAu').value = au.toISOString().slice(0, 10);
  if (!silencieux) chargerVueCompta();
}

function bornesCompta(){
  return { du: document.getElementById('cpDu').value, au: document.getElementById('cpAu').value };
}

async function chargerVueCompta(){
  const z = document.getElementById('cpVue');
  if (!z) return;
  if (!comptaOuverte()) {
    z.innerHTML = `<div class="carte"><div class="carte-corps centre" style="padding:26px 18px">
      <div style="font-size:34px">📒</div>
      <h2 style="font-size:17px;margin-top:8px">La comptabilité est comprise dans le forfait Pro</h2>
      <p class="petit muet" style="margin-top:8px;max-width:460px;margin-left:auto;margin-right:auto">
        Recettes et dépenses par catégorie, suivi de vos caisses, ce que vos clients vous doivent,
        ce que vous devez à vos fournisseurs, déclaration de TCA, résultat mensuel et export
        pour votre comptable. Vos ventes encaissées par Konekte s'y inscrivent toutes seules.</p>
      <button class="btn btn-primaire mt" onclick="allerSection('abonnement')">Voir les forfaits</button>
    </div></div>`;
    return;
  }
  const { du, au } = bornesCompta();
  document.getElementById('cpExport').href = `/api/mon-entreprise/compta/export.csv?du=${du}&au=${au}`;
  if (!REF_COMPTA) {
    try { REF_COMPTA = await api('/api/mon-entreprise/compta/referentiel'); }
    catch(e){ z.innerHTML = `<p class="petit muet">${ech(e.message)}</p>`; return; }
  }
  z.innerHTML = '<p class="petit muet">Calcul en cours…</p>';
  try {
    if (VUE_COMPTA === 'tableau') await vueTableauCompta();
    else if (VUE_COMPTA === 'journal') await vueJournal();
    else if (VUE_COMPTA === 'resultat') await vueResultat();
    else if (VUE_COMPTA === 'tresorerie') await vueTresorerie();
    else if (VUE_COMPTA === 'tiers') await vueTiers();
    else if (VUE_COMPTA === 'tca') await vueTca();
    else if (VUE_COMPTA === 'balance') await vueBalance();
    else if (VUE_COMPTA === 'reglages') await vueReglages();
  } catch(e){ z.innerHTML = `<div class="carte"><div class="carte-corps"><p class="petit" style="color:var(--rouge)">${ech(e.message)}</p></div></div>`; }
}

/* ---------- Vue d'ensemble ---------- */
async function vueTableauCompta(){
  const t = await api('/api/mon-entreprise/compta/tableau');
  const cmp = (v) => v === null || v === undefined ? ''
    : `<div class="cmp ${v >= 0 ? 'hausse' : 'baisse'}">${v >= 0 ? '▲' : '▼'} ${Math.abs(v)} % vs mois dernier</div>`;

  const maxEvo = Math.max(1, ...t.evolution.map(m => Math.max(m.recettes, m.depenses)));
  const barres = t.evolution.map(m => `
    <div class="cp-mois">
      <div class="cp-paire">
        <div class="cp-bar r" style="height:${Math.round(m.recettes / maxEvo * 100)}%" title="Recettes ${htgC(m.recettes)}"></div>
        <div class="cp-bar d" style="height:${Math.round(m.depenses / maxEvo * 100)}%" title="Dépenses ${htgC(m.depenses)}"></div>
      </div>
      <span class="cp-etiq">${moisLisible(m.mois)}</span>
    </div>`).join('');

  const postes = (liste, couleur) => {
    const tot = liste.reduce((s, x) => s + x.montant, 0) || 1;
    return liste.map(x => `<div class="cp-poste">
      <div class="tete"><span>${ech(x.nom)}</span><strong class="num">${htgC(x.montant)}</strong></div>
      <div class="cp-jauge"><div style="width:${Math.max(2, Math.round(x.montant / tot * 100))}%;background:${couleur}"></div></div>
    </div>`).join('') || '<p class="petit muet">Rien sur la période.</p>';
  };

  document.getElementById('cpVue').innerHTML = `
    ${(t.alertes || []).map(a => `<div class="panneau" style="border-color:var(--orange);background:#FFFBF2;margin-bottom:12px">
      <strong class="petit">⚠️ ${ech(a)}</strong></div>`).join('')}

    <div class="cp-cartes">
      <div class="cp-carte recette"><span class="etq">Recettes du mois</span>
        <div class="val">${htgC(t.recettes)}</div>${cmp(t.variationRecettes)}</div>
      <div class="cp-carte depense"><span class="etq">Dépenses du mois</span>
        <div class="val">${htgC(t.depenses)}</div></div>
      <div class="cp-carte resultat${t.resultat < 0 ? ' negatif' : ''}"><span class="etq">Résultat du mois</span>
        <div class="val">${htgC(t.resultat)}</div>${cmp(t.variationResultat)}</div>
      <div class="cp-carte"><span class="etq">Argent disponible</span>
        <div class="val" style="color:${t.tresorerie.total < 0 ? 'var(--rouge)' : 'var(--marine)'}">${htgC(t.tresorerie.total)}</div>
        <div class="cmp muet">${t.tresorerie.comptes.length} caisse${t.tresorerie.comptes.length > 1 ? 's' : ''}</div></div>
    </div>

    <div class="grille mt" style="grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px">
      <div class="carte"><div class="carte-corps">
        <h2 style="font-size:15px">Six derniers mois</h2>
        <div class="cp-barres">${barres}</div>
        <div class="cp-legende">
          <span><span class="cp-pastille" style="background:#1E7E34"></span>Recettes</span>
          <span><span class="cp-pastille" style="background:#C2410C"></span>Dépenses</span>
        </div>
      </div></div>

      <div class="carte"><div class="carte-corps">
        <h2 style="font-size:15px">Ce qui est en jeu</h2>
        <table style="margin-top:10px">
          <tr><td class="petit">Vos clients vous doivent</td>
              <td class="num"><strong>${htgC(t.creances)}</strong>
              ${t.creancesEnRetard ? `<br><span class="petit" style="color:var(--rouge)">dont ${htgC(t.creancesEnRetard)} en retard</span>` : ''}</td></tr>
          <tr><td class="petit">Vous devez à vos fournisseurs</td>
              <td class="num"><strong>${htgC(t.dettes)}</strong>
              ${t.dettesEnRetard ? `<br><span class="petit" style="color:var(--rouge)">dont ${htgC(t.dettesEnRetard)} en retard</span>` : ''}</td></tr>
          ${t.tca ? `<tr><td class="petit">TCA à verser ce mois</td><td class="num"><strong>${htgC(t.tca.aVerser)}</strong>
              ${t.tca.creditReportable ? `<br><span class="petit muet">crédit reportable ${htgC(t.tca.creditReportable)}</span>` : ''}</td></tr>` : ''}
          ${t.tauxMarge !== null ? `<tr><td class="petit">Marge brute</td><td class="num"><strong>${t.tauxMarge} %</strong><br><span class="petit muet">${htgC(t.margeBrute)}</span></td></tr>` : ''}
          <tr><td class="petit">Résultat depuis le ${ech(t.exercice.du)}</td>
              <td class="num"><strong style="color:${t.exercice.resultat < 0 ? 'var(--rouge)' : '#15803D'}">${htgC(t.exercice.resultat)}</strong></td></tr>
        </table>
        ${t.reprises ? `<p class="aide mt">${t.reprises} opération${t.reprises > 1 ? 's' : ''} de la plateforme reprise${t.reprises > 1 ? 's' : ''} automatiquement.</p>` : ''}
      </div></div>
    </div>

    <div class="grille mt" style="grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px">
      <div class="carte"><div class="carte-corps">
        <h2 style="font-size:15px">D'où vient l'argent</h2>${postes(t.topRecettes, 'linear-gradient(90deg,#34A853,#1E7E34)')}
      </div></div>
      <div class="carte"><div class="carte-corps">
        <h2 style="font-size:15px">Où il part</h2>${postes(t.topDepenses, 'linear-gradient(90deg,#FB923C,#C2410C)')}
      </div></div>
    </div>

    ${t.clotureJusquau ? `<p class="aide mt">🔒 Période clôturée jusqu'au ${ech(t.clotureJusquau)} : ces écritures ne sont plus modifiables.</p>` : ''}`;
}

/* ---------- Journal ---------- */
async function vueJournal(){
  const { du, au } = bornesCompta();
  const rech = document.getElementById('cpRech') ? document.getElementById('cpRech').value : '';
  const j = await api(`/api/mon-entreprise/compta/ecritures?du=${du}&au=${au}&q=${encodeURIComponent(rech)}`);
  const OP = REF_COMPTA.OPERATIONS;
  const lignes = j.ecritures.map(x => {
    const op = OP[x.operation] || { nom: { fr: x.operation }, signe: 0 };
    const signe = op.signe;
    const couleur = signe > 0 ? '#15803D' : (signe < 0 ? '#C2410C' : 'var(--gris)');
    const prefixe = signe > 0 ? '+' : (signe < 0 ? '−' : '');
    return `<tr>
      <td class="petit muet" style="white-space:nowrap">${ech(x.date)}</td>
      <td><strong class="petit">${ech(x.libelle)}</strong>${x.auto ? '<span class="cp-auto">auto</span>' : ''}
        <div class="petit muet">${ech(op.nom.fr)}${x.tiersNom ? ' · ' + ech(x.tiersNom) : ''}${x.piece ? ' · pièce ' + ech(x.piece) : ''}</div></td>
      <td class="petit muet">${x.tresorerie ? ech((REF_COMPTA.COMPTES[x.tresorerie] || {nom:{}}).nom.fr || '') : '—'}</td>
      <td class="num"><strong style="color:${couleur}">${prefixe}${htgC(x.montant)}</strong>
        ${x.tca ? `<br><span class="petit muet">dont TCA ${htgC(x.tca)}</span>` : ''}</td>
      <td class="flex" style="gap:5px">
        ${x.auto ? '' : `<button class="btn btn-fantome btn-petit" onclick='ouvrirEcriture(${JSON.stringify(x).replace(/'/g, "&#39;")})' title="Modifier">✏️</button>`}
        <button class="btn btn-fantome btn-petit" onclick="supprimerEcriture('${x.id}')" title="Supprimer">🗑️</button>
      </td></tr>`;
  }).join('');

  document.getElementById('cpVue').innerHTML = `
    <div class="carte"><div class="carte-corps">
      <div class="flex entre" style="gap:10px;flex-wrap:wrap">
        <h2 style="font-size:15px">Journal — ${j.total} opération${j.total > 1 ? 's' : ''}</h2>
        <input id="cpRech" placeholder="Rechercher un libellé, un client, une pièce…"
               style="width:auto;min-width:240px;margin:0" value="${ech(rech)}" oninput="if(this._t)clearTimeout(this._t);this._t=setTimeout(vueJournal,350)">
      </div>
      <div class="flex mt" style="gap:16px;flex-wrap:wrap">
        <span class="petit">Recettes <strong style="color:#15803D">${htgC(j.totalRecettes)}</strong></span>
        <span class="petit">Dépenses <strong style="color:#C2410C">${htgC(j.totalDepenses)}</strong></span>
        <span class="petit">Résultat <strong>${htgC(j.totalRecettes - j.totalDepenses)}</strong></span>
      </div>
      <p class="aide">Les transferts entre caisses et les règlements de dettes ne comptent ni en recette ni en dépense : l'argent bouge sans que l'entreprise s'enrichisse ou s'appauvrisse.</p>
      ${j.total ? `<div style="overflow:auto;margin-top:12px"><table>
        <tr><th>Date</th><th>Opération</th><th>Caisse</th><th class="num">Montant</th><th></th></tr>
        ${lignes}</table></div>`
        : '<p class="petit muet mt">Aucune opération sur cette période. Utilisez « Saisir une opération » pour commencer.</p>'}
    </div></div>`;
}

/* ---------- Compte de résultat ---------- */
async function vueResultat(){
  const { du, au } = bornesCompta();
  const r = await api(`/api/mon-entreprise/compta/resultat?du=${du}&au=${au}`);
  const bloc = (titre, liste, total, couleur) => `
    <div class="carte"><div class="carte-corps">
      <h2 style="font-size:15px">${titre}</h2>
      <table style="margin-top:10px">
        ${liste.map(x => `<tr><td class="petit">${ech(x.nom)}</td><td class="num">${htgC(x.montant)}</td></tr>`).join('')
          || '<tr><td class="petit muet">Rien sur la période.</td><td></td></tr>'}
        <tr><td><strong>Total</strong></td><td class="num"><strong style="color:${couleur}">${htgC(total)}</strong></td></tr>
      </table>
    </div></div>`;

  document.getElementById('cpVue').innerHTML = `
    <div class="grille" style="grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px">
      ${bloc('Produits — ce que l\'activité a rapporté', r.produits, r.totalProduits, '#15803D')}
      ${bloc('Charges — ce qu\'elle a coûté', r.charges, r.totalCharges, '#C2410C')}
    </div>
    <div class="carte mt"><div class="carte-corps centre" style="padding:20px">
      <span class="petit muet">Résultat du ${ech(r.du)} au ${ech(r.au)}</span>
      <div style="font-size:30px;font-weight:800;margin-top:5px;color:${r.resultat < 0 ? 'var(--rouge)' : '#15803D'}">${htgC(r.resultat)}</div>
      <p class="petit muet" style="margin-top:6px">${r.resultat < 0
        ? 'Les charges dépassent les produits sur cette période.'
        : 'Les produits dépassent les charges sur cette période.'}</p>
      ${r.tauxMarge !== null ? `<p class="aide">Marge brute : ${r.tauxMarge} % — ce qu'il reste des ventes après avoir payé la marchandise.</p>` : ''}
      <p class="aide">Rappel : les prélèvements du propriétaire, les apports et les remboursements de prêt n'apparaissent pas ici. Ce ne sont pas des charges, mais des mouvements de patrimoine.</p>
    </div></div>`;
}

/* ---------- Caisses ---------- */
async function vueTresorerie(){
  const { au } = bornesCompta();
  const t = await api(`/api/mon-entreprise/compta/tresorerie?au=${au}`);
  const max = Math.max(1, ...t.evolution.map(m => Math.abs(m.resultat)));
  document.getElementById('cpVue').innerHTML = `
    <div class="cp-cartes">
      ${t.comptes.map(c => `<div class="cp-carte${c.solde < 0 ? ' negatif' : ''}">
        <span class="etq">${ech(c.nom)}</span>
        <div class="val">${htgC(c.solde)}</div>
        ${c.solde < 0 ? '<div class="cmp baisse">Solde négatif — recette manquante ?</div>'
                      : (c.horsListe ? '<div class="cmp muet">caisse non déclarée</div>' : '')}
      </div>`).join('')}
    </div>
    <div class="carte mt"><div class="carte-corps">
      <div class="flex entre"><h2 style="font-size:15px">Total disponible au ${ech(t.au)}</h2>
        <strong style="font-size:19px;color:${t.total < 0 ? 'var(--rouge)' : 'var(--marine)'}">${htgC(t.total)}</strong></div>
      <p class="aide">Ce total est de l'argent, pas du bénéfice : il contient la TCA que vous devez à la DGI et les avances de vos clients.</p>
    </div></div>
    <div class="carte mt"><div class="carte-corps">
      <h2 style="font-size:15px">Résultat mois par mois</h2>
      <table style="margin-top:10px">
        <tr><th>Mois</th><th class="num">Recettes</th><th class="num">Dépenses</th><th class="num">Résultat</th><th></th></tr>
        ${t.evolution.map(m => `<tr>
          <td class="petit">${moisLisible(m.mois)}</td>
          <td class="num petit">${htgC(m.recettes)}</td>
          <td class="num petit">${htgC(m.depenses)}</td>
          <td class="num"><strong style="color:${m.resultat < 0 ? 'var(--rouge)' : '#15803D'}">${htgC(m.resultat)}</strong></td>
          <td style="width:40%"><div class="cp-jauge"><div style="width:${Math.round(Math.abs(m.resultat) / max * 100)}%;background:${m.resultat < 0 ? 'var(--rouge)' : 'linear-gradient(90deg,#34A853,#1E7E34)'}"></div></div></td>
        </tr>`).join('')}
      </table>
    </div></div>`;
}

/* ---------- Clients et fournisseurs ---------- */
async function vueTiers(){
  const t = await api('/api/mon-entreprise/compta/tiers');
  TIERS_CONNUS = [...t.clients.liste.map(x => x.nom), ...t.fournisseurs.liste.map(x => x.nom)];
  const bloc = (titre, d, action, aide) => `
    <div class="carte"><div class="carte-corps">
      <div class="flex entre"><h2 style="font-size:15px">${titre}</h2><strong>${htgC(d.total)}</strong></div>
      ${d.enRetard ? `<p class="petit" style="color:var(--rouge);margin-top:5px">${htgC(d.enRetard)} en retard de règlement</p>` : ''}
      ${d.liste.length ? `<div style="overflow:auto;margin-top:10px"><table>
        <tr><th>Nom</th><th>Échéance</th><th class="num">Solde</th><th></th></tr>
        ${d.liste.map(x => `<tr>
          <td><strong class="petit">${ech(x.nom)}</strong><div class="petit muet">${x.operations} opération${x.operations > 1 ? 's' : ''} · dernière le ${ech(x.derniere)}</div></td>
          <td class="petit${x.enRetard ? '' : ' muet'}" style="${x.enRetard ? 'color:var(--rouge);font-weight:700' : ''}">${x.echeance ? ech(x.echeance) + (x.enRetard ? ' ⚠️' : '') : '—'}</td>
          <td class="num"><strong>${htgC(x.solde)}</strong></td>
          <td><button class="btn btn-contour btn-petit" onclick="reglerTiers('${action}','${ech(x.nom).replace(/'/g, "&#39;")}',${x.solde})">Régler</button></td>
        </tr>`).join('')}</table></div>`
        : `<p class="petit muet mt">${aide}</p>`}
    </div></div>`;

  document.getElementById('cpVue').innerHTML = `
    <div class="grille" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">
      ${bloc('Ce que vos clients vous doivent', t.clients, 'encaissement_client',
        'Personne ne vous doit rien. Les ventes à crédit apparaissent ici.')}
      ${bloc('Ce que vous devez à vos fournisseurs', t.fournisseurs, 'reglement_fournisseur',
        'Vous ne devez rien. Les achats à crédit apparaissent ici.')}
    </div>
    <p class="aide mt">Un solde disparaît de cette liste dès qu'il est entièrement réglé.</p>`;
}

/* Pré-remplit la saisie d'un règlement depuis la liste des tiers. */
function reglerTiers(operation, nom, montant){
  ouvrirEcriture();
  document.getElementById('ecOperation').value = operation;
  majFormulaireEcriture();
  document.getElementById('ecTiers').value = nom;
  document.getElementById('ecMontant').value = Math.abs(montant);
  apercuEcriture();
}

/* ---------- TCA ---------- */
async function vueTca(){
  const { du, au } = bornesCompta();
  const t = await api(`/api/mon-entreprise/compta/tca?du=${du}&au=${au}`);
  if (!t.assujetti) {
    document.getElementById('cpVue').innerHTML = `
      <div class="carte"><div class="carte-corps">
        <h2 style="font-size:15px">Vous n'êtes pas déclaré assujetti à la TCA</h2>
        <p class="petit muet mt">Aucune taxe n'est extraite de vos montants : ce que vous encaissez est entièrement une recette.</p>
        <p class="aide">Si votre entreprise est assujettie, activez-le dans les Réglages. Vos montants saisis seront alors décomposés en recette hors taxe et TCA à verser.</p>
        <button class="btn btn-contour mt" onclick="document.querySelector('.onglet-compta[data-vue=reglages]').click()">Aller aux réglages</button>
      </div></div>`;
    return;
  }
  document.getElementById('cpVue').innerHTML = `
    <div class="cp-cartes">
      <div class="cp-carte recette"><span class="etq">TCA collectée sur vos ventes</span><div class="val">${htgC(t.collectee)}</div></div>
      <div class="cp-carte depense"><span class="etq">TCA déductible sur vos achats</span><div class="val">${htgC(t.deductible)}</div></div>
      <div class="cp-carte resultat"><span class="etq">À verser à la DGI</span><div class="val">${htgC(t.aVerser)}</div></div>
    </div>
    <div class="carte mt"><div class="carte-corps">
      <h2 style="font-size:15px">Déclaration du ${ech(t.du)} au ${ech(t.au)}</h2>
      <table style="margin-top:10px">
        <tr><td class="petit">TCA collectée sur les ventes</td><td class="num">${htgC(t.collectee)}</td></tr>
        <tr><td class="petit">— TCA déductible sur les achats</td><td class="num">− ${htgC(t.deductible)}</td></tr>
        <tr><td><strong>${t.creditReportable ? 'Crédit reportable' : 'Montant à verser'}</strong></td>
            <td class="num"><strong>${htgC(t.creditReportable || t.aVerser)}</strong></td></tr>
      </table>
      ${t.creditReportable ? `<p class="aide">Vous avez payé plus de TCA que vous n'en avez collectée. Ce crédit s'impute sur vos déclarations suivantes ; il n'est pas remboursé automatiquement.</p>`
        : `<p class="aide">Taux appliqué : ${Math.round(t.taux * 1000) / 10} %. Cette TCA n'est pas à vous : gardez-la de côté jusqu'à la déclaration.</p>`}
      ${t.aVerser > 0 ? `<button class="btn btn-primaire mt" onclick="saisirVersementTca(${t.aVerser})">Enregistrer le versement à la DGI</button>` : ''}
    </div></div>`;
}

function saisirVersementTca(montant){
  ouvrirEcriture();
  document.getElementById('ecOperation').value = 'tca_versee';
  majFormulaireEcriture();
  document.getElementById('ecMontant').value = montant;
  document.getElementById('ecLibelle').value = 'Versement de TCA';
  apercuEcriture();
}

/* ---------- Balance ---------- */
async function vueBalance(){
  const { du, au } = bornesCompta();
  const b = await api(`/api/mon-entreprise/compta/balance?du=${du}&au=${au}`);
  const CLASSES = { 1: 'Capitaux', 2: 'Immobilisations', 3: 'Stocks', 4: 'Clients, fournisseurs et État',
                    5: 'Caisses et banques', 6: 'Charges', 7: 'Produits' };
  let classeEnCours = 0;
  const lignes = b.lignes.map(l => {
    const entete = l.classe !== classeEnCours
      ? (classeEnCours = l.classe, `<tr><td colspan="4" style="background:var(--gris-clair);font-weight:800;font-size:12px;padding:6px 8px">${CLASSES[l.classe] || 'Classe ' + l.classe}</td></tr>`)
      : '';
    return entete + `<tr>
      <td class="petit"><span class="muet">${l.compte}</span> ${ech(l.nom)}</td>
      <td class="num petit">${l.debit ? htgC(l.debit) : ''}</td>
      <td class="num petit">${l.credit ? htgC(l.credit) : ''}</td>
      <td class="num"><button class="btn btn-fantome btn-petit" onclick="voirGrandLivre('${l.compte}')">Détail</button></td>
    </tr>`;
  }).join('');

  document.getElementById('cpVue').innerHTML = `
    <div class="carte"><div class="carte-corps">
      <h2 style="font-size:15px">Balance générale du ${ech(b.du)} au ${ech(b.au)}</h2>
      <p class="aide">Vue comptable, pour votre comptable. Le total des débits doit égaler celui des crédits : c'est la preuve que rien n'a été perdu en route.</p>
      <div style="overflow:auto;margin-top:12px"><table>
        <tr><th>Compte</th><th class="num">Débit</th><th class="num">Crédit</th><th></th></tr>
        ${lignes || '<tr><td class="petit muet">Aucun mouvement.</td><td></td><td></td><td></td></tr>'}
        <tr><td><strong>Totaux</strong></td>
            <td class="num"><strong>${htgC(b.totalDebit)}</strong></td>
            <td class="num"><strong>${htgC(b.totalCredit)}</strong></td><td></td></tr>
      </table></div>
      <p class="petit mt" style="color:${b.totalDebit === b.totalCredit ? '#15803D' : 'var(--rouge)'};font-weight:700">
        ${b.totalDebit === b.totalCredit ? '✅ Balance équilibrée.' : '⚠️ Balance déséquilibrée — signalez-le, c\'est une anomalie.'}</p>
      <div id="cpLivre" class="mt"></div>
    </div></div>`;
}

async function voirGrandLivre(compte){
  const { du, au } = bornesCompta();
  const l = await api(`/api/mon-entreprise/compta/grand-livre?compte=${compte}&du=${du}&au=${au}`);
  document.getElementById('cpLivre').innerHTML = `
    <div class="panneau">
      <div class="flex entre"><strong class="petit">${l.compte} — ${ech(l.nom)}</strong>
        <strong class="petit">Solde ${htgC(l.solde)}</strong></div>
      <div style="overflow:auto;margin-top:8px"><table>
        <tr><th>Date</th><th>Libellé</th><th class="num">Débit</th><th class="num">Crédit</th><th class="num">Solde</th></tr>
        ${l.lignes.map(x => `<tr>
          <td class="petit muet">${ech(x.date)}</td>
          <td class="petit">${ech(x.libelle)}${x.tiers ? ' · ' + ech(x.tiers) : ''}</td>
          <td class="num petit">${x.debit ? htgC(x.debit) : ''}</td>
          <td class="num petit">${x.credit ? htgC(x.credit) : ''}</td>
          <td class="num petit"><strong>${htgC(x.solde)}</strong></td></tr>`).join('')
          || '<tr><td class="petit muet" colspan="5">Aucun mouvement sur ce compte.</td></tr>'}
      </table></div>
    </div>`;
}

/* ---------- Réglages et clôture ---------- */
async function vueReglages(){
  const r = await api('/api/mon-entreprise/compta/reglages');
  const caisses = Object.entries(REF_COMPTA.COMPTES).filter(([, d]) => d.tresorerie);
  document.getElementById('cpVue').innerHTML = `
    <div class="carte"><div class="carte-corps">
      <h2 style="font-size:15px">Taxe sur le chiffre d'affaires</h2>
      <label class="equip-case${r.tcaAssujetti ? ' on' : ''}" style="margin:12px 0 0">
        <input type="checkbox" id="rgTca"${r.tcaAssujetti ? ' checked' : ''}
               onchange="this.closest('.equip-case').classList.toggle('on', this.checked)">
        <span>Mon entreprise est assujettie à la TCA</span></label>
      <p class="aide">Si vous l'activez, chaque montant saisi est décomposé : la recette hors taxe d'un côté, la TCA à verser de l'autre. Ne l'activez que si vous êtes réellement assujetti — une TCA facturée à tort doit être reversée.</p>
      <label>Taux de TCA (%)</label>
      <input id="rgTaux" type="number" min="0" max="50" step="0.5" value="${Math.round(r.tcaTaux * 1000) / 10}">
      <p class="aide">Taux de droit commun en Haïti : 10 %. À ajuster si la loi change.</p>
      <label>Début de mon exercice comptable</label>
      <input id="rgExercice" type="date" value="${ech(r.debutExercice)}">
      <label>Caisse proposée par défaut</label>
      <select id="rgCaisse">${caisses.map(([c, d]) => `<option value="${c}"${r.caisseDefaut === c ? ' selected' : ''}>${ech(d.nom.fr)}</option>`).join('')}</select>
      <label>Les caisses que j'utilise</label>
      <div class="grille-equip">
        ${caisses.map(([c, d]) => `<label class="equip-case${r.caissesActives.includes(c) ? ' on' : ''}">
          <input type="checkbox" data-caisse="${c}"${r.caissesActives.includes(c) ? ' checked' : ''}
                 onchange="this.closest('.equip-case').classList.toggle('on', this.checked)">
          <span>${ech(d.nom.fr)}</span></label>`).join('')}
      </div>
      <p class="aide">Le portefeuille Konekte reçoit vos paiements en ligne : gardez-le coché si vous encaissez sur la plateforme.</p>
      <button class="btn btn-primaire mt" onclick="enregistrerReglagesCompta()">Enregistrer</button>
    </div></div>

    <div class="carte mt"><div class="carte-corps">
      <h2 style="font-size:15px">Clôture d'une période</h2>
      <p class="petit muet mt">Clôturer verrouille toutes les écritures jusqu'à une date : un mois déjà déclaré ne peut plus changer sans que vous le sachiez. C'est réversible.</p>
      ${r.clotureJusquau
        ? `<div class="panneau mt" style="border-color:var(--vert)">
             <strong class="petit">🔒 Clôturé jusqu'au ${ech(r.clotureJusquau)}</strong>
             <p class="aide">Les opérations antérieures ne sont plus modifiables ni supprimables.</p>
             <button class="btn btn-danger btn-petit mt" onclick="clotureCompta(null, true)">Rouvrir la période</button>
           </div>`
        : `<label>Clôturer jusqu'au</label><input id="rgCloture" type="date">
           <button class="btn btn-primaire mt" onclick="clotureCompta(document.getElementById('rgCloture').value)">Clôturer</button>`}
    </div></div>

    <div class="carte mt"><div class="carte-corps">
      <h2 style="font-size:15px">Donner mes comptes à un comptable</h2>
      <p class="petit muet mt">L'export reprend chaque opération ligne par ligne, avec les numéros de comptes : c'est le format qu'un comptable sait relire, et qui s'ouvre dans Excel.</p>
      <a class="btn btn-contour mt" id="cpExport2" href="/api/mon-entreprise/compta/export.csv?du=${bornesCompta().du}&au=${bornesCompta().au}">⬇️ Télécharger la période affichée</a>
    </div></div>`;
}

async function enregistrerReglagesCompta(){
  const caissesActives = [...document.querySelectorAll('#cpVue input[data-caisse]:checked')].map(i => i.dataset.caisse);
  try {
    await api('/api/mon-entreprise/compta/reglages', 'PUT', {
      tcaAssujetti: document.getElementById('rgTca').checked,
      tcaTaux: (+document.getElementById('rgTaux').value || 0) / 100,
      debutExercice: document.getElementById('rgExercice').value,
      caisseDefaut: document.getElementById('rgCaisse').value,
      caissesActives
    });
    REF_COMPTA = null;                 // les réglages changent ce que propose la saisie
    toast('Réglages comptables enregistrés.');
    chargerVueCompta();
  } catch(e){ toast(e.message); }
}

async function clotureCompta(jusquau, rouvrir){
  if (rouvrir) { if (!confirm('Rouvrir la période ? Les écritures redeviendront modifiables.')) return; }
  else if (!jusquau) { toast('Choisissez une date de clôture.'); return; }
  else if (!confirm(`Clôturer jusqu'au ${jusquau} ? Les opérations antérieures ne seront plus modifiables.`)) return;
  try {
    const r = await api('/api/mon-entreprise/compta/cloture', 'POST', rouvrir ? { rouvrir: true } : { jusquau });
    toast(rouvrir ? 'Période rouverte.' : 'Période clôturée.');
    if (r.resultat) toast(`Résultat de l'exercice clôturé : ${htgC(r.resultat.resultat)}`);
    chargerVueCompta();
  } catch(e){ toast(e.message); }
}

/* ---------- Saisie ---------- */
let ecrEnCours = null;

function ouvrirEcriture(ec){
  if (!REF_COMPTA) { toast('Comptabilité en cours de chargement.'); return; }
  ecrEnCours = ec || null;
  document.getElementById('titreEcriture').textContent = ec ? 'Modifier l\'opération' : 'Saisir une opération';

  const sel = document.getElementById('ecOperation');
  /* Les opérations sont regroupées : ce qui fait entrer de l'argent,
     ce qui en fait sortir, et ce qui n'est ni l'un ni l'autre. */
  const groupes = [
    { nom: 'Argent qui entre', cles: ['vente_encaissee', 'vente_a_credit', 'encaissement_client', 'apport', 'emprunt_recu'] },
    { nom: 'Argent qui sort', cles: ['achat_paye', 'achat_a_credit', 'reglement_fournisseur', 'salaire', 'immobilisation', 'prelevement', 'remboursement_emprunt', 'tca_versee'] },
    { nom: 'Sans mouvement d\'argent', cles: ['virement_interne', 'amortissement'] }
  ];
  sel.innerHTML = groupes.map(g => `<optgroup label="${g.nom}">${g.cles
    .filter(c => REF_COMPTA.OPERATIONS[c])
    .map(c => `<option value="${c}">${ech(REF_COMPTA.OPERATIONS[c].nom.fr)}</option>`).join('')}</optgroup>`).join('');

  sel.value = ec ? ec.operation : 'vente_encaissee';
  document.getElementById('ecDate').value = ec ? ec.date : new Date().toISOString().slice(0, 10);
  document.getElementById('ecMontant').value = ec ? ec.montant : '';
  document.getElementById('ecPiece').value = ec ? (ec.piece || '') : '';
  document.getElementById('ecLibelle').value = ec ? (ec.libelle || '') : '';
  document.getElementById('ecNote').value = ec ? (ec.note || '') : '';
  document.getElementById('ecTiers').value = ec ? (ec.tiersNom || '') : '';
  document.getElementById('ecEcheance').value = ec ? (ec.echeance || '') : '';
  document.getElementById('listeTiersCompta').innerHTML = TIERS_CONNUS.map(n => `<option value="${ech(n)}">`).join('');
  const tcaCase = document.getElementById('ecTca');
  tcaCase.checked = ec ? !!ec.tca : true;
  tcaCase.closest('.equip-case').classList.toggle('on', tcaCase.checked);

  majFormulaireEcriture();
  document.getElementById('voileEcriture').classList.add('ouvert');
  document.getElementById('ecMontant').focus();
}

/* Montre exactement les champs que l'opération choisie demande.
   Un formulaire qui affiche tout tout le temps se fait remplir
   n'importe comment. */
function majFormulaireEcriture(){
  const cle = document.getElementById('ecOperation').value;
  const op = REF_COMPTA.OPERATIONS[cle];
  if (!op) return;
  const r = REF_COMPTA.reglages;

  document.getElementById('ecAide').textContent = op.aide ? op.aide.fr : '';

  // Catégorie
  const zc = document.getElementById('ecZoneCategorie');
  if (op.categories) {
    const liste = REF_COMPTA[op.categories === 'recettes' ? 'RECETTES'
      : op.categories === 'depenses' ? 'DEPENSES' : 'IMMOBILISATIONS'];
    document.getElementById('ecLabelCategorie').textContent =
      op.categories === 'recettes' ? 'Nature de la recette *'
      : op.categories === 'depenses' ? 'Nature de la dépense *' : 'Nature du bien *';
    const actuel = ecrEnCours && ecrEnCours.categorie;
    document.getElementById('ecCategorie').innerHTML =
      liste.map(c => `<option value="${c.cle}"${actuel === c.cle ? ' selected' : ''}>${ech(c.nom.fr)}</option>`).join('');
    zc.style.display = '';
  } else zc.style.display = 'none';

  // Caisses
  const besoinTreso = op.debit === 'tresorerie' || op.credit === 'tresorerie' || op.debit === 'tresorerieArrivee';
  const zt = document.getElementById('ecZoneTresorerie');
  if (besoinTreso) {
    const actives = r.caissesActives.length ? r.caissesActives : REF_COMPTA.TRESORERIE;
    const choix = actives.map(c => `<option value="${c}">${ech((REF_COMPTA.COMPTES[c] || {nom:{}}).nom.fr)}</option>`).join('');
    const selT = document.getElementById('ecTresorerie');
    selT.innerHTML = choix;
    selT.value = (ecrEnCours && ecrEnCours.tresorerie) || r.caisseDefaut;
    document.getElementById('ecLabelTresorerie').textContent =
      op.debit === 'tresorerie' ? 'Dans quelle caisse l\'argent entre *'
      : (op.debit === 'tresorerieArrivee' ? 'Caisse de départ *' : 'De quelle caisse l\'argent sort *');
    zt.style.display = '';
    const za = document.getElementById('ecZoneArrivee');
    if (op.debit === 'tresorerieArrivee') {
      const selA = document.getElementById('ecArrivee');
      selA.innerHTML = choix;
      selA.value = (ecrEnCours && ecrEnCours.tresorerieArrivee) || actives.find(c => c !== selT.value) || '';
      za.style.display = '';
    } else za.style.display = 'none';
  } else { zt.style.display = 'none'; document.getElementById('ecZoneArrivee').style.display = 'none'; }

  // Tiers
  const ztr = document.getElementById('ecZoneTiers');
  if (op.tiersRequis) {
    document.getElementById('ecLabelTiers').textContent =
      op.tiersRequis === 'client' ? 'Nom du client *' : 'Nom du fournisseur *';
    ztr.style.display = '';
  } else ztr.style.display = 'none';

  // TCA : seulement si l'entreprise est assujettie et si l'opération en porte
  const ztc = document.getElementById('ecZoneTca');
  ztc.style.display = (r.tcaAssujetti && op.tca) ? '' : 'none';
  document.getElementById('ecAideTca').textContent = op.tca === 'collectee'
    ? `Décochez si cette vente n'est pas soumise à la TCA. Sinon, ${Math.round(r.tcaTaux * 1000) / 10} % du montant sera isolé comme taxe à verser.`
    : `Décochez si le reçu ne mentionne pas de TCA. Sinon, ${Math.round(r.tcaTaux * 1000) / 10} % du montant sera isolé comme taxe récupérable.`;

  apercuEcriture();
}

/* Aperçu en clair : ce que l'opération va produire. L'entreprise
   voit la TCA extraite avant d'enregistrer, pas après. */
function apercuEcriture(){
  const cle = document.getElementById('ecOperation').value;
  const op = REF_COMPTA.OPERATIONS[cle];
  const r = REF_COMPTA.reglages;
  const montant = +document.getElementById('ecMontant').value || 0;
  const z = document.getElementById('ecApercu');
  if (!op || montant <= 0) { z.innerHTML = '<span class="petit muet">Saisissez un montant pour voir le détail.</span>'; return; }

  const avecTca = r.tcaAssujetti && op.tca && document.getElementById('ecTca').checked;
  const tca = avecTca ? Math.round(montant - montant / (1 + r.tcaTaux)) : 0;
  const base = montant - tca;
  const effet = op.signe > 0 ? `<strong style="color:#15803D">+ ${htgC(base)} de recette</strong>`
    : op.signe < 0 ? `<strong style="color:#C2410C">− ${htgC(base)} de dépense</strong>`
    : '<strong class="muet">Aucun effet sur le résultat — seulement un mouvement d\'argent.</strong>';

  z.innerHTML = `<div class="petit">${effet}
    ${tca ? `<br>dont TCA ${op.tca === 'collectee' ? 'à verser' : 'récupérable'} : <strong>${htgC(tca)}</strong>` : ''}
    <br><span class="muet">Montant total du mouvement : ${htgC(montant)}</span></div>`;
}

async function enregistrerEcriture(){
  const corps = {
    operation: document.getElementById('ecOperation').value,
    date: document.getElementById('ecDate').value,
    montant: +document.getElementById('ecMontant').value || 0,
    categorie: document.getElementById('ecCategorie').value,
    tresorerie: document.getElementById('ecTresorerie').value,
    tresorerieArrivee: document.getElementById('ecArrivee').value,
    tiersNom: document.getElementById('ecTiers').value.trim(),
    echeance: document.getElementById('ecEcheance').value,
    piece: document.getElementById('ecPiece').value.trim(),
    libelle: document.getElementById('ecLibelle').value.trim(),
    note: document.getElementById('ecNote').value.trim(),
    tca: document.getElementById('ecTca').checked
  };
  try {
    if (ecrEnCours) await api('/api/mon-entreprise/compta/ecritures/' + ecrEnCours.id, 'PUT', corps);
    else await api('/api/mon-entreprise/compta/ecritures', 'POST', corps);
    fermer('voileEcriture');
    toast('Opération enregistrée.');
    chargerVueCompta();
  } catch(e){ toast(e.message); }
}

async function supprimerEcriture(id){
  if (!confirm('Supprimer cette opération ? Elle disparaîtra de tous vos états.')) return;
  try {
    await api('/api/mon-entreprise/compta/ecritures/' + id, 'DELETE');
    toast('Opération supprimée.');
    chargerVueCompta();
  } catch(e){ toast(e.message); }
}

document.getElementById('ecMontant')?.addEventListener('input', apercuEcriture);
initCompta();
