#!/bin/sh
# LOCAL DEVELOPMENT ONLY: builds nothing, starts the built engine on 127.0.0.1:3100 reading the Digipart installed on this machine through dev/bridge.php (no front key), for the sales channel given
# (default 1). Usage: sh dev/start-local.sh [channel id]. Build first with `npm run build`.
cd "$(dirname "$0")/.." || exit 1
if lsof -nP -iTCP:3100 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Le moteur tourne deja sur le port 3100 : rien a lancer. Pour le redemarrer, arretez-le d'abord :  kill \$(lsof -tiTCP:3100 -sTCP:LISTEN)"
  exit 0
fi
# where the local Digipart is: DIGIPART_APP when it is set, else the folder beside this one (../app/local.digipart.fr/app.digipart.fr)
export NUXT_LOCAL_APP="${DIGIPART_APP:-$(cd "$(pwd)/../app/local.digipart.fr/app.digipart.fr" 2>/dev/null && pwd)}"
if [ ! -f "$NUXT_LOCAL_APP/conf/config.php" ]; then
  echo "Digipart local introuvable. Indiquez son dossier :  DIGIPART_APP=/chemin/vers/app.digipart.fr sh dev/start-local.sh"
  exit 1
fi
export NUXT_LOCAL_PHP="/Applications/MAMP/bin/php/php8.3.36/bin/php"
export NUXT_LOCAL_URL="https://local.digipart.fr"
export NUXT_ID_MARKET_PLACE="${1:-1}"
export NUXT_CACHE_SECONDS=30   # what Digipart answers is kept 30 s (a publication in the builder still shows at once); a change of product or menu shows within 30 s
export NODE_TLS_REJECT_UNAUTHORIZED=0   # the local Digipart has a self-signed certificate: never set this on a real server
export PORT=3100 HOST=127.0.0.1
exec node .output/server/index.mjs
