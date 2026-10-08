"""Read-only encrypted-at-rest checks on synthetic native artifacts; no secrets logged."""
import hashlib
import json
import subprocess
import sys

app = 'com.spendwise.app'
roots = ['databases', 'files', 'shared_prefs', 'cache', 'app_webview', '/sdcard/Android/data/' + app + '/files', '/sdcard/Android/data/' + app + '/cache']
listing = subprocess.run(['adb', 'shell', 'run-as', app, 'find', *roots, '-type', 'f'], capture_output=True, text=True, timeout=30)
if 'Permission denied' in listing.stderr:
    raise RuntimeError('Private at-rest inventory is incomplete: access denied')
receipts = []
databases = 0
for path in listing.stdout.splitlines():
    path = path.strip()
    if not path or not any(path.startswith(root + '/') for root in roots) or '..' in path:
        raise RuntimeError('Invalid private inventory path')
    raw = subprocess.check_output(['adb', 'exec-out', 'run-as', app, 'cat', path], timeout=30)
    if path.startswith('databases/') and 'spendwise_secure_v1' in path and path.endswith('.db'):
        databases += 1
        if raw.startswith(b'SQLite format 3'):
            raise RuntimeError('SQLCipher database has a plaintext SQLite header')
    if b'WP05 Native Recovery' in raw or b'WP05 Native Edited' in raw:
        raise RuntimeError('Financial draft sentinel found in a plaintext private artifact: ' + path)
    if raw.startswith(b'\xff\xd8\xff') or raw.startswith(b'\x89PNG\r\n\x1a\n'):
        raise RuntimeError('Unencrypted acquired photo remains in private storage: ' + path)
    receipts.append({'path': path, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
if databases != 1:
    raise RuntimeError('Expected exactly one encrypted SpendWise database')
with open(sys.argv[1], 'w', encoding='utf8') as target:
    json.dump({'encryptedDatabaseCount': databases, 'plaintextDraftSentinels': 0, 'plaintextPhotoFiles': 0, 'artifacts': receipts}, target, indent=2)
print('WP05_ENCRYPTED_AT_REST_PASSED')
