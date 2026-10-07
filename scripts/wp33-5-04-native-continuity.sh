#!/usr/bin/env bash
# Called only by the existing disposable-emulator acceptance runners.
restore_wp04_ime_setting() {
  if [[ -n "${WP04_PREVIOUS_IME:-}" ]]; then
    if [[ "$WP04_PREVIOUS_IME" = null ]]; then
      adb shell settings delete secure show_ime_with_hard_keyboard >/dev/null
    else
      adb shell settings put secure show_ime_with_hard_keyboard "$WP04_PREVIOUS_IME" >/dev/null
    fi
    WP04_PREVIOUS_IME=""
  fi
}

require_wp04_soft_ime() {
  local phase="$1"
  local receipt="$RESULT_ROOT/wp04-ime-$phase"
  for attempt in {1..10}; do
    adb shell dumpsys input_method > "$receipt-input-method.txt"
    adb shell dumpsys window > "$receipt-window.txt"
    if app_is_foreground && grep -Eq 'mInputShown=true|mIsInputViewShown=true|type=ime.*visible=true' "$receipt-input-method.txt" "$receipt-window.txt"; then
      adb exec-out screencap -p > "$receipt.png"
      echo "WP04_SOFT_IME_VISIBLE:$phase"
      return 0
    fi
    sleep 1
  done
  echo "::error::WP04 soft IME was not visibly shown before $phase Save."
  return 1
}

run_wp04_continuity() {
  WP04_PREVIOUS_IME="$(adb shell settings get secure show_ime_with_hard_keyboard | tr -d '\r')"
  adb shell settings put secure show_ime_with_hard_keyboard 1 >/dev/null
  run_flow wp04-add-ime .maestro/current/wp33-5-04-expense-continuity.yaml
  require_wp04_soft_ime add || return 1
  run_flow wp04-save-edit-ime .maestro/current/wp33-5-04-save-and-edit.yaml
  require_wp04_soft_ime edit || return 1
  run_flow wp04-save-ai-continuity .maestro/current/wp33-5-04-save-and-ai.yaml
  restore_wp04_ime_setting
}
