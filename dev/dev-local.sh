#!/bin/sh
# LOCAL DEVELOPMENT ONLY: the engine in development mode (`nuxt dev`: a change in app/ or server/ shows without rebuilding) on 127.0.0.1:3100, reading the Digipart installed on this machine through
# dev/bridge.php (no front key), for the sales channel given (default 1). Usage: sh dev/dev-local.sh [channel id]. Slower than the built engine (dev/start-local.sh): use it to work on the code.
cd "$(dirname "$0")/.." || exit 1
if lsof -nP -iTCP:3100 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Le moteur tourne deja sur le port 3100. Arretez-le d'abord :  kill \$(lsof -tiTCP:3100 -sTCP:LISTEN)"
  exit 0
fi
export NUXT_LOCAL_APP="${DIGIPART_APP:-$(cd "$(pwd)/../app/local.digipart.fr/app.digipart.fr" 2>/dev/null && pwd)}"
if [ ! -f "$NUXT_LOCAL_APP/conf/config.php" ]; then
  echo "Digipart local introuvable. Indiquez son dossier :  DIGIPART_APP=/chemin/vers/app.digipart.fr sh dev/dev-local.sh"
  exit 1
fi
export NUXT_LOCAL_PHP="/Applications/MAMP/bin/php/php8.3.36/bin/php"
export NUXT_LOCAL_URL="https://local.digipart.fr"
export NUXT_ID_MARKET_PLACE="${1:-1}"
export NUXT_CACHE_SECONDS=5
export NODE_TLS_REJECT_UNAUTHORIZED=0   # the local Digipart has a self-signed certificate: never set this on a real server
exec npx nuxt dev --port 3100 --host 127.0.0.1
