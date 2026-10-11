FROM node:22-alpine
WORKDIR /app
COPY commun.js serveur.js envoyer-lettre.js abonnes.js ./
# Les données (abonnés, trace des lettres) vivent sur le volume /donnees, propriété de « node ».
RUN mkdir -p /donnees && chown node:node /donnees
USER node
ENV PORT=3030 DOSSIER_DONNEES=/donnees
EXPOSE 3030
CMD ["node","serveur.js"]
