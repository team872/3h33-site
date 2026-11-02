# Pour Claude : ouvrir le deck Droit d'Enfance sur 3h33.com

Préparé le 02/11/2026 (heure de Paris) par AI ENGINE SLIDE, l'assistant d'Alexandre. **Rien n'a été déployé, rien n'a été poussé** : cette branche attend la validation d'Alexandre, puis ta relecture.

## Contexte

- Le deck Droit d'Enfance est la masterclass IA du **lundi 02/11/2026 à 9 h 30** (Fondation Droit d'Enfance). 35 slides, 30 dans la version à emporter.
- Il se trouve dans `team872/masterclass-3h33` : `publics/droit-denfance.json`, `catalogue/parties/droit-denfance.js`, entrée `droit-denfance` dans `publier.json`. **Il n'est pas encore poussé** : Alexandre doit le valider d'abord.
- Une fois poussé, le workflow `publier.yml` enverra les fichiers par FTP, puis échouera à la vérification finale, comme pour Acorus : https://3h33.com/droit-denfance/ renverra **404**.

## Cause

3h33.com passe par le nginx du VPS (`/opt/3h33-site`), qui ne sert que les dossiers listés dans `nginx.conf` (ligne 63). `droit-denfance` n'y figure pas. Le contrôle `controle.sh droit-denfance` le confirme (étape 5.2 de la skill `slides-marque`).

## Le changement (un seul commit sur cette branche)

Une seule ligne dans `nginx.conf` (ligne 63) : `droit-denfance` est ajouté à la liste des dossiers.

```
…|herport|afnor|acorus|droit-denfance|salle|…
```

## Déploiement proposé (procédure du README, coupure d'environ 40 s)

À faire **seulement après** l'accord d'Alexandre, et si possible **avant 9 h 30** :

1. Relever l'état de référence : code HTTP de `/`, de chaque deck (`ia-talent`, `cockpit-ia`, `ia-cabinet-dentaire`, `exemple-audencia`, `pays-de-fontainebleau`, `lenotre`, `herport`, `afnor`, `acorus`), de `/atelier/`, `/salle/`, `/relais/ia.php`, `/s/`, `/demo-vibe-coding/` et `/medias/`.
2. Fusionner cette branche dans `main`, puis `git pull` sur le VPS dans `/opt/3h33-site`.
3. `nginx -t` dans un conteneur jetable. S'il échoue, tout remettre comme avant.
4. `docker compose up -d --force-recreate web`.
5. Revérifier toutes les adresses de référence ainsi que `/droit-denfance/`. Si l'une ne répond plus, revenir au commit précédent et recréer le conteneur.
6. Dans `masterclass-3h33`, relancer le job échoué du workflow (`gh run rerun <id> --failed`) pour que la vérification passe et que les vignettes soient capturées.

## À noter

- Le deck est en accès par jeton pour la version à emporter (`acces: jeton`). La salle vivante (`/salle/`, `relais/ia.php`) doit répondre le matin même : à vérifier avant 9 h 30.
- Des 000 intermittents sur `https://3h33.com/` ont déjà été vus (voir la note Acorus). Mon poste n'a pas pu joindre 3h33.com pendant les contrôles de la nuit : à regarder.
- Ne pas supprimer ce fichier de `main` ; on peut le retirer de la branche avant la fusion.
