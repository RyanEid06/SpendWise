#!/usr/bin/env bash
# Sourced only after the isolated runner's disposable-emulator guard.
wp05_launch_unlock() {
  local phase="$1"
  adb shell am start -n "$APP_ACTIVITY" >/dev/null
  # Verify the app DOM remains redacted while Android authentication is pending.
  node scripts/wp33-5-05-native-probe.mjs locked "$RESULT_ROOT/$phase-locked.json"
  run_flow "$phase-unlock" .maestro/helpers/android-device-pin.yaml
}

wp05_kill_reopen() {
  local phase="$1" before after
  before="$(adb shell pidof "$APP_ID" | tr -d '\r')"
  [[ "$before" =~ ^[0-9]+$ ]]
  adb shell input keyevent KEYCODE_HOME
  adb shell am force-stop "$APP_ID"
  after="$(adb shell pidof "$APP_ID" | tr -d '\r' || true)"
  [[ -z "$after" ]]
  printf '{"phase":"%s","beforePid":%s,"afterKillPid":null,"method":"am force-stop"}\n' "$phase" "$before" > "$RESULT_ROOT/$phase-process-death.json"
  wp05_launch_unlock "$phase"
  after="$(adb shell pidof "$APP_ID" | tr -d '\r')"
  [[ "$after" =~ ^[0-9]+$ && "$after" != "$before" ]]
  echo "WP05_PROCESS_DEATH:$phase:$before->$after"
}

run_wp05_recovery() {
  install_current
  adb shell locksettings set-pin 2468 >/dev/null
  bootstrap_app_lock_timeout
  run_flow wp05-add .maestro/wp05/add.yaml
  node scripts/wp33-5-05-native-probe.mjs add "$RESULT_ROOT/add-fields.json"
  adb shell input keyevent KEYCODE_HOME
  sleep 2 # Wait for Android onStop; an immediate start can skip appStateChange(false).
  wp05_launch_unlock background
  run_flow wp05-background-fields .maestro/wp05/assert-add.yaml
  # Android's real "Don't keep activities" destroys the background Activity while
  # preserving the process. Record unchanged PID independently of force-stop tests.
  local activity_pid
  activity_pid="$(adb shell pidof "$APP_ID" | tr -d '\r')"
  adb shell settings put global always_finish_activities 1
  adb shell input keyevent KEYCODE_HOME
  sleep 2
  adb shell dumpsys activity activities > "$RESULT_ROOT/destroyed-activity.txt"
  adb shell settings put global always_finish_activities 0
  wp05_launch_unlock activity-recreation
  [[ "$(adb shell pidof "$APP_ID" | tr -d '\r')" = "$activity_pid" ]]
  run_flow wp05-recreated-activity .maestro/wp05/assert-add.yaml
  printf '{"pid":%s,"mechanism":"always_finish_activities","sameProcess":true}\n' "$activity_pid" > "$RESULT_ROOT/activity-recreation.json"
  wp05_kill_reopen partial-add
  run_flow wp05-recovered-fields .maestro/wp05/assert-add.yaml
  node scripts/wp33-5-05-native-probe.mjs add "$RESULT_ROOT/recovered-add-fields.json"
  run_flow wp05-picker-cancel .maestro/wp05/picker-cancel.yaml
  node scripts/wp33-5-05-native-probe.mjs add "$RESULT_ROOT/picker-cancel-fields.json"
  # Picker cancellation left Photos open; collapse before the attach fragment.
  run_flow wp05-collapse .maestro/wp05/collapse-photos.yaml
  run_flow wp05-attach .maestro/wp05/attach.yaml
  node scripts/wp33-5-05-native-probe.mjs photo "$RESULT_ROOT/attached-photo.json"
  python3 scripts/wp33-5-05-at-rest.py "$RESULT_ROOT/at-rest.json"
  wp05_kill_reopen attached-photo
  run_flow wp05-recovered-photo .maestro/wp05/assert-photo.yaml
  node scripts/wp33-5-05-native-probe.mjs photo "$RESULT_ROOT/recovered-photo.json"
  # A real reboot with durable photo recovery, not a browser reload.
  adb reboot
  adb wait-for-device
  for attempt in {1..60}; do
    [[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1 ]] && break
    sleep 2
  done
  [[ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1 ]]
  adb shell input keyevent KEYCODE_WAKEUP
  adb shell input swipe 500 1800 500 300
  adb shell input text 2468
  adb shell input keyevent KEYCODE_ENTER
  wp05_launch_unlock reboot-photo
  run_flow wp05-reboot-photo .maestro/wp05/assert-photo.yaml
  node scripts/wp33-5-05-native-probe.mjs photo "$RESULT_ROOT/reboot-photo.json"
  run_flow wp05-recovered-save .maestro/wp05/save.yaml
  wp05_kill_reopen recovered-save
  run_flow wp05-saved-once .maestro/wp05/assert-saved.yaml
  node scripts/wp33-5-05-native-probe.mjs saved "$RESULT_ROOT/saved-once.json"
  run_flow wp05-add-discard .maestro/wp05/add.yaml
  run_flow wp05-attach-discard .maestro/wp05/attach.yaml
  wp05_kill_reopen before-discard
  run_flow wp05-recover-discard-photo .maestro/wp05/assert-photo.yaml
  run_flow wp05-discard .maestro/wp05/discard.yaml
  wp05_kill_reopen recovered-discard
  node scripts/wp33-5-05-native-probe.mjs saved "$RESULT_ROOT/discarded-no-draft.json"
  run_flow wp05-edit .maestro/wp05/edit.yaml
  wp05_kill_reopen interrupted-edit
  run_flow wp05-recovered-edit-save .maestro/wp05/assert-edit-save.yaml
  wp05_kill_reopen edited-save
  node scripts/wp33-5-05-native-probe.mjs edited "$RESULT_ROOT/edited-once.json"
  echo "WP05_NATIVE_RECOVERY_PASSED"
}
