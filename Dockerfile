# Lśni: aplikacja + serwer w jednym kontenerze
FROM node:22-alpine
WORKDIR /app
COPY index.html app.js api.js ./
COPY server ./server
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data PUBLIC_DIR=/app
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/index.js"]
