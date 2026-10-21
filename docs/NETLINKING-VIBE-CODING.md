# Liens vers la page vibe coding : le bilan (21/10/2026)

**But** : aider [3h33.com/vibe-coding/](https://3h33.com/vibe-coding/), ta meilleure page d'atterrissage,
à monter dans Google grâce à des liens venus de tes autres sites. Chaque lien est placé là où un
visiteur le trouverait normal. **Rien n'est en ligne** : tout attend ton accord, site par site.

## En deux mots : les règles suivies

- **Des textes de lien variés.** Google se méfie quand cent pages pointent vers la même adresse avec
  exactement les mêmes mots (« vibe coding », « vibe coding », « vibe coding »…) : ça ressemble à une
  fabrication. Ici, chaque site dit la chose à sa façon : le nom de la marque, une phrase, une signature.
- **Un lien en pied de page sur tout un site, c'est permis s'il est vrai.** « Fabriqué par 3h33 » sur un
  site que 3h33 a réellement fabriqué, c'est une signature d'artisan, pas une astuce.
- **Le meilleur lien est dans le texte.** Un lien au milieu d'un article qui parle du sujet (comme sur
  ia-magique.com) compte plus qu'un lien en bas de page.
- **Aucun texte caché**, aucun lien invisible, aucune page créée juste pour faire des liens.

## Site par site

Chaque site a sa propre branche `claude/lien-vibe-coding` (dans son dépôt), enregistrée sur ce Mac,
**pas encore envoyée sur GitHub**. Les copies de travail sont dans `~/Developer/netlinking/<dépôt>`.

| Site | Où est le lien | Texte du lien | Vers | Aperçu |
|---|---|---|---|---|
| [alexandrestopnicki.com](https://alexandrestopnicki.com) | Accueil, partie « Mes outils IA, conçus en vibe coding », sous le bouton | « Vous avez un projet ? Avec mon agence, je le construis avec vous : **le vibe coding chez 3h33** » | /vibe-coding/ | ✅ vu en local |
| alexandrestopnicki.com/vibe-coding/ | Dernier encadré « Et chez vous, ça donnerait quoi ? », 2ᵉ bouton | « **Votre outil, construit avec 3h33** » | /vibe-coding/ | ✅ vu en local |
| [ia-magique.com](https://ia-magique.com/blog/vibecoding-2026.html) | Article « Vibecoding 2026 », partie 6 « Mon expérience perso » | « Six de ces projets, de chapitre.ai aux Voix de l'IA, sont présentés sur la page **Vibe coding : construire des outils en dialoguant avec l'IA** » | /vibe-coding/ | ✅ vu en local |
| ia-magique.com (même article) | Conclusion « En résumé » | « Et si c'est vous qui avez l'idée d'un outil : **vous avez l'idée, je la fabrique avec l'IA** » | [/pour/alexandre-vibe-coding/](https://3h33.com/pour/alexandre-vibe-coding/) | ✅ vu en local |
| ia-magique.com (tout le site) | Pied de page, colonne « Ressources », sous « Galaxie 3H33 » | « **Vibe coding avec 3h33** » | /vibe-coding/ | ✅ vu en local |
| [le-savez-vous.com](https://le-savez-vous.com) | Pied de page de l'application, après « ☕ Soutenir » | « **Fabriqué en vibe coding par 3h33** » | /vibe-coding/ | ✅ simulé sur le vrai site (voir plus bas) |
| le-savez-vous.com/histoires, /podcast… | Pied des pages publiques fabriquées par le serveur | « **Un site construit avec l'IA par 3h33** » | /vibe-coding/ | code relu, pas affiché |
| [listen-to-my-art.com](https://listen-to-my-art.com) | Pied de page des 10 pages, à la suite de « Une création d'Alexandre Stopnicki » | « …, **fabriquée avec l'IA par 3h33** » | /vibe-coding/ | ✅ vu en local |
| [Les Voix de l'IA](https://3h33.com/podcast-voix-de-lia/) | Pied de page, à côté de « 3h33.com » et « Tous les podcasts de 3h33 » | « **Ce site est fait en vibe coding** » | /vibe-coding/ | ✅ vu en local |
| [chapitre.ai](https://chapitre.ai) | Pied de page, dernière ligne « © chapitre.ai · Vos données restent privées par défaut. » | « · **Conçu en vibe coding par 3h33** » | /vibe-coding/ | ⚠️ pas d'aperçu (voir plus bas) |
| [botmoileqi.com](https://botmoileqi.com/sur-mesure/) | Page « Outils sur mesure », étape 2 « Construire vite » | « Grâce au **vibe coding, la façon de construire de 3h33**, une première version utilisable est prête en quelques jours. » | /vibe-coding/ | ✅ vu en local |
| [lma.botmoileqi.com](https://lma.botmoileqi.com) | Pied de page | « …conçu par 3h33, **en dialoguant avec l'IA**. » | /vibe-coding/ | ✅ vu en local |
| [slide.botmoileqi.com](https://slide.botmoileqi.com) | Pied de page, après « © 3H33 — l'agence de l'IA » | « · **outil construit en vibe coding** » | /vibe-coding/ | ✅ vu en local |

Choix faits :

- **alexandrestopnicki.com a déjà sa propre page vibe coding.** Je ne l'ai pas remplacée : les deux pages
  ne disent pas la même chose (la tienne raconte ton atelier, celle de 3h33 propose de construire le projet
  du visiteur). Le lien dit justement ça : « votre outil, construit avec 3h33 ».
- **La page qui te présente** (/pour/alexandre-vibe-coding/) n'est liée qu'une fois, depuis la conclusion de
  l'article d'ia-magique.com, avec son propre titre (« Vous avez l'idée, je la fabrique avec l'IA »). Depuis
  ton site perso, un lien vers une page qui te présente aurait tourné en rond.
- **Le savez-vous ?** dit déjà « édité par 3h33 SARL » ; j'ai ajouté le lien à côté sans toucher à cette mention.
- **Listen to my art** : la page « Chefs-d'œuvre » est faite à la main avec un pied différent ; elle n'a pas
  été modifiée (les 10 autres pages, oui).

### Les deux sites sans aperçu local

- **Le savez-vous ?** et **chapitre.ai** sont des applications à construire (React et Next.js), longues à
  installer pour une ligne de pied de page. Pour Le savez-vous, j'ai **ajouté la ligne pour de faux, dans
  le navigateur, sur le vrai site** (rien n'a été envoyé : la page reprend son état en la rechargeant) pour
  voir le rendu : elle se range à la suite des autres liens du pied, même style.
- Pour **chapitre.ai**, cet essai a été refusé par le garde-fou de sécurité de l'outil ; voici donc la
  modification exacte (fichier `components/footer.tsx`) :

  ```
  © 2026 chapitre.ai · Vos données restent privées par défaut. · Conçu en vibe coding par 3h33
  ```

  même taille et même couleur que le reste de la ligne, en bordeaux au survol, comme les autres liens.

## Ce qu'il reste à faire, par toi : la mise en ligne

Ordre pour chaque site : **1)** tu me dis « oui » → j'envoie la branche sur GitHub et j'ouvre la demande
de fusion (PR) ; **2)** tu fusionnes et tu mets en ligne avec la commande ci-dessous.

| Site | Mettre en ligne |
|---|---|
| alexandrestopnicki.com | Fusionner la PR : le serveur se met à jour seul toutes les 5 minutes. |
| ia-magique.com | Fusionner la PR : GitHub envoie le site chez Hostinger tout seul (≈ 30 s). |
| chapitre.ai | Fusionner la PR : GitHub reconstruit et redéploie l'application tout seul. |
| le-savez-vous.com | Fusionner la PR, puis `ssh -F ~/.hostinger/ssh_config botmoileqi 'cd /opt/botmoileqi && git pull && cd deploy && docker compose -f docker-compose.prod.yml up -d --build backend frontend'` |
| botmoileqi.com | Fusionner la PR, puis `ssh -F ~/.hostinger/ssh_config botmoileqi 'cd /opt/botmoileqi-site && git pull'` |
| lma.botmoileqi.com | Fusionner la PR, puis `ssh -F ~/.hostinger/ssh_config srv1472723 'cd /opt/atelier-lms && git pull --ff-only'` (la vitrine est lue directement dans le dossier : pas besoin de reconstruire l'application). ⚠️ Je n'ai pas pu regarder l'état du serveur : si `git pull` refuse, utiliser la procédure de `deploy/DEPLOYER.md` § 5. |
| slide.botmoileqi.com | Fusionner la PR, puis `scp -F ~/.hostinger/ssh_config ~/Developer/netlinking/botmoileqi-slide/index.html srv1472723:/opt/slide-vitrine/site/index.html` (seul ce fichier change). |
| listen-to-my-art.com | Fusionner la PR, puis la procédure habituelle (`CLAUDE.md` § 3 du dépôt : archive `site.zip` ≈ 200 Mo envoyée chez Hostinger, **pas depuis le réseau de l'école**). |
| Les Voix de l'IA | Fusionner la PR, puis depuis le clone propre : `cd ~/Developer/podcast-engine-main && git pull && zsh site/mettre-en-ligne.sh`. ⚠️ Ce script se place sur `main` dans `~/Developer/3h33-site` et y fait un `git pull` : attendre que la session « VIBE CODING » ait enregistré ses modifications là-bas. ⚠️ Ne pas le lancer depuis `~/Developer/podcast-engine` : ce clone est sur une autre branche (`version-anglaise`) avec du travail en cours. |

## ⚠️ À part : Subsidium et Sator (rien touché)

Ce sont des plateformes de clients. Je n'y ai rien modifié. Ce que je proposerais, **seulement si tu es
d'accord et si le client l'accepte** :

- **Subsidium** ([www.subsidium.world](https://www.subsidium.world)), cité en exemple sur /vibe-coding/ :
  une ligne discrète en pied de page, « Plateforme conçue avec 3h33 », vers /vibe-coding/. C'est un usage
  courant entre une agence et son client, mais c'est au client de dire oui.
- **Sator** ([app.sator.fr](https://app.sator.fr)) : une application réservée aux comptes connectés, donc un
  lien y servirait peu au référencement (Google n'y entre pas). Je ne proposerais rien, sauf une ligne
  « Conçu avec 3h33 » sur une éventuelle page publique de Sator, avec l'accord du client.

## Pour plus tard (pas fait)

D'autres sites de la galaxie pourraient porter la même signature, avec chacun son texte :
[histoires.alexandre.ai](https://histoires.alexandre.ai), [choucroute-citron.com](https://choucroute-citron.com),
[negovox.com](https://negovox.com), [ia-conforme.com](https://ia-conforme.com),
[mon-ia-privee.com](https://mon-ia-privee.com), [listen-engine.com](https://listen-engine.com),
[alexandre.ai](https://alexandre.ai). À faire par petits lots, pas tous le même jour.

---
Rédigé par Claude (session netlinking) le 21/10/2026.
