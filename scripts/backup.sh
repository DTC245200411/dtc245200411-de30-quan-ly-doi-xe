#!/bin/sh
set -eu
. "$(dirname -- "$0")/common.sh"
umask 077
mkdir -p .local/backups
backup="$ROOT/.local/backups/lam-fleet-$(date +%Y%m%d-%H%M%S)-$$.dump"
trap 'rm -f -- "$backup.tmp"' EXIT
dc exec -T postgres sh -ec 'export PGPASSWORD="$(cat /run/secrets/db_owner_password)"; exec pg_dump -h 127.0.0.1 -U fleet_owner -d fleet --format=custom' >"$backup.tmp"
mv -- "$backup.tmp" "$backup"
(cd "$(dirname -- "$backup")" && sha256sum "$(basename -- "$backup")" >"$(basename -- "$backup").sha256")
printf '%s\n' "$backup"
