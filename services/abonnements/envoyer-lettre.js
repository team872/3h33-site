/**
 * Envoie la lettre « nouveau portrait » des Voix de l'IA aux abonnés confirmés.
 * À lancer dans le conteneur du service :
 *
 *   docker compose exec abonnements node envoyer-lettre.js                 à blanc (rien ne part)
 *   docker compose exec abonnements node envoyer-lettre.js --essai moi@…   la lettre à cette seule adresse
 *   docker compose exec abonnements node envoyer-lettre.js --envoyer       envoi réel aux abonnés confirmés
 *
 * La lettre est composée à partir du flux RSS public (titre, accroche, lien vers la
 * page), jamais à la main. Une lettre ne part jamais deux fois : la trace des envois
 * est gardée dans envois.json, sur le volume du service.
 */
"use strict";
const fs = require("fs");
const crypto = require("crypto");
const C = require("./commun");
const { CONF, LISTES } = C;

const TAILLE_LOT = 100;          // maximum de l'API d'envoi groupé de Resend
const PAUSE_ENTRE_LOTS = 600;    // millisecondes : très en dessous des 10 requêtes par seconde
const ESSAIS = 4;                // nouvelles tentatives sur 429, 5xx ou coupure réseau

const AIDE = `Envoi de la lettre « nouveau portrait » aux abonnés confirmés.

  node envoyer-lettre.js                     à blanc : quel épisode, combien d'e-mails partiraient
  node envoyer-lettre.js --essai <adresse>   envoie la lettre à cette seule adresse (marquée [Essai])
  node envoyer-lettre.js --envoyer           envoie vraiment, aux seuls abonnés confirmés

  --episode <guid>   un épisode précis (guid du flux, ou son dossier : « bret-taylor ») ;
                     sans cette option, le plus récent du flux
  --episodes         liste les épisodes du flux et dit lesquels ont déjà eu leur lettre
  --liste <nom>      la liste (par défaut : voix-de-lia)
  --flux <adresse>   un autre flux RSS (adresse ou fichier), pour un essai

Une lettre déjà envoyée ne repart jamais. Si un envoi est interrompu, relancer la même
commande reprend là où il s'était arrêté, sans rien renvoyer à ceux qui l'ont déjà reçue.`;

function arreter(message, code = 1) { console.error(message); process.exit(code); }
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

function lireOptions(argv) {
  const o = { envoyer: false, essai: null, episode: null, liste: "voix-de-lia", flux: null, episodes: false, aide: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valeur = () => { const v = argv[++i]; if (!v || v.startsWith("--")) arreter(`${a} attend une valeur. Voir --aide.`); return v; };
    if (a === "--envoyer") o.envoyer = true;
    else if (a === "--essai") o.essai = valeur();
    else if (a === "--episode") o.episode = valeur();
    else if (a === "--liste") o.liste = valeur();
    else if (a === "--flux") o.flux = valeur();
    else if (a === "--episodes") o.episodes = true;
    else if (a === "--aide" || a === "--help" || a === "-h") o.aide = true;
    else arreter(`Option inconnue : ${a}. Voir --aide.`);
  }
  return o;
}

// ---------------------------------------------------------------- lecture du flux RSS
function decoder(s) {
  s = String(s || "").trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(s);
  if (cdata) return cdata[1];
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, c) => {
    if (c[0] === "#") return String.fromCodePoint(c[1].toLowerCase() === "x" ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10));
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[c.toLowerCase()];
  });
}
const balise = (xml, nom) => { const m = new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`).exec(xml); return m ? decoder(m[1]) : ""; };
const attribut = (xml, nom, attr) => { const m = new RegExp(`<${nom}\\s[^>]*?${attr}="([^"]*)"`).exec(xml); return m ? decoder(m[1]) : ""; };

function secondes(d) {
  if (/^\d+$/.test(d)) return Number(d);
  const p = String(d).split(":").map(Number);
  return p.every(Number.isFinite) ? p.reduce((t, x) => t * 60 + x, 0) : 0;
}

async function lireTexte(source) {
  if (/^https?:\/\//.test(source)) {
    const r = await fetch(source, { headers: { "User-Agent": "3h33-abonnements/1.0" }, signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`${source} a répondu ${r.status}`);
    return r.text();
  }
  return fs.readFileSync(source, "utf8");
}

function analyserFlux(xml) {
  const tete = xml.split("<item>")[0];
  const episodes = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const x = m[1];
    return {
      titre: balise(x, "title"),
      lien: balise(x, "link"),
      guid: balise(x, "guid"),
      date: balise(x, "pubDate"),
      description: balise(x, "description"),
      duree: secondes(balise(x, "itunes:duration")),
      image: attribut(x, "itunes:image", "href"),
      audio: attribut(x, "enclosure", "url"),
    };
  }).filter((e) => e.guid && e.titre && /^https:\/\//.test(e.lien));
  return { episodes, imageEmission: attribut(tete, "itunes:image", "href") || balise(balise(tete, "image"), "url") };
}

function choisir(episodes, demande) {
  if (demande) {
    const ep = episodes.find((e) => e.guid === demande || e.guid === `voix-de-lia-${demande}` || e.lien.replace(/\/+$/, "").endsWith("/" + demande));
    if (!ep) arreter(`Aucun épisode « ${demande} » dans le flux. La liste : node envoyer-lettre.js --episodes`);
    return ep;
  }
  // le plus récent ; à date égale, le premier du flux
  return episodes.reduce((m, e) => (Date.parse(e.date) > Date.parse(m.date) ? e : m), episodes[0]);
}

// L'image de partage de la page (1200 × 630) va mieux dans une lettre que la vignette carrée.
async function imagePartage(lien) {
  try {
    const html = await lireTexte(lien);
    const m = /<meta\s+property="og:image"\s+content="([^"]+)"/.exec(html);
    return m && /^https:\/\//.test(decoder(m[1])) ? decoder(m[1]) : "";
  } catch { return ""; }
}

const dateFr = (d) => { const t = Date.parse(d); return isNaN(t) ? "" : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }).format(t).replace(/^1 /, "1er "); };

// ---------------------------------------------------------------- la lettre
function avecSuivi(url, liste) {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "lettre");
    u.searchParams.set("utm_medium", "email");
    u.searchParams.set("utm_campaign", liste);
    return u.toString();
  } catch { return url; }
}

function composer(ep, liste, abonneId) {
  const L = LISTES[liste];
  const e = C.echapper;
  const paragraphes = ep.description.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const accroche = paragraphes[0] || "";
  const mention = paragraphes.find((p) => /^Voix générées/i.test(p)) || "Voix générées par intelligence artificielle.";
  const minutes = ep.duree ? Math.max(1, Math.round(ep.duree / 60)) : 0;
  const lienPage = avecSuivi(ep.lien, liste);
  const lienStop = C.lienDesinscription(abonneId);
  const lienEmission = avecSuivi(L.page, liste);
  const sujet = `Nouveau portrait · ${ep.titre}`;

  const corps = `${ep.image ? `<tr><td style="padding:0 0 26px;"><a href="${e(lienPage)}"><img src="${e(ep.image)}" width="560" alt="${e(ep.titre)}" style="display:block;width:100%;max-width:560px;height:auto;border:1px solid #2c2c31;color:#b8b5ad;font-family:Helvetica,Arial,sans-serif;"></a></td></tr>` : ""}
<tr><td style="padding:0 0 8px;font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a877f;">Nouveau portrait${minutes ? ` · ${minutes} min d'écoute` : ""}</td></tr>
<tr><td style="padding:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;font-weight:bold;color:#f5f4f1;"><a href="${e(lienPage)}" style="color:#f5f4f1;text-decoration:none;">${e(ep.titre)}</a></td></tr>
<tr><td style="padding:0 0 24px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#b8b5ad;">${e(accroche)}</td></tr>
<tr><td style="padding:0 0 18px;">${C.boutonEmail("Écouter le portrait", lienPage)}</td></tr>
<tr><td style="padding:0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#b8b5ad;">Sur la page : la conversation complète, les citations datées et toutes les sources. Et <a href="${e(lienEmission)}" style="color:#c4a265;">tous les portraits</a>.</td></tr>`;

  const pied = `${e(mention)}<br><br>
Vous recevez cette lettre parce que vous l'avez demandée sur 3h33.com : une lettre à chaque nouveau portrait, rien d'autre.
<a href="${e(lienStop)}" style="color:#c4a265;">Se désinscrire en un clic</a> · <a href="${e(CONF.confidentialite)}" style="color:#8a877f;">Confidentialité</a><br><br>
Une série Choucroute Citron imaginée par Alexandre Stopnicki. Pour nous écrire, répondez simplement à cet e-mail.`;

  const texte = [
    "LES VOIX DE L'IA · NOUVEAU PORTRAIT", "",
    ep.titre, "",
    accroche, "",
    `Écouter le portrait${minutes ? ` (${minutes} min)` : ""} : ${lienPage}`,
    "Sur la page : la conversation complète, les citations datées et toutes les sources.",
    `Tous les portraits : ${lienEmission}`, "",
    "--", mention, "",
    `Vous recevez cette lettre parce que vous l'avez demandée sur 3h33.com : une lettre à chaque nouveau portrait, rien d'autre.`,
    `Se désinscrire en un clic : ${lienStop}`,
    `Confidentialité : ${CONF.confidentialite}`, "",
    "Une série Choucroute Citron imaginée par Alexandre Stopnicki. Pour nous écrire, répondez simplement à cet e-mail.",
  ].join("\n");

  return {
    subject: sujet,
    html: C.cadreEmail({ titre: sujet, preentete: accroche, corps, pied }),
    text: texte,
    headers: C.entetesDesinscription(abonneId, liste),
    tags: [
      { name: "liste", value: liste.replace(/[^A-Za-z0-9_-]/g, "_") },
      { name: "episode", value: ep.guid.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 200) },
    ],
  };
}

// ---------------------------------------------------------------- envoi
// Un lot = un appel à l'API d'envoi groupé. La clé d'idempotence dépend des destinataires :
// un lot relancé à l'identique (reprise, nouvel essai) n'est pas envoyé deux fois par Resend (24 h).
async function envoyerLot(messages, cle) {
  let r;
  for (let essai = 1; essai <= ESSAIS; essai++) {
    r = await C.resend("/emails/batch", messages, { idempotence: cle, entetes: { "x-batch-validation": "permissive" } });
    if (r.ok) return r;
    const reessayable = r.statut === 0 || r.statut === 429 || r.statut >= 500;
    if (!reessayable || essai === ESSAIS) return r;
    const pause = Math.max((r.attente || 0) * 1000, 2000 * 2 ** (essai - 1));
    console.log(`  ${r.raison} — nouvel essai dans ${Math.round(pause / 1000)} s`);
    await attendre(pause);
  }
  return r;
}

// Un seul envoi à la fois.
function prendreVerrou() {
  const chemin = C.fichier("envoi.verrou");
  try {
    fs.writeFileSync(chemin, JSON.stringify({ pid: process.pid, debut: new Date().toISOString() }), { flag: "wx" });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    let pid = 0;
    try { pid = JSON.parse(fs.readFileSync(chemin, "utf8")).pid; } catch { /* verrou illisible */ }
    let vivant = false;
    try { if (pid) { process.kill(pid, 0); vivant = true; } } catch { /* plus là */ }
    if (vivant && pid !== process.pid) arreter(`Un autre envoi est en cours (processus ${pid}). Attendez qu'il se termine.`);
    fs.writeFileSync(chemin, JSON.stringify({ pid: process.pid, debut: new Date().toISOString() }));
  }
  return () => { try { fs.unlinkSync(chemin); } catch { /* déjà retiré */ } };
}

// ---------------------------------------------------------------- programme
async function principal() {
  const o = lireOptions(process.argv.slice(2));
  if (o.aide) { console.log(AIDE); return; }
  C.verifierSecret();          // sans lui, les liens de désinscription des lettres seraient faux
  const L = LISTES[o.liste];
  if (!L) arreter(`Liste inconnue : ${o.liste}. Listes : ${Object.keys(LISTES).join(", ")}`);

  const source = o.flux || L.flux;
  let xml;
  try { xml = await lireTexte(source); } catch (e) { arreter(`Flux illisible (${source}) : ${e.message}`); }
  const { episodes, imageEmission } = analyserFlux(xml);
  if (!episodes.length) arreter(`Aucun épisode dans le flux ${source}.`);
  const envois = C.lireEnvois();

  if (o.episodes) {
    console.log(`${episodes.length} épisodes dans ${source} :`);
    for (const ep of episodes) {
      const t = envois.lettres[`${o.liste}/${ep.guid}`];
      const etat = t ? (t.statut === "termine" ? `lettre envoyée le ${dateFr(t.fin)} (${t.envoyes})` : `envoi ${t.statut} (${t.envoyes} déjà servis)`) : "pas de lettre";
      console.log(`  ${dateFr(ep.date).padEnd(18)} ${ep.guid.padEnd(36)} ${etat}`);
    }
    return;
  }

  const ep = choisir(episodes, o.episode);
  ep.image = (await imagePartage(ep.lien)) || ep.image || imageEmission;
  const cle = `${o.liste}/${ep.guid}`;
  let trace = envois.lettres[cle];

  console.log(`Liste      : ${L.nom} (${o.liste})`);
  console.log(`Épisode    : « ${ep.titre} »`);
  console.log(`             ${ep.guid}, publié le ${dateFr(ep.date)}${o.episode ? "" : " (le plus récent du flux)"}`);
  console.log(`Page       : ${ep.lien}`);
  console.log(`Image      : ${ep.image || "aucune"}`);
  console.log(`Expéditeur : ${CONF.expediteur} (réponses à ${CONF.repondreA})`);

  // Aperçu : la lettre telle qu'elle partira, avec un lien de désinscription factice.
  const apercu = composer(ep, o.liste, "apercu");
  const cheminApercu = C.fichier("apercu-lettre.html");
  try { fs.mkdirSync(CONF.dossier, { recursive: true }); fs.writeFileSync(cheminApercu, apercu.html); } catch { /* aperçu facultatif */ }
  console.log(`Objet      : ${apercu.subject}`);
  console.log(`Aperçu     : ${cheminApercu}`);

  if (o.essai) {
    const adresse = C.normaliser(o.essai);
    if (!C.emailValide(adresse)) arreter(`Adresse d'essai incorrecte : ${o.essai}`);
    if (!C.envoiConfigure()) arreter("Envoi non configuré : RESEND_API_KEY absente du .env. Rien n'est parti.", 2);
    const a = C.trouver(C.lireAbonnes(), adresse, o.liste);
    const m = composer(ep, o.liste, a ? a.id : "essai");
    const r = await C.envoyerUn({ to: [adresse], ...m, subject: "[Essai] " + m.subject });
    if (!r.ok) arreter(`Essai NON envoyé : ${r.raison}`);
    console.log(`\nEssai envoyé à ${adresse} (${r.donnees && r.donnees.id}). Il ne compte pas : la lettre reste à envoyer.`);
    return;
  }

  const tous = Object.values(C.lireAbonnes().abonnes).filter((a) => a.liste === o.liste);
  const confirmes = tous.filter((a) => a.etat === "confirme");
  const compte = (etat) => tous.filter((a) => a.etat === etat).length;
  console.log(`Abonnés    : ${confirmes.length} confirmé(s) · ${compte("en_attente")} en attente de confirmation · ${compte("desinscrit")} désinscrit(s)`);

  if (trace && trace.statut === "termine") {
    console.log(`\nCette lettre est déjà partie le ${dateFr(trace.fin)} (${trace.envoyes} e-mail(s)). Elle ne repart jamais une deuxième fois.`);
    if (o.envoyer) process.exitCode = 1;
    return;
  }
  const dejaServis = new Set(trace ? trace.ids : []);
  const aServir = confirmes
    .filter((a) => !dejaServis.has(a.id))
    .sort((x, y) => String(x.confirmeLe).localeCompare(String(y.confirmeLe)) || x.id.localeCompare(y.id));
  if (trace) console.log(`Reprise    : envoi ${trace.statut} commencé le ${dateFr(trace.debut)}, ${dejaServis.size} déjà servi(s).`);
  const nbLots = Math.ceil(aServir.length / TAILLE_LOT);

  if (!o.envoyer) {
    console.log(`\nÀ BLANC : ${aServir.length} e-mail(s) partiraient, en ${nbLots} lot(s) de ${TAILLE_LOT} au plus. Rien n'est parti.`);
    console.log(`\n--- version texte ---\n${apercu.text}\n---------------------`);
    console.log(`\nPour s'envoyer la lettre :  node envoyer-lettre.js --episode ${ep.guid} --essai <votre adresse>`);
    console.log(`Pour l'envoyer vraiment :   node envoyer-lettre.js --episode ${ep.guid} --envoyer`);
    if (!C.envoiConfigure()) console.log("(Envoi non configuré pour l'instant : RESEND_API_KEY absente du .env.)");
    return;
  }

  if (!C.envoiConfigure()) arreter("Envoi non configuré : RESEND_API_KEY absente du .env. Rien n'est parti.", 2);
  if (!aServir.length) { console.log("\nAucun abonné confirmé à servir : rien n'est parti, et la lettre reste à envoyer."); return; }

  const lacher = prendreVerrou();
  const enregistrer = () => { const e = C.lireEnvois(); e.lettres[cle] = trace; C.ecrireEnvois(e); };
  trace = trace || { liste: o.liste, guid: ep.guid, titre: ep.titre, lien: ep.lien, debut: new Date().toISOString(), envoyes: 0, echecs: 0, ids: [] };
  trace.statut = "en_cours";
  enregistrer();
  process.on("SIGINT", () => { trace.statut = "interrompu"; enregistrer(); lacher(); console.log("\nInterrompu. Relancez la même commande pour reprendre."); process.exit(130); });

  console.log(`\nEnvoi de ${aServir.length} e-mail(s) en ${nbLots} lot(s)…`);
  try {
    for (let n = 0; n < nbLots; n++) {
      if (n) await attendre(PAUSE_ENTRE_LOTS);
      const lot = aServir.slice(n * TAILLE_LOT, (n + 1) * TAILLE_LOT);
      const messages = lot.map((a) => ({ from: CONF.expediteur, reply_to: CONF.repondreA, to: [a.email], ...composer(ep, o.liste, a.id) }));
      const cleLot = "lettre-" + crypto.createHash("sha256").update(cle + "|" + lot.map((a) => a.id).join(",")).digest("hex").slice(0, 40);
      const r = await envoyerLot(messages, cleLot);
      if (!r.ok) {
        trace.statut = "interrompu";
        enregistrer();
        lacher();
        arreter(`\nLot ${n + 1}/${nbLots} refusé : ${r.raison}\n${trace.envoyes} e-mail(s) partis. Relancez la même commande pour reprendre : personne ne recevra la lettre deux fois.`);
      }
      const refuses = new Map(((r.donnees && r.donnees.errors) || []).map((x) => [Number(x.index), x.message]));
      lot.forEach((a, i) => {
        if (refuses.has(i)) { trace.echecs++; console.log(`  refusé par Resend : ${C.masquer(a.email)} — ${refuses.get(i)}`); }
        else { trace.ids.push(a.id); trace.envoyes++; }
      });
      enregistrer();
      console.log(`  lot ${n + 1}/${nbLots} : ${lot.length - refuses.size} envoyé(s)${refuses.size ? `, ${refuses.size} refusé(s)` : ""}`);
    }
    trace.statut = "termine";
    trace.fin = new Date().toISOString();
    enregistrer();
    console.log(`\nLettre envoyée : ${trace.envoyes} e-mail(s)${trace.echecs ? `, ${trace.echecs} refusé(s)` : ""}. Elle ne repartira plus.`);
  } finally {
    lacher();
  }
}

principal().catch((e) => arreter("Erreur : " + e.message));
