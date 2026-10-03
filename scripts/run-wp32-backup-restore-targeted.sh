#!/usr/bin/env bash
set -euo pipefail

APP_ID="com.spendwise.app"
APP_ACTIVITY="$APP_ID/.MainActivity"
NEW_APK="${NEW_APK:-artifacts/android-e2e/apks/current-debug.apk}"
RESULT_ROOT="${RESULT_ROOT:-artifacts/android-e2e/results}"
FIXTURE_ROOT="${FIXTURE_ROOT:-artifacts/android-e2e/fixtures}"
ONBOARD_READY_TEXT="Language"

mkdir -p "$RESULT_ROOT" "$FIXTURE_ROOT"

capture_failure() {
  mkdir -p "$RESULT_ROOT/failure"
  adb exec-out screencap -p > "$RESULT_ROOT/failure/device.png" 2>/dev/null || true
  adb shell dumpsys activity activities > "$RESULT_ROOT/failure/activity.txt" 2>/dev/null || true
  adb shell uiautomator dump /sdcard/wp32-window.xml >/dev/null 2>&1 || true
  adb exec-out cat /sdcard/wp32-window.xml > "$RESULT_ROOT/failure/window.xml" 2>/dev/null || true
  timeout 120 node scripts/wp32-inspect-webview.mjs "$RESULT_ROOT/failure/webview" || true
  adb logcat -d -t 4000 \
    | grep -E "SpendWise|com\\.spendwise\\.app|Capacitor|AppPlugin|ActivityTaskManager|AndroidRuntime|FATAL EXCEPTION|chromium" \
    > "$RESULT_ROOT/failure/logcat.txt" || true
}

cleanup() {
  adb shell cmd connectivity airplane-mode disable >/dev/null 2>&1 || true
  adb shell settings delete global hide_error_dialogs >/dev/null 2>&1 || true
}

on_exit() {
  local rc=$?
  trap - EXIT
  if [ "$rc" -ne 0 ]; then capture_failure; fi
  cleanup
  exit "$rc"
}
trap on_exit EXIT

app_is_foreground() {
  local resumed
  resumed="$(adb shell dumpsys activity activities 2>/dev/null | grep -m 1 -E "mResumedActivity|topResumedActivity" || true)"
  [[ "$resumed" == *"$APP_ID"* ]]
}

wait_for_accessible_text() {
  local needle="$1"
  local attempts="${2:-60}"
  local attempt
  local stable_hits=0

  for attempt in $(seq 1 "$attempts"); do
    if ! app_is_foreground; then
      adb shell am start -n "$APP_ACTIVITY" >/dev/null 2>&1 || true
    fi
    if adb shell uiautomator dump /sdcard/wp32-window.xml >/dev/null 2>&1 \
      && adb shell grep -Fq "$needle" /sdcard/wp32-window.xml 2>/dev/null; then
      stable_hits=$((stable_hits + 1))
      if [ "$stable_hits" -ge 2 ]; then return 0; fi
    else
      stable_hits=0
    fi
    sleep 2
  done

  echo "::error::SpendWise never exposed '$needle' through Android accessibility."
  return 1
}

start_app_expect() {
  local needle="$1"
  adb shell am start -W -n "$APP_ACTIVITY" >/dev/null
  wait_for_accessible_text "$needle"
}

reset_app_expect() {
  local needle="$1"
  adb shell pm clear "$APP_ID" >/dev/null
  start_app_expect "$needle"
}

run_flow() {
  local name="$1"
  local flow="$2"
  local out="$RESULT_ROOT/$name"
  mkdir -p "$out"
  maestro test \
    --config=.maestro/config.yaml \
    --format=junit \
    --output="$out/report.xml" \
    --test-output-dir="$out/artifacts" \
    --debug-output="$out/debug" \
    "$flow"
}

dismiss_share_sheet() {
  if ! app_is_foreground; then
    adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || true
  fi
  adb shell am start -n "$APP_ACTIVITY" >/dev/null 2>&1 || true
}

extract_backup_prefix() {
  local prefix="$1"
  local target="$2"
  local cache_file=""
  local attempt

  for attempt in {1..30}; do
    cache_file="$(
      adb shell run-as "$APP_ID" find cache -type f 2>/dev/null \
        | tr -d '\r' \
        | grep -F "/$prefix" \
        | grep -F ".swb3" \
        | sort \
        | tail -n 1
    )"
    if [ -n "$cache_file" ]; then
      adb exec-out run-as "$APP_ID" cat "$cache_file" > "$target"
      if [ -s "$target" ]; then
        echo "Extracted $cache_file -> $target ($(wc -c < "$target") bytes)"
        return 0
      fi
    fi
    sleep 1
  done

  echo "::error::Expected exported backup prefix $prefix was not found in app cache."
  return 1
}

verify_swb3() {
  local file="$1"
  local expected_media="$2"
  python3 - "$file" "$expected_media" <<'PY'
import json
import struct
import sys

path = sys.argv[1]
expected = sys.argv[2].lower() == "true"
raw = open(path, "rb").read()
if len(raw) < 25 or raw[:4] != b"SWB3" or raw[4] != 3:
    raise SystemExit(f"{path}: invalid SWB3 magic/version")
header_len = struct.unpack(">I", raw[5:9])[0]
if header_len <= 0 or 9 + header_len + 16 > len(raw):
    raise SystemExit(f"{path}: invalid SWB3 header length")
header = json.loads(raw[9:9 + header_len].decode("utf-8"))
actual = header.get("payload", {}).get("mediaIncluded")
if actual is not expected:
    raise SystemExit(f"{path}: mediaIncluded={actual!r}, expected {expected!r}")
print(f"Verified {path}: mediaIncluded={actual}, envelopeBytes={len(raw)}")
PY
}

push_download() {
  local source="$1"
  local target_name="$2"
  adb shell mkdir -p /sdcard/Download
  adb push "$source" "/sdcard/Download/$target_name" >/dev/null
  adb shell am broadcast \
    -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
    -d "file:///sdcard/Download/$target_name" >/dev/null || true
}

echo "== Targeted WP32 backup/restore preparation =="
adb wait-for-device
adb shell settings put system screen_off_timeout 2147483647 || true
adb shell svc power stayon true || true
adb shell cmd connectivity airplane-mode disable >/dev/null 2>&1 || true
adb shell settings put global hide_error_dialogs 1 || true
adb shell input keyevent KEYCODE_HOME >/dev/null 2>&1 || true

for attempt in {1..15}; do
  if adb shell uiautomator dump /sdcard/wp32-window.xml >/dev/null 2>&1; then break; fi
  if [ "$attempt" -eq 15 ]; then
    echo "::error::Android UI automation did not become ready after cold boot."
    exit 1
  fi
  sleep 2
done

adb uninstall "$APP_ID" >/dev/null 2>&1 || true
adb install "$NEW_APK" >/dev/null
reset_app_expect "$ONBOARD_READY_TEXT"

echo "== Empty Home navigation accessibility regression =="
run_flow empty-navigation .maestro/current/empty-navigation.yaml
reset_app_expect "$ONBOARD_READY_TEXT"

echo "== Nearest safe prerequisite: representative media state =="
run_flow media .maestro/current/media.yaml

echo "== Target: Backup v3 export identity and full restore =="
run_flow export-v3-data .maestro/current/backup-export-data.yaml
extract_backup_prefix "spendwise_backup_v3_data_" "$FIXTURE_ROOT/wp32-data.swb3"
verify_swb3 "$FIXTURE_ROOT/wp32-data.swb3" false
dismiss_share_sheet

run_flow export-v3-full .maestro/current/backup-export-full.yaml
extract_backup_prefix "spendwise_backup_v3_full_" "$FIXTURE_ROOT/wp32-full.swb3"
verify_swb3 "$FIXTURE_ROOT/wp32-full.swb3" true
dismiss_share_sheet

data_bytes=$(wc -c < "$FIXTURE_ROOT/wp32-data.swb3")
full_bytes=$(wc -c < "$FIXTURE_ROOT/wp32-full.swb3")
if [ "$full_bytes" -le "$data_bytes" ]; then
  echo "::error::Full Backup v3 is not larger than data-only backup ($full_bytes <= $data_bytes)."
  exit 1
fi

push_download "$FIXTURE_ROOT/wp32-full.swb3" wp32-full.swb3
run_flow clear-before-v3-full .maestro/current/clear-financial-data.yaml
run_flow import-v3-full .maestro/current/import-v3-full.yaml

echo "WP32 targeted backup/restore reproduction completed successfully."
