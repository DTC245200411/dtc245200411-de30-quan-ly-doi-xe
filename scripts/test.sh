#!/bin/sh
set -eu
. "$(dirname -- "$0")/common.sh"
umask 077
mkdir -p .local/test-results
if dc run --rm -T tests >.local/test-results/tests.tap 2>&1; then cat .local/test-results/tests.tap; else cat .local/test-results/tests.tap; exit 1; fi
if [ "${BASE_ONLY:-0}" != 1 ]; then
 dc exec -T app node < scripts/check-monitoring.js
 dc exec -T app node < scripts/check-logs.js
 python3 scripts/check-hardening.py
fi
