#!/bin/sh
# Dev-only Keycloak bootstrap wrapper (audit finding P0-2).
#
# realm-chama.json is committed to git, so anyone with repo access already knows every value in
# it. Two things follow from that:
#
#   1. Importing it must be an explicit, conscious choice, not something that happens just because
#      a docker-compose.yml sitting in a repo got run. Without CHAMA_DEV_REALM_IMPORT=true, this
#      script boots Keycloak with no realm imported at all.
#   2. The SUPER_ADMIN user's password can never be the literal value committed to git, so it is
#      generated fresh on every start and printed to this container's logs instead. It is not
#      persisted anywhere in the image or in version control.
#
# This whole compose file runs Keycloak in `start-dev` mode, which is documented by Keycloak as
# unsuitable for production use on its own; this script is an additional guard against the realm
# import specifically, not a production hardening layer.
set -eu

HTTP_PORT="${KC_HTTP_PORT:-8180}"

if [ "${CHAMA_DEV_REALM_IMPORT:-}" != "true" ]; then
  echo "=================================================================="
  echo "[chama] CHAMA_DEV_REALM_IMPORT is not 'true': starting Keycloak WITHOUT"
  echo "[chama] importing the demo realm. It contains credentials committed to git"
  echo "[chama] and must never be imported outside an isolated local/dev environment."
  echo "[chama] To opt in for local development: CHAMA_DEV_REALM_IMPORT=true docker compose up"
  echo "=================================================================="
  exec /opt/keycloak/bin/kc.sh start-dev --http-port="$HTTP_PORT"
fi

IMPORT_DIR="/opt/keycloak/data/import"
mkdir -p "$IMPORT_DIR"

GENERATED_PASSWORD="$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 24)Aa1!"
sed "s/__SUPER_ADMIN_PASSWORD__/${GENERATED_PASSWORD}/" \
  /opt/keycloak/config/realm-chama.json > "$IMPORT_DIR/realm-chama.json"

echo "=================================================================="
echo "[chama] Demo realm import enabled (CHAMA_DEV_REALM_IMPORT=true)."
echo "[chama] Generated SUPER_ADMIN password for this session (username: admin):"
echo "[chama]   ${GENERATED_PASSWORD}"
echo "[chama] This is regenerated on every container start and is never written to disk"
echo "[chama] outside this container's ephemeral filesystem."
echo "=================================================================="

exec /opt/keycloak/bin/kc.sh start-dev --import-realm --http-port="$HTTP_PORT"
