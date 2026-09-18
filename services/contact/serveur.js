/**
 * Service du formulaire de contact de 3h33.com.
 *
 * Reçoit les messages, les enregistre sur disque et les envoie par courriel.
 * L'adresse de destination n'apparaît jamais dans les pages : elle vit ici,
 * dans la configuration du serveur.
 *
 * L'envoi passe par l'API Hostinger Email (api.mail.hostinger.com), depuis la
 * boîte site@3h33.com : un jeton d'API borné à cette seule boîte, pas de mot
 * de passe SMTP. Le message part avec l'adresse du visiteur en clair dans le
 * corps et le sujet : l'API ne connaît pas l'en-tête Reply-To.
 *
 * Réglages (variables d'environnement, fichier .env sur le VPS) :
 *   DESTINATAIRE      adresse qui reçoit les messages
 *   MAIL_BOITE        identifiant de la boîte expéditrice chez Hostinger (AC…)
 *   MAIL_JETON        jeton de l'API Hostinger Email, borné à cette boîte
 *   MAIL_EXPEDITEUR   l'adresse de cette boîte, pour l'affichage (site@3h33.com)
 *   ORIGINES          domaines autorisés, séparés par des virgules
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const CONF = {
  port: Number(process.env.PORT || 3020),
  destinataire: process.env.DESTINATAIRE || "",
  mail: {
    boite: process.env.MAIL_BOITE || "",
    jeton: process.env.MAIL_JETON || "",
    expediteur: process.env.MAIL_EXPEDITEUR || "site@3h33.com",
  },
  origines: (process.env.ORIGINES || "https://3h33.com,https://www.3h33.com,https://nouveau.3h33.com").split(","),
  dossier: process.env.DOSSIER_MESSAGES || "/données/messages",
};

fs.mkdirSync(CONF.dossier, { recursive: true });

// ---------------------------------------------------------------- garde-fous
const recents = new Map();                       // adresse IP -> horodatages
function tropDeMessages(ip) {
  const maintenant = Date.now();
  const liste = (recents.get(ip) || []).filter((t) => maintenant - t < 3600_000);
  liste.push(maintenant);
  recents.set(ip, liste);
  return liste.length > 5;                        // 5 messages par heure et par IP
}

function valide(m) {
  const erreurs = [];
  if (!m.nom || m.nom.trim().length < 2) erreurs.push("Merci d'indiquer votre nom.");
  if (!m.email || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(m.email)) erreurs.push("L'adresse électronique semble incorrecte.");
  if (!m.message || m.message.trim().length < 10) erreurs.push("Le message est un peu court.");
  if (m.message && m.message.length > 5000) erreurs.push("Le message est trop long.");
  if (m.site) erreurs.push("robot");             // champ piège, invisible pour un humain
  if (m.instant && Date.now() - Number(m.instant) < 3000) erreurs.push("robot");
  return erreurs;
}

// ---------------------------------------------------------------- envoi par l'API Hostinger Email
function envoyer(sujet, corps) {
  const { boite, jeton } = CONF.mail;
  if (!boite || !jeton || !CONF.destinataire) {
    return Promise.resolve({ envoye: false, raison: "envoi non configuré" });
  }
  const donnees = JSON.stringify({
    to: [CONF.destinataire],
    displayName: "Site 3h33",
    subject: sujet,
    text: corps,
  });
  return new Promise((resolve) => {
    const req = https.request({
      host: "api.mail.hostinger.com",
      path: `/api/v1/mailboxes/${boite}/send`,
      method: "POST",
      headers: {
        "Authorization": "Bearer " + jeton,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(donnees),
        "Accept": "application/json",
      },
      timeout: 20000,
    }, (rep) => {
      let corps = "";
      rep.on("data", (c) => { corps += c; });
      rep.on("end", () => {
        if (rep.statusCode >= 200 && rep.statusCode < 300) resolve({ envoye: true });
        else resolve({ envoye: false, raison: `API ${rep.statusCode} ${corps.slice(0, 200)}` });
      });
    });
    req.on("timeout", () => { req.destroy(new Error("délai dépassé")); });
    req.on("error", (e) => resolve({ envoye: false, raison: e.message }));
    req.write(donnees); req.end();
  });
}

// ---------------------------------------------------------------- serveur
const serveur = http.createServer((req, rep) => {
  // Traefik transmet le chemin complet : /api/contact/... On le normalise
  // pour que le service réponde aussi bien derrière le proxy qu'en direct.
  const chemin = (req.url || "/").replace(/^\/api\/contact/, "") || "/";
  const origine = req.headers.origin || "";
  const autorisee = CONF.origines.includes(origine);
  if (autorisee) {
    rep.setHeader("Access-Control-Allow-Origin", origine);
    rep.setHeader("Vary", "Origin");
  }
  rep.setHeader("Access-Control-Allow-Headers", "Content-Type");
  rep.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") { rep.writeHead(204).end(); return; }

  if (req.method === "GET" && (chemin === "/sante" || chemin === "/sante/")) {
    rep.writeHead(200, { "Content-Type": "application/json" });
    rep.end(JSON.stringify({ ok: true, envoiConfigure: Boolean(CONF.mail.boite && CONF.mail.jeton && CONF.destinataire) }));
    return;
  }

  if (req.method !== "POST" || !(chemin === "/" || chemin.startsWith("/contact"))) {
    rep.writeHead(404, { "Content-Type": "application/json" });
    rep.end(JSON.stringify({ erreur: "Adresse inconnue." }));
    return;
  }

  let corps = "";
  req.on("data", (c) => { corps += c; if (corps.length > 20000) req.destroy(); });
  req.on("end", async () => {
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";
    let m;
    try { m = JSON.parse(corps); } catch { m = null; }
    if (!m) { rep.writeHead(400, { "Content-Type": "application/json" }); rep.end(JSON.stringify({ erreur: "Message illisible." })); return; }

    const erreurs = valide(m);
    if (erreurs.includes("robot")) {                       // on ne le dit pas au robot
      rep.writeHead(200, { "Content-Type": "application/json" }); rep.end(JSON.stringify({ ok: true })); return;
    }
    if (erreurs.length) { rep.writeHead(422, { "Content-Type": "application/json" }); rep.end(JSON.stringify({ erreurs })); return; }
    if (tropDeMessages(ip)) {
      rep.writeHead(429, { "Content-Type": "application/json" });
      rep.end(JSON.stringify({ erreurs: ["Trop de messages envoyés depuis cette adresse. Réessayez dans une heure."] })); return;
    }

    const recu = {
      recuLe: new Date().toISOString(),
      nom: String(m.nom).slice(0, 120).trim(),
      email: String(m.email).slice(0, 160).trim(),
      organisation: String(m.organisation || "").slice(0, 160).trim(),
      sujet: String(m.sujet || "Contact").slice(0, 120).trim(),
      message: String(m.message).slice(0, 5000).trim(),
      page: String(m.page || "").slice(0, 200),
      ip,
    };
    const nomFichier = `${recu.recuLe.replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}.json`;
    try { fs.writeFileSync(path.join(CONF.dossier, nomFichier), JSON.stringify(recu, null, 1), "utf8"); }
    catch (e) { console.error("écriture impossible :", e.message); }

    const texte = [
      `Répondre à   : ${recu.email}`,
      `Nom          : ${recu.nom}`,
      recu.organisation ? `Organisation : ${recu.organisation}` : null,
      `Sujet        : ${recu.sujet}`,
      `Page         : ${recu.page}`,
      `Reçu le      : ${recu.recuLe}`,
      "", "-----", "", recu.message, "",
    ].filter((l) => l !== null).join("\n");

    let resultat = { envoye: false, raison: "" };
    try { resultat = await envoyer(`[3h33] ${recu.sujet} — ${recu.nom} <${recu.email}>`, texte); }
    catch (e) { resultat = { envoye: false, raison: e.message }; console.error("envoi :", e.message); }

    console.log(`message de ${recu.email} — enregistré${resultat.envoye ? " et envoyé" : ` (envoi : ${resultat.raison})`}`);
    rep.writeHead(200, { "Content-Type": "application/json" });
    rep.end(JSON.stringify({ ok: true }));
  });
});

serveur.listen(CONF.port, () => {
  console.log(`formulaire de contact sur le port ${CONF.port}`);
  console.log(`envoi ${CONF.mail.boite && CONF.mail.jeton && CONF.destinataire ? "configuré vers " + CONF.destinataire + " via l'API Hostinger Email" : "NON configuré — les messages sont seulement enregistrés"}`);
});
