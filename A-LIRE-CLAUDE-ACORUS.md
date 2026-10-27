# Pour Claude : ouvrir le deck Acorus sur 3h33.com

Préparé le 27/10/2026 à 18 h (heure de Paris) par AI ENGINE SLIDE, l'assistant d'Alexandre. **Rien n'a été déployé** : cette branche attend ta relecture.

## Contexte

- Le deck Acorus (masterclass IA du **mercredi 28/10/2026**) a été poussé dans `team872/masterclass-3h33` (commit `05bb1dc`).
- Le workflow `publier.yml` (run `40544861444`) a bien envoyé tous les fichiers par FTP. Il a échoué uniquement à la vérification finale, parce que https://3h33.com/acorus/ renvoie **404**. Le job `vignettes` n'a donc pas tourné.
- Ce qui marche déjà en ligne : `https://3h33.com/medias/x-madame-qualite.mp4` (200), `https://3h33.com/salle/slides/acorus/` (200) et `relais/ia.php` (prêt).

## Cause

Depuis le 03/10, 3h33.com passe par le nginx du VPS (`/opt/3h33-site`), qui ne sert que les dossiers listés dans `nginx.conf`. `acorus` n'y figure pas. Herport et AFNOR avaient eu le même problème.

## Le changement (commit `362f0fa` sur cette branche)

Une seule ligne dans `nginx.conf` (ligne 63), où `acorus` est ajouté à la liste des dossiers :

```
…|lenotre|herport|afnor|acorus|salle|…
```

## Déploiement proposé (procédure du README, coupure d'environ 40 s)

1. Relever l'état de référence : le code HTTP de `/`, de chaque deck (`ia-talent`, `cockpit-ia`, `ia-cabinet-dentaire`, `exemple-audencia`, `pays-de-fontainebleau`, `lenotre`, `herport`, `afnor`), de `/atelier/`, `/salle/`, `/relais/ia.php`, `/s/`, `/demo-vibe-coding/` et `/medias/`.
2. Fusionner cette branche dans `main`, puis lancer `git pull` sur le VPS dans `/opt/3h33-site`.
3. Lancer `nginx -t` dans un conteneur jetable. S'il échoue, tout remettre comme avant et ne rien recréer.
4. Lancer `docker compose up -d --force-recreate web`.
5. Revérifier toutes les adresses de référence ainsi que `/acorus/`. Si l'une d'elles ne répond plus, revenir au commit `c48703d` et recréer le conteneur.
6. Dans `masterclass-3h33`, lancer `gh run rerun 40544861444 --failed` pour que la vérification passe et que les vignettes soient capturées.

## À noter

- Des délais d'attente dépassés apparaissent par intermittence sur `https://3h33.com/` (des 000 sur curl, puis 200 au nouvel essai), **avant** tout changement. C'est peut-être à regarder séparément.
- Ne pas supprimer le fichier `A-LIRE-CLAUDE-ACORUS.md` de `main` ; on peut simplement le supprimer de la branche avant la fusion si tu préfères.
