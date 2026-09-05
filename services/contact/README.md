# Formulaire de contact

Micro-service Node sans dépendance. Il reçoit les messages du site, les
enregistre sur disque puis les envoie par courriel.

**L'adresse de destination n'apparaît nulle part dans les pages** : elle est
lue dans `.env` côté serveur. Aucun robot ne peut la récupérer sur le site.

- Sur le VPS : `/opt/3h33-contact`, `docker compose up -d`
- Réglages : copier `.env.exemple` en `.env` et remplir le mot de passe
- Les messages restent aussi dans le volume `messages`, donc rien n'est perdu
  même si l'envoi échoue.

Protections : champ piège invisible, délai minimum de trois secondes,
cinq messages par heure et par adresse IP, taille limitée.
