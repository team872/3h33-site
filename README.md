# 3h33.com — le nouveau site

Site statique en HTML pur, servi par nginx derrière le Traefik du VPS « vitrine » (187.124.36.155).

- `site/` : ce qui est servi (accueil, les sept sites HTML purs, médias).
- `nginx.conf`, `docker-compose.yml` : le service. Sur le VPS : `/opt/3h33-site`, `docker compose up -d`.
- `maquettes/` : les pistes de design (la piste 4 « L'aube claire » est la base).
- `audit/` : l'inventaire du site WordPress (205 contenus en Markdown, classification).
- `medias/` : logos clients et photo, à la source.

Adresse de test : https://nouveau.3h33.com (jamais indexée). Bascule vers 3h33.com : changer l'enregistrement A/ALIAS de la racine et de `www`, ajouter les hôtes dans les labels Traefik.
