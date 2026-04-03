#!/bin/bash

set -euo pipefail

LABEL="com.bilibili-auto-signin-ji.atlas-checkin"
LEGACY_LABEL="com.alberlat.atlas-bilibili-checkin"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_ROOT="$HOME/Library/Application Support/bilibili-auto-signin-ji"
INSTALLED_LAUNCHER="$INSTALL_ROOT/launch-atlas-checkin.sh"
PLIST_TEMPLATE="$SCRIPT_DIR/com.bilibili-auto-signin-ji.atlas-checkin.plist.template"
PLIST_DEST="$HOME/Library/LaunchAgents/${LABEL}.plist"
LEGACY_PLIST_DEST="$HOME/Library/LaunchAgents/${LEGACY_LABEL}.plist"
LOG_DIR="$HOME/Library/Logs"

mkdir -p "$INSTALL_ROOT"
mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$LOG_DIR"

cp "$SCRIPT_DIR/launch-atlas-checkin.sh" "$INSTALLED_LAUNCHER"
chmod +x "$INSTALLED_LAUNCHER"

LABEL="$LABEL" \
SCRIPT_PATH="$INSTALLED_LAUNCHER" \
WORKING_DIRECTORY="$INSTALL_ROOT" \
LOG_DIR="$LOG_DIR" \
perl -0pe '
  s/__LABEL__/$ENV{LABEL}/g;
  s/__SCRIPT_PATH__/$ENV{SCRIPT_PATH}/g;
  s/__WORKING_DIRECTORY__/$ENV{WORKING_DIRECTORY}/g;
  s/__LOG_DIR__/$ENV{LOG_DIR}/g;
' "$PLIST_TEMPLATE" > "$PLIST_DEST"

launchctl bootout "gui/$(id -u)" "$LEGACY_PLIST_DEST" 2>/dev/null || true
launchctl bootout "gui/$(id -u)" "$PLIST_DEST" 2>/dev/null || true
rm -f "$LEGACY_PLIST_DEST"
launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST"

echo "Installed launcher: $INSTALLED_LAUNCHER"
echo "Installed LaunchAgent: $PLIST_DEST"
