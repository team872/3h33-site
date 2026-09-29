# Formulaire de contact

Micro-service Node sans dépendance. Il reçoit les messages du site, les
enregistre sur disque puis les envoie par courriel.

**L'adresse de destination n'apparaît nulle part dans les pages** : elle est
lue dans `.env` côté serveur. Aucun robot ne peut la récupérer sur le site.

- Sur le VPS : `/opt/3h33-contact`, `docker compose up -d`
- Réglages : copier `.env.exemple` en `.env` et remplir l'identifiant de la boîte
  et le jeton de l'API Hostinger Email (pas de mot de passe SMTP : un jeton borné
  à la seule boîte site@3h33.com, révocable depuis l'API Hostinger)
- Les messages restent aussi dans le volume `messages`, donc rien n'est perdu
  même si l'envoi échoue.

Protections : champ piège invisible, délai minimum de trois secondes,
cinq messages par heure et par adresse IP, taille limitée.

## Sites qui utilisent ce service (au 29/09/2026)

| Site | Comment il poste | Sujet des messages |
|---|---|---|
| nouveau.3h33.com | même domaine, `/api/contact` | selon le formulaire |
| lma.botmoileqi.com | même domaine, `/api/contact` (routeur `h3h33contact-lma`) | « Démonstration ATELIER LMA » |
| botmoileqi.com | **autre serveur** : appel direct vers `https://lma.botmoileqi.com/api/contact` (CORS) | « Démonstration BotMoiLeQi » |

Chaque domaine appelant doit figurer dans `ORIGINES` du `.env` du VPS vitrine
(`/opt/3h33-contact/.env`), sinon le navigateur bloque l'envoi. Essai sans
envoyer de vrai message : poster avec le champ piège `site` rempli, le service
répond `{"ok":true}` et n'envoie rien.
