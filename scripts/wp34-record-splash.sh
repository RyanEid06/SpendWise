#!/usr/bin/env bash
set -euo pipefail

# Emulator-only: record from BEFORE a cold launch. Never force-stop the owner's
# device and never clear app data. Run separately with Light and Dark selected.
OUT="${1:-artifacts/android-e2e/results/wp34-splash}"
SERIAL="${ANDROID_SERIAL:-$(adb get-serialno)}"
case "$SERIAL" in
  emulator-*) ;;
  *) echo 'Refusing to interrupt a non-emulator device.' >&2; exit 2 ;;
esac
[ "$(adb -s "$SERIAL" shell getprop ro.kernel.qemu | tr -d '\r')" = '1' ] || {
  echo 'Target is not a verified Android emulator.' >&2; exit 2;
}
mkdir -p "$OUT"
REMOTE='/sdcard/wp34-cold-launch.mp4'
adb -s "$SERIAL" shell am force-stop com.spendwise.app
adb -s "$SERIAL" shell rm -f "$REMOTE"
adb -s "$SERIAL" shell screenrecord --bit-rate 4000000 --time-limit 5 "$REMOTE" &
RECORDER=$!
sleep 1
adb -s "$SERIAL" shell am start -n com.spendwise.app/.MainActivity
wait "$RECORDER"
adb -s "$SERIAL" pull "$REMOTE" "$OUT/launch.mp4" >/dev/null
adb -s "$SERIAL" shell rm -f "$REMOTE"
if command -v ffmpeg >/dev/null 2>&1; then
  mkdir -p "$OUT/frames"
  ffmpeg -hide_banner -loglevel error -y -i "$OUT/launch.mp4" \
    -vf 'fps=20' "$OUT/frames/frame-%03d.png"
  ffmpeg -hide_banner -loglevel error -y -i "$OUT/launch.mp4" \
    -vf 'fps=10,scale=240:-1:flags=lanczos,tile=8x5' -frames:v 1 "$OUT/contact-sheet.png" || true
else
  echo 'ffmpeg unavailable; video captured, frame extraction pending.' >&2
fi
printf 'Startup evidence: %s\n' "$OUT"
