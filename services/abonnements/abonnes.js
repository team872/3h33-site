/**
 * Petite commande de gestion des abonnés, à lancer dans le conteneur :
 *
 *   docker compose exec abonnements node abonnes.js                       le bilan, liste par liste
 *   docker compose exec abonnements node abonnes.js chercher <adresse>    où en est cette adresse
 *   docker compose exec abonnements node abonnes.js desinscrire <adresse> la désinscrire (demande reçue par e-mail)
 *   docker compose exec abonnements node abonnes.js effacer <adresse>     tout effacer (droit à l'effacement)
 *
 * N'affiche jamais la liste des adresses : seulement des comptes, ou la fiche demandée.
 */
"use strict";
const C = require("./commun");

const [action = "bilan", adresseBrute, listeDemandee] = process.argv.slice(2);
const base = C.lireAbonnes();
const fiches = Object.values(base.abonnes);

if (action === "bilan") {
  const listes = [...new Set(fiches.map((a) => a.liste))];
  if (!listes.length) console.log("Aucun abonné pour l'instant.");
  for (const l of listes) {
    const n = (etat) => fiches.filter((a) => a.liste === l && a.etat === etat).length;
    console.log(`${(C.LISTES[l] || { nom: l }).nom} : ${n("confirme")} confirmé(s), ${n("en_attente")} en attente de confirmation, ${n("desinscrit")} désinscrit(s)`);
  }
  process.exit(0);
}

if (!["chercher", "desinscrire", "effacer"].includes(action) || !adresseBrute) {
  console.error("Utilisation : node abonnes.js [bilan | chercher <adresse> | desinscrire <adresse> | effacer <adresse>] [liste]");
  process.exit(1);
}

const email = C.normaliser(adresseBrute);
const trouvees = fiches.filter((a) => a.email === email && (!listeDemandee || a.liste === listeDemandee));
if (!trouvees.length) { console.log(`${email} : inconnue.`); process.exit(0); }

for (const a of trouvees) {
  if (action === "chercher") {
    console.log(`${a.email} · ${a.liste} · ${a.etat} · demande ${a.demandeLe || "?"}${a.confirmeLe ? ` · confirmé ${a.confirmeLe}` : ""}${a.desinscritLe ? ` · désinscrit ${a.desinscritLe}` : ""}`);
  } else if (action === "desinscrire") {
    a.etat = "desinscrit";
    a.desinscritLe = new Date().toISOString();
    console.log(`${a.email} (${a.liste}) : désinscrite.`);
  } else {
    delete base.abonnes[a.id];
    console.log(`${a.email} (${a.liste}) : fiche effacée.`);
  }
}
if (action !== "chercher") C.ecrireAbonnes(base);
