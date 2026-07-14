#!/usr/bin/env bash
# Generates the RSA keypair used to sign access tokens (RS256).
# Keys are git-ignored and must never be committed.
set -euo pipefail

mkdir -p keys

if [ -f keys/private.pem ]; then
  echo "keys/private.pem already exists — refusing to overwrite."
  echo "Delete it first if you really want a new keypair."
  exit 0
fi

openssl genpkey -algorithm RSA -out keys/private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in keys/private.pem -out keys/public.pem

echo "Wrote keys/private.pem and keys/public.pem"
