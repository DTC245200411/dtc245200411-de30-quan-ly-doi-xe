#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
umask 077
mkdir -p .local/secrets
for name in db_owner_password db_app_password db_migrate_password db_exporter_password admin_password pgadmin_password session_secret grafana_password; do
  if [ ! -s ".local/secrets/$name" ]; then
    printf 'Lam9A%s' "$(openssl rand -hex 24)" >".local/secrets/$name"
  fi
done
# Compose bind-mounted secret files must be readable by the non-root container UIDs.
# Their containing directory stays 0700 and blocks other host users.
chmod 700 .local .local/secrets
chmod 644 .local/secrets/*
printf '%s\n' 'Secrets ready; existing passwords preserved.'
