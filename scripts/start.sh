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
printf '%s\n' 'Website http://localhost:8080 | pgAdmin http://localhost:8091' 'Website user: admin. Password file: .local/secrets/admin_password'
