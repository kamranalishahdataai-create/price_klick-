# PriceKlick — single-service deploy (API + built frontend) for Railway.
# Stage 1 builds the Vite frontend; stage 2 runs the Express API and serves it.

# ---- Stage 1: build the frontend ----
FROM node:20-slim AS web
WORKDIR /web
# Public client-side build vars, supplied by Railway as build args (not committed).
# VITE_API_URL is left empty so the frontend calls the API on its own origin.
ARG VITE_MAPBOX_TOKEN=""
ARG VITE_API_URL=""
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN
ENV VITE_API_URL=$VITE_API_URL
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# ---- Stage 2: server runtime ----
FROM node:20-slim AS server
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ ./
# Place the built frontend where index.js serves it (server/public)
COPY --from=web /web/dist ./public
# Railway injects PORT at runtime; the app reads process.env.PORT.
CMD ["node", "index.js"]
