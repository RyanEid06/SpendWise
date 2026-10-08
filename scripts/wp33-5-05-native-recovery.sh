#!/usr/bin/env bash
# Sourced only after the isolated runner's disposable-emulator guard.
wp05_launch_unlock() {
  local phase="$1"
  shift
  adb shell am start "$@" -n "$APP_ACTIVITY" >/dev/null
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
  printf '{"phase":"%s","beforePid":%s,"afterKillPid":null,"restartedPid":%s,"method":"am force-stop"}\n' "$phase" "$before" "$after" > "$RESULT_ROOT/$phase-process-death.json"
  echo "WP05_PROCESS_DEATH:$phase:$before->$after"
}

run_wp05_recovery() {
  node scripts/wp33-5-05-photo-fixture.mjs
  install_current
  adb shell locksettings set-pin 2468 >/dev/null
  bootstrap_app_lock_timeout
  run_flow wp05-add .maestro/wp05/add.yaml
  node scripts/wp33-5-05-native-probe.mjs add "$RESULT_ROOT/add-fields.json"
  # Prove inventory access before spending time on lifecycle/picker phases;
  # repeat the full audit with an acquired photo and after terminal operations.
  python3 scripts/wp33-5-05-at-rest.py "$RESULT_ROOT/before-photo-at-rest.json"
  adb shell input keyevent KEYCODE_HOME
  sleep 2 # Wait for Android onStop; an immediate start can skip appStateChange(false).
  wp05_launch_unlock background
  run_flow wp05-background-fields .maestro/wp05/assert-add.yaml
  # Replace the task's Activity through Android while preserving the process.
  # Setting always_finish_activities alone left the observed Activity STOPPED;
  # assert actual ActivityRecord replacement as well as unchanged process ID.
  local activity_pid
  activity_pid="$(adb shell pidof "$APP_ID" | tr -d '\r')"
  adb shell dumpsys activity activities > "$RESULT_ROOT/before-activity-recreation.txt"
  adb shell input keyevent KEYCODE_HOME
  sleep 2
  # am has no --activity-new-task switch on API 34. -f supplies the documented
  # FLAG_ACTIVITY_NEW_TASK (0x10000000) | FLAG_ACTIVITY_CLEAR_TASK (0x8000).
  wp05_launch_unlock activity-recreation -f 0x10008000
  [[ "$(adb shell pidof "$APP_ID" | tr -d '\r')" = "$activity_pid" ]]
  run_flow wp05-recreated-activity .maestro/wp05/assert-add.yaml
  adb shell dumpsys activity activities > "$RESULT_ROOT/after-activity-recreation.txt"
  node --input-type=module - "$RESULT_ROOT" "$activity_pid" <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const [root, pid] = process.argv.slice(2);
const records = phase => [...new Set([...readFileSync(`${root}/${phase}-activity-recreation.txt`, 'utf8')
  .matchAll(/ActivityRecord\{([a-f0-9]+) [^\n}]*com\.spendwise\.app\/[^\n}]*MainActivity[^\n}]*\}/g)].map(match => match[1]))];
const before = records('before'), after = records('after');
assert.ok(before.length && after.length, 'Observe both old and replacement native Activities');
assert.ok(before.every(record => !after.includes(record)), 'Old Activity must actually be destroyed/replaced');
writeFileSync(`${root}/activity-recreation.json`, JSON.stringify({ pid: Number(pid), mechanism: 'am start -f 0x10008000 (NEW_TASK | CLEAR_TASK)', sameProcess: true, before, after }, null, 2));
console.log('WP05_ACTIVITY_RECREATION_PASSED');
NODE
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
  local before_boot after_boot
  before_boot="$(adb shell cat /proc/sys/kernel/random/boot_id | tr -d '\r')"
  [[ "$before_boot" =~ ^[a-f0-9-]{36}$ ]]
  adb reboot
  adb wait-for-device
  for attempt in {1..60}; do
    after_boot="$(adb shell cat /proc/sys/kernel/random/boot_id 2>/dev/null | tr -d '\r' || true)"
    if [[ "$after_boot" =~ ^[a-f0-9-]{36}$ && "$after_boot" != "$before_boot" && "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1 ]]; then break; fi
    sleep 2
  done
  [[ "$after_boot" =~ ^[a-f0-9-]{36}$ && "$after_boot" != "$before_boot" && "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1 ]]
  printf '{"beforeBootId":"%s","afterBootId":"%s","completed":true}\n' "$before_boot" "$after_boot" > "$RESULT_ROOT/reboot.json"
  echo "WP05_ACTUAL_REBOOT_PASSED"
  adb shell input keyevent KEYCODE_WAKEUP
  adb shell input swipe 500 1800 500 300
  python3 scripts/wp33-5-05-keyguard.py "$RESULT_ROOT"
  wp05_launch_unlock reboot-photo
  run_flow wp05-reboot-photo .maestro/wp05/assert-photo.yaml
  node scripts/wp33-5-05-native-probe.mjs photo "$RESULT_ROOT/reboot-photo.json"
  run_flow wp05-recovered-save .maestro/wp05/save.yaml
  wp05_kill_reopen recovered-save
  run_flow wp05-saved-once .maestro/wp05/assert-saved.yaml
  node scripts/wp33-5-05-native-probe.mjs viewer "$RESULT_ROOT/saved-photo-decoded.json"
  run_flow wp05-close-saved-photo .maestro/wp05/close-saved-photo.yaml
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
  run_flow wp05-edited-photo .maestro/wp05/assert-edited-photo.yaml
  node scripts/wp33-5-05-native-probe.mjs viewer "$RESULT_ROOT/edited-photo-decoded.json"
  run_flow wp05-close-edited-photo .maestro/wp05/close-saved-photo.yaml
  python3 scripts/wp33-5-05-at-rest.py "$RESULT_ROOT/after-terminal-at-rest.json"
  echo "WP05_NATIVE_RECOVERY_PASSED"
}
