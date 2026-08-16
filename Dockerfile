FROM node:22-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .

# Local unlimited instance: SQLite database inside the container (persist it
# with the docker-compose volume) and DEMO_MODE off — no 60s limits, no code
# caps, transparent step-by-step narration.
ENV DATABASE_URL=file:/app/prisma/dev.db
ENV DEMO_MODE=false
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate && npx next build

EXPOSE 3000
CMD npx prisma db push --skip-generate && npx next start
