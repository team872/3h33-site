FROM node:22-alpine
WORKDIR /app
COPY serveur.js .
RUN mkdir -p /données/messages
ENV PORT=3020
EXPOSE 3020
CMD ["node","serveur.js"]
