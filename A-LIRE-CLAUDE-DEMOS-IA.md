# Pour Claude : ouvrir la page https://3h33.com/demos-ia/

Préparé le 27/10/2026 vers 20 h 45 (heure de Paris) par l'assistant d'Alexandre. **Rien n'a été déployé, rien n'est fusionné** : cette branche attend ta relecture. Même modèle que `claude/ouvrir-deck-acorus` (commit `4963bd5`).

## Contexte

- Alexandre veut une page à part, hors des slides, pour faire des démonstrations directes : https://3h33.com/demos-ia/. Elle montre quatre cartes cliquables (le site du film « bébé punk », Madame Qualité sur wowbut.com, le jeu 3D de pâtisserie, le simulateur de devis), avec l'en-tête et le pied de page de 3h33.com.
- Elle est **volontairement non indexée** : `<meta name="robots" content="noindex, nofollow, noarchive">` dans la page, et l'en-tête `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` posé par un `.htaccess` dans le dossier. Elle n'est dans aucun sitemap, aucun menu, aucune page du site.
- La source vit dans `team872/masterclass-3h33`, dossier `pages/demos-ia/` (commit `1102933`, poussé sur `main`). Le workflow « Publier sur 3h33.com » l'envoie par FTP vers `public_html/demos-ia/` (une nouvelle section « pages autonomes » dans `moteur/publier.js`). Aucun deck n'est touché.

## Cause du 404 attendu

Depuis le 03/10, 3h33.com passe par le nginx du VPS (`/opt/3h33-site`), qui ne sert que les dossiers listés dans `nginx.conf`. `demos-ia` n'y figure pas : tant que ce n'est pas ajouté, https://3h33.com/demos-ia/ répond **404**, alors que les fichiers sont bien sur l'hébergeur.

## Le changement (commit sur cette branche)

Une seule ligne dans `nginx.conf` (ligne 63), `demos-ia` ajouté à la liste des dossiers, juste après `acorus` :

```diff
-    location ~ ^/(atelier|cockpit-ia|ia-talent|ia-cabinet-dentaire|exemple-audencia|pays-de-fontainebleau|lenotre|herport|afnor|acorus|salle|relais|img|galaxie|s|demo-vibe-coding)(/|$) {
+    location ~ ^/(atelier|cockpit-ia|ia-talent|ia-cabinet-dentaire|exemple-audencia|pays-de-fontainebleau|lenotre|herport|afnor|acorus|demos-ia|salle|relais|img|galaxie|s|demo-vibe-coding)(/|$) {
```

Les images de la page (`demo-*.jpg`, dans le même dossier) passent par ce même bloc `location`, comme celles des decks : rien d'autre à ouvrir.

**X-Robots-Tag : pas de changement nginx nécessaire.** Le serveur mutualisé le pose lui-même (`.htaccess` du dossier) et nginx le laisse passer, comme pour `/acorus/` et `/lenotre/configurateur/`, qui répondent déjà avec cet en-tête. Si tu préfères une ceinture et des bretelles, ajouter `add_header X-Robots-Tag "noindex, nofollow" always;` dans un bloc dédié `location ^~ /demos-ia/` — mais ce n'est pas demandé, et ça doublerait l'en-tête.

## Déploiement proposé (procédure du README, coupure d'environ 40 s)

1. Relever l'état de référence : le code HTTP de `/`, de chaque deck (`ia-talent`, `cockpit-ia`, `ia-cabinet-dentaire`, `exemple-audencia`, `pays-de-fontainebleau`, `lenotre`, `herport`, `afnor`, `acorus`), de `/atelier/`, `/salle/`, `/relais/ia.php`, `/s/`, `/demo-vibe-coding/` et `/medias/`.
2. Fusionner cette branche dans `main` (ou appliquer la ligne ci-dessus depuis `main`, comme pour Acorus), puis `git pull` sur le VPS dans `/opt/3h33-site`.
3. Lancer `nginx -t` dans un conteneur jetable. S'il échoue, tout remettre comme avant et ne rien recréer.
4. Lancer `docker compose up -d --force-recreate web` (coupure d'environ 40 s).
5. Revérifier toutes les adresses de référence.
6. Revenir en arrière si besoin : revenir au commit précédent de `main` et recréer le conteneur.

## Comment tester

```
curl -s -o /dev/null -w '%{http_code}\n' https://3h33.com/demos-ia/        # attendu : 200 (404 avant)
curl -sI https://3h33.com/demos-ia/ | grep -i x-robots-tag                 # attendu : noindex, nofollow, …
curl -s https://3h33.com/demos-ia/ | grep -i 'name="robots"'               # attendu : noindex, nofollow, noarchive
curl -s -o /dev/null -w '%{http_code}\n' https://3h33.com/demos-ia/demo-bebe-punk.jpg   # attendu : 200
```

Puis ouvrir la page : les quatre cartes s'ouvrent dans un nouvel onglet ; le logo et le menu ramènent au site.

## À noter

- Ne l'ajouter ni à `site/sitemap.xml`, ni à `llms.txt`, ni à `plan-du-site`, ni au menu.
- Des délais d'attente dépassés apparaissent par intermittence sur 3h33.com depuis le box (des 000 sur curl, puis 200 au nouvel essai) : déjà signalé dans la note Acorus.
