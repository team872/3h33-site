# Liens courts de 3h33.com

Mis en place le 21/10/2026. Un lien court est une adresse facile à dire ou à écrire
(`3h33.com/li`) qui renvoie aussitôt vers une page du site **avec ses étiquettes de campagne**
(utm). Dans les statistiques (https://stats.3h33.com, page « UTM »), chaque visite arrivée par
ce lien est rangée sous sa source, sa forme et son opération.

| Lien court | Mène à | Étiquettes | À utiliser pour |
|---|---|---|---|
| https://3h33.com/li | l'accueil | linkedin · profil · profil · alexandre | le profil LinkedIn d'Alexandre (« Site web ») |
| https://3h33.com/michel | portrait de Michel Ruiz | linkedin · post · michel-ruiz · alexandre | quand Alexandre partage le portrait sur LinkedIn |
| https://3h33.com/podcast | le podcast Les Voix de l'IA | lien-court · adresse · voix-de-lia | à dire ou écrire partout (signature, diapositive) |
| https://3h33.com/qr | l'accueil | qr · imprime · carte | un QR code imprimé (carte, affiche, fin de diaporama) |
| https://3h33.com/vibecoding | page « Mon nouveau métier : le vibe coding » | lien-court · vibecoding | (fait le 17/10 par `podcast-engine/outils/page-vibe-coding.mjs`) |

Michel Ruiz partage, lui, son propre lien long (étiqueté `utm_content=michel-ruiz`) : on sait
ainsi qui, d'Alexandre ou de Michel, a amené chaque visiteur.

## Comment c'est fait

- `liens-courts.json` : la liste (code, destination, étiquettes, usage).
- `node liens-courts.mjs` écrit `site/<code>/index.html`, une petite page qui renvoie vers la
  destination. Elle recopie le titre, le texte et l'image de la destination : l'aperçu sur
  LinkedIn ou WhatsApp est celui de la vraie page.
- Le script refuse un code déjà pris (page du site, `redirections.conf`, `nginx.conf`).
- Pourquoi des pages et pas des redirections du serveur (nginx) : la mise en ligne habituelle
  (le serveur fait un `git pull`) suffit, sans redémarrer quoi que ce soit.
- Mise en ligne : `zsh ~/Developer/podcast-engine/site/kits-en-ligne.sh` (geste d'Alexandre).

## Ajouter un lien court

1. Ajouter une entrée dans `liens-courts.json` (code en minuscules, sans accent).
2. `node liens-courts.mjs`, commit, mise en ligne.
3. L'ajouter à cette table et à la « Fabrique de liens » (artefact privé, voir
   `galaxie-admin/docs/audience/`).

Étiquettes (convention du 21/10/2026) : `utm_source` = où (linkedin, whatsapp, email, qr,
histoire-ai, lien-court) ; `utm_medium` = forme (post, commentaire, profil, message, page-3h33,
article, adresse, imprime) ; `utm_campaign` = l'opération (michel-ruiz, vibe-coding, voix-de-lia…) ;
`utm_content` = qui partage ou quelle version. Minuscules, sans accents, tirets.
