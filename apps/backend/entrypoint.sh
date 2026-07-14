#!/bin/sh
set -e

# Migrations are opt-in. Applying them from every replica on boot means N
# containers racing the same schema change, so drive this from a release step —
# or set RUN_MIGRATIONS=true when you know there is exactly one instance.
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Applying migrations..."
  ./node_modules/.bin/prisma migrate deploy
fi

# Seeding writes the SUPER_ADMIN from ADMIN_EMAIL / ADMIN_PASSWORD. Off by
# default: a production database should not be re-seeded on every boot.
if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding..."
  ./node_modules/.bin/prisma db seed
fi

exec node dist/src/main.js
