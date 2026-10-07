# Image AntiKebo: satu image untuk web (Next standalone), worker, dan migrasi.
FROM node:22-alpine AS dasar
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM dasar AS dep
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dep AS bangun
COPY . .
ARG ANTIKEBO_VERSI=dev
ENV ANTIKEBO_VERSI=$ANTIKEBO_VERSI
# `pnpm build` = penjaga (scripts/jaga.mjs) + next build. Penjaga gagal = image tidak jadi.
RUN pnpm build
# Worker & migrasi dibundel jadi berkas ESM (dijalankan di luar Next).
RUN npx esbuild src/worker/index.ts scripts/migrasi.ts --bundle --platform=node --target=node22 --format=esm \
      --outdir=dist --out-extension:.js=.mjs --entry-names=[name] \
      --banner:js="import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" \
      --external:bufferutil --external:utf-8-validate --log-level=warning \
 && mv dist/index.mjs dist/worker.mjs

FROM node:22-alpine AS jalan
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 ANTIKEBO_FOLDER_MIGRASI=/app/migrasi
RUN addgroup -S -g 1001 antikebo && adduser -S -u 1001 -G antikebo antikebo
ARG ANTIKEBO_VERSI=dev
ENV ANTIKEBO_VERSI=$ANTIKEBO_VERSI
COPY --from=bangun /app/.next/standalone ./
COPY --from=bangun /app/.next/static ./.next/static
COPY --from=bangun /app/public ./public
COPY --from=bangun /app/dist ./dist
COPY --from=bangun /app/src/lib/db/migrasi ./migrasi
USER antikebo
EXPOSE 3000
CMD ["node", "server.js"]
