#!/usr/bin/env bash
# Codzienna aktualizacja na serwerze: najnowszy kod z GitHuba, teksty ustaw z API Sejmu,
# przeliczenie pytań, build z prerenderem i podmiana katalogu WWW (atomowo).
set -euo pipefail
APP_DIR=/opt/sedzia
WEB_DIR=/var/www/sedzia
LOG_TAG="[sedzia $(date -Is)]"

cd "$APP_DIR"
git fetch --quiet origin main
git reset --quiet --hard origin/main
npm ci --no-audit --no-fund --loglevel=error
# ustawy z API Sejmu – przy błędzie sieci zostają dotychczasowe dane
npm run data:acts || echo "$LOG_TAG aktualizacja ustaw nie powiodła się – używam poprzednich danych"
npm run data:questions
npm run build
rsync -a --delete dist/ "$WEB_DIR.new/"
rm -rf "$WEB_DIR.old"
[ -d "$WEB_DIR" ] && mv "$WEB_DIR" "$WEB_DIR.old"
mv "$WEB_DIR.new" "$WEB_DIR"
rm -rf "$WEB_DIR.old"
echo "$LOG_TAG gotowe"
