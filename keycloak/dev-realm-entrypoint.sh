#!/bin/sh
# Dev-only Keycloak bootstrap wrapper (audit finding P0-2).
#
# realm-chama.json is committed to git, so anyone with repo access already knows every value in
# it. This script always imports it, since docker-compose.yml is itself only ever used for local
# dev, but keeps the one credential that matters out of git: the SUPER_ADMIN user's password comes
# from CHAMA_SUPERADMIN_PASSWORD, set locally (e.g. in a gitignored .env), falling back to a fixed
# dev-only default if unset. Either way it is substituted into the realm import at start time,
# never persisted in the image or in version control.
#
# This whole compose file runs Keycloak in `start-dev` mode, which is documented by Keycloak as
# unsuitable for production use on its own; this script does not add production hardening.
set -eu

HTTP_PORT="${KC_HTTP_PORT:-8180}"

IMPORT_DIR="/opt/keycloak/data/import"
mkdir -p "$IMPORT_DIR"

SUPERADMIN_PASSWORD="${CHAMA_SUPERADMIN_PASSWORD:-Superadmin1!}"
sed "s/__SUPER_ADMIN_PASSWORD__/${SUPERADMIN_PASSWORD}/" \
  /opt/keycloak/config/realm-chama.json > "$IMPORT_DIR/realm-chama.json"

echo "=================================================================="
echo "[chama] Importing demo realm."
echo "[chama] SUPER_ADMIN login (username: admin):"
echo "[chama]   ${SUPERADMIN_PASSWORD}"
if [ -z "${CHAMA_SUPERADMIN_PASSWORD:-}" ]; then
  echo "[chama] Using the built-in dev default. Set CHAMA_SUPERADMIN_PASSWORD (e.g. in a"
  echo "[chama] gitignored .env) to use your own instead."
fi
echo "[chama] Never committed to git; substituted into the realm import at container start."
echo "=================================================================="

exec /opt/keycloak/bin/kc.sh start-dev --import-realm --http-port="$HTTP_PORT"
