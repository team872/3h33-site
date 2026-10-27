# Lenteurs de 3h33.com — diagnostic et correctifs (27/10/2026)

> Note pour Claude. Rédigée le 27/10/2026 vers 20 h 30 (heure de Paris), sur la branche `claude/perf-3h33`.
> **Rien n'a été modifié sur le serveur** : mesures depuis l'extérieur, lecture du dépôt, lecture seule des métriques Hostinger.
> Les diffs nginx ci-dessous sont **proposés et non testés** (pas de Docker sur la machine de mesure) : à passer dans `nginx -t` avant tout `--force-recreate` (le redémarrage coûte ~40 s de coupure, à faire à une heure creuse).

## 1. Réponse courte

- **Le serveur n'est pas trop faible. Pas d'upgrade de VPS.** Le VPS « vitrine » est un KVM 4 (4 vCPU, 16 Go de RAM, 200 Go, 16 To de trafic/mois). Sur les 7 derniers jours : **CPU 4,7 à 7,7 % (moyenne 5 %)**, **RAM ~2,5 Go sur 16**, disque 31 Go sur 200, trafic sortant total ~15,7 Go (moyenne ~0,2 Mbit/s, pic ~650 Mo sur 30 min), uptime 10,5 jours sans redémarrage. Le serveur est utilisé à environ 5 %.
- **Ce n'est pas non plus le poids des pages servies.** Le HTML du deck en ligne n'est pas le fichier de 8,6 Mo : c'est une version allégée de 0,92 Mo (**488 Ko** sur le réseau, compressée en brotli), les images étant chargées depuis `/img/`. Les 8,6 Mo sont la copie locale `dist/acorus.html` (images en base64), qui n'est pas ce qui est publié. L'accueil pèse 28 Ko compressé, `/bebe-punk/` 21 Ko, le configurateur 660 Ko.
- **Les « timeouts de 8 s » viennent d'un blocage de poignée de main TLS/connexion intermittent, pas de la lenteur nginx.** Voir les preuves au §2. Cause exacte **non établie** depuis l'extérieur : il faut deux ou trois commandes en lecture seule sur le VPS (§3) pour trancher.
- Beaucoup de petites améliorations nginx/cache/médias sont utiles (§4 à §6), mais **aucune ne guérira à elle seule les échecs de connexion**.

## 2. Mesures et preuves

### 2.1 Depuis la machine de mesure (environ 30 passages espacés, 5 URL + origine directe)

Commande : `curl -4 -w` (dns, connect, tls, ttfb, total, code, version HTTP), `--compressed`, 7 s entre deux passages.

| URL | essais | échecs (code 000, rc=35, **8,01 s pile**) | TLS médian | TTFB médian | total médian (si OK) | octets reçus |
|---|---|---|---|---|---|---|
| `/` (accueil) | 30 | **11 (37 %)** | 0,45 s | 0,65 s | 0,68 s (max 0,89) | 28 Ko (gzip) |
| `/bebe-punk/` | 30 | **12 (40 %)** | 0,44 s | 0,63 s | 0,65 s (max 0,74) | 21 Ko |
| `/acorus/` | 30 | **6 (20 %)** | 0,44 s | 0,66 s | 1,23 s (max 2,08) | 488 Ko (br) |
| `/lenotre/configurateur/` | 30 | **9 (30 %)** | 0,45 s | 0,68 s | 1,34 s (max 1,62) | 661 Ko |
| `/medias/x-madame-qualite.mp4` (2,5 Mo) | 30 | **8 (27 %)** | 0,41 s | 0,62 s | 1,60 s (max 1,89) | 2,48 Mo |
| `/acorus/` **directement sur l'ancien hébergement** (`--resolve 3h33.com:443:147.79.116.46`) | 30 | **8 (27 %)** | 0,43 s | 0,66 s | 1,24 s (max 1,46) | 488 Ko |

Au total : **54 échecs sur 180 requêtes (30 %)**, tous identiques (8,01 s, `rc=35`). Un test à part sur `nouveau.3h33.com` et `old.3h33.com` (même VPS) donne 8/30 et 12/30 échecs.

À retenir :
1. **Quand ça répond, tout est rapide et régulier** : HTTP/2 partout, TLS 1.3, aucune requête > 2,1 s, pas de lenteur progressive. Les 8,01 s sont **toujours exactement 8,01 s** et toujours `rc=35` (échec TLS) : c'est un délai de coupure fixe, pas une lenteur qui s'étire.
2. **Les échecs touchent tout pareil** : l'accueil (servi par nginx local), `bebe-punk` (local), `acorus` et le configurateur (relayés vers l'ancien hébergement), **et l'ancien hébergement joint directement** (147.79.116.46), `nouveau.3h33.com` et `old.3h33.com`. Donc ce n'est **pas** le relais nginx → mutualisé, ni la config nginx des chemins : le point commun est la **connexion vers l'une ou l'autre des deux adresses Hostinger**.
3. **Témoins sans échec sur la même machine, même minute** : wikipedia.org (30/30), hostinger.com (30/30, derrière un CDN), un serveur de test Hetzner (14/14). Donc le réseau de la machine de mesure n'est pas en cause en général.
4. **Depuis l'extérieur** (service public check-host.net, 10 à 20 nœuds dans le monde, requêtes HTTPS réelles) : **151 requêtes sur l'accueil, `/acorus/`, le configurateur et `/bebe-punk/`, 151 réponses 200, 0 échec.** Médiane ≈ 0,5 s. Les lents sont les nœuds asiatiques (1,8 à 4,7 s). **Un seul vrai cas lent : 19,8 s sur l'accueil, depuis un nœud non identifié**, soit environ 0,7 % des essais. Deux lectures indépendantes (outil de lecture web) : OK du premier coup.

**Lecture** : depuis la plupart des endroits, le site répond. Le taux d'échec de ~30 % observé depuis la machine de mesure est en partie un artefact de son chemin réseau (sortie partagée, vers les plages d'adresses Hostinger : possible limitation ou filtrage anti-abus de leur côté sur une adresse très sollicitée). **Mais** le cas à 19,8 s et les deux erreurs SSL du configurateur signalées par Alexandre montrent qu'il existe **un décrochage réel, rare** (de l'ordre de 1 %). Les symptômes « ~8 s puis 200 en 1,4 s » rapportés correspondent exactement à ce que la machine de mesure reproduit : je soupçonne que les mesures initiales venaient du même type de sortie réseau. **À confirmer avec un test depuis le poste ou le téléphone d'Alexandre (4G, hors Wi-Fi du bureau)** : si le site y est instantané en permanence, le problème est surtout du côté de l'outil de mesure.

### 2.2 DNS

- `3h33.com` : **A = 187.124.36.155** (le VPS), TTL 300 s. **Pas d'enregistrement AAAA** → pas d'IPv6 cassée. Pas de CNAME ni de CAA. Serveurs de noms : `ns1/ns2.dns-parking.com` (Hostinger).
- `www.3h33.com` : CNAME → `3h33.com` (redirigé en 301 par Traefik). Pas de AAAA non plus.
- Le VPS a bien une adresse IPv6 (`2a02:4780:7:2a24::1`) mais elle n'est pas publiée : bon réglage tant que Traefik/nginx n'écoutent pas dessus. **Ne pas ajouter de AAAA sans l'avoir testée d'abord.**
- Le pare-feu Hostinger du VPS (« Claude amourtop chapitre », synchronisé) accepte TCP 22, 80, 443 de partout, et rien d'autre : **pas de règle de limitation de débit, pas d'UDP 443 (donc pas de HTTP/3 possible sans ajouter une règle)**.

### 2.3 TLS

- Certificat Let's Encrypt (émis par `YR2`, racine `Root YR` croisée ISRG X1), `CN=3h33.com`, **valide du 03/10/2026 au 01/01/2027**, renouvellement automatique par Traefik (défi HTTP). Surveiller en décembre qu'il se renouvelle bien (il est à 90 jours).
- TLS 1.3, `TLS_AES_128_GCM_SHA256`, HTTP/2 négocié, chaîne complète servie. Rien d'anormal.
- Le certificat est servi par **Traefik**, pas par nginx : c'est lui qui accepte les connexions de la poignée de main. Les échecs `rc=35` sont donc à chercher **côté Traefik / VPS / réseau**, pas dans `nginx.conf`.

### 2.4 En-têtes constatés

| URL | serveur réel | compression | cache-control | remarques |
|---|---|---|---|---|
| `/` | nginx local (via Traefik) | gzip | `no-cache` + ETag faible (304 possibles) | **pas d'en-tête `Vary: Accept-Encoding`** ; pas de brotli |
| `/bebe-punk/medias/f/v2.mp4` (5 Mo) | nginx local | — | **deux `Cache-Control` en double** (`max-age=2592000` + `public, max-age=2592000`) + `Expires` | 206 OK (Range), faststart OK (`moov` en tête) ; **les en-têtes de sécurité du serveur (X-Content-Type-Options, X-Frame-Options, Referrer-Policy) disparaissent** (voir §4.3) |
| `/acorus/` | ancien hébergement (via relais) | **brotli** | `no-cache` (+ ETag) | `x-hcdn-cache-status: DYNAMIC` (CDN Hostinger devant le mutualisé) |
| `/lenotre/configurateur/` | ancien hébergement | brotli | `no-cache, must-revalidate` **+** `no-cache` (doublon) | |
| `/medias/x-madame-qualite.mp4` (2,5 Mo) | ancien hébergement | — | **aucun** `Cache-Control` ni `Expires` (le `expires 30d` du `location ^~ /medias/` ne s'applique pas après `try_files … @ancien`) | `x-hcdn-cache-status: HIT` côté mutualisé |
| `/img/14-alexandre.jpg` | ancien hébergement | — | `public, max-age=2592000` (bon) | `x-hcdn-cache-status: MISS` |

Toutes les réponses venant de l'ancien hébergement portent aussi **`X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex`** (images `/img/` et médias `/medias/` comprises). Voulu pour les decks privés ; **à vérifier pour `/lenotre/petites-toques/`, `/lenotre/configurateur/`** si on veut qu'ils soient indexés, et c'est dommage pour les images.

## 3. Cause probable et ce qu'il reste à vérifier sur le VPS (lecture seule)

**Hypothèse n° 1 (la plus probable)** : des **échecs de connexion intermittents avant ou pendant la poignée de main TLS**, touchant **Traefik/le VPS** et aussi l'ancien hébergement, très marqués depuis une sortie réseau partagée, rares (~1 %) depuis le reste du monde. Candidats, du plus au moins vraisemblable :
1. une **protection anti-abus / limitation de débit chez Hostinger** (pare-feu réseau ou filtre du mutualisé) qui ralentit ou coupe certaines adresses sources très actives (l'outil de mesure, le robot de publication FTP, un scan…) ;
2. **fail2ban ou règles `iptables`/`ufw` sur le VPS** qui ban des adresses (IP partagées derrière un NAT) : non visible depuis l'extérieur ;
3. **table de suivi de connexions (conntrack) pleine** ou file d'attente SYN saturée par un pic (robots, scan) ;
4. Traefik : délais de réponse trop courts, ou renouvellement ACME bloquant brièvement.

**Commandes en lecture seule à lancer sur le VPS** (ne modifient rien), à coller dans le rapport :
```bash
# ressources et conteneurs
docker stats --no-stream; docker ps --format '{{.Names}} {{.Status}} {{.RunningFor}}'
uptime; free -m; df -h /; ss -s
# conntrack / pare-feu / bannissements
sysctl net.netfilter.nf_conntrack_count net.netfilter.nf_conntrack_max
dmesg -T | grep -iE 'conntrack|syn flood|oom|dropped' | tail -20
fail2ban-client status 2>/dev/null; fail2ban-client status sshd 2>/dev/null
iptables -S 2>/dev/null | head -40; ufw status verbose 2>/dev/null
# Traefik : erreurs de poignée de main, ACME, timeouts
docker logs --since 24h traefik 2>&1 | grep -iE 'error|tls|handshake|timeout|acme|certificate' | tail -50
# nginx : codes et temps sur 24 h (si l'accès est journalisé)
docker logs --since 24h h3h33_web 2>&1 | awk '{print $9}' | sort | uniq -c | sort -rn | head
```
Ce qui trancherait : `nf_conntrack_count` proche de `nf_conntrack_max`, des lignes `handshake error` / `i/o timeout` dans Traefik aux heures des échecs, des IP bannies par fail2ban, ou des `499`/`502`/`504` côté nginx. **Si rien de tout cela n'apparaît, le problème est en amont (Hostinger / réseau) et l'upgrade ne changerait rien.**

**À mettre en place, sans risque** : une **sonde externe toutes les 5 minutes** (UptimeRobot, BetterStack ou Hetrixtools, gratuits) sur `https://3h33.com/`, `/acorus/` et `/lenotre/configurateur/`, avec temps de réponse. Après 48 h on aura la vraie fréquence des décrochages et leur heure, ce qui permettra de les corréler aux journaux.

## 4. Correctifs nginx, classés par impact

Tous s'appliquent à `nginx.conf` (le fichier est inclus dans le contexte `http` : `upstream` et `proxy_cache_path` peuvent donc se placer tout en haut). Un seul redémarrage groupé suffit : **regrouper les corrections 4.1 à 4.5 dans une seule opération** (≈ 40 s de coupure).

### 4.1 (impact moyen, risque faible) Connexion persistante et cache vers l'ancien hébergement

**Constat.** Chaque requête relayée (`/acorus/`, `/lenotre/…`, `/img/`, `/medias/`, `/wp-content/uploads/`) ouvre **une nouvelle connexion TCP + TLS** vers `147.79.116.46`, sans `keepalive` ni `proxy_http_version 1.1`, avec `proxy_connect_timeout` à 60 s (défaut), sans cache. Une page de deck charge 20 à 40 images : autant de poignées de main inutiles, et si l'ancien hébergement a un blocage, chaque visiteur le subit en direct. À l'usage mesuré, le saut supplémentaire ne coûte que quelques dizaines de ms (accueil local 0,63 s de TTFB vs deck relayé 0,65 s), donc **le gain porte surtout sur la robustesse et le nombre de connexions**, pas sur un temps spectaculaire.

```diff
--- a/nginx.conf
+++ b/nginx.conf
@@ en tête du fichier (avant le premier "map")
+# Connexions persistantes vers l'ancien hébergement mutualisé
+upstream ancien_hebergement {
+    server 147.79.116.46:443;
+    keepalive 16;
+    keepalive_time 1h;
+    keepalive_timeout 60s;
+}
+# Cache disque pour les images et médias relayés (jamais pour le HTML des decks)
+proxy_cache_path /var/cache/nginx/ancien levels=1:2 keys_zone=ancien:20m
+                 max_size=1g inactive=30d use_temp_path=off;
@@ location ~ ^/(atelier|cockpit-ia|ia-talent|...)(/|$) {
-        proxy_pass https://147.79.116.46;
+        proxy_pass https://ancien_hebergement;
+        proxy_http_version 1.1;
+        proxy_set_header Connection "";
+        proxy_connect_timeout 5s;
         proxy_ssl_server_name on;
         proxy_ssl_name 3h33.com;
@@ nouveau bloc, AVANT le bloc regex ci-dessus ("^~" gagne sur la regex) :
+    # /img/ : images des decks. Elles portent déjà ?v=<empreinte> : cache de 30 jours sûr.
+    location ^~ /img/ {
+        proxy_pass https://ancien_hebergement;
+        proxy_http_version 1.1;
+        proxy_set_header Connection "";
+        proxy_connect_timeout 5s;
+        proxy_ssl_server_name on;
+        proxy_ssl_name 3h33.com;
+        proxy_set_header Host 3h33.com;
+        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
+        proxy_set_header X-Forwarded-Proto https;
+        proxy_redirect off;
+        proxy_cache ancien;
+        proxy_cache_valid 200 30d;
+        proxy_cache_valid 404 1m;
+        proxy_cache_lock on;
+        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
+        add_header X-Cache $upstream_cache_status;
+    }
@@ location @ancien {
-        proxy_pass https://147.79.116.46;
+        proxy_pass https://ancien_hebergement;
+        proxy_http_version 1.1;
+        proxy_set_header Connection "";
+        proxy_connect_timeout 5s;
         proxy_ssl_server_name on;
@@ (même bloc) après proxy_redirect off;
+        proxy_cache ancien;
+        proxy_cache_valid 200 30d;
+        proxy_cache_lock on;
+        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
```
Pour `old.3h33.com` : laisser tel quel (il désactive volontairement la compression amont pour `sub_filter`), ou y mettre seulement `proxy_pass https://ancien_hebergement;` si l'on veut tout uniformiser.

**À savoir** : `proxy_cache_use_stale … http_502/504` fait que les images et médias **continuent à s'afficher** si le mutualisé a un incident, ce qui est un vrai filet de sécurité. `/img/` : si une image est remplacée sous le même nom sans changer `?v=`, la copie en cache vit 30 jours : le moteur met déjà une empreinte `?v=` (vérifié sur les URL en ligne), donc c'est sûr pour les decks. Si un doute, descendre `proxy_cache_valid 200` à `1d`.
**Test** : `curl -sI https://3h33.com/img/14-alexandre.jpg | grep -i x-cache` deux fois : `MISS` puis `HIT`. `curl -s -o /dev/null -w '%{http_code} %{time_total}\n' https://3h33.com/acorus/` avant/après. `docker exec h3h33_web ls /var/cache/nginx/ancien` doit se remplir.
**Risque** : faible. Cache disque dans le conteneur (perdu au `--force-recreate`, sans conséquence). Si une image disparaît du mutualisé, elle reste servie du cache 30 jours : vider avec `docker exec h3h33_web sh -c 'rm -rf /var/cache/nginx/ancien/*'`.

### 4.2 (impact moyen pour les visiteurs récurrents, risque faible) Cache long sur les médias relayés

**Constat.** `/medias/x-*.mp4` (les vidéos des decks : 2,3 à 6,8 Mo pièce) sort **sans `Cache-Control` ni `Expires`** : à chaque visite le navigateur redemande ou revalide, car le `expires 30d` du `location ^~ /medias/` n'est pas appliqué quand `try_files` bascule vers `@ancien`.

```diff
 location @ancien {
@@
         proxy_redirect off;
+        # En-tête de cache posé ici : celui du location d'origine ne suit pas le try_files.
+        proxy_hide_header Cache-Control;
+        proxy_hide_header Expires;
+        expires 30d;
     }
```
(`proxy_hide_header` évite le doublon si l'amont envoie déjà un en-tête.)
**Test** : `curl -sI https://3h33.com/medias/x-madame-qualite.mp4 | grep -iE 'cache-control|expires'` → un seul `Cache-Control: max-age=2592000`.
**Risque** : si un média change **sous le même nom**, les visiteurs gardent l'ancien jusqu'à 30 jours. Pratique à adopter : un nouveau nom de fichier à chaque version (le moteur le fait déjà pour les images avec `?v=`).

### 4.3 (impact faible, correct à faire) Doublons de `Cache-Control` et en-têtes de sécurité perdus

**Constat.** Dans nginx, un `add_header` dans un `location` **annule tous** les `add_header` du niveau `server`. Résultat constaté : sur les `.mp4`, `.svg`, `.jpg`… `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` ne sont **pas envoyés**, et `Cache-Control` est présent **deux fois** (`expires` + `add_header`).

```diff
-    location ~* \.(jpg|jpeg|png|webp|svg|gif|ico|woff2?|mp4|webm|mp3)$ {
-        expires 30d;
-        add_header Cache-Control "public, max-age=2592000";
-    }
-    location ~* \.(css|js)$ {
-        expires 7d;
-        add_header Cache-Control "public, max-age=604800";
-    }
+    location ~* \.(jpg|jpeg|png|webp|svg|gif|ico|woff2?|mp4|webm|mp3)$ {
+        expires 30d;            # émet déjà Cache-Control: max-age=… et Expires
+    }
+    location ~* \.(css|js)$ {
+        expires 7d;
+    }
```
Même retouche pour le `location ^~ /medias/` (retirer son `add_header Cache-Control …`, garder `expires 30d`).
**Test** : `curl -sI https://3h33.com/favicon.svg` : un seul `cache-control`, et `x-content-type-options: nosniff` présent.
**Risque** : très faible. Les fichiers « chargés par nom constant » (`mesure-clics.js`, CSS) restent à 7 jours : si on les modifie, renommer ou ajouter `?v=`.

### 4.4 (impact faible) Compression : `Vary`, niveau, types

```diff
     gzip on;
-    gzip_types text/css application/javascript application/json image/svg+xml text/plain application/xml;
-    gzip_min_length 1024;
+    gzip_vary on;
+    gzip_comp_level 5;
+    gzip_min_length 512;
+    gzip_types text/css text/javascript application/javascript application/json
+               image/svg+xml text/plain application/xml text/xml application/manifest+json;
```
(`text/html` est toujours compressé par nginx.) **Constat** : l'accueil part sans `Vary: Accept-Encoding` ; un cache intermédiaire (CDN, proxy d'entreprise) pourrait resservir du gzip à un client qui n'en veut pas. `gzip_comp_level 5` ≈ -10 % de plus que le niveau 1 par défaut, pour un coût CPU négligeable ici (5 % de CPU).
**Test** : `curl -sI -H 'Accept-Encoding: gzip' https://3h33.com/ | grep -iE 'vary|content-encoding'`. **Risque** : nul.

**Brotli** : l'image `nginx:1.27-alpine` ne l'inclut pas. Le gain (brotli vs gzip) est de 15 à 20 % sur le HTML, soit 5 Ko sur l'accueil : **pas prioritaire**. Les pages relayées sont déjà en brotli (c'est l'ancien hébergement qui le fait). Si on le veut un jour : middleware `compress` de Traefik (versions récentes) ou Cloudflare (§5).

### 4.5 (impact faible, utile) Fermeture propre et priorité aux fichiers statiques

Rien à changer dans `worker_processes` / `worker_connections` (valeurs de l'image : `auto` = 4 workers, 1024 connexions chacun, très largement suffisant pour ~5 % de CPU). `keepalive_timeout` côté client est géré par Traefik. Pas de `limit_req`/`limit_conn` dans le dépôt : **aucune limitation nginx** ne bloque d'adresse. Ne pas en ajouter pour l'instant.

### 4.6 (à décider avec Alexandre) En-tête `X-Robots-Tag` venant du mutualisé

Pour que `/img/` (images), `/lenotre/petites-toques/` et `/lenotre/configurateur/` soient indexables si c'est voulu :
```nginx
    location ^~ /img/ { ... proxy_hide_header X-Robots-Tag; ... }
```
À ne **pas** faire pour les decks privés, qui doivent rester `noindex`. Question de choix éditorial, pas de performance.

## 5. Plus gros leviers (hors nginx)

| Levier | Impact | Effort | Risque |
|---|---|---|---|
| **Sonde externe 5 min** (§3) | permet de savoir enfin la vraie fréquence | 10 min | nul |
| **Lire les journaux Traefik/conntrack/fail2ban** (§3) | trouve la vraie cause des décrochages | 15 min | nul (lecture) |
| **Cloudflare gratuit devant 3h33.com** | HTTP/3, brotli, cache des images et vidéos près du visiteur, poignée de main TLS terminée près du visiteur (réduit l'effet d'un décrochage éventuel sur le chemin vers le VPS) | moyen : il faut **déléguer les serveurs de noms** de 3h33.com à Cloudflare (le CNAME partiel est réservé aux offres payantes), recopier **tous** les enregistrements (MX, DKIM, SPF, `ia-magique`, `projet`, `veille`, `stats`, `nouveau`…), mettre le SSL en « Full (strict) » ; le défi HTTP de Let's Encrypt de Traefik continue de marcher | **moyen** : une erreur de copie DNS coupe les mails ; les conditions d'usage de la formule gratuite limitent la diffusion de vidéos lourdes depuis son cache (garder les mp4 hors cache ou sur un sous-domaine non proxifié) ; à faire un soir calme, avec TTL à 300 s |
| **Upgrade du VPS** | **aucun** (CPU 5 %, RAM 16 % utilisée) | — | argent perdu |
| **HTTP/3 sur Traefik** | léger gain sur mobile | ajouter UDP 443 au pare-feu Hostinger + `entryPoints.websecure.http3` | faible, mais inutile derrière Cloudflare |
| **Fermer le port 22 au monde** (restreindre à l'IP d'Alexandre / Tailscale) et installer fail2ban si absent | sécurité, pas vitesse | 15 min | **risque de se bloquer l'accès SSH** : tester une seconde session avant de fermer |

Ordre conseillé : (1) sonde + journaux ; (2) correctifs nginx 4.1 à 4.4 en un seul redémarrage, à une heure creuse ; (3) allègement des decks (§6) ; (4) Cloudflare seulement si les décrochages persistent après (1) et que les journaux montrent un problème côté VPS.

## 6. Poids des pages et du moteur de slides (pour le dépôt `masterclass-3h33`, **non modifié**)

Mesuré en lecture seule sur `dist/` et sur les pages en ligne.

**Deck Acorus en ligne** : HTML 920 875 octets, 488 254 octets en brotli. Il contient en base64 : **14 polices woff2 (378 Ko) + 2 SVG (148 Ko)**, ~200 Ko de JS et ~470 Ko de CSS en ligne. Les photos sont externes (`https://3h33.com/img/…?v=…`), 25 `<img>`, **1 seul `loading="lazy"`**, et **5 `<video preload="auto">`** (x-livre-enfants-interactif 6,8 Mo, x-ia-qui-ecoute-pendant 6,3 Mo, x-madame-qualite 2,5 Mo, x-site-web-chaque-clic 2,3 Mo, x-modele-de-monde-3d) : sur un téléphone, le navigateur peut précharger **près de 20 Mo de vidéo** avant même qu'on arrive à ces slides.

**Version locale `dist/acorus.html` (8,57 Mo) et `dist/acorus-emporter.html` (5,04 Mo)** : 43 images JPEG en base64 (7,4 Mo dans le HTML), **mais seulement 27 sont distinctes : 16 sont des doublons exacts, soit 3,9 Mo gaspillés** (la même image de 294 Ko 1620×815 apparaît 6 fois). Les JPEG font 1620×815 pour des vignettes affichées en bien plus petit.
Les pages à emporter ne sont pas encore publiées : `https://3h33.com/acorus/emporter/` répond 404 au moment de la mesure (à surveiller avant le 28/10).

Améliorations côté moteur, par impact (à décrire à qui travaille sur le dépôt, sans y toucher ici) :
1. **Vidéos : `preload="none"` (ou `metadata`) + `poster`** au lieu de `preload="auto"` ; lancer la lecture seulement à l'approche de la slide (IntersectionObserver). Gain : jusqu'à ~20 Mo économisés au chargement. **Impact le plus élevé pour l'utilisateur final.**
2. **Dédoublonner les images incorporées** (version à emporter et copie de secours) : stocker chaque image une fois (une feuille CSS avec `--img-N: url(data:…)` ou un objet JS, réutilisé) : **−3,9 Mo** sur `acorus.html`, de l'ordre de −2 à −3 Mo sur l'`emporter`.
3. **Convertir en WebP/AVIF** (qualité ~75) et **redimensionner à la taille affichée** (1620 px de large est inutile pour des vignettes) : −50 à −70 % sur les images, soit −2 à −4 Mo sur l'emporter. Prévoir `<picture>` ou un repli JPEG si des lecteurs anciens comptent.
4. **`loading="lazy"` + `decoding="async"`** sur toutes les images hors première slide (25 `<img>`, un seul est lazy aujourd'hui).
5. **Polices** : 14 woff2 en base64 (378 Ko) : ne garder que les graisses réellement utilisées, sous-ensemble « latin » (`pyftsubset`, `unicode-range`). Gain plausible : −150 à −250 Ko.
6. **Sortir les polices et le CSS commun en fichiers versionnés** (`/slides/engine-<hash>.css`, cache 1 an) au lieu de les recopier dans chaque deck : chaque deck pèserait ~600 Ko de moins et le navigateur les réutiliserait d'un deck à l'autre. À peser contre l'intérêt d'un fichier unique autonome.
7. **Publication FTP** : n'envoyer que ce qui a changé (empreintes) et publier `emporter` en second, comme déjà prévu.
8. Le deck Acorus publié pèse 0,9 Mo de HTML (0,5 Mo compressé) : **le poids n'est pas la cause des timeouts**, mais l'amélioration du point 1 améliorera sensiblement les téléphones. (Les autres decks n'ont pas été mesurés en ligne : leurs copies locales `dist/` font 5 à 11 Mo avec images incorporées ; vérifier qu'ils sont publiés en version allégée.)

## 7. Résumé des correctifs par ordre de priorité

1. **Sonde externe + journaux VPS** (§3) : trouve la vraie cause des décrochages. Aucun risque.
2. **nginx 4.1 + 4.2** : connexions persistantes, cache et `stale` pour les images/vidéos relayées, cache navigateur de 30 jours sur `/medias/` (aujourd'hui absent). Un seul redémarrage groupé avec 4.3 et 4.4.
3. **Moteur de slides : `preload="none"` sur les vidéos + dédoublonnage/WebP des images** (§6).
4. Puis, si les décrochages persistent : **Cloudflare gratuit** (§5). **Pas d'upgrade du VPS.**

## 8. Données brutes

- VPS : plan KVM 4, id 1472723, hôte `srv1472723.hstgr.cloud`, IPv4 187.124.36.155, IPv6 2a02:4780:7:2a24::1, Ubuntu 24.04 + Docker + Traefik, créé le 08/03/2026, centre de données 15.
- Métriques du 20/10 au 27/10/2026 (374 points) : CPU min 4,7 % / moyenne 5,0 % / max 7,7 % ; RAM 2,39 à 2,69 Go ; disque 28,6 à 31,1 Go ; trafic sortant 15,7 Go cumulés ; trafic entrant 6,7 Go ; uptime 910 747 s (10,5 jours).
- Image nginx : `nginx:1.27-alpine` (réponses `server: nginx/1.27.5`), derrière Traefik (TLS et HTTP/2).
- Outils de mesure : curl (IPv4 ; IPv6 impossible depuis la machine de mesure, mais aucun AAAA n'est publié), check-host.net (10 à 20 nœuds par vague), lecture web indépendante.
