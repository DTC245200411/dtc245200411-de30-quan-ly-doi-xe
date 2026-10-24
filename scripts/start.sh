#!/bin/sh
set -eu
. "$(dirname -- "$0")/common.sh"
sh scripts/prepare.sh
docker info --format '{{.OperatingSystem}} | {{.ServerVersion}} | {{.CgroupVersion}}'
dc config --quiet
dc build
dc up -d --wait --wait-timeout 300
dc exec -T nginx nginx -t
dc exec -T nginx nginx -s reload
printf 'Website http://%s | pgAdmin http://%s\n' "$(dc port nginx 8080)" "$(dc port pgadmin 80)"
printf '%s\n' 'Website user: admin. Password file: .local/secrets/admin_password'
