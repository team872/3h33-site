# 3h33.com — le nouveau site

Site statique en HTML pur, servi par nginx derrière le Traefik du VPS « vitrine » (187.124.36.155).

- `site/` : ce qui est servi (accueil, les sept sites HTML purs, médias).
- `nginx.conf`, `docker-compose.yml` : le service. Sur le VPS : `/opt/3h33-site`, `docker compose up -d`.
  Après une modification de `nginx.conf` : sur le VPS, `git pull`, tester la configuration dans un conteneur jetable (`docker run --rm -v /opt/3h33-site/nginx.conf:/etc/nginx/conf.d/default.conf:ro -v /opt/3h33-site/redirections.conf:/etc/nginx/redirections.conf:ro nginx:1.27-alpine nginx -t`), puis `docker compose up -d --force-recreate web`. ⚠ 3h33.com répond alors 404 pendant environ 30 à 40 secondes : Traefik attend le premier contrôle de santé (toutes les 30 s). Le faire à une heure creuse (mesuré le 25/10/2026).
- `maquettes/` : les pistes de design (la piste 4 « L'aube claire » est la base).
- `audit/` : l'inventaire du site WordPress (205 contenus en Markdown, classification).
- `medias/` : logos clients et photo, à la source.

**En service sur 3h33.com depuis le 03/10/2026.** Adresse de test : https://nouveau.3h33.com (jamais indexée). L'ancien WordPress reste consultable sur https://old.3h33.com (jamais indexé, voir `nginx.conf`). Bascule vers 3h33.com : changer l'enregistrement A/ALIAS de la racine et de `www`, ajouter les hôtes dans les labels Traefik.

**Ce qui reste sur l'ancien hébergement mutualisé, servi par procuration** (voir `nginx.conf`) : les decks de masterclass (liste dans `masterclass-3h33/publier.json`), leur relais PHP, `/img/`, `/galaxie/` (dépôt `3h33-galaxie`) et les médias WordPress. Un deck ajouté à `publier.json` doit l'être aussi à la liste de `nginx.conf`, sinon il répond 404 sur 3h33.com.

Bascule, dans cet ordre : (1) DNS chez Hostinger — `@` en A vers 187.124.36.155 à la place de l'ALIAS CDN, `www` en CNAME vers `3h33.com` ; ne toucher à rien d'autre (MX, DKIM, `ia-magique`, `projet`, `veille`, `stats`, `nouveau`). (2) Une fois le DNS propagé (TTL 300 s), décommenter les routeurs `h3h33-prod` et `h3h33-www` ici, et `h3h33contact-prod` dans `/opt/3h33-contact/docker-compose.yml`, puis `docker compose up -d` dans les deux dossiers : Traefik obtient les certificats par défi HTTP, il lui faut donc le DNS d'abord.
