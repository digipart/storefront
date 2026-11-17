# The site engine of Digipart Commerce as a container (Coolify, or any Docker host). Two stages: the first builds the engine, the second keeps only what runs it (Nitro's own bundle: .output
# carries the server and its dependencies, so no node_modules in the final image). Nothing secret goes in the image: DIGIPART_URL, the key of the front... are given to the CONTAINER at run time
# as NUXT_DIGIPART_URL, NUXT_ID_MARKET_PLACE, NUXT_CLIENT_ID, NUXT_CLIENT_SECRET, NUXT_CACHE_SECONDS (see README.md > Docker). Do not ask the platform to pass them at build time.

# ---- build -----------------------------------------------------------------------------------------------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
# the dependencies first (a layer kept while package-lock.json does not change); the scripts are skipped here (`nuxt prepare` needs the sources, the build runs it)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npx nuxt build

# ---- run -------------------------------------------------------------------------------------------------------------------------------------------------------------------
FROM node:22-alpine AS run
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/.output ./.output
USER node
EXPOSE 3000
# alive = the port answers (a page would also depend on Digipart, which must not make the container look dead when the back-office is down)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "require('net').connect(process.env.PORT||3000,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
