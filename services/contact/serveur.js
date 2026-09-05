/**
 * Service du formulaire de contact de 3h33.com.
 *
 * Reçoit les messages, les enregistre sur disque et les envoie par courriel.
 * L'adresse de destination n'apparaît jamais dans les pages : elle vit ici,
 * dans la configuration du serveur.
 *
 * Réglages (variables d'environnement, fichier .env sur le VPS) :
 *   DESTINATAIRE   adresse qui reçoit les messages
 *   SMTP_HOTE      serveur d'envoi          (ex. smtp.hostinger.com)
 *   SMTP_PORT      465 (SSL) ou 587 (STARTTLS)
 *   SMTP_UTILISATEUR / SMTP_MOTDEPASSE
 *   ORIGINES       domaines autorisés, séparés par des virgules
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const net = require("net");
const tls = require("tls");
const crypto = require("crypto");

const CONF = {
  port: Number(process.env.PORT || 3020),
  destinataire: process.env.DESTINATAIRE || "",
  smtp: {
    hote: process.env.SMTP_HOTE || "",
    port: Number(process.env.SMTP_PORT || 465),
    utilisateur: process.env.SMTP_UTILISATEUR || "",
    motdepasse: process.env.SMTP_MOTDEPASSE || "",
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

// ---------------------------------------------------------------- envoi SMTP
function ligne(sock, attendu) {
  return new Promise((resolve, reject) => {
    let tampon = "";
    const surDonnees = (d) => {
      tampon += d.toString();
      if (!/\r\n$/.test(tampon)) return;
      sock.removeListener("data", surDonnees);
      const code = Number(tampon.slice(0, 3));
      if (attendu && !attendu.includes(code)) return reject(new Error("SMTP " + tampon.trim()));
      resolve(tampon);
    };
    sock.on("data", surDonnees);
    sock.once("error", reject);
  });
}

async function envoyer(sujet, corps, repondreA) {
  const { hote, port, utilisateur, motdepasse } = CONF.smtp;
  if (!hote || !utilisateur || !motdepasse || !CONF.destinataire) {
    return { envoye: false, raison: "envoi non configuré" };
  }
  const sock = port === 465
    ? tls.connect({ host: hote, port, servername: hote })
    : net.connect({ host: hote, port });
  await new Promise((ok, ko) => { sock.once(port === 465 ? "secureConnect" : "connect", ok); sock.once("error", ko); });
  const dire = async (cmd, attendu) => { sock.write(cmd + "\r\n"); return ligne(sock, attendu); };

  await ligne(sock, [220]);
  await dire("EHLO 3h33.com", [250]);
  await dire("AUTH LOGIN", [334]);
  await dire(Buffer.from(utilisateur).toString("base64"), [334]);
  await dire(Buffer.from(motdepasse).toString("base64"), [235]);
  await dire(`MAIL FROM:<${utilisateur}>`, [250]);
  await dire(`RCPT TO:<${CONF.destinataire}>`, [250, 251]);
  await dire("DATA", [354]);

  const enTete = [
    `From: Site 3h33 <${utilisateur}>`,
    `To: <${CONF.destinataire}>`,
    repondreA ? `Reply-To: <${repondreA}>` : null,
    `Subject: =?UTF-8?B?${Buffer.from(sujet).toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "", "",
  ].filter(Boolean).join("\r\n");
  const contenu = Buffer.from(corps, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");
  sock.write(enTete + contenu + "\r\n.\r\n");
  await ligne(sock, [250]);
  await dire("QUIT");
  sock.end();
  return { envoye: true };
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
    rep.end(JSON.stringify({ ok: true, envoiConfigure: Boolean(CONF.smtp.hote && CONF.destinataire) }));
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
      `Nom          : ${recu.nom}`,
      `Courriel     : ${recu.email}`,
      recu.organisation ? `Organisation : ${recu.organisation}` : null,
      `Sujet        : ${recu.sujet}`,
      `Page         : ${recu.page}`,
      `Reçu le      : ${recu.recuLe}`,
      "", "-----", "", recu.message, "",
    ].filter((l) => l !== null).join("\n");

    let resultat = { envoye: false, raison: "" };
    try { resultat = await envoyer(`[3h33] ${recu.sujet} — ${recu.nom}`, texte, recu.email); }
    catch (e) { resultat = { envoye: false, raison: e.message }; console.error("envoi :", e.message); }

    console.log(`message de ${recu.email} — enregistré${resultat.envoye ? " et envoyé" : ` (envoi : ${resultat.raison})`}`);
    rep.writeHead(200, { "Content-Type": "application/json" });
    rep.end(JSON.stringify({ ok: true }));
  });
});

serveur.listen(CONF.port, () => {
  console.log(`formulaire de contact sur le port ${CONF.port}`);
  console.log(`envoi ${CONF.smtp.hote && CONF.destinataire ? "configuré vers " + CONF.destinataire : "NON configuré — les messages sont seulement enregistrés"}`);
});
