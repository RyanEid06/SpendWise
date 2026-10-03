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
  local found=0 media_file media_paths injected
  # Finish enumeration before opening another adb session. Bound both the
  # remote operation and a stuck adb transport; no stdin/tee stream is needed.
  if ! media_paths="$(timeout --kill-after=2s 15s adb shell run-as "$APP_ID" find files -type f)"; then
    echo "::error::Could not enumerate encrypted fixture attachments."
    return 1
  fi
  while IFS= read -r media_file; do
    media_file="${media_file//$'\r'/}"
    [[ "$media_file" == files/expense-attachments/secure/* ]] || continue
    # Secure attachment names are generated IDs. Reject shell metacharacters
    # before the remote shell interprets the overwrite command.
    if [[ ! "$media_file" =~ ^[a-zA-Z0-9._/-]+$ ]]; then
      echo "::error::Unsafe encrypted fixture path: $media_file"
      return 1
    fi
    if ! timeout --kill-after=2s 15s adb shell run-as "$APP_ID" sh -c \
      "'printf WP32_CORRUPTED_CIPHERTEXT > \"$media_file\"'" </dev/null; then
      echo "::error::Could not corrupt encrypted fixture: $media_file"
      return 1
    fi
    if ! injected="$(timeout --kill-after=2s 15s adb exec-out run-as "$APP_ID" cat "$media_file")" \
      || [[ "$injected" != WP32_CORRUPTED_CIPHERTEXT ]]; then
      echo "::error::Encrypted fixture corruption was not verified: $media_file"
      return 1
    fi
    found=$((found + 1))
  done <<< "$media_paths"
  if [ "$found" -eq 0 ]; then
    echo "::error::No encrypted attachment file was found to corrupt."
    return 1
  fi
  echo "Corrupted $found encrypted fixture attachments."
}
