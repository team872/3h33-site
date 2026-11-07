// Liens courts de 3h33.com (21/10/2026) : node liens-courts.mjs
// Lit liens-courts.json et écrit, pour chaque code, site/<code>/index.html : une page qui renvoie aussitôt vers la
// destination avec ses étiquettes de campagne (utm), comme /vibecoding. Pourquoi des pages et pas des redirections
// nginx : la mise en ligne (git pull du serveur) suffit, sans recharger nginx ; et l'aperçu LinkedIn/WhatsApp reprend
// le titre, le texte et l'image de la destination, recopiés ici depuis sa page.
// Refuse un code déjà pris par une page du site, une redirection (redirections.conf) ou un bloc de nginx.conf.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const SITE = "https://3h33.com";
const MARQUE = "<!-- lien court : liens-courts.mjs -->";
const { liens } = JSON.parse(readFileSync("liens-courts.json", "utf8"));
const redirections = readFileSync("redirections.conf", "utf8") + readFileSync("nginx.conf", "utf8");
const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

for (const l of liens) {
  if (!/^[a-z0-9-]+$/.test(l.code)) throw new Error(`code « ${l.code} » : minuscules, chiffres et tirets seulement`);
  const page = `site/${l.code}/index.html`;
  if (existsSync(page) && !readFileSync(page, "utf8").includes(MARQUE)) throw new Error(`/${l.code}/ est déjà une page du site`);
  if (new RegExp(`location\\s*(=|\\^~|~\\*?)?\\s*\\^?/${l.code}(/|\\s|\\(|\\|)`).test(redirections)) throw new Error(`/${l.code} est déjà pris dans nginx`);

  const cible = `site${l.vers}index.html`;
  if (!existsSync(cible)) throw new Error(`${l.code} : la destination ${l.vers} n'existe pas dans site/`);
  const html = readFileSync(cible, "utf8");
  const meta = (re) => (html.match(re) || [])[1] || "";
  const titre = meta(/<meta property="og:title" content="([^"]*)"/);
  const desc = meta(/<meta property="og:description" content="([^"]*)"/);
  const image = meta(/<meta property="og:image" content="([^"]*)"/);

  const url = `${SITE}${l.vers}?${new URLSearchParams(l.utm)}`;
  mkdirSync(`site/${l.code}`, { recursive: true });
  writeFileSync(page, `<!doctype html>
${MARQUE}
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titre}</title><meta name="description" content="${desc}"><meta name="robots" content="noindex">
<link rel="canonical" href="${SITE}${l.vers}"><meta http-equiv="refresh" content="0;url=${attr(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="3h33"><meta property="og:title" content="${titre}">
<meta property="og:description" content="${desc}"><meta property="og:url" content="${SITE}/${l.code}/">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${image}">
<style>body{margin:0;font:17px -apple-system,Inter,sans-serif;background:#f6f8fc;color:#0f1524;display:grid;place-items:center;min-height:100vh}a{color:#1f6ff5}</style>
</head><body><p><a href="${attr(url)}">${titre} →</a></p><script>location.replace(${JSON.stringify(url)})</script></body></html>
`);
  console.log(`  ${SITE}/${l.code} → ${url}`);
}
