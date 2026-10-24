#!/bin/sh
set -eu
. "$(dirname -- "$0")/common.sh"
dc down
printf '%s\n' 'Stopped. Volumes and secrets preserved.'
