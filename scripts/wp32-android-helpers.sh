#!/usr/bin/env bash
# Shared host-side operations. APP_ID is supplied by each Android test runner.

extract_backup_prefix() {
  local prefix="$1" target="$2" cache_file="" candidate attempt
  for attempt in {1..30}; do
    cache_file=""
    while IFS= read -r candidate; do
      candidate="${candidate//$'\r'/}"
      if [[ "$candidate" == cache/* && "${candidate##*/}" == "$prefix"*.swb3 ]]; then
        cache_file="$candidate"
      fi
    done < <(adb shell run-as "$APP_ID" find cache -type f | sort)
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

corrupt_secure_media_files() {
  local found=0 media_file
  while IFS= read -r media_file; do
    media_file="${media_file//$'\r'/}"
    [[ "$media_file" == files/expense-attachments/secure/* ]] || continue
    # Avoid adb's extra remote-shell parsing: tee receives both the path and
    # corruption bytes directly under the app's UID.
    printf 'WP32_CORRUPTED_CIPHERTEXT' | adb exec-out run-as "$APP_ID" tee "$media_file" >/dev/null
    found=$((found + 1))
  done < <(adb shell run-as "$APP_ID" find files -type f)
  if [ "$found" -eq 0 ]; then
    echo "::error::No encrypted attachment file was found to corrupt."
    return 1
  fi
  echo "Corrupted $found encrypted fixture attachments."
}
