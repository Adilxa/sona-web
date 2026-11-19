FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 SONA_STANDALONE=1

COPY package.json package-lock.json ./
RUN npm ci --include=optional --no-audit --no-fund
COPY . .

# Next.js embeds these public browser settings in its client bundles.
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_VAPID_KEY
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone/ ./
COPY --from=build --chown=node:node /app/.next/static/ ./.next/static/
COPY --from=build /app/public/ ./public/

USER node
EXPOSE 3000
CMD ["node", "server.js"]
