#!/usr/bin/env bash
set -euo pipefail

TARGET="${WP32_TARGET:?WP32_TARGET is required}"
APP_ID="com.spendwise.app"
NEW_APK="${NEW_APK:-artifacts/android-e2e/apks/current-debug.apk}"
V14_APK="${V14_APK:-artifacts/android-e2e/apks/v14-debug.apk}"
RESULT_ROOT="${RESULT_ROOT:-artifacts/android-isolated/${TARGET}}"
FIXTURE_ROOT="${FIXTURE_ROOT:-artifacts/android-e2e/fixtures}"

mkdir -p "$RESULT_ROOT"
source scripts/wp32-android-helpers.sh

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

capture_failure() {
  mkdir -p "$RESULT_ROOT/failure"
  adb exec-out screencap -p > "$RESULT_ROOT/failure/device.png" 2>/dev/null || true
  adb shell dumpsys activity activities > "$RESULT_ROOT/failure/activity.txt" 2>/dev/null || true
  adb shell uiautomator dump /sdcard/wp32-window.xml >/dev/null 2>&1 || true
  adb exec-out cat /sdcard/wp32-window.xml > "$RESULT_ROOT/failure/window.xml" 2>/dev/null || true
  adb logcat -d -t 5000 \
    | grep -E "SpendWise|com\\.spendwise\\.app|Capacitor|AppPlugin|ActivityTaskManager|AndroidRuntime|FATAL EXCEPTION|chromium|google.android.gms" \
    > "$RESULT_ROOT/failure/logcat.txt" || true
  if [ "${WP32_INSPECT_WEBVIEW:-0}" = 1 ]; then
    node scripts/wp32-inspect-webview.mjs "$RESULT_ROOT/failure/webview" || true
  fi
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

reset_app() {
  adb shell pm clear "$APP_ID" >/dev/null
}

install_current() {
  adb uninstall "$APP_ID" >/dev/null 2>&1 || true
  adb install "$NEW_APK" >/dev/null
  reset_app
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

prepare_device() {
  adb wait-for-device
  adb shell settings put system screen_off_timeout 2147483647 || true
  adb shell svc power stayon true || true
  adb shell cmd connectivity airplane-mode disable >/dev/null 2>&1 || true
  adb shell settings put global hide_error_dialogs 1 || true
  adb shell input keyevent KEYCODE_HOME >/dev/null 2>&1 || true
  for attempt in {1..15}; do
    if adb shell uiautomator dump /sdcard/wp32-window.xml >/dev/null 2>&1; then return 0; fi
    if [ "$attempt" -eq 15 ]; then
      echo "::error::Android UI automation did not become ready after cold boot."
      exit 1
    fi
    sleep 2
  done
}

bootstrap_onboard_current() {
  run_flow bootstrap-onboard .maestro/diagnostic/onboard-current-only.yaml
}

bootstrap_v3_full_restore() {
  push_download "$FIXTURE_ROOT/wp32-full.swb3" wp32-full.swb3
  run_flow bootstrap-v3-full .maestro/diagnostic/restore-v3-full-bootstrap.yaml
}

bootstrap_app_lock() {
  run_flow bootstrap-app-lock-setup .maestro/current/app-lock-setup-start.yaml
  run_flow bootstrap-app-lock-auth .maestro/helpers/android-device-pin.yaml
}

bootstrap_app_lock_timeout() {
  bootstrap_app_lock
  run_flow bootstrap-app-lock-timeout .maestro/current/app-lock-configure-timeout.yaml
}

prepare_device
echo "== WP32 isolated target: $TARGET =="

case "$TARGET" in
  import-v3-full)
    install_current
    bootstrap_onboard_current
    push_download "$FIXTURE_ROOT/wp32-full.swb3" wp32-full.swb3
    run_flow target-import-v3-full .maestro/current/import-v3-full.yaml
    ;;
  corrupt-encrypted-media)
    install_current
    bootstrap_onboard_current
    bootstrap_v3_full_restore
    corrupt_secure_media_files
    run_flow target-corrupt-encrypted-media .maestro/current/corrupt-media.yaml
    ;;
  clear-before-v3-data)
    install_current
    bootstrap_onboard_current
    bootstrap_v3_full_restore
    run_flow target-clear-before-v3-data .maestro/current/clear-financial-data.yaml
    ;;
  import-v3-data)
    install_current
    bootstrap_onboard_current
    push_download "$FIXTURE_ROOT/wp32-data.swb3" wp32-data.swb3
    run_flow target-import-v3-data .maestro/current/import-v3-data.yaml
    ;;
  import-v1)
    install_current
    push_download "$FIXTURE_ROOT/wp32-v1.json" wp32-v1.json
    run_flow target-import-v1 .maestro/current/import-v1.yaml
    ;;
  import-v2-data)
    install_current
    push_download "$FIXTURE_ROOT/wp32-v2-data.zip" wp32-v2-data.zip
    run_flow target-import-v2-data .maestro/current/import-v2-data.yaml
    ;;
  import-v2-full)
    install_current
    push_download "$FIXTURE_ROOT/wp32-v2-full.zip" wp32-v2-full.zip
    run_flow target-import-v2-full .maestro/current/import-v2-full.yaml
    ;;
  app-lock-setup)
    install_current
    adb shell locksettings set-pin 2468 >/dev/null
    run_flow target-app-lock-setup .maestro/current/app-lock-setup-start.yaml
    ;;
  app-lock-setup-auth)
    install_current
    adb shell locksettings set-pin 2468 >/dev/null
    run_flow bootstrap-app-lock-setup .maestro/current/app-lock-setup-start.yaml
    run_flow target-app-lock-setup-auth .maestro/helpers/android-device-pin.yaml
    ;;
  app-lock-timeout)
    install_current
    adb shell locksettings set-pin 2468 >/dev/null
    bootstrap_app_lock
    run_flow target-app-lock-timeout .maestro/current/app-lock-configure-timeout.yaml
    ;;
  app-lock-cancel-retry)
    install_current
    adb shell locksettings set-pin 2468 >/dev/null
    bootstrap_app_lock_timeout
    run_flow target-app-lock-cancel-retry .maestro/current/app-lock-background-cancel-retry.yaml
    ;;
  v14-seed)
    adb uninstall "$APP_ID" >/dev/null 2>&1 || true
    adb install "$V14_APK" >/dev/null
    run_flow target-v14-seed .maestro/migration/v14-seed.yaml
    ;;
  hardened-upgrade)
    adb uninstall "$APP_ID" >/dev/null 2>&1 || true
    adb install "$V14_APK" >/dev/null
    run_flow bootstrap-v14-seed .maestro/migration/v14-seed.yaml
    # The legacy fixture uses its own PIN. Device credentials are needed only
    # by the hardened upgrade; configuring them first can obscure seed setup.
    adb shell locksettings set-pin 2468 >/dev/null
    adb install -r "$NEW_APK" >/dev/null
    adb shell am force-stop "$APP_ID"
    run_flow target-hardened-upgrade .maestro/migration/hardened-verify.yaml
    ;;
  *)
    echo "::error::Unknown WP32_TARGET: $TARGET"
    exit 2
    ;;
esac

echo "WP32 isolated target passed: $TARGET"
