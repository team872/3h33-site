/**
 * Ce que partagent le service d'abonnement (serveur.js), l'envoi des lettres
 * (envoyer-lettre.js) et la petite commande de gestion (abonnes.js) :
 * réglages, listes, fichiers de données, liens signés, envoi par Resend.
 *
 * Aucune dépendance : Node 22 suffit (fetch, crypto).
 * Aucun secret ici : la clé Resend et le secret des liens sont lus dans .env.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ---------------------------------------------------------------- réglages
const CONF = {
  port: Number(process.env.PORT || 3030),
  // Adresse publique du site : sert à écrire les liens des e-mails.
  adresse: (process.env.ADRESSE_PUBLIQUE || "https://3h33.com").replace(/\/+$/, ""),
  chemin: "/api/abonnement",
  secret: process.env.SECRET || "",
  resendCle: process.env.RESEND_API_KEY || "",
  // Seulement pour les essais en local (faux serveur Resend) : jamais dans le .env du VPS.
  resendUrl: (process.env.RESEND_URL || "https://api.resend.com").replace(/\/+$/, ""),
  expediteur: process.env.EXPEDITEUR || "Les Voix de l'IA <voixdelia@lettres.3h33.com>",
  repondreA: process.env.REPONDRE_A || "voixdelia@3h33.fr",
  origines: (process.env.ORIGINES || "https://3h33.com,https://www.3h33.com,https://nouveau.3h33.com")
    .split(",").map((s) => s.trim()).filter(Boolean),
  dossier: process.env.DOSSIER_DONNEES || "/donnees",
  confidentialite: "https://3h33.com/politique-de-confidentialite/",
};

// Les listes auxquelles on peut s'abonner. Une seule pour l'instant.
const LISTES = {
  "voix-de-lia": {
    nom: "Les Voix de l'IA",
    des: "des Voix de l'IA",          // « chaque nouveau portrait des Voix de l'IA »
    aux: "aux Voix de l'IA",          // « votre abonnement aux Voix de l'IA »
    page: "https://3h33.com/podcast-voix-de-lia/",
    flux: "https://3h33.com/podcast-voix-de-lia/flux.xml",
  },
};

const DUREE_CONFIRMATION = 7 * 24 * 3600_000;   // un lien de confirmation vaut 7 jours
const PURGE_EN_ATTENTE = 30 * 24 * 3600_000;     // sans confirmation, l'adresse est effacée après 30 jours

function envoiConfigure() { return Boolean(CONF.resendCle); }

function verifierSecret() {
  if (CONF.secret.length < 32) {
    console.error("SECRET manquant ou trop court dans .env (32 caractères au moins) : les liens ne pourraient pas être signés. Arrêt.");
    process.exit(1);
  }
}

// ---------------------------------------------------------------- petites aides
const echapper = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// « a…@gmail.com » : assez pour suivre le journal, sans y écrire les adresses en entier.
function masquer(email) {
  const [local, domaine] = String(email).split("@");
  return (local ? local[0] : "") + "…@" + (domaine || "?");
}

function normaliser(email) { return String(email || "").trim().toLowerCase(); }

function emailValide(email) {
  return typeof email === "string" && email.length <= 254 && /^[^@\s<>"',;:]+@[^@\s<>"',;:]+\.[a-z]{2,}$/i.test(email);
}

// ---------------------------------------------------------------- fichiers de données (volume)
// abonnes.json : écrit par le service (et par abonnes.js). envois.json : écrit par envoyer-lettre.js.
// Écriture atomique : on écrit un fichier temporaire puis on le renomme, le fichier n'est jamais à moitié écrit.
function fichier(nom) { return path.join(CONF.dossier, nom); }

function lireJson(nom, vide) {
  try { return JSON.parse(fs.readFileSync(fichier(nom), "utf8")); }
  catch (e) {
    if (e.code === "ENOENT") return vide();
    throw new Error(`${nom} illisible (${e.message}) : rien n'est modifié.`);
  }
}

function ecrireJson(nom, donnees) {
  fs.mkdirSync(CONF.dossier, { recursive: true });
  const cible = fichier(nom);
  const temporaire = `${cible}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  const fd = fs.openSync(temporaire, "w", 0o600);
  try { fs.writeSync(fd, JSON.stringify(donnees, null, 1)); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temporaire, cible);
}

const lireAbonnes = () => lireJson("abonnes.json", () => ({ version: 1, abonnes: {} }));
const ecrireAbonnes = (d) => ecrireJson("abonnes.json", d);
const lireEnvois = () => lireJson("envois.json", () => ({ version: 1, lettres: {} }));
const ecrireEnvois = (d) => ecrireJson("envois.json", d);

function trouver(base, email, liste) {
  return Object.values(base.abonnes).find((a) => a.email === email && a.liste === liste) || null;
}

const nouvelId = () => crypto.randomBytes(12).toString("base64url");

// ---------------------------------------------------------------- liens signés (HMAC)
// Le lien ne contient jamais l'adresse e-mail : seulement l'identifiant tiré au hasard
// de l'abonné, et une signature. Une clé dérivée par usage : un lien de désinscription
// ne peut pas servir à confirmer, et inversement.
function cle(usage) { return crypto.createHmac("sha256", CONF.secret).update("3h33-abonnements/" + usage).digest(); }
function signature(usage, charge) { return crypto.createHmac("sha256", cle(usage)).update(charge).digest("base64url"); }
function egal(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function jetonConfirmation(id, instant = Date.now()) {
  const charge = `${id}.${instant.toString(36)}`;
  return `${charge}.${signature("confirmer", charge)}`;
}
function lireJetonConfirmation(jeton) {
  const m = /^([A-Za-z0-9_-]{8,40})\.([0-9a-z]{1,12})\.([A-Za-z0-9_-]{43})$/.exec(String(jeton || ""));
  if (!m || !egal(m[3], signature("confirmer", `${m[1]}.${m[2]}`))) return { valide: false };
  const instant = parseInt(m[2], 36);
  return { valide: true, id: m[1], instant, expire: Date.now() - instant > DUREE_CONFIRMATION };
}

function jetonDesinscription(id) { return `${id}.${signature("desinscription", id)}`; }
function lireJetonDesinscription(jeton) {
  const m = /^([A-Za-z0-9_-]{4,40})\.([A-Za-z0-9_-]{43})$/.exec(String(jeton || ""));
  if (!m || !egal(m[2], signature("desinscription", m[1]))) return { valide: false };
  return { valide: true, id: m[1] };
}

const lienConfirmation = (id) => `${CONF.adresse}${CONF.chemin}/confirmer?jeton=${jetonConfirmation(id)}`;
const lienDesinscription = (id) => `${CONF.adresse}${CONF.chemin}/desinscription?jeton=${jetonDesinscription(id)}`;

// En-têtes de désinscription en un clic (Gmail, Yahoo, Apple Mail…). Pas de « mailto: » :
// une demande par e-mail devrait être traitée à la main, et passerait inaperçue.
function entetesDesinscription(id, liste) {
  return {
    "List-Unsubscribe": `<${lienDesinscription(id)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "List-Id": `${LISTES[liste] ? LISTES[liste].nom.replace(/[<>"]/g, "") : liste} <${liste}.lettres.3h33.com>`,
  };
}

// ---------------------------------------------------------------- Resend
// API https://api.resend.com : en-tête Authorization Bearer, User-Agent obligatoire
// (sinon 403), 10 requêtes par seconde au plus, lots de 100 e-mails au plus.
async function resend(chemin, corps, { idempotence, entetes } = {}) {
  if (!envoiConfigure()) return { ok: false, statut: 0, raison: "envoi non configuré (RESEND_API_KEY absente)" };
  let rep;
  try {
    rep = await fetch(CONF.resendUrl + chemin, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + CONF.resendCle,
        "Content-Type": "application/json",
        "User-Agent": "3h33-abonnements/1.0",
        ...(idempotence ? { "Idempotency-Key": idempotence } : {}),
        ...(entetes || {}),
      },
      body: JSON.stringify(corps),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    return { ok: false, statut: 0, raison: "Resend injoignable : " + e.message };
  }
  const texte = await rep.text();
  let json = null;
  try { json = JSON.parse(texte); } catch { /* réponse non JSON */ }
  if (!rep.ok) {
    const attente = Number(rep.headers.get("retry-after")) || 0;
    return { ok: false, statut: rep.status, attente, raison: `Resend ${rep.status} : ${(json && (json.message || json.name)) || texte.slice(0, 200)}` };
  }
  return { ok: true, statut: rep.status, donnees: json };
}

function envoyerUn(message, idempotence) {
  return resend("/emails", { from: CONF.expediteur, reply_to: CONF.repondreA, ...message }, { idempotence });
}

// ---------------------------------------------------------------- e-mails : le cadre commun
// Mise en page par tableaux et styles en ligne : c'est ce que les messageries affichent le mieux.
// Fond noir et or, comme la page du podcast.
function cadreEmail({ titre, preentete, corps, pied }) {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light">
<title>${echapper(titre)}</title></head>
<body style="margin:0;padding:0;background:#0a0a0c;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#0a0a0c;font-size:1px;line-height:1px;">${echapper(preentete)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0c" style="background:#0a0a0c;">
<tr><td align="center" style="padding:32px 16px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
<tr><td style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c4a265;padding:0 0 22px;">Les Voix de l'IA</td></tr>
${corps}
<tr><td style="padding:36px 0 0;"><div style="height:1px;line-height:1px;font-size:1px;background:#2c2c31;">&nbsp;</div></td></tr>
<tr><td style="padding:18px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.65;color:#8a877f;">${pied}</td></tr>
</table></td></tr></table></body></html>`;
}

// Bouton or, qui reste un bouton même quand les images sont bloquées.
function boutonEmail(libelle, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#c4a265" style="background:#c4a265;">
<a href="${echapper(url)}" style="display:inline-block;padding:15px 28px;font-family:'Courier New',Courier,monospace;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#0a0a0c;text-decoration:none;">${echapper(libelle)}</a>
</td></tr></table>`;
}

module.exports = {
  CONF, LISTES, DUREE_CONFIRMATION, PURGE_EN_ATTENTE,
  envoiConfigure, verifierSecret,
  echapper, masquer, normaliser, emailValide,
  lireAbonnes, ecrireAbonnes, lireEnvois, ecrireEnvois, trouver, nouvelId, fichier,
  jetonConfirmation, lireJetonConfirmation, jetonDesinscription, lireJetonDesinscription,
  lienConfirmation, lienDesinscription, entetesDesinscription,
  resend, envoyerUn, cadreEmail, boutonEmail,
};
