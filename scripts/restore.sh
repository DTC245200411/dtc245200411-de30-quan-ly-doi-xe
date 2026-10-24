#!/bin/sh
set -eu
. "$(dirname -- "$0")/common.sh"
mode=${1:-}
case "$mode" in --verify|--verify-current|--apply) ;; *) echo 'Usage: sh scripts/restore.sh --verify|--verify-current|--apply backup.dump'; exit 2;; esac
[ -n "${2:-}" ] && [ -f "$2" ] || { echo 'Backup file not found.'; exit 2; }
backup=$(realpath -- "$2")
[ -f "$backup.sha256" ] || { echo 'Checksum file is required.'; exit 2; }
(cd "$(dirname -- "$backup")" && sha256sum -c "$(basename -- "$backup").sha256")
pg() { dc exec -T postgres sh -ec 'export PGPASSWORD="$(cat /run/secrets/db_owner_password)"; exec "$@"' sh "$@"; }
fingerprint() {
 pg psql -h 127.0.0.1 -U fleet_owner -d "$1" -At -v ON_ERROR_STOP=1 -c "SELECT json_build_object('vehicles',(SELECT count(*) FROM vehicles),'drivers',(SELECT count(*) FROM drivers),'trips',(SELECT count(*) FROM trips),'maintenance',(SELECT count(*) FROM maintenance),'fingerprint',md5(COALESCE((SELECT string_agg(row_to_json(v)::text,'' ORDER BY id) FROM vehicles v),'')||COALESCE((SELECT string_agg(row_to_json(d)::text,'' ORDER BY id) FROM drivers d),'')||COALESCE((SELECT string_agg(row_to_json(t)::text,'' ORDER BY id) FROM trips t),'')||COALESCE((SELECT string_agg(row_to_json(m)::text,'' ORDER BY id) FROM maintenance m),'')))::text"
}
verify_db="lam_restore_verify_$(date +%s)_$$"
cleanup() { pg dropdb -h 127.0.0.1 -U fleet_owner --if-exists "$verify_db" >/dev/null; }
trap cleanup EXIT
pg createdb -h 127.0.0.1 -U fleet_owner "$verify_db"
pg pg_restore -h 127.0.0.1 -U fleet_owner --dbname="$verify_db" --no-owner --no-acl --exit-on-error <"$backup"
restored=$(fingerprint "$verify_db")
current=$(fingerprint fleet)
printf 'Restored archive: %s\n' "$restored"
if [ "$restored" = "$current" ]; then echo 'PASS: restored business rows match current database exactly.'
elif [ "$mode" = --verify-current ]; then echo 'FAIL: restored business rows differ from current database.'; exit 1
else echo 'Archive restored successfully; data differs from current DB.'; fi
if [ "$mode" = --apply ]; then
 printf '%s\n' 'This replaces Lam Fleet data. Type PHUC HOI LAM FLEET to continue:'
 read -r confirmation
 [ "$confirmation" = 'PHUC HOI LAM FLEET' ] || { echo 'Cancelled.'; exit 1; }
 dc stop nginx app
 if pg pg_restore -h 127.0.0.1 -U fleet_owner --dbname=fleet --clean --if-exists --exit-on-error <"$backup"; then
  dc up -d --wait app nginx
  echo 'Restored. Account passwords follow the archive; initial secret files are unchanged.'
 else echo 'Restore failed; app/nginx remain stopped for recovery.'; exit 1; fi
fi
