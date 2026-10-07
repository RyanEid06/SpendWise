#!/usr/bin/env bash
set -euo pipefail

APP_ID="com.spendwise.app"
APP_ACTIVITY="$APP_ID/.MainActivity"
NEW_APK="${NEW_APK:-artifacts/android-e2e/apks/current-debug.apk}"
RESULT_ROOT="${RESULT_ROOT:-artifacts/android-e2e/results}"
FIXTURE_ROOT="${FIXTURE_ROOT:-artifacts/android-e2e/fixtures}"

mkdir -p "$RESULT_ROOT" "$FIXTURE_ROOT"
source scripts/wp32-android-helpers.sh

capture_failure() {
  mkdir -p "$RESULT_ROOT/failure"
  adb exec-out screencap -p > "$RESULT_ROOT/failure/device.png" 2>/dev/null || true
  adb shell dumpsys activity activities > "$RESULT_ROOT/failure/activity.txt" 2>/dev/null || true
  adb shell uiautomator dump /sdcard/wp32-window.xml >/dev/null 2>&1 || true
  adb exec-out cat /sdcard/wp32-window.xml > "$RESULT_ROOT/failure/window.xml" 2>/dev/null || true
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

# Maestro attaches its accessibility service before creating the WebView.
# Host-side launch/uiautomator readiness probes hand an already-running WebView
# between accessibility clients and can leave Maestro with a partial tree.
reset_app() {
  adb shell pm clear "$APP_ID" >/dev/null
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
reset_app

echo "== Empty Home navigation accessibility regression =="
run_flow empty-navigation .maestro/current/empty-navigation.yaml
reset_app

echo "== Nearest safe prerequisite: representative media state =="
run_flow media .maestro/current/media.yaml

echo "== Target: Backup v3 export identity and full restore =="
run_flow export-v3-data .maestro/current/backup-export-data.yaml
extract_backup_prefix "spendwise_encrypted_backup_data_" "$FIXTURE_ROOT/wp32-data.swb3"
verify_swb3 "$FIXTURE_ROOT/wp32-data.swb3" false
dismiss_share_sheet

run_flow export-v3-full .maestro/current/backup-export-full.yaml
extract_backup_prefix "spendwise_encrypted_backup_full_" "$FIXTURE_ROOT/wp32-full.swb3"
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
