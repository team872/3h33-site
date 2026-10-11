# Abonnement par e-mail des Voix de l'IA

Micro-service Node sans dépendance, sur le modèle du formulaire de contact (`services/contact`).
Il reçoit les inscriptions de l'encart « Par e-mail » de https://3h33.com/podcast-voix-de-lia/,
envoie l'e-mail de confirmation, garde la liste des abonnés, et envoie la lettre « nouveau portrait ».
Envoi par **Resend** (domaine `lettres.3h33.com`).

- Sur le VPS vitrine : `/opt/3h33-abonnements`, `docker compose up -d --build`.
- Données (abonnés, trace des lettres) : volume Docker `donnees` (`/donnees` dans le conteneur).
- Aucun secret dans le dépôt : la clé Resend et le secret des liens sont dans `.env`, sur le serveur seulement.

## Comment ça marche

1. Le visiteur tape son adresse et clique « Je m'abonne ». L'adresse est notée **en attente**.
2. Il reçoit un e-mail « Un dernier clic » avec un lien de confirmation (valable 7 jours).
   Tant qu'il n'a pas cliqué, il ne reçoit rien ; sans confirmation, l'adresse est effacée après 30 jours.
3. Il clique : l'abonnement est **confirmé** (page « C'est confirmé », aux couleurs du site).
4. À chaque nouveau portrait, Alexandre lance `envoyer-lettre.js` : la lettre part aux seuls abonnés
   confirmés. Chaque lettre a son lien « Se désinscrire en un clic » et les en-têtes qui affichent le
   bouton « Se désabonner » de Gmail, Yahoo et Apple Mail. Après une désinscription, une page propose
   « Me réabonner », au cas où le clic était une erreur.

La réponse au formulaire est **la même** que l'adresse soit nouvelle, en attente ou déjà abonnée :
personne ne peut savoir, depuis le site, si une adresse est inscrite.

| Adresse | Rôle |
|---|---|
| `POST /api/abonnement` | inscription `{email, liste: "voix-de-lia", site, instant, ecoule}` (JSON, ou formulaire sans JavaScript) |
| `GET /api/abonnement/confirmer?jeton=…` | confirmation (lien de l'e-mail) |
| `GET /api/abonnement/desinscription?jeton=…` | désinscription en un clic (lien de la lettre) |
| `POST /api/abonnement/desinscription?jeton=…` | désinscription « One-Click » envoyée par les messageries |
| `POST /api/abonnement/reabonner` | bouton « Me réabonner » de la page de désinscription |
| `GET /api/abonnement/sante` | contrôle de santé : `{"ok":true,"envoiConfigure":true}` |

Les liens ne contiennent jamais l'adresse e-mail : un identifiant tiré au hasard et une signature (HMAC,
avec `SECRET`). Un lien de désinscription ne peut pas servir à confirmer, et inversement.

## Protections

- Champ piège invisible (`site`) et délai minimum de 3 secondes : un robot reçoit la même réponse qu'un
  humain, et rien n'est enregistré.
- 5 demandes par heure et par adresse IP ; pour une même adresse e-mail, un lien de confirmation toutes
  les 10 minutes au plus, et 3 par 24 heures ; 60 liens par heure au total (`PLAFOND_CONFIRMATIONS_HEURE`).
- Seuls les sites listés dans `ORIGINES` peuvent appeler le service depuis un navigateur.
- Le journal n'écrit jamais une adresse en entier (`a…@gmail.com`).

## Réglages (`.env`, sur le serveur)

| Variable | Rôle |
|---|---|
| `RESEND_API_KEY` | clé d'API Resend (droit « envoi »). **Vide : rien ne part**, le lien de confirmation est écrit dans le journal, et le site affiche « l'envoi des e-mails n'est pas encore en service » |
| `SECRET` | signe les liens. 64 caractères au hasard. **Ne plus jamais le changer** : tous les liens déjà envoyés, dont les liens de désinscription, cesseraient de marcher. Sans lui, le service refuse de démarrer |
| `EXPEDITEUR` | par défaut `Les Voix de l'IA <voixdelia@lettres.3h33.com>` |
| `REPONDRE_A` | par défaut `voixdelia@3h33.fr` (les réponses aux lettres y arrivent) |
| `ADRESSE_PUBLIQUE` | `https://3h33.com` : sert à écrire les liens des e-mails |
| `ORIGINES` | sites autorisés à appeler le service, séparés par des virgules |

## Mise en route sur le VPS vitrine

Le domaine `lettres.3h33.com` doit être **« Verified » chez Resend** avant tout envoi : sinon Resend refuse
les e-mails et le journal affiche `confirmation NON envoyée … Resend 403`.

```bash
# 1. Copier le service depuis le dépôt (sans toucher au site en service)
mkdir -p /opt/3h33-abonnements
git -C /opt/3h33-site fetch origin abonnements          # plus tard, après fusion : origin main
git -C /opt/3h33-site archive FETCH_HEAD services/abonnements | tar -x -C /opt/3h33-abonnements --strip-components=2
cd /opt/3h33-abonnements

# 2. Le .env : le secret est tiré au hasard, la clé Resend se tape sans s'afficher (bash)
grep -v -E '^(RESEND_API_KEY|SECRET)=' .env.exemple > .env
chmod 600 .env
printf 'SECRET=%s\n' "$(openssl rand -hex 32)" >> .env
read -rs -p "Clé Resend (rien ne s'affiche) : " CLE; echo
printf 'RESEND_API_KEY=%s\n' "$CLE" >> .env; unset CLE
grep -cE '^(SECRET|RESEND_API_KEY)=.+' .env             # doit afficher 2

# 3. Démarrer, puis vérifier
docker compose up -d --build
docker compose ps                                       # « healthy » au bout de 30 s environ
docker compose logs --tail 5                            # « envoi configuré (Resend) … »
curl -s https://3h33.com/api/abonnement/sante           # {"ok":true,"envoiConfigure":true}
```

Mettre à jour le code plus tard : refaire l'étape 1 (le `.env` n'est pas touché), puis
`docker compose up -d --build`. Pendant ~30 s, le temps du contrôle de santé, Traefik ne lui envoie rien :
les inscriptions répondent 404.

## Envoyer une lettre

Toujours depuis `/opt/3h33-abonnements`. **Par défaut, rien ne part** (« à blanc ») : la commande dit
quel épisode, combien d'e-mails partiraient, et montre la version texte de la lettre.

```bash
docker compose exec abonnements node envoyer-lettre.js                       # à blanc, épisode le plus récent
docker compose exec abonnements node envoyer-lettre.js --episodes            # les épisodes du flux, et ceux déjà annoncés
docker compose exec abonnements node envoyer-lettre.js --episode bret-taylor # à blanc, un épisode précis
docker compose exec abonnements node envoyer-lettre.js --episode bret-taylor --essai voixdelia@3h33.fr
docker compose exec abonnements node envoyer-lettre.js --episode bret-taylor --envoyer
```

- La lettre est composée à partir du **flux RSS public** : titre, accroche, durée, image de partage de la
  page, bouton « Écouter le portrait », mention « Voix générées par intelligence artificielle ». Le portrait
  doit donc être **en ligne** (page et flux) avant la lettre.
- `--essai <adresse>` envoie la lettre à cette seule adresse, objet préfixé « [Essai] » ; ça ne compte pas.
- **Une lettre ne part jamais deux fois** : la trace est dans `envois.json`. Si un envoi est interrompu
  (coupure, refus de Resend), relancer la même commande reprend là où il s'était arrêté, sans rien renvoyer
  à ceux qui l'ont déjà reçue.
- Envoi par lots de 100 (API d'envoi groupé de Resend), une pause entre les lots.
- Un aperçu HTML de la lettre est écrit dans le volume (`/donnees/apercu-lettre.html`) ; pour le regarder :
  `docker compose cp abonnements:/donnees/apercu-lettre.html /tmp/` puis le rapatrier sur le Mac.

## Gérer les abonnés

```bash
docker compose exec abonnements node abonnes.js                         # combien de confirmés, en attente, désinscrits
docker compose exec abonnements node abonnes.js chercher <adresse>      # où en est cette adresse
docker compose exec abonnements node abonnes.js desinscrire <adresse>   # demande reçue par e-mail
docker compose exec abonnements node abonnes.js effacer <adresse>       # droit à l'effacement : la fiche disparaît
```

La commande n'affiche jamais la liste des adresses. Sauvegarde du fichier des abonnés :
`docker compose cp abonnements:/donnees/abonnes.json ./abonnes-$(date +%F).json` (puis `chmod 600`).

## Essais en local (sur le Mac)

```bash
cd services/abonnements
SECRET=$(openssl rand -hex 32) DOSSIER_DONNEES=/tmp/abo PORT=3030 ADRESSE_PUBLIQUE=http://127.0.0.1:3030 node serveur.js
# autre terminal :
curl -s -X POST http://127.0.0.1:3030/api/abonnement -H 'Content-Type: application/json' \
  -d '{"email":"essai@example.com","liste":"voix-de-lia","ecoule":5000}'
# le lien de confirmation est dans le journal du serveur (pas de clé Resend = rien ne part)
DOSSIER_DONNEES=/tmp/abo SECRET=<le même> node envoyer-lettre.js         # à blanc, sur le vrai flux
```

`RESEND_URL` permet de viser un faux serveur Resend local pour tester l'envoi réel sans rien envoyer.
Ne jamais le mettre dans le `.env` du VPS.

## Fichiers

| Fichier | Rôle |
|---|---|
| `serveur.js` | le service : inscription, confirmation, désinscription, pages |
| `envoyer-lettre.js` | la lettre « nouveau portrait » (à blanc, essai, envoi, reprise) |
| `abonnes.js` | bilan et gestion d'une adresse |
| `commun.js` | réglages, fichiers de données (écriture atomique), liens signés, appel à Resend, cadre des e-mails |
| `Dockerfile`, `docker-compose.yml` | le conteneur (utilisateur `node`, pas root) et ses routes Traefik |

Sites qui utilisent ce service : la page des Voix de l'IA (encart construit par
`podcast-engine/site/gabarits.mjs`, envoi dans `site.js`), sur 3h33.com et nouveau.3h33.com.
