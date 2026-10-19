# /bebe-punk/ — la page du film « Le monstre et le bébé punk » (19/10/2026)

Page vitrine du court-métrage IA d'Alexandre Stopnicki pour le concours The Loophole Project
(https://www.theloopholeproject.ai/). Adresse prévue : https://3h33.com/bebe-punk/.
**Pas encore en ligne** : elle vit sur la branche `bebe-punk`, rien n'est fusionné dans `main`.

## Ce qu'il y a dans la page

- Ouverture : boucle muette tirée du film, titre en lettres découpées, tampon « BOOM! » (joue le vrai cri du
  bébé, `medias/boom.m4a`, extrait de la V3 à 6,7 s).
- 3D (Three.js 0.160.0, chargé depuis cdn.jsdelivr.net **après** le reste de la page, seulement si WebGL existe) :
  des biberons-grenades tombent et sont aspirés par un trou noir en tourbillon ; un clic dessus les fait exploser
  (feu + lait). Sans WebGL : un repli en CSS. La scène ne tourne que si l'ouverture ou le trou final sont à l'écran.
- 01 Le film : la V3 (version déposée), bascule riff punk / son natif, chapitres cliquables.
- 02 Le concours : les 4 temps Fall / Threat / Run / Jump (boucles muettes de 3 s), les règles.
- 03 Les versions : V3 et V2 (conformes), **« Choisis ta fin »** (un lecteur, 4 fins + 5 boucles ; un clic
  démarre la vidéo à 14,5 s, juste avant le plongeon), les essais en 20 s (poursuite accélérée, jugée moins bonne
  par Alexandre), les V1.
- 04 La fabrique : l'histoire du film, centrée sur les idées et les choix d'Alexandre.
- 05 La pellicule : 15 planches-contact, agrandies au clic (`<dialog>`).
- 06 JUMP : le trou final, bouton « REPEAT » qui remonte en haut.
- Effets : grain, rayures, brouillard, éclaboussures au clic, gouttes de lait qui tombent, curseur biberon
  (ordinateur seulement). **Tout s'arrête avec « réduire les animations »** (`prefers-reduced-motion`).
- Aucun traceur, aucun cookie, pas d'Umami sur cette page. Polices servies depuis `site/bebe-punk/polices/`.

Fichiers : `site/bebe-punk/index.html`, `bebe-punk.css`, `bebe-punk.js`, `scene3d.js`, `polices/`, `medias/`
(23 MP4 en 720p, affiches, planches-contact dans `medias/planches/`). Environ 86 Mo de médias.
La page est autonome : `build.py` ne la fabrique pas et ne l'efface pas. Elle n'est **pas** dans
`sitemap.xml`, `llms.txt` ni dans le menu du site (à décider).

## La mettre à jour

- Textes : directement dans `index.html`. Après une retouche de `bebe-punk.css` ou `bebe-punk.js`, monter
  le `?v=` dans `index.html` (nginx garde CSS et JS 7 jours). Pour `scene3d.js`, monter le `?v=` dans
  `bebe-punk.js` (ligne `import('./scene3d.js?v=…')`).
- Une vidéo refaite prend **un nouveau nom** (nginx et les navigateurs gardent les MP4 30 jours).
- Encoder une vidéo pour le web (depuis le master 1080p) :
  `ffmpeg -i source.mp4 -vf "scale=1280:720:flags=lanczos,format=yuv420p" -c:v libx264 -crf 26 -preset slow -movflags +faststart -c:a aac -b:a 128k -ac 2 medias/nom.mp4`
  puis une affiche : `ffmpeg -ss <s> -i source.mp4 -frames:v 1 -vf scale=960:-2 -q:v 5 medias/affiche-nom.jpg`.
- Ajouter une fin au lecteur « Choisis ta fin » : copier un `<li><button class="fin" …>` dans `index.html`
  (attributs `data-src`, `data-poster`, `data-titre`, `data-texte`, un symbole dans `.fin-symbole`).
- Masters 1080p et originaux : Google Drive d'Alexandre, dossier « Loophole — Le monstre et le bébé punk ».
  Journal de fabrication : dépôt `team872/videos-nodales`, `scenarios/loophole-monstre-bebe/`.

## La voir en local

`python3 -m http.server` suffit pour la page, **mais il ne sait pas avancer dans une vidéo** (pas de requêtes
« Range ») : « Choisis ta fin » et les chapitres repartent alors de 0. nginx, lui, le fait. Pour tout tester,
un petit serveur compatible est dans le dossier de travail du Mac (`~/Developer/bebe-punk-travail/serveur_plages.py`) :

    python3 -I ~/Developer/bebe-punk-travail/serveur_plages.py 4341 ~/Developer/3h33-site-bebe-punk/site
    # puis http://127.0.0.1:4341/bebe-punk/

## La publier (décision d'Alexandre)

Le site 3h33.com n'a **aucun déploiement automatique** (vérifié le 19/10 : pas de workflow GitHub, pas de
webhook, pas de `git pull` en tâche planifiée sur le VPS ; le VPS est sur `main`). Publier = :

1. Fusionner la branche `bebe-punk` dans `main` (PR sur GitHub).
2. Sur le VPS : `ssh -F ~/.hostinger/ssh_config srv1472723 'cd /opt/3h33-site && git pull -q && git log --oneline -1'`
3. Vérifier : `curl -sI https://3h33.com/bebe-punk/` (200) et une vidéo :
   `curl -sI https://3h33.com/bebe-punk/medias/v3-musique.mp4` (200, `Accept-Ranges: bytes`).
4. Si on veut qu'elle soit trouvée : l'ajouter à `sitemap.xml` (via `build.py`), au studio ou à l'accueil.

Les MP4 sont dans Git sur cette branche (86 Mo, sous le seuil de 100 Mo). Si on préfère garder le dépôt léger
comme pour `site/pour/*.mp4`, les sortir de Git avant la fusion (`.gitignore`) et les copier à part sur le
serveur avec `rsync`.
