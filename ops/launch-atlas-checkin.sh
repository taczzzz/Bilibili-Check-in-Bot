#!/bin/bash

set -euo pipefail

APP_NAME="ChatGPT Atlas"
APP_PATH="/Applications/ChatGPT Atlas.app"
OPEN_BIN="/usr/bin/open"
PGREP_BIN="/usr/bin/pgrep"

timestamp() {
  /bin/date "+%Y-%m-%d %H:%M:%S"
}

if [[ ! -d "$APP_PATH" ]]; then
  echo "[$(timestamp)] Atlas app not found at: $APP_PATH" >&2
  exit 1
fi

if "$PGREP_BIN" -xq "$APP_NAME"; then
  echo "[$(timestamp)] $APP_NAME is already running; skip launch."
  exit 0
fi

echo "[$(timestamp)] Launching $APP_NAME in background."
"$OPEN_BIN" -g -a "$APP_PATH"
