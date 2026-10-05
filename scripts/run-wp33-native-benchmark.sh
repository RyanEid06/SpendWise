#!/usr/bin/env bash
set -euo pipefail
# Requires a dedicated wp33-synthetic[-suffix] AVD and normal system authentication.
# Never clears financial data, changes credentials or runs on a physical device.
if [ -f artifacts/wp33/native-runner.mjs ]; then
  node artifacts/wp33/native-runner.mjs "${1:-artifacts/wp33/native-benchmark.json}"
else
  node --import tsx scripts/wp33/native.ts "${1:-artifacts/wp33/native-benchmark.json}"
fi
