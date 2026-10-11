/**
 * Abonnement par e-mail des Voix de l'IA (3h33.com/podcast-voix-de-lia/).
 *
 * Micro-service Node sans dépendance, derrière Traefik, sur le même modèle que
 * le formulaire de contact (services/contact). Double confirmation : l'adresse
 * reste « en attente » tant que son propriétaire n'a pas cliqué le lien reçu.
 *
 *   POST /api/abonnement                       {email, liste, site (piège), instant, ecoule}
 *   GET  /api/abonnement/confirmer?jeton=…     confirme l'abonnement
 *   GET  /api/abonnement/desinscription?jeton=…  désinscrit en un clic (page)
 *   POST /api/abonnement/desinscription?jeton=…  désinscription « One-Click » des messageries
 *   POST /api/abonnement/reabonner             « Un clic par erreur ? Me réabonner »
 *   GET  /api/abonnement/sante                 contrôle de santé
 *
 * Réglages : voir .env.exemple et README.md. Sans RESEND_API_KEY, rien ne part :
 * le lien de confirmation est écrit dans le journal du service.
 */
"use strict";
const http = require("http");
const C = require("./commun");
const { CONF, LISTES } = C;

C.verifierSecret();

// ---------------------------------------------------------------- garde-fous
const HEURE = 3600_000, JOUR = 24 * HEURE;
const MAX_PAR_IP = 5;                                         // 5 demandes par heure et par adresse IP
const PLAFOND_HEURE = Number(process.env.PLAFOND_CONFIRMATIONS_HEURE || 60);  // tous visiteurs confondus
const parIp = new Map();                                      // IP -> horodatages
let confirmationsEnvoyees = [];                               // horodatages, pour le plafond horaire

function tropDeDemandes(ip) {
  const maintenant = Date.now();
  const liste = (parIp.get(ip) || []).filter((t) => maintenant - t < HEURE);
  liste.push(maintenant);
  parIp.set(ip, liste);
  return liste.length > MAX_PAR_IP;
}

function plafondAtteint() {
  const maintenant = Date.now();
  confirmationsEnvoyees = confirmationsEnvoyees.filter((t) => maintenant - t < HEURE);
  return confirmationsEnvoyees.length >= PLAFOND_HEURE;
}

// Envoyé moins de 3 secondes après l'ouverture de la page : un robot. La page envoie
// « ecoule » (mesuré sur l'horloge du visiteur, insensible à une horloge déréglée) ;
// à défaut, « instant » est comparé à l'heure du serveur.
function tropRapide(m) {
  if (m.ecoule !== undefined && m.ecoule !== "" && Number.isFinite(Number(m.ecoule))) return Number(m.ecoule) < 3000;
  const instant = Number(m.instant);
  if (!instant) return false;
  const ecart = Date.now() - instant;
  return ecart >= 0 && ecart < 3000;
}

// Derrière Traefik, la dernière adresse de X-Forwarded-For est celle que Traefik a vue.
function adresseIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
  return fwd.length ? fwd[fwd.length - 1] : (req.socket.remoteAddress || "?");
}

// ---------------------------------------------------------------- enregistrement
const iso = () => new Date().toISOString();

// Renvoie l'abonné et s'il faut (r)envoyer un lien de confirmation. Jamais plus d'un lien
// toutes les 10 minutes, ni plus de 3 par 24 heures, pour une même adresse.
function enregistrer(email, liste, page) {
  const base = C.lireAbonnes();
  const maintenant = Date.now();
  let a = C.trouver(base, email, liste);
  if (a && a.etat === "confirme") return { a, envoyer: false, raison: "adresse déjà confirmée" };
  if (!a) {
    a = { id: C.nouvelId(), email, liste, etat: "en_attente", demandeLe: iso(), page, confirmations: [] };
    base.abonnes[a.id] = a;
  } else {
    if (a.etat === "desinscrit") a.etat = "en_attente";
    a.demandeLe = iso();
  }
  const recents = (a.confirmations || []).filter((t) => maintenant - Date.parse(t) < JOUR);
  const derniere = recents.length ? Date.parse(recents[recents.length - 1]) : 0;
  let envoyer = true, raison = "";
  if (maintenant - derniere < 10 * 60_000) { envoyer = false; raison = "un lien est parti il y a moins de 10 minutes"; }
  else if (recents.length >= 3) { envoyer = false; raison = "déjà 3 liens en 24 heures"; }
  else if (C.envoiConfigure() && plafondAtteint()) { envoyer = false; raison = `plafond de ${PLAFOND_HEURE} confirmations par heure atteint`; }
  if (envoyer && C.envoiConfigure()) { recents.push(iso()); confirmationsEnvoyees.push(maintenant); }
  a.confirmations = recents;
  C.ecrireAbonnes(base);
  return { a, envoyer, raison };
}

// ---------------------------------------------------------------- e-mail de confirmation
function emailConfirmation(a) {
  const L = LISTES[a.liste];
  const lien = C.lienConfirmation(a.id);
  const p = (t) => `<tr><td style="padding:0 0 16px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#b8b5ad;">${t}</td></tr>`;
  const corps = `<tr><td style="padding:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;font-weight:bold;color:#f5f4f1;">Un dernier clic</td></tr>
${p(`Vous avez demandé à recevoir une lettre à chaque nouveau portrait <strong style="color:#f5f4f1;">${C.echapper(L.des)}</strong>, le podcast qui raconte les femmes et les hommes qui façonnent l'intelligence artificielle.`)}
${p("Pour confirmer, il suffit de cliquer :")}
<tr><td style="padding:4px 0 22px;">${C.boutonEmail("Je confirme mon abonnement", lien)}</td></tr>
<tr><td style="padding:0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#8a877f;">Le bouton ne marche pas ? Copiez ce lien dans votre navigateur :<br><a href="${C.echapper(lien)}" style="color:#c4a265;word-break:break-all;">${C.echapper(lien)}</a></td></tr>`;
  const pied = `Ce n'est pas vous ? Ignorez simplement cet e-mail : sans confirmation, vous ne recevrez rien et votre adresse sera effacée sous 30 jours. Le lien est valable 7 jours.<br><br>
Une lettre à chaque nouveau portrait, rien d'autre. Désinscription en un clic. <a href="${C.echapper(CONF.confidentialite)}" style="color:#c4a265;">Confidentialité</a>`;
  const texte = [
    "LES VOIX DE L'IA", "",
    "Un dernier clic", "",
    `Vous avez demandé à recevoir une lettre à chaque nouveau portrait ${L.des}, le podcast qui raconte les femmes et les hommes qui façonnent l'intelligence artificielle.`, "",
    "Pour confirmer, ouvrez ce lien :", lien, "",
    "Ce n'est pas vous ? Ignorez simplement cet e-mail : sans confirmation, vous ne recevrez rien et votre adresse sera effacée sous 30 jours. Le lien est valable 7 jours.", "",
    "Une lettre à chaque nouveau portrait, rien d'autre. Désinscription en un clic.",
    "Confidentialité : " + CONF.confidentialite,
  ].join("\n");
  return {
    to: [a.email],
    subject: `Confirmez votre abonnement ${L.aux}`,
    html: C.cadreEmail({ titre: `Confirmez votre abonnement ${L.aux}`, preentete: "Un clic pour recevoir chaque nouveau portrait.", corps, pied }),
    text: texte,
  };
}

async function envoyerConfirmation(a) {
  if (!C.envoiConfigure()) {
    console.log(`envoi non configuré — lien de confirmation pour ${C.masquer(a.email)} : ${C.lienConfirmation(a.id)}`);
    return;
  }
  const r = await C.envoyerUn(emailConfirmation(a));
  if (r.ok) console.log(`confirmation envoyée à ${C.masquer(a.email)} (${r.donnees && r.donnees.id})`);
  else console.error(`confirmation NON envoyée à ${C.masquer(a.email)} : ${r.raison}`);
}

// ---------------------------------------------------------------- pages (fond noir, or)
function page(rep, statut, { titre, texte, actions }) {
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark">
<title>${C.echapper(titre)} · Les Voix de l'IA</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0a0a0c;--texte:#f5f4f1;--doux:#b8b5ad;--faible:#8a877f;--or:#c4a265;--or-clair:#d4b275;--bord:#2c2c31;--vert:#86b59c}
html,body{min-height:100%}
body{background:var(--bg);color:var(--texte);font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.55;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem 1rem}
.carte{position:relative;overflow:hidden;width:100%;max-width:560px;border:1px solid #222226;background:linear-gradient(135deg,#121216,#0c0c0f);padding:2.4rem 1.5rem}
.carte::after{content:'';position:absolute;right:-90px;top:-90px;width:280px;height:280px;border-radius:50%;background:radial-gradient(#c4a26526,transparent 70%);pointer-events:none}
.marque{font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;font-size:.68rem;letter-spacing:.32em;text-transform:uppercase;color:var(--or);margin-bottom:1.3rem}
h1{font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:clamp(1.8rem,7vw,2.5rem);line-height:1.12;font-weight:700;margin-bottom:1rem}
h1 em{font-style:italic;font-weight:400;color:var(--or)}
p{color:var(--doux);font-weight:300;margin-bottom:.9rem}
p a{color:var(--or);text-underline-offset:3px}
.actions{display:flex;flex-wrap:wrap;gap:.7rem;margin-top:1.6rem;position:relative;z-index:1}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.95rem 1.5rem;font-family:'JetBrains Mono',ui-monospace,Menlo,monospace;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;border:1px solid transparent;cursor:pointer;background:none;color:inherit;transition:background .3s,border-color .3s,color .3s}
.btn-or{background:var(--or);color:var(--bg)}
.btn-or:hover{background:var(--or-clair)}
.btn-ligne{border-color:var(--bord);color:var(--texte)}
.btn-ligne:hover{border-color:var(--or);color:var(--or)}
.petit{font-size:.85rem;color:var(--faible);margin-top:1.4rem}
.petit a{color:var(--or)}
form{display:inline}
a:focus-visible,button:focus-visible{outline:2px solid var(--or);outline-offset:3px}
@media(max-width:480px){.btn{width:100%}form{display:block;width:100%}}
</style></head>
<body><main class="carte"><div class="marque">Les Voix de l'IA</div>${texte}<div class="actions">${actions || ""}</div></main></body></html>`;
  rep.writeHead(statut, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  });
  rep.end(html);
}

const retour = (liste, ancre = "", libelle = "Écouter les portraits") =>
  `<a class="btn btn-or" href="${C.echapper((LISTES[liste] || LISTES["voix-de-lia"]).page + ancre)}">${C.echapper(libelle)}</a>`;

function json(rep, statut, objet) {
  rep.writeHead(statut, { "Content-Type": "application/json; charset=utf-8" });
  rep.end(JSON.stringify(objet));
}

// ---------------------------------------------------------------- les routes
function inscription(rep, m, ip, enHtml) {
  const liste = String(m.liste || "voix-de-lia");
  const email = C.normaliser(m.email);
  const reponseOk = () => enHtml
    ? page(rep, 200, C.envoiConfigure() ? {
      titre: "Vérifiez votre boîte",
      texte: `<h1>Vérifiez votre <em>boîte</em></h1><p>Un e-mail de confirmation vient de partir. Cliquez le lien qu'il contient pour recevoir chaque nouveau portrait.</p><p class="petit">Rien reçu d'ici quelques minutes ? Regardez dans les indésirables.</p>`,
      actions: retour(liste),
    } : {
      titre: "Presque prêt",
      texte: `<h1>Presque <em>prêt</em></h1><p>Votre demande est notée, mais l'envoi des e-mails n'est pas encore en service. Réessayez dans quelques jours.</p>`,
      actions: retour(liste),
    })
    : json(rep, 200, C.envoiConfigure() ? { ok: true } : { ok: true, envoi: "non configuré" });
  const refus = (statut, erreurs) => enHtml
    ? page(rep, statut, { titre: "Inscription impossible", texte: `<h1>Inscription <em>impossible</em></h1>${erreurs.map((x) => `<p>${C.echapper(x)}</p>`).join("")}`, actions: retour(liste, "#abonnement", "Revenir à la page") })
    : json(rep, statut, { erreurs });

  // Un robot reçoit la même réponse qu'un humain, et rien n'est enregistré.
  if (m.site || tropRapide(m)) { console.log("demande de robot ignorée"); return reponseOk(); }
  if (!LISTES[liste]) return refus(422, ["Cette liste n'existe pas."]);
  if (!C.emailValide(email)) return refus(422, ["Cette adresse e-mail semble incorrecte."]);
  if (tropDeDemandes(ip)) return refus(429, ["Trop de demandes depuis cette connexion. Réessayez dans une heure."]);

  // Même réponse que l'adresse soit nouvelle, en attente ou déjà abonnée : rien ne fuit.
  const { a, envoyer, raison } = enregistrer(email, liste, String(m.page || "").slice(0, 200));
  reponseOk();
  if (envoyer) envoyerConfirmation(a).catch((e) => console.error("confirmation :", e.message));
  else console.log(`demande pour ${C.masquer(email)} (${a.etat}) — pas de nouveau lien : ${raison}`);
}

function confirmer(rep, jeton) {
  const j = C.lireJetonConfirmation(jeton);
  const perime = (texte) => page(rep, 410, {
    titre: "Lien périmé",
    texte: `<h1>Ce lien ne fonctionne <em>plus</em></h1><p>${texte}</p><p>Inscrivez-vous de nouveau depuis la page du podcast : un nouveau lien vous sera envoyé.</p>`,
    actions: retour("voix-de-lia", "#abonnement", "Revenir à la page"),
  });
  if (!j.valide) {
    return page(rep, 400, { titre: "Lien incomplet", texte: `<h1>Ce lien est <em>incomplet</em></h1><p>Il a peut-être été coupé par votre messagerie. Ouvrez-le en entier, en le copiant depuis l'e-mail reçu.</p>`, actions: retour("voix-de-lia", "#abonnement", "Revenir à la page") });
  }
  const base = C.lireAbonnes();
  const a = base.abonnes[j.id];
  if (!a) return perime("Il a expiré, ou l'adresse a été effacée faute de confirmation.");
  if (a.etat === "confirme") {
    return page(rep, 200, { titre: "Abonnement déjà actif", texte: `<h1>Votre abonnement est <em>déjà actif</em></h1><p>Chaque nouveau portrait ${C.echapper(LISTES[a.liste].des)} vous arrivera par e-mail.</p>`, actions: retour(a.liste) });
  }
  if (j.expire) return perime("Il était valable 7 jours.");
  if (a.etat !== "en_attente") return perime("Cette adresse a été désinscrite depuis l'envoi de ce lien.");
  a.etat = "confirme";
  a.confirmeLe = iso();
  C.ecrireAbonnes(base);
  console.log(`abonnement confirmé : ${C.masquer(a.email)}`);
  return page(rep, 200, {
    titre: "Abonnement confirmé",
    texte: `<h1>C'est <em>confirmé</em></h1><p>Vous recevrez une lettre à chaque nouveau portrait ${C.echapper(LISTES[a.liste].des)}. Rien d'autre.</p><p>Chaque lettre contient un lien pour vous désinscrire en un clic.</p>`,
    actions: retour(a.liste, "", "Découvrir les portraits"),
  });
}

function desinscrire(jeton) {
  const j = C.lireJetonDesinscription(jeton);
  if (!j.valide) return null;
  const base = C.lireAbonnes();
  const a = base.abonnes[j.id];
  if (a && a.etat !== "desinscrit") {
    a.etat = "desinscrit";
    a.desinscritLe = iso();
    C.ecrireAbonnes(base);
    console.log(`désinscription : ${C.masquer(a.email)}`);
  }
  return { a, jeton };
}

function pageDesinscription(rep, jeton) {
  const r = desinscrire(jeton);
  if (!r) {
    return page(rep, 400, {
      titre: "Lien incomplet",
      texte: `<h1>Ce lien est <em>incomplet</em></h1><p>Il a peut-être été coupé par votre messagerie. Ouvrez-le en entier depuis la lettre reçue, ou écrivez à <a href="mailto:${C.echapper(CONF.repondreA)}">${C.echapper(CONF.repondreA)}</a> : on vous désinscrit à la main.</p>`,
      actions: retour("voix-de-lia", "", "Revenir à la page"),
    });
  }
  const liste = r.a ? r.a.liste : "voix-de-lia";
  return page(rep, 200, {
    titre: "Désinscription faite",
    texte: `<h1>C'est <em>fait</em></h1><p>Vous ne recevrez plus de lettre ${C.echapper(LISTES[liste].des)}.</p>${r.a ? "<p>Un clic par erreur ? Un bouton suffit pour revenir.</p>" : ""}`,
    actions: retour(liste, "", "Écouter les portraits") + (r.a ? `<form method="post" action="${CONF.chemin}/reabonner"><input type="hidden" name="jeton" value="${C.echapper(r.jeton)}"><button class="btn btn-ligne" type="submit">Me réabonner</button></form>` : ""),
  });
}

function reabonner(rep, jeton) {
  const j = C.lireJetonDesinscription(jeton);
  const base = j.valide ? C.lireAbonnes() : null;
  const a = base && base.abonnes[j.id];
  if (!a) {
    return page(rep, 400, { titre: "Lien incomplet", texte: `<h1>Impossible de vous <em>réabonner</em></h1><p>Inscrivez-vous de nouveau depuis la page du podcast.</p>`, actions: retour("voix-de-lia", "#abonnement", "Revenir à la page") });
  }
  // Le lien venait de sa boîte : l'adresse est déjà vérifiée, pas besoin d'une nouvelle confirmation.
  if (a.etat !== "confirme") {
    a.etat = "confirme";
    a.confirmeLe = iso();
    a.reabonneLe = iso();
    delete a.desinscritLe;
    C.ecrireAbonnes(base);
    console.log(`réabonnement : ${C.masquer(a.email)}`);
  }
  return page(rep, 200, { titre: "Abonnement rétabli", texte: `<h1>Votre abonnement est <em>rétabli</em></h1><p>Chaque nouveau portrait ${C.echapper(LISTES[a.liste].des)} vous arrivera par e-mail.</p>`, actions: retour(a.liste) });
}

// ---------------------------------------------------------------- serveur
function lireCorps(req, max = 4096) {
  return new Promise((resolve) => {
    let corps = "", trop = false;
    req.on("data", (c) => { if (trop) return; corps += c; if (corps.length > max) { trop = true; resolve(null); } });
    req.on("end", () => { if (!trop) resolve(corps); });
    req.on("error", () => resolve(null));
  });
}

function analyser(corps, type) {
  if (/application\/x-www-form-urlencoded/i.test(type)) return Object.fromEntries(new URLSearchParams(corps));
  try { const m = JSON.parse(corps); return m && typeof m === "object" ? m : null; } catch { return null; }
}

const serveur = http.createServer(async (req, rep) => {
  // Traefik transmet le chemin complet (/api/abonnement/…) : on le normalise pour
  // répondre aussi bien derrière le proxy qu'en direct.
  let url;
  try { url = new URL(req.url || "/", "http://local"); } catch { rep.writeHead(400).end(); return; }
  const chemin = url.pathname.replace(/^\/api\/abonnement/, "").replace(/\/+$/, "") || "/";
  const origine = req.headers.origin || "";
  const autorisee = CONF.origines.includes(origine);

  rep.setHeader("X-Content-Type-Options", "nosniff");
  rep.setHeader("Referrer-Policy", "no-referrer");          // le jeton ne part pas vers la page suivante
  rep.setHeader("Cache-Control", "no-store");
  rep.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (autorisee) {
    rep.setHeader("Access-Control-Allow-Origin", origine);
    rep.setHeader("Access-Control-Allow-Headers", "Content-Type");
    rep.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    rep.setHeader("Access-Control-Max-Age", "600");
  }
  rep.setHeader("Vary", "Origin");

  try {
    if (req.method === "OPTIONS") { rep.writeHead(autorisee ? 204 : 403).end(); return; }

    if (req.method === "GET" && chemin === "/sante") return json(rep, 200, { ok: true, envoiConfigure: C.envoiConfigure() });

    if (chemin === "/confirmer" && req.method === "GET") return confirmer(rep, url.searchParams.get("jeton"));

    if (chemin === "/desinscription" && req.method === "GET") return pageDesinscription(rep, url.searchParams.get("jeton"));

    if (chemin === "/desinscription" && req.method === "POST") {
      // Désinscription « One-Click » (RFC 8058) : la messagerie poste « List-Unsubscribe=One-Click »
      // sur l'adresse de l'en-tête, qui porte le jeton.
      const corps = await lireCorps(req);
      const jeton = url.searchParams.get("jeton") || (corps ? new URLSearchParams(corps).get("jeton") : "");
      const r = desinscrire(jeton);
      rep.writeHead(r ? 200 : 400, { "Content-Type": "text/plain; charset=utf-8" });
      rep.end(r ? "Désinscription faite." : "Lien incomplet.");
      return;
    }

    if (chemin === "/reabonner" && req.method === "POST") {
      const corps = await lireCorps(req);
      return reabonner(rep, corps ? new URLSearchParams(corps).get("jeton") : "");
    }

    if (chemin === "/" && req.method === "POST") {
      // Une page d'un autre site ne peut pas inscrire quelqu'un à son insu.
      if (origine && !autorisee) return json(rep, 403, { erreurs: ["Origine non autorisée."] });
      const type = String(req.headers["content-type"] || "");
      const enHtml = /application\/x-www-form-urlencoded/i.test(type);   // formulaire sans JavaScript
      const corps = await lireCorps(req);
      const m = corps === null ? null : analyser(corps, type);
      if (!m) return json(rep, 400, { erreurs: ["Demande illisible."] });
      return inscription(rep, m, adresseIp(req), enHtml);
    }

    return json(rep, 404, { erreur: "Adresse inconnue." });
  } catch (e) {
    console.error("erreur :", e.message);
    if (!rep.headersSent) json(rep, 500, { erreurs: ["Erreur du serveur. Réessayez dans un moment."] });
  }
});

// ---------------------------------------------------------------- ménage
// Les adresses jamais confirmées sont effacées après 30 jours ; les compteurs anti-abus sont vidés.
function purger() {
  try {
    const base = C.lireAbonnes();
    const limite = Date.now() - C.PURGE_EN_ATTENTE;
    let n = 0;
    for (const [id, a] of Object.entries(base.abonnes)) {
      if (a.etat === "en_attente" && Date.parse(a.demandeLe) < limite) { delete base.abonnes[id]; n++; }
    }
    if (n) { C.ecrireAbonnes(base); console.log(`${n} adresse(s) jamais confirmée(s) effacée(s) après 30 jours`); }
  } catch (e) { console.error("purge :", e.message); }
}
setInterval(purger, JOUR).unref();
setInterval(() => {
  const maintenant = Date.now();
  for (const [ip, t] of parIp) if (!t.some((x) => maintenant - x < HEURE)) parIp.delete(ip);
}, 10 * 60_000).unref();

serveur.listen(CONF.port, () => {
  purger();
  console.log(`abonnements sur le port ${CONF.port} — liens vers ${CONF.adresse}${CONF.chemin}`);
  console.log(C.envoiConfigure()
    ? `envoi configuré (Resend), expéditeur ${CONF.expediteur}, réponses à ${CONF.repondreA}`
    : "envoi NON configuré (RESEND_API_KEY absente) : les liens de confirmation sont écrits dans ce journal");
});
