/**
 * Deux modes d’emploi A4 : simple volontaire médical / non médical.
 * Captures petites, texte d’abord : on explique comment ça marche.
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const CAP = join(ROOT, 'docs/guides/captures')
const OUT_HTML = join(ROOT, 'docs/guides')
const LOGO = join(ROOT, 'public/icons/ha-logo-512-v4.png')
const LOGO_S = join(ROOT, 'public/icons/ha-logo-192-v4.png')

function src(name) {
  const p = join(CAP, name + '.png')
  return existsSync(p) ? `file://${p}` : ''
}

function fig(file, title, body, extraClass = '') {
  const s = src(file)
  if (!s) return `<div class="bloc"><h3>${title}</h3>${body}</div>`
  return `<figure class="fig ${extraClass}">
    <div class="phone"><img src="${s}" alt="" /></div>
    <figcaption><h3>${title}</h3>${body}</figcaption>
  </figure>`
}

function figDesk(file, title, body) {
  const s = src(file)
  if (!s) return `<div class="bloc"><h3>${title}</h3>${body}</div>`
  return `<figure class="fig fig-desk">
    <div class="phone desk"><img src="${s}" alt="" /></div>
    <figcaption><h3>${title}</h3>${body}</figcaption>
  </figure>`
}

const CSS = `
:root {
  --accent: #1BB0CE; --heading: #0E4A5A; --blue: #185FA5;
  --card: #fff; --border: #E3E0DC; --text: #1A1514;
  --muted: #7A7470; --text2: #3F3A37;
  --ok: #3B6D11; --ok-bg: #EAF3DE;
  --warn: #8A6D1B; --warn-bg: #FAEEDA;
  --note-bg: #E6F7FA;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: var(--text); }
body { font-family: 'DM Sans', system-ui, sans-serif; line-height: 1.5; font-size: 11.4pt; }
h1, h2, h3 { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600; color: var(--heading); line-height: 1.18; }
h1 { font-size: 26pt; margin: 8px 0 6px; }
h2 { font-size: 16.5pt; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1.5px solid var(--accent); }
h3 { font-size: 12.5pt; margin: 0 0 6px; border: 0; }
p { margin: 0 0 8px; color: var(--text2); }
ul, ol { margin: 0 0 8px; padding-left: 1.15em; color: var(--text2); }
li { margin: 0 0 4px; }
.wrap { max-width: 180mm; margin: 0 auto; }
.cover {
  text-align: center; padding: 10px 12px 14px;
  background: linear-gradient(180deg, #fff 0%, #F4FBFC 100%);
  border: 1px solid var(--border); border-radius: 16px;
}
.cover img.logo { width: 88px; height: 88px; object-fit: contain; display: block; margin: 0 auto 4px; }
.tag { display: inline-block; margin-top: 4px; padding: 3px 10px; border-radius: 99px;
  background: #E6F7FA; color: var(--heading); font-size: 9.5pt; font-weight: 700; }
.lead { max-width: 42em; margin: 6px auto 0; font-size: 11pt; }
.meta { margin-top: 8px; font-size: 9pt; color: var(--muted); }
.toc { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin: 12px 0 4px; }
.toc span { display: flex; gap: 8px; align-items: center; font-size: 9.5pt; font-weight: 600; color: var(--heading);
  background: #fff; border: 1px solid var(--border); border-radius: 9px; padding: 6px 8px; }
.toc i { width: 18px; height: 18px; border-radius: 99px; background: #E6F7FA; color: var(--accent);
  display: grid; place-items: center; font-style: normal; font-size: 8.5pt; font-weight: 700; flex-shrink: 0; }
.fig {
  display: grid; grid-template-columns: 92px 1fr; gap: 10px 14px;
  align-items: start; margin: 8px 0 14px; break-inside: avoid;
}
.fig-desk { grid-template-columns: 148px 1fr; }
.phone {
  width: 92px; background: #1A1514; border-radius: 13px; padding: 4px 4px 6px;
  box-shadow: 0 4px 10px rgba(0,0,0,.12);
}
.phone.desk { width: 148px; }
.phone img { display: block; width: 100%; border-radius: 9px; }
figcaption p:last-child, .bloc p:last-child { margin-bottom: 0; }
.note, .warn, .ok { border-radius: 9px; padding: 8px 10px; font-size: 10pt; margin: 8px 0 10px; }
.note { background: var(--note-bg); color: var(--heading); }
.warn { background: var(--warn-bg); color: var(--warn); }
.ok { background: var(--ok-bg); color: var(--ok); }
kbd { font-family: inherit; font-size: 9.5pt; background: #fff; border: 1px solid var(--border);
  border-radius: 5px; padding: 0 5px; color: var(--heading); font-weight: 600; }
.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 8px 0 12px; }
.card { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; }
.card h3 { font-size: 11pt; margin-bottom: 3px; }
.card p { font-size: 10pt; margin: 0; }
footer { margin-top: 16px; text-align: center; font-size: 8.5pt; color: #A8A29D; }
.url { font-family: ui-monospace, Menlo, monospace; font-size: 9.5pt; background: #fff;
  border: 1px dashed var(--accent); border-radius: 8px; padding: 6px 8px; color: var(--heading); word-break: break-all; }
@page { size: A4; margin: 12mm 14mm 14mm; }
@media print {
  .fig, .cover, .note, .warn, .ok, .card { break-inside: avoid; }
  h2 { break-after: avoid; }
}
`

function shell(title, tag, lead, inner) {
  return `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8" />
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>${CSS}</style>
</head><body><div class="wrap">
<header class="cover">
  <img class="logo" src="file://${LOGO}" alt="Heart’s Angels ASBL" />
  <div class="tag">${tag}</div>
  <h1>Mode d’emploi</h1>
  <p class="lead">${lead}</p>
  <p class="meta">Format A4 · à imprimer ou à joindre en PDF à l’invitation · Heart’s Angels ASBL · octobre 2026</p>
</header>
${inner}
<footer>
  <img src="file://${LOGO_S}" width="36" height="36" alt="" style="display:block;margin:0 auto 6px" />
  Heart’s Angels ASBL — Le rêve d’un jour<br />
  © 2026 Heart’s Angels ASBL &amp; Laurent Noulin — Tous droits réservés.
</footer>
</div></body></html>`
}

const COMMUN_COMPTE = `
<h2>1. Créer ton compte</h2>
<p>Tu ne t’inscris pas tout seul. La coordination t’envoie un <strong>lien d’invitation</strong> par e-mail (valable <strong>7 jours</strong>). Ta fiche (prénom, nom, type de volontaire) est déjà préparée. Toi, tu n’as qu’à choisir un mot de passe.</p>
${fig('commun_inscription', 'Écran après le lien', `
<p>L’e-mail est déjà rempli : tu ne le changes pas. Tu encodes deux fois le même mot de passe, puis tu touches <kbd>Créer mon compte</kbd>.</p>
<ul>
  <li>Au moins <strong>10 caractères</strong>.</li>
  <li>Une <strong>majuscule</strong>, une <strong>minuscule</strong>, un <strong>chiffre</strong> et un caractère spécial (<kbd>!</kbd> <kbd>*</kbd> <kbd>@</kbd>…).</li>
  <li>Ce mot de passe est <strong>personnel</strong> : l’ASBL ne le connaît pas. Ne le partage pas.</li>
</ul>`)}
<p>Si le lien ne s’ouvre pas : va sur l’écran de connexion et touche <kbd>J’ai une invitation</kbd>, puis encode le code (du type <kbd>HA-XXXX-XXXX</kbd>) qui est dans le mail.</p>
<p class="note">Ce n’est <strong>pas</strong> l’espace des hôpitaux et maisons de repos. N’utilise jamais le bouton <kbd>Accès partenaire</kbd> : autre adresse, autre mot de passe.</p>
`

const COMMUN_LOGIN = `
<h2>2. Te connecter ensuite</h2>
<p>Une fois le compte créé, tu reviens toujours ici :</p>
<p class="url">https://heart-s-angels.web.app/login</p>
${fig('commun_login', 'Espace de gestion', `
<p>Trois champs / boutons seulement :</p>
<ul>
  <li><strong>Adresse e-mail</strong> — celui de l’invitation.</li>
  <li><strong>Mot de passe</strong> — celui que tu as choisi.</li>
  <li><kbd>Se connecter</kbd>.</li>
</ul>
<p>En dessous : <kbd>Accès partenaire</kbd> (à ignorer) et <kbd>J’ai une invitation</kbd> (seulement si tu n’as pas encore de compte).</p>`)}
${fig('commun_login_rempli', 'Connexion remplie', `
<p>Sur téléphone, tu peux ajouter la page à l’écran d’accueil (partage → « Sur l’écran d’accueil ») : l’app s’ouvre comme une application, sans barre d’adresse.</p>
<p>Si une bannière <kbd>Mettre à jour</kbd> apparaît, accepte-la : c’est une nouvelle version. Sans ça, tu peux rester sur un écran ancien.</p>`)}
`

function medicalInner() {
  return `
<nav class="toc" aria-label="Sommaire">
  <span><i>1</i> Compte</span><span><i>2</i> Connexion</span>
  <span><i>3</i> Tes 4 menus</span><span><i>4</i> Ma fiche</span>
  <span><i>5</i> Disponibilités</span><span><i>6</i> Mes missions</span>
  <span><i>7</i> Jour J — 9 écrans</span><span><i>8</i> Défraiements</span>
</nav>
<p class="ok">Ce document est pour un <strong>simple volontaire médical</strong> (infirmier, médecin, ambulancier). Tu vois le dossier patient, les traitements et le protocole de détresse. Le PDF non médical n’a pas ces écrans — c’est voulu.</p>
<p>Les captures sont des <strong>démonstrations fictives</strong> (Marc, visite à la famille). Un vrai dossier se comporte pareil, avec de vraies données à garder secrètes.</p>
${COMMUN_COMPTE}
${COMMUN_LOGIN}

<h2>3. Ce que tu vois une fois connecté</h2>
<p>Un simple volontaire n’a <strong>que quatre menus</strong>, plus sa fiche. Tu n’encodes pas les souhaits, tu ne gères pas le stock, tu n’as pas l’administration. Si tu voyais Souhaits ou Stock, ce ne serait plus un compte « simple volontaire ».</p>
<div class="cards">
  <div class="card"><h3>🏠 Tableau de bord</h3><p>Bonjour, tes prochaines missions, raccourcis.</p></div>
  <div class="card"><h3>🚑 Mes missions</h3><p>Uniquement les sorties où tu es d’équipage, tant qu’elles restent à faire.</p></div>
  <div class="card"><h3>🧾 Défraiements</h3><p>Ta note de frais du mois (forfait + km).</p></div>
  <div class="card"><h3>📅 Disponibilités</h3><p>Tes jours. Les missions y apparaissent sans nom de patient.</p></div>
</div>
${fig('med_dashboard', 'Tableau de bord', `
<p>En haut : « Bonjour » + la date. Si une mission t’attend, une carte <strong>Vos prochaines missions</strong> s’affiche (prénom, date, véhicule). Toucher <kbd>Ouvrir</kbd> lance directement le parcours du jour J.</p>
<p>En dessous, les <strong>accès rapides</strong> mènent aux mêmes quatre espaces que le menu.</p>`)}
${figDesk('med_dashboard_menu', 'Le menu (ordinateur)', `
<p>À gauche : Tableau de bord, Mes missions, Défraiements, Disponibilités. En bas : ta photo / initiales, <kbd>Ma fiche</kbd>, le thème clair/sombre, la recherche de mise à jour, et <kbd>Déconnexion</kbd> (en rouge).</p>
<p>Sur téléphone, le même menu s’ouvre avec <kbd>☰</kbd> en haut à gauche.</p>`)}

<h2>4. Ma fiche et l’IBAN</h2>
<p>Sans IBAN, la trésorerie ne peut pas te virer le forfait. Encode-le une fois : il est repris automatiquement sur chaque note de frais.</p>
${fig('med_fiche', 'Ma fiche volontaire', `
<ul>
  <li><strong>Photo</strong> — utile à la base pour que l’équipage te reconnaisse (JPG/PNG, max 5 Mo).</li>
  <li><strong>Téléphone</strong> — pour te joindre le jour J.</li>
  <li><strong>IBAN</strong> — compte belge <kbd>BE</kbd> + 14 chiffres, espaces ignorés.</li>
  <li><strong>Type Médical</strong> et qualifications (ex. Infirmier) : tu les <em>lis</em>. C’est la coordination qui les encode. Tu ne peux pas te passer médical tout seul.</li>
</ul>
<p>Ajoute aussi tes contacts d’urgence et, si besoin, visa / permis. Enregistre avant de quitter.</p>`)}

<h2>5. Dire que tu es disponible</h2>
<p>La coordination ne t’affecte pas au hasard : elle regarde d’abord qui a coché des jours. Une disponibilité = <strong>la journée entière</strong> (minuit à minuit), pas un créneau de deux heures.</p>
${fig('med_dispos', 'Calendrier du mois', `
<p>Flèches pour changer de mois, <kbd>Aujourd’hui</kbd>, vues <kbd>Semaine</kbd> / <kbd>Mois</kbd>. Les pastilles de couleur indiquent le type d’équipage manquant (ambulancier, infirmier…) ou si la mission est déjà complète — <strong>jamais le nom du patient</strong>.</p>
<p>Le bouton <kbd>+ Me rendre disponible</kbd> ouvre le formulaire. Tu peux aussi toucher un jour dans la grille.</p>`)}
${fig('med_dispos_form', 'Ajouter un jour', `
<p>Vérifie la date, ajoute un commentaire si utile (ex. « après 14 h », « pas de nuit »). Enregistre. Tu peux modifier ou supprimer tes propres jours plus tard.</p>
<p>Sans jour coché, tu n’apparais pas dans la liste du personnel disponible : tu peux quand même être affecté, mais c’est plus rare.</p>`)}

<h2>6. Un souhait devient ta mission</h2>
<p>Un <strong>souhait</strong>, c’est le rêve d’un jour d’une personne. La coordination encode le dossier (administratif, médical, véhicule, équipage). Toi, tu n’ouvres pas ce tableau. Quand le statut est <strong>Prêt à réaliser</strong> et que tu es dans l’équipage, la carte arrive toute seule dans <strong>Mes missions</strong> et sur le tableau de bord.</p>
${fig('med_missions_liste', 'Liste Mes missions', `
<p>Onglets <kbd>À faire</kbd> et <kbd>En cours</kbd>. Sur la carte tu vois :</p>
<ul>
  <li>le <strong>nom</strong> (ici Marc) — en médical tu as le dossier complet une fois ouvert ;</li>
  <li>la description, la date, le lieu, le véhicule, ton <strong>rôle</strong> (ex. infirmier) ;</li>
  <li>le <strong>n° du médecin</strong> en rouge, à appeler si besoin ;</li>
  <li><kbd>Google Maps</kbd> / <kbd>Waze</kbd> pour le lieu ;</li>
  <li><kbd>Ouvrir ›</kbd> pour démarrer les 9 écrans.</li>
</ul>
<p>Une mission <strong>terminée, annulée ou non réalisée disparaît</strong> de cette liste. C’est normal : tu ne gardes que ce qui reste à faire.</p>`)}

<h2>7. Le jour J — les 9 écrans, dans l’ordre</h2>
<p>Le parcours est le même pour tout l’équipage du véhicule. Chacun avance avec <kbd>Suivant</kbd>. En haut : <strong>1 / 9</strong>, puis 2 / 9… Le bandeau rose <strong>Médecin</strong> reste collé : un tap sur le numéro lance l’appel.</p>
<p class="note">Avant de quitter la base, l’app exige les <strong>photos des 4 côtés</strong> du véhicule (avant, arrière, gauche, droite). S’il y a un dégât, marque-le sur la photo : les marques restent visibles à toutes les étapes. Essence : vise 100 %. Si le réservoir n’est pas plein, fais le plein et photographie le ticket du matin (remboursement auprès du prêteur).</p>

${fig('med_01_base', '1 / 9 — Sur place (base)', `
<p>Coche <kbd>Sur place</kbd> dès que tu es à la base (ex. Solumob Jemeppe-sur-Meuse). Tu vois qui d’autre de ton véhicule est déjà là.</p>
<ul>
  <li>Vérifie véhicule, plaque, adresse, heure de RDV et de départ, consignes d’équipage.</li>
  <li>Encode <strong>KMs départ</strong> et <strong>essence %</strong>.</li>
  <li>Coche la checklist de départ (GPS, carte essence, dégâts…).</li>
</ul>
<p>Puis <kbd>Suivant</kbd> → Départ vers prise en charge.</p>`)}
${fig('med_01_base_emport', 'Emport O₂ et sacs (médical)', `
<p>Sur un vecteur médical, tu <strong>scannes</strong> chaque bouteille d’oxygène et chaque sac que tu sors du stock. Pour l’O₂, l’app demande la pression au manomètre (alerte si ≤ 50 bar : ne pars pas avec une bouteille vide).</p>
<p>Sans scan, le stock ne sait pas ce qui est parti. C’est aussi pour ça que le non médical, seul dans une voiture, n’a pas cet écran.</p>`)}

${fig('med_02_depart_pec', '2 / 9 — Départ vers prise en charge', `
<p>Tu es en route vers le patient. L’écran montre le lieu de PEC (domicile ou institution : service, étage, chambre). GPS toujours disponible.</p>
<p><strong>Matériel utilisé</strong> : dès que tu sors de la base, tu peux scanner ce que tu consommes (panser, gants, O₂…). Ça alimente le stock au retour.</p>
<p>Les photos « dégâts départ » restent en lecture : tu ne les refais pas ici, tu les consultes.</p>`)}

${fig('med_03_pec_sur_place', '3 / 9 — Sur place, prise en charge', `
<p>Tu es auprès du patient. Coche la checklist PEC : consentement, autorisation photos, feuille de traitements, protections, etc.</p>
<p>C’est aussi le premier écran où le <strong>patient est « à bord »</strong> pour l’app : le MAR et le bouton rouge de détresse deviennent disponibles, jusqu’au départ retour base.</p>`)}
${fig('med_03_mar', 'Administration des médicaments (MAR)', `
<p>Tableau des prises prévues (ex. Paracétamol 1 g à 09:00). Touche la case à l’heure due : elle passe au vert avec l’heure réelle. « Si nécessaire » : tu ajoutes une prise au moment où tu la donnes.</p>
<p>Ne recopie pas la pathologie dans tes notes. Le MAR sert à tracer ce qui a été donné, pas à réécrire le dossier.</p>`)}
${fig('med_03_detresse', 'Protocole de détresse', `
<p>Bouton rouge, uniquement médical, uniquement entre PEC et retour base. L’écran montre les <strong>dosages prévus</strong> encodés par la coordination (exemple fictif ici : Adrénaline, Midazolam).</p>
<p>Avant d’injecter, tu dois cocher : médecin coordinateur prévenu, coordinateur médical (président) prévenu, traitements revus. Puis confirmation. L’heure et ton nom sont tracés sur le rapport. Ce n’est pas un geste anodin : ne l’ouvre pas « pour voir » sur un vrai dossier.</p>`)}

${fig('med_04_depart_dest', '4 / 9 — Départ vers destination', `
<p>Le souhait commence vraiment : tu quittes le lieu de PEC vers le lieu du rêve (famille, parc, restaurant…). L’adresse de destination et les précisions s’affichent. Continue le MAR si une prise tombe pendant le trajet.</p>`)}
${fig('med_05_dest_sur_place', '5 / 9 — Sur place à destination', `
<p>Vous êtes arrivés. Pas de checklist obligatoire ici : c’est le temps du souhait. Garde le bandeau médecin sous la main. Quand il est temps de rentrer, <kbd>Suivant</kbd>.</p>`)}
${fig('med_06_depart_retour', '6 / 9 — Départ retour', `
<p>Le retour est soit « sur envie du patient », soit à une heure imposée (institution). L’écran te le rappelle. Le patient est encore à bord : MAR et détresse restent actifs.</p>`)}
${fig('med_07_retour_sur_place', '7 / 9 — Sur place au retour', `
<p>Checklist retour patient : traitements en surplus rendus, matériel rendu, échange de draps si institution. C’est ta responsabilité médicale, pas celle d’un VNM du même véhicule.</p>`)}
${fig('med_08_depart_base', '8 / 9 — Départ retour base', `
<p>Le patient n’est plus à bord : plus de détresse. Tu peux (et tu dois, en médical) renseigner <strong>Comment s’est passée la journée</strong> : le récit de la mission, pas la pathologie. Ex. « belle journée, repas en famille, traitements donnés ».</p>`)}
${fig('med_09_base_rentre', '9 / 9 — Rentré base', `
<ul>
  <li>Photos des <strong>4 côtés à la remise</strong> (nouveaux dégâts à marquer).</li>
  <li>Ticket de caisse du plein du <strong>retour</strong> si tu en fais un.</li>
  <li>KMs retour + checklist (plein, rangement, linge, clés, pannes).</li>
  <li>Notes de terrain (véhicule, incidents logistiques).</li>
</ul>
<p>Quand tout est bon : <kbd>Terminer la mission</kbd>. L’écran se fige. La carte disparaît de Mes missions.</p>`)}
<p class="warn">Ne termine pas par erreur en milieu de journée : une mission clôturée n’est plus modifiable par l’équipage. En cas de doute, reste sur l’écran 9 et demande à la coordination.</p>

<h2>8. Te faire défrayer</h2>
<p>Une <strong>note par mois civil</strong>. Ce n’est pas un remboursement de tickets restaurant : c’est le forfait légal belge du volontaire, plus éventuellement tes km perso. Valider dans l’app <strong>vaut signature</strong> (horodatée à ton nom). Pas de signature dessinée.</p>
${fig('med_def_liste', 'Liste de tes notes', `
<p><kbd>Nouvelle note</kbd> ouvre le mois en cours (ou un mois encore libre). Chaque carte montre la période, l’IBAN, le total et le statut : Brouillon, Demandée, Vérifiée, Autorisée, Payée — ou Refusée.</p>`)}
${fig('med_def_forfait', 'Haut de la note', `
<ul>
  <li><strong>Communication structurée</strong> <kbd>+++XXX/XXXX/XXXXX+++</kbd> : elle n’existe qu’après <kbd>Valider ma demande</kbd>. C’est ce numéro que la trésorerie colle sur le virement. Tu peux le copier.</li>
  <li><strong>Circuit</strong> : Demandé par / Vérifié / Autorisé / Virement — chaque ligne se remplit avec un nom et une heure. Tu n’as rien à faire après avoir validé, sauf corriger si on refuse.</li>
  <li><strong>Mois, année, IBAN</strong> — l’IBAN vient de ta fiche ; tu peux encore le corriger tant que c’est un brouillon.</li>
</ul>`)}
${fig('med_def_km', 'Forfait et kilomètres', `
<p><strong>Jours d’activité</strong> : l’app propose tes missions du mois (<kbd>Reprendre les missions du mois</kbd>). Un jour = <strong>44,02 €</strong> (2026), même si tu as fait deux souhaits le même jour. Plafond annuel <strong>1 760,83 €</strong> : un bandeau rouge t’alerte si tu le dépasses.</p>
<p><strong>Frais de déplacement</strong> à 0,4326 € / km (aller-retour), max. 2 000 km / an :</p>
<ul>
  <li><strong>Oui</strong> — récolte de souhaits, ou souhait dont la base n’était pas celle de la semaine (aujourd’hui Solumob Jemeppe-sur-Meuse).</li>
  <li><strong>Non</strong> — trajet d’un souhait qui part de la base de la semaine. <strong>Non</strong> — les km du véhicule de mission (ambulance / voiture ASBL) : ils sont déjà relevés sur le terrain, ce n’est pas ton forfait.</li>
</ul>`)}
${fig('med_def_brouillon', 'Enregistrer puis signer', `
<ol>
  <li><kbd>Enregistrer le brouillon</kbd> — tu peux revenir plus tard.</li>
  <li>Relis totaux : forfait + km = total de la note.</li>
  <li><kbd>Valider ma demande</kbd> — tu signes. Le statut passe à Demandée, le n° +++…+++ apparaît.</li>
  <li>Tant que c’est Demandée, tu peux encore <kbd>Retirer la demande</kbd> pour corriger, puis re-valider.</li>
  <li><kbd>Ouvrir la note A4</kbd> / <kbd>Télécharger</kbd> si tu veux un PDF pour toi.</li>
</ol>
<p>Ensuite la trésorerie vérifie, la présidence autorise, le virement part. Si refus : le motif s’affiche, tu corriges, tu re-valides.</p>`)}

<h2>Confidentialité et réflexes</h2>
<div class="cards">
  <div class="card"><h3>Secret médical</h3><p>Tu vois le dossier parce que tu es médical. Pas de capture d’écran, pas de nom dans un SMS, pas de photo du MAR.</p></div>
  <div class="card"><h3>Fictif</h3><p>Un badge « Fictif » = démonstration. Un vrai patient n’a jamais ce badge.</p></div>
  <div class="card"><h3>Ordinateur partagé</h3><p>Déconnecte-toi (menu, en rouge) quand tu as fini.</p></div>
  <div class="card"><h3>Lien expiré</h3><p>Au-delà de 7 jours, demande un nouveau lien à la personne qui t’a invité. Tu ne peux pas le régénérer toi-même.</p></div>
</div>
<p class="warn">En cas de doute sur le terrain (détresse, véhicule, patient qui refuse) : appelle le numéro du bandeau médecin, puis la coordination. L’app enregistre tes gestes, elle ne les remplace pas.</p>
`
}

function vnmInner() {
  return `
<nav class="toc" aria-label="Sommaire">
  <span><i>1</i> Compte</span><span><i>2</i> Connexion</span>
  <span><i>3</i> Tes 4 menus</span><span><i>4</i> Ma fiche</span>
  <span><i>5</i> Disponibilités</span><span><i>6</i> Mes missions</span>
  <span><i>7</i> Jour J — 9 écrans</span><span><i>8</i> Défraiements</span>
</nav>
<p class="ok">Ce document est pour un <strong>simple volontaire non médical</strong> (accompagnement, conduite). Tu n’as <strong>pas</strong> le dossier médical, pas les traitements, pas le protocole de détresse. Si un soignant est dans le même véhicule, ces parties restent à sa charge — c’est normal et voulu.</p>
<p>Les captures sont des <strong>démonstrations fictives</strong> (Léa, promenade au parc). Un vrai souhait se comporte pareil.</p>
${COMMUN_COMPTE}
${COMMUN_LOGIN}

<h2>3. Ce que tu vois une fois connecté</h2>
<p>Quatre menus seulement, plus ta fiche. Tu n’encodes pas les dossiers, tu ne touches pas au stock.</p>
<div class="cards">
  <div class="card"><h3>🏠 Tableau de bord</h3><p>Tes prochaines missions (prénom seulement) et les raccourcis.</p></div>
  <div class="card"><h3>🚑 Mes missions</h3><p>Les sorties où tu es affecté, tant qu’elles restent à faire.</p></div>
  <div class="card"><h3>🧾 Défraiements</h3><p>Ta note de frais du mois.</p></div>
  <div class="card"><h3>📅 Disponibilités</h3><p>Tes jours. Uniquement les missions qui ont besoin d’un VNM.</p></div>
</div>
${fig('vnm_dashboard', 'Tableau de bord', `
<p>« Bonjour Alex », la date, puis <strong>Vos prochaines missions</strong> : tu lis « Mission — Léa », jamais le nom de famille. <kbd>Ouvrir</kbd> lance le parcours du jour J.</p>
<p>Les trois cartes du bas (Mes missions, Défraiements, Disponibilités) font la même chose que le menu.</p>`)}
${figDesk('vnm_dashboard_menu', 'Le menu', `
<p>Tableau de bord, Mes missions, Défraiements, Disponibilités. En bas : <kbd>Ma fiche</kbd>, thème, mises à jour, <kbd>Déconnexion</kbd>. Sur téléphone : bouton <kbd>☰</kbd>.</p>
<p>Si tu voyais Souhaits, Stock ou Administration, ce ne serait plus un compte simple volontaire : préviens la coordination.</p>`)}

<h2>4. Ma fiche et l’IBAN</h2>
<p>L’IBAN est indispensable pour le virement du forfait. Le type « Non médical » et tes qualifications (ex. chauffeur, secouriste) sont <em>lus</em> : c’est la coordination qui les encode.</p>
${fig('vnm_fiche', 'Ma fiche', `
<ul>
  <li>Photo (reconnaissance à la base), téléphone, contacts d’urgence.</li>
  <li><strong>IBAN belge</strong> <kbd>BE</kbd> + 14 chiffres — repris sur chaque note de frais.</li>
  <li>Type <strong>Non médical</strong>, qualification visible (ici Chauffeur).</li>
</ul>
<p>Tu ne peux pas te passer « médical » tout seul en changeant un menu. Enregistre avant de quitter.</p>`)}

<h2>5. Dire que tu es disponible</h2>
<p>Coche tes jours : la coordination s’en sert pour composer les équipages. Une dispo = la <strong>journée entière</strong>.</p>
${fig('vnm_dispos', 'Ton calendrier', `
<p>Particularité non médicale : tu ne vois que les missions qui demandent vraiment un volontaire non médical. Une sortie 100 % soignante reste invisible. Ce n’est pas un bug.</p>
<p>Les pastilles indiquent ce qui manque dans l’équipage, <strong>sans nom de patient</strong>.</p>`)}
${fig('vnm_dispos_form', 'Me rendre disponible', `
<p><kbd>+ Me rendre disponible</kbd> (ou un tap sur le jour). Commentaire possible (« après 14 h »). Tu modifies et tu supprimes tes propres jours. Sans jour coché, tu es plus difficile à placer.</p>`)}

<h2>6. Un souhait devient ta mission</h2>
<p>La coordination encode le souhait et t’affecte au véhicule. Quand c’est <strong>Prêt à réaliser</strong>, la carte arrive dans Mes missions. Tu n’as rien à chercher ailleurs.</p>
${fig('vnm_missions_liste', 'Liste Mes missions', `
<p>Tu vois le <strong>prénom</strong> (Léa), la description, la date, le lieu, la voiture, ton rôle. Pas de nom de famille, pas de n° de médecin, pas de pathologie.</p>
<p><kbd>Google Maps</kbd> / <kbd>Waze</kbd> ouvrent le GPS. <kbd>Ouvrir ›</kbd> lance les 9 écrans. Onglet <kbd>En cours</kbd> si la sortie a déjà démarré.</p>
<p>Mission faite = elle <strong>disparaît</strong>. Tu ne archives rien ici.</p>`)}

<h2>7. Le jour J — les 9 écrans, dans l’ordre</h2>
<p>Même enchaînement que l’équipage médical, mais <strong>côté logistique</strong> : présence, photos du véhicule, km, essence, GPS, notes de terrain. En bas d’écran, une ligne rappelle : aucune information médicale n’est accessible depuis cette vue.</p>
<p class="note">Les <strong>4 photos</strong> (avant, arrière, gauche, droite) sont obligatoires avant de quitter la base. Marque les dégâts sur la photo : ça protège l’ASBL et le prêteur du véhicule. Essence à 100 % si possible ; sinon plein + photo du ticket du matin.</p>

${fig('vnm_01_base', '1 / 9 — Sur place (base)', `
<p>Coche <kbd>Sur place</kbd>. Vérifie voiture, plaque, adresse de la base, heures de RDV / départ, consignes (ex. « promenade douce »).</p>
<p>Encode <strong>KMs départ</strong> et <strong>essence %</strong>. Pas de scan de sacs médicaux, pas de checklist patient. <kbd>Suivant</kbd> t’emmène vers la prise en charge.</p>`)}
${fig('vnm_02_depart_pec', '2 / 9 — Départ vers prise en charge', `
<p>En route vers le domicile ou l’institution. L’adresse s’affiche, le GPS aussi. Les photos de dégâts du départ restent visibles (lecture). Tu n’as pas de médicaments à donner : si un soignant est à bord, c’est lui qui gère le patient.</p>`)}
${fig('vnm_03_pec_sur_place', '3 / 9 — Sur place, prise en charge', `
<p>Tu aides à l’accueil, aux sacs, à l’installation dans le véhicule. L’écran te donne le lieu (domicile / institution) sans dossier médical.</p>
<p>S’il y a un médical dans le véhicule, la checklist patient est <strong>à sa charge</strong> : tu peux voir un message du type « à charge du médical ». Ne demande pas les traitements à voix haute dans un couloir.</p>`)}
${fig('vnm_04_depart_dest', '4 / 9 — Départ vers destination', `
<p>Vous quittez le lieu de PEC vers le lieu du souhait (ici le parc). Suit le GPS, roule calmement, respecte les consignes d’équipage.</p>`)}
${fig('vnm_05_dest_sur_place', '5 / 9 — Sur place à destination', `
<p>C’est le cœur du souhait : accompagner, pousser le fauteuil, porter un sac, discuter. L’app n’attend pas de checklist médicale. Quand le groupe rentre, <kbd>Suivant</kbd>.</p>`)}
${fig('vnm_06_depart_retour', '6 / 9 — Départ retour', `
<p>Retour « sur envie » ou à heure fixe. Tu suis l’itinéraire inverse. Pas de MAR à remplir.</p>`)}
${fig('vnm_07_retour_sur_place', '7 / 9 — Sur place au retour', `
<p>Tu aides à la descente, tu rends ce qui est logistique (sacs, couverture). Le médical, s’il est là, gère les traitements rendus et le linge de l’institution.</p>`)}
${fig('vnm_08_depart_base', '8 / 9 — Départ retour base', `
<p>Direction la base. Tu peux déjà noter un incident véhicule dans un coin de tête : tu le saisiras à l’écran 9.</p>`)}
${fig('vnm_09_base_rentre', '9 / 9 — Rentré base', `
<ul>
  <li>Photos des 4 côtés à la <strong>remise</strong> (nouveaux dégâts).</li>
  <li>Ticket du plein du retour si tu en fais un.</li>
  <li><strong>KMs retour</strong>.</li>
  <li><strong>Notes de terrain</strong> : véhicule, matériel, imprévu logistique — pas d’info santé.</li>
</ul>
<p><kbd>Terminer la mission</kbd> clôture. La carte disparaît de Mes missions. Ne termine pas trop tôt : après, tu ne modifies plus.</p>`)}

<h2>8. Te faire défrayer</h2>
<p>Même règles que pour les médicaux : une note par mois, forfait + km éventuels. <kbd>Valider ma demande</kbd> = tu signes.</p>
${fig('vnm_def_liste', 'Tes notes', `
<p><kbd>Nouvelle note</kbd> pour un mois encore libre. Statuts : Brouillon → Demandée → Vérifiée → Autorisée → Payée (ou Refusée avec motif).</p>`)}
${fig('vnm_def_forfait', 'IBAN et circuit', `
<p>L’IBAN vient de ta fiche. La <strong>communication structurée</strong> <kbd>+++…+++</kbd> n’apparaît qu’après validation : c’est la référence du virement. Le circuit (demandé / vérifié / autorisé / viré) se remplit tout seul avec des noms et des heures — tu n’as pas à relancer tout le monde.</p>`)}
${fig('vnm_def_km', '44,02 € et les km', `
<p>Chaque jour de souhait = <strong>44,02 €</strong> (2026), une seule fois par date. Plafond annuel <strong>1 760,83 €</strong>.</p>
<p>Km perso à 0,4326 € / km (A/R), max. 2 000 km / an :</p>
<ul>
  <li><strong>Oui</strong> si tu as roulé pour une <strong>récolte de souhaits</strong>, ou vers une base qui n’était pas celle de la semaine.</li>
  <li><strong>Non</strong> pour un souhait qui part de la base de la semaine (Solumob Jemeppe). <strong>Non</strong> pour les km de la voiture de mission : tu les as déjà encodés au terrain, ce n’est pas la même enveloppe.</li>
</ul>
<p><kbd>Reprendre les missions du mois</kbd> préremplit tes jours. <kbd>+ Trajet</kbd> seulement si le motif le permet.</p>`)}
${fig('vnm_def_brouillon', 'Brouillon, puis signature', `
<ol>
  <li><kbd>Enregistrer le brouillon</kbd> dès que les jours / km sont bons.</li>
  <li>Vérifie le total (forfait + déplacements).</li>
  <li><kbd>Valider ma demande</kbd> — statut Demandée, n° +++…+++ créé.</li>
  <li>Tu peux encore <kbd>Retirer la demande</kbd> tant que ce n’est pas vérifié, pour corriger.</li>
</ol>
<p>La suite (vérification, autorisation, virement) est le travail de la trésorerie et de la présidence. Toi tu attends, ou tu corriges si on refuse.</p>`)}

<h2>Confidentialité et réflexes</h2>
<div class="cards">
  <div class="card"><h3>Prénom seulement</h3><p>Tu n’as pas le nom de famille ni le dossier. Ne les demande pas « pour savoir ». Ce n’est pas ton rôle.</p></div>
  <div class="card"><h3>Pas de photo du patient</h3><p>Sauf si le médical confirme l’autorisation photos du dossier. En cas de doute : pas de photo.</p></div>
  <div class="card"><h3>Fictif</h3><p>Les écrans de ce PDF (Léa, parc) sont des démos. Un vrai souhait n’a pas ce caractère d’exemple.</p></div>
  <div class="card"><h3>Lien expiré</h3><p>7 jours. Après, un nouveau lien doit être généré par l’ASBL.</p></div>
</div>
<p class="warn">Accident, malaise, doute : tu préviens d’abord le médical de l’équipage s’il est là, sinon tu appelles le numéro affiché sur l’écran (s’il y en a un) et la coordination. Tu n’improvises pas un geste de soin.</p>
`
}

async function printPdf(browser, htmlPath, pdfPath) {
  const page = await browser.newPage()
  await page.goto('file://' + htmlPath, { waitUntil: 'load', timeout: 120000 })
  await page.evaluateHandle('document.fonts.ready').catch(() => {})
  await new Promise(r => setTimeout(r, 600))
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '12mm', bottom: '14mm', left: '14mm', right: '14mm' },
  })
  await page.close()
  console.log('PDF', pdfPath)
}

async function main() {
  mkdirSync(OUT_HTML, { recursive: true })
  const medHtml = join(OUT_HTML, 'mode-emploi-volontaire-medical.html')
  const vnmHtml = join(OUT_HTML, 'mode-emploi-volontaire-non-medical.html')
  writeFileSync(medHtml, shell(
    'Mode d’emploi du volontaire médical — Heart’s Angels',
    'Simple volontaire médical · document A4',
    'Comment créer ton compte, indiquer tes jours, réaliser un souhait (dossier, traitements, détresse) et demander tes frais — expliqué écran par écran.',
    medicalInner(),
  ))
  writeFileSync(vnmHtml, shell(
    'Mode d’emploi du volontaire non médical — Heart’s Angels',
    'Simple volontaire non médical · document A4',
    'Comment créer ton compte, indiquer tes jours, accompagner un souhait (photos, km, GPS — sans dossier médical) et demander tes frais — expliqué écran par écran.',
    vnmInner(),
  ))

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
  const medPdf = join(ROOT, 'docs/Mode-emploi-volontaire-medical.pdf')
  const vnmPdf = join(ROOT, 'docs/Mode-emploi-volontaire-non-medical.pdf')
  await printPdf(browser, medHtml, medPdf)
  await printPdf(browser, vnmHtml, vnmPdf)
  await browser.close()

  for (const dir of ['/opt/cursor/artifacts', '/cursor/stores/self/artifacts']) {
    try {
      mkdirSync(dir, { recursive: true })
      copyFileSync(medPdf, join(dir, 'mode_emploi_volontaire_medical.pdf'))
      copyFileSync(vnmPdf, join(dir, 'mode_emploi_volontaire_non_medical.pdf'))
    } catch (e) { console.warn(dir, e.message) }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
