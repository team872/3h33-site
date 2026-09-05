# Umami — mesure d'audience de 3h33.com

Compteur de visites hébergé sur le VPS vitrine, sans cookies : aucun bandeau
de consentement n'est nécessaire et les données ne quittent pas le serveur.

- Adresse : https://stats.3h33.com
- Sur le VPS : `/opt/umami`, `docker compose up -d`
- Secrets : `/opt/umami/.env` (jamais dans le dépôt)

Le script de mesure est appelé par les pages du site depuis
`https://stats.3h33.com/script.js` avec l'identifiant du site.
