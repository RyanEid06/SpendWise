"""Read-only encrypted-at-rest checks on synthetic native artifacts; no secrets logged."""
import hashlib
import base64
import json
from pathlib import Path
import subprocess
import sys

app = 'com.spendwise.app'


def inventory(output):
    roots = ['databases', 'files', 'shared_prefs', 'cache', 'app_webview', '/sdcard/Android/data/' + app + '/files', '/sdcard/Android/data/' + app + '/cache']
    listing = subprocess.run(['adb', 'shell', 'run-as', app, 'find', *roots, '-type', 'f'], capture_output=True, text=True, timeout=30)
    diagnostics = {'runAsReturnCode': listing.returncode, 'runAsErrors': listing.stderr.splitlines()}
    # Keep the exact denied paths in the artifact, even when the complete root
    # audit succeeds. Never silently omit an inaccessible directory.
    Path(output + '.inventory.json').write_text(json.dumps(diagnostics, indent=2), encoding='utf8')
    reader = ['adb', 'exec-out', 'run-as', app, 'cat']
    if 'Permission denied' in listing.stderr:
        # run-as has a restricted SELinux domain and cannot inventory scoped
        # external storage on API 34. Root only the disposable emulator's ADB
        # observer; do not change app permissions, lock, encryption or SELinux.
        qemu = subprocess.check_output(['adb', 'shell', 'getprop', 'ro.kernel.qemu'], text=True, timeout=15).strip()
        avd = subprocess.check_output(['adb', 'emu', 'avd', 'name'], text=True, timeout=15).splitlines()[0].strip()
        if qemu != '1' or not (avd == 'wp33-synthetic' or avd.startswith('wp33-synthetic-')):
            raise RuntimeError('Root at-rest observer requires the guarded disposable emulator')
        subprocess.run(['adb', 'root'], check=True, capture_output=True, timeout=30)
        subprocess.run(['adb', 'wait-for-device'], check=True, capture_output=True, timeout=30)
        uid = subprocess.check_output(['adb', 'shell', 'id', '-u'], text=True, timeout=15).strip()
        if uid != '0':
            raise RuntimeError('Private at-rest inventory requires a root-capable synthetic emulator')
        roots = ['/data/user/0/' + app, '/data/media/0/Android/data/' + app]
        listing = subprocess.run(['adb', 'shell', 'find', *roots, '-type', 'f'], capture_output=True, text=True, timeout=30)
        reader = ['adb', 'exec-out', 'cat']
        diagnostics.update({'rootObserver': True, 'rootReturnCode': listing.returncode, 'rootErrors': listing.stderr.splitlines()})
        Path(output + '.inventory.json').write_text(json.dumps(diagnostics, indent=2), encoding='utf8')
    # Absent optional cache/external directories are allowed; every other
    # filesystem error (including a denied root audit) fails closed.
    errors = [line for line in listing.stderr.splitlines() if line.strip()]
    if any('No such file or directory' not in line for line in errors) or (listing.returncode and not errors):
        raise RuntimeError('Private at-rest inventory is incomplete; see inventory diagnostic artifact')
    return roots, reader, listing.stdout.splitlines()


def audit(output):
    roots, reader, paths = inventory(output)
    return audit_paths(output, roots, reader, paths)


def audit_paths(output, roots, reader, paths):
    receipts = []
    databases = 0
    fixture_prefix = Path('artifacts/android-e2e/fixtures/wp05-private-photo.jpg').read_bytes()[:48]
    for path in paths:
        path = path.strip()
        if not path or not any(path.startswith(root + '/') for root in roots) or '..' in path:
            raise RuntimeError('Invalid private inventory path')
        raw = subprocess.check_output([*reader, path], timeout=30)
        if ('/databases/' in path or path.startswith('databases/')) and 'spendwise_secure_v1' in path and path.endswith('.db'):
            databases += 1
            if raw.startswith(b'SQLite format 3'):
                raise RuntimeError('SQLCipher database has a plaintext SQLite header')
        if b'WP05 Native Recovery' in raw or b'WP05 Native Edited' in raw:
            raise RuntimeError('Financial draft sentinel found in a plaintext private artifact: ' + path)
        if raw.startswith(b'\xff\xd8\xff') or raw.startswith(b'\x89PNG\r\n\x1a\n'):
            raise RuntimeError('Unencrypted acquired photo remains in private storage: ' + path)
        if fixture_prefix in raw or base64.b64encode(fixture_prefix) in raw:
            raise RuntimeError('Acquired photo bytes remain in a plaintext private/cache artifact: ' + path)
        receipts.append({'path': path, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    if databases != 1:
        raise RuntimeError('Expected exactly one encrypted SpendWise database')
    Path(output).write_text(json.dumps({'encryptedDatabaseCount': databases, 'plaintextDraftSentinels': 0, 'plaintextPhotoFiles': 0, 'artifacts': receipts}, indent=2), encoding='utf8')
    print('WP05_ENCRYPTED_AT_REST_PASSED')


if __name__ == '__main__':
    audit(sys.argv[1])
