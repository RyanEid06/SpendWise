#!/usr/bin/env bash
set -euo pipefail

APP_ID="com.spendwise.app"
APP_ACTIVITY="$APP_ID/.MainActivity"
NEW_APK="${NEW_APK:-artifacts/android-e2e/apks/current-debug.apk}"
V14_APK="${V14_APK:-artifacts/android-e2e/apks/v14-debug.apk}"
RESULT_ROOT="${RESULT_ROOT:-artifacts/android-e2e/results}"
FIXTURE_ROOT="${FIXTURE_ROOT:-artifacts/android-e2e/fixtures}"

# The wizard's <h1> ("Set up SpendWise") is never exposed through Android
# accessibility: neither `uiautomator dump` nor Maestro's hierarchy contains it,
# even while it is plainly rendered (verified against capture_failure artifacts).
# The step heading "Language" is exposed by both, so it is the readiness gate.
# Keep this in sync with `.maestro/helpers/onboard-current.yaml`.
ONBOARD_READY_TEXT="Language"

mkdir -p "$RESULT_ROOT" "$FIXTURE_ROOT"

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
  adb shell locksettings clear --old 2468 >/dev/null 2>&1 || true
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
  resumed="$(
    adb shell dumpsys activity activities 2>/dev/null \
      | grep -m 1 -E "mResumedActivity|topResumedActivity" || true
  )"
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
      if [ "$stable_hits" -ge 2 ]; then
        return 0
      fi
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

extract_backup() {
  local glob="$1"
  local target="$2"
  local cache_file=""
  local candidate=""
  local attempt

  for attempt in {1..30}; do
    cache_file=""
    while IFS= read -r candidate; do
      candidate="${candidate//
push_download() {
  local source="$1"
  local target_name="$2"
  adb shell mkdir -p /sdcard/Download
  adb push "$source" "/sdcard/Download/$target_name" >/dev/null
  adb shell am broadcast \
    -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
    -d "file:///sdcard/Download/$target_name" >/dev/null || true
}

corrupt_one_secure_media_file() {
  local media_file
  media_file="$(
    adb shell run-as "$APP_ID" sh -c \
      "find files -type f | grep 'expense-attachments/secure' | sort | head -n 1" \
      | tr -d '\r'
  )"
  if [ -z "$media_file" ]; then
    echo "::error::No encrypted attachment file was found to corrupt."
    return 1
  fi
  adb shell run-as "$APP_ID" sh -c "printf 'WP32_CORRUPTED_CIPHERTEXT' > '$media_file'"
}

echo "== Device preparation =="
adb wait-for-device
adb shell settings put system screen_off_timeout 2147483647 || true
adb shell svc power stayon true || true
adb shell cmd connectivity airplane-mode disable >/dev/null 2>&1 || true

# Fresh hosted emulators can briefly ANR System UI after cold boot. Suppress only
# OS error dialogs on this disposable test device; app failures still fail the
# assertions and are captured in the failure bundle.
adb shell settings put global hide_error_dialogs 1 || true
adb shell input keyevent KEYCODE_HOME >/dev/null 2>&1 || true
for attempt in {1..15}; do
  if adb shell uiautomator dump /sdcard/wp32-window.xml >/dev/null 2>&1; then
    break
  fi
  if [ "$attempt" -eq 15 ]; then
    echo "::error::Android UI automation did not become ready after cold boot."
    exit 1
  fi
  sleep 2
done

adb uninstall "$APP_ID" >/dev/null 2>&1 || true
adb install "$NEW_APK" >/dev/null
reset_app_expect "$ONBOARD_READY_TEXT"

echo "== Fresh install, persistence, delete safety, network failure =="
run_flow fresh-persistence .maestro/current/fresh-persistence.yaml
run_flow delete-undo .maestro/current/delete-undo.yaml
run_flow delete-background .maestro/current/delete-background-verify.yaml
run_flow offline-ai .maestro/current/offline-ai.yaml

echo "== Media boundaries and restart durability =="
reset_app_expect "$ONBOARD_READY_TEXT"
run_flow media .maestro/current/media.yaml

echo "== Secure Backup v3 exports =="
run_flow export-v3-data .maestro/current/backup-export-data.yaml
extract_backup "spendwise_backup_v3_data_*.swb3" "$FIXTURE_ROOT/wp32-data.swb3"
dismiss_share_sheet

run_flow export-v3-full .maestro/current/backup-export-full.yaml
extract_backup "spendwise_backup_v3_full_*.swb3" "$FIXTURE_ROOT/wp32-full.swb3"
dismiss_share_sheet

push_download "$FIXTURE_ROOT/wp32-data.swb3" wp32-data.swb3
push_download "$FIXTURE_ROOT/wp32-full.swb3" wp32-full.swb3

echo "== Backup v3 disaster recovery and encrypted-media corruption =="
run_flow clear-before-v3-full .maestro/current/clear-financial-data.yaml
run_flow import-v3-full .maestro/current/import-v3-full.yaml
corrupt_one_secure_media_file
run_flow corrupt-encrypted-media .maestro/current/corrupt-media.yaml

run_flow clear-before-v3-data .maestro/current/clear-financial-data.yaml
run_flow import-v3-data .maestro/current/import-v3-data.yaml

echo "== Backward-compatible v1/v2 restore =="
push_download tests/fixtures/backup-v1.json wp32-v1.json
push_download "$FIXTURE_ROOT/wp32-v2-data.zip" wp32-v2-data.zip
push_download "$FIXTURE_ROOT/wp32-v2-full.zip" wp32-v2-full.zip

reset_app_expect "$ONBOARD_READY_TEXT"
run_flow import-v1 .maestro/current/import-v1.yaml
reset_app_expect "$ONBOARD_READY_TEXT"
run_flow import-v2-data .maestro/current/import-v2-data.yaml
reset_app_expect "$ONBOARD_READY_TEXT"
run_flow import-v2-full .maestro/current/import-v2-full.yaml

echo "== Native App Lock cancellation and retry =="
adb shell locksettings set-pin 2468 >/dev/null
reset_app_expect "$ONBOARD_READY_TEXT"
run_flow app-lock-setup .maestro/current/app-lock-setup-start.yaml
run_flow app-lock-setup-auth .maestro/helpers/android-device-pin.yaml
run_flow app-lock-timeout .maestro/current/app-lock-configure-timeout.yaml
run_flow app-lock-cancel-retry .maestro/current/app-lock-background-cancel-retry.yaml

echo "== v1.4 in-place upgrade migration =="
adb uninstall "$APP_ID" >/dev/null
adb install "$V14_APK" >/dev/null
start_app_expect "$ONBOARD_READY_TEXT"
run_flow v14-seed .maestro/migration/v14-seed.yaml
adb install -r "$NEW_APK" >/dev/null
start_app_expect "SpendWise is Locked"
run_flow hardened-upgrade .maestro/migration/hardened-verify.yaml

echo "WP32 Android E2E completed successfully."
\\r'/}"
      if [[ "${candidate##*/}" == $glob ]]; then
        cache_file="$candidate"
      fi
    done < <(adb shell run-as "$APP_ID" find cache -type f 2>/dev/null | sort)

    if [ -n "$cache_file" ]; then
      adb exec-out run-as "$APP_ID" cat "$cache_file" > "$target"
      if [ -s "$target" ]; then
        return 0
      fi
    fi

    sleep 1
  done

  echo "::error::Expected exported backup matching $glob was not found in app cache."
  return 1
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

corrupt_one_secure_media_file() {
  local media_file
  media_file="$(
    adb shell run-as "$APP_ID" sh -c \
      "find files -type f | grep 'expense-attachments/secure' | sort | head -n 1" \
      | tr -d '\r'
  )"
  if [ -z "$media_file" ]; then
    echo "::error::No encrypted attachment file was found to corrupt."
    return 1
  fi
  adb shell run-as "$APP_ID" sh -c "printf 'WP32_CORRUPTED_CIPHERTEXT' > '$media_file'"
}

echo "== Device preparation =="
adb wait-for-device
adb shell settings put system screen_off_timeout 2147483647 || true
adb shell svc power stayon true || true
adb shell cmd connectivity airplane-mode disable >/dev/null 2>&1 || true

# Fresh hosted emulators can briefly ANR System UI after cold boot. Suppress only
# OS error dialogs on this disposable test device; app failures still fail the
# assertions and are captured in the failure bundle.
adb shell settings put global hide_error_dialogs 1 || true
adb shell input keyevent KEYCODE_HOME >/dev/null 2>&1 || true
for attempt in {1..15}; do
  if adb shell uiautomator dump /sdcard/wp32-window.xml >/dev/null 2>&1; then
    break
  fi
  if [ "$attempt" -eq 15 ]; then
    echo "::error::Android UI automation did not become ready after cold boot."
    exit 1
  fi
  sleep 2
done

adb uninstall "$APP_ID" >/dev/null 2>&1 || true
adb install "$NEW_APK" >/dev/null
reset_app_expect "$ONBOARD_READY_TEXT"

echo "== Fresh install, persistence, delete safety, network failure =="
run_flow fresh-persistence .maestro/current/fresh-persistence.yaml
run_flow delete-undo .maestro/current/delete-undo.yaml
run_flow delete-background .maestro/current/delete-background-verify.yaml
run_flow offline-ai .maestro/current/offline-ai.yaml

echo "== Media boundaries and restart durability =="
reset_app_expect "$ONBOARD_READY_TEXT"
run_flow media .maestro/current/media.yaml

echo "== Secure Backup v3 exports =="
run_flow export-v3-data .maestro/current/backup-export-data.yaml
extract_backup "spendwise_backup_v3_data_*.swb3" "$FIXTURE_ROOT/wp32-data.swb3"
dismiss_share_sheet

run_flow export-v3-full .maestro/current/backup-export-full.yaml
extract_backup "spendwise_backup_v3_full_*.swb3" "$FIXTURE_ROOT/wp32-full.swb3"
dismiss_share_sheet

push_download "$FIXTURE_ROOT/wp32-data.swb3" wp32-data.swb3
push_download "$FIXTURE_ROOT/wp32-full.swb3" wp32-full.swb3

echo "== Backup v3 disaster recovery and encrypted-media corruption =="
run_flow clear-before-v3-full .maestro/current/clear-financial-data.yaml
run_flow import-v3-full .maestro/current/import-v3-full.yaml
corrupt_one_secure_media_file
run_flow corrupt-encrypted-media .maestro/current/corrupt-media.yaml

run_flow clear-before-v3-data .maestro/current/clear-financial-data.yaml
run_flow import-v3-data .maestro/current/import-v3-data.yaml

echo "== Backward-compatible v1/v2 restore =="
push_download tests/fixtures/backup-v1.json wp32-v1.json
push_download "$FIXTURE_ROOT/wp32-v2-data.zip" wp32-v2-data.zip
push_download "$FIXTURE_ROOT/wp32-v2-full.zip" wp32-v2-full.zip

reset_app_expect "$ONBOARD_READY_TEXT"
run_flow import-v1 .maestro/current/import-v1.yaml
reset_app_expect "$ONBOARD_READY_TEXT"
run_flow import-v2-data .maestro/current/import-v2-data.yaml
reset_app_expect "$ONBOARD_READY_TEXT"
run_flow import-v2-full .maestro/current/import-v2-full.yaml

echo "== Native App Lock cancellation and retry =="
adb shell locksettings set-pin 2468 >/dev/null
reset_app_expect "$ONBOARD_READY_TEXT"
run_flow app-lock-setup .maestro/current/app-lock-setup-start.yaml
run_flow app-lock-setup-auth .maestro/helpers/android-device-pin.yaml
run_flow app-lock-timeout .maestro/current/app-lock-configure-timeout.yaml
run_flow app-lock-cancel-retry .maestro/current/app-lock-background-cancel-retry.yaml

echo "== v1.4 in-place upgrade migration =="
adb uninstall "$APP_ID" >/dev/null
adb install "$V14_APK" >/dev/null
start_app_expect "$ONBOARD_READY_TEXT"
run_flow v14-seed .maestro/migration/v14-seed.yaml
adb install -r "$NEW_APK" >/dev/null
start_app_expect "SpendWise is Locked"
run_flow hardened-upgrade .maestro/migration/hardened-verify.yaml

echo "WP32 Android E2E completed successfully."
