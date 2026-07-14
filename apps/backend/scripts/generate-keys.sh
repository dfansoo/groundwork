#!/usr/bin/env bash
# Generates the EC P-256 keypair used to sign access tokens (ES256).
# Keys are git-ignored and must never be committed.
#
# ES256 (not RS256) — the algorithm is set in src/auth/auth.module.ts. If you
# switch to RS256 there, generate an RSA key here instead or signing will fail.
set -euo pipefail

mkdir -p keys

if [ -f keys/private.pem ]; then
  echo "keys/private.pem already exists — refusing to overwrite."
  echo "Delete keys/ first if you really want a new keypair."
  exit 0
fi

openssl ecparam -name prime256v1 -genkey -noout -out keys/private.pem
openssl ec -in keys/private.pem -pubout -out keys/public.pem

echo "Wrote keys/private.pem and keys/public.pem (EC P-256, for ES256)"
