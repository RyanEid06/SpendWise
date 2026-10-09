#!/usr/bin/env bash
set -uo pipefail

repo_root="$(pwd)"
result_root="${WP36_ARTIFACT_ROOT:-artifacts/android-fileprovider-api36}"
if [[ "$result_root" != /* ]]; then result_root="$repo_root/$result_root"; fi
mkdir -p "$result_root"
validated_target=0
test_status=1

fail() {
  printf '%s\n' "$*" | tee "$result_root/gate-error.txt" >&2
  exit 1
}

capture_evidence() {
  local status="$1"
  printf '{"testExitCode":%s,"targetValidated":%s,"debugInstrumentationOnly":true}\n' \
    "$status" "$validated_target" > "$result_root/run-receipt.json"

  if [[ "$validated_target" == 1 ]]; then
    adb -s "$ANDROID_SERIAL" logcat -d -t 12000 > "$result_root/logcat.txt" 2>&1 || true
    adb -s "$ANDROID_SERIAL" shell dumpsys activity activities > "$result_root/activities.txt" 2>&1 || true
    adb -s "$ANDROID_SERIAL" shell dumpsys package com.spendwise.app > "$result_root/package.txt" 2>&1 || true
    adb -s "$ANDROID_SERIAL" shell getprop > "$result_root/getprop.txt" 2>&1 || true
  fi

  local outputs="$repo_root/android/app/build/outputs/androidTest-results/connected/debug"
  local reports="$repo_root/android/app/build/reports/androidTests/connected/debug"
  if [[ -d "$outputs" ]]; then
    mkdir -p "$result_root/test-results"
    cp -R "$outputs"/. "$result_root/test-results/" || true
    find "$outputs" -type f -name 'TEST-*.xml' -print > "$result_root/test-results/xml-files.txt" || true
  fi
  if [[ -d "$reports" ]]; then
    mkdir -p "$result_root/test-reports"
    cp -R "$reports"/. "$result_root/test-reports/" || true
  fi
}

finish() {
  local status=$?
  trap - EXIT
  capture_evidence "$status"
  exit "$status"
}
trap finish EXIT

[[ "${WP36_ALLOW_EMULATOR_MUTATION:-}" == "1" ]] || fail "Refusing instrumentation install without WP36_ALLOW_EMULATOR_MUTATION=1."
[[ "${WP36_EXPECTED_AVD:-}" == "wp33-fileprovider-api36" ]] || fail "Unexpected instrumentation AVD; expected wp33-fileprovider-api36."
[[ "${ANDROID_SERIAL:-}" == emulator-* ]] || fail "Refusing instrumentation on a non-emulator serial."

ready_devices="$(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')"
[[ "$ready_devices" == "$ANDROID_SERIAL" ]] || fail "Expected only the guarded emulator to be connected; got: ${ready_devices:-none}."
[[ "$(adb -s "$ANDROID_SERIAL" get-state 2>/dev/null)" == "device" ]] || fail "Guarded emulator is not ready."
[[ "$(adb -s "$ANDROID_SERIAL" shell getprop ro.kernel.qemu | tr -d '\r')" == "1" ]] || fail "Target is not a synthetic QEMU emulator."
[[ "$(adb -s "$ANDROID_SERIAL" shell getprop ro.build.version.sdk | tr -d '\r')" == "36" ]] || fail "FileProvider instrumentation requires API36."
avd_name="$(adb -s "$ANDROID_SERIAL" emu avd name 2>/dev/null | sed -n '1p' | tr -d '\r')"
[[ "$avd_name" == "wp33-fileprovider-api36" ]] || fail "Unexpected emulator AVD: ${avd_name:-unknown}."
validated_target=1

{
  printf 'serial=%s\n' "$ANDROID_SERIAL"
  printf 'avd=%s\n' "$avd_name"
  printf 'api=%s\n' "$(adb -s "$ANDROID_SERIAL" shell getprop ro.build.version.sdk | tr -d '\r')"
  printf 'fingerprint=%s\n' "$(adb -s "$ANDROID_SERIAL" shell getprop ro.build.fingerprint | tr -d '\r')"
  printf 'boot_id=%s\n' "$(adb -s "$ANDROID_SERIAL" shell cat /proc/sys/kernel/random/boot_id | tr -d '\r')"
} > "$result_root/target.txt"

cd android || fail "Could not enter Android Gradle project."
rm -rf app/build/outputs/androidTest-results/connected/debug app/build/reports/androidTests/connected/debug
if ./gradlew --no-daemon :app:connectedDebugAndroidTest; then
  test_status=0
else
  test_status=$?
fi
exit "$test_status"
