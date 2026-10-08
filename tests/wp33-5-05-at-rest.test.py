"""Exercise denied scoped storage and fail-closed native inventory boundaries."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('at_rest', Path(__file__).parents[1] / 'scripts/wp33-5-05-at-rest.py')
scanner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scanner)
PRIVATE = '/data/user/0/com.spendwise.app'
EXTERNAL = '/data/media/0/Android/data/com.spendwise.app'
DB = PRIVATE + '/databases/spendwise_secure_v1SQLite.db'
PHOTO = EXTERNAL + '/cache/provider-copy'


class AtRestTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path.cwd(), prefix='wp05-at-rest-test-')
        self.addCleanup(self.temp.cleanup)
        self.output = str(Path(self.temp.name) / 'receipt.json')

    def run_command(self, args, **kwargs):
        if 'run-as' in args:
            return subprocess.CompletedProcess(args, 1, 'databases/spendwise_secure_v1SQLite.db\n', "find: /sdcard/Android/data/com.spendwise.app/cache: Permission denied\n")
        if 'find' in args:
            return subprocess.CompletedProcess(args, 0, DB + '\n' + PHOTO + '\n', '')
        return subprocess.CompletedProcess(args, 0, '', '')

    def read_command(self, args, **kwargs):
        if 'getprop' in args:
            return '1\n'
        if 'avd' in args:
            return 'wp33-synthetic-api34\nOK\n'
        if 'id' in args:
            return '0\n'
        return b'encrypted non-image bytes'

    @patch.object(scanner.subprocess, 'check_output')
    @patch.object(scanner.subprocess, 'run')
    def test_denied_scoped_storage_is_fully_scanned_as_root_with_diagnostics(self, run, read):
        run.side_effect = self.run_command
        read.side_effect = self.read_command
        with patch.object(scanner.Path, 'read_bytes', return_value=b'uniquely marked JPEG prefix'):
            scanner.audit(self.output)
        receipt = json.loads(Path(self.output).read_text())
        self.assertEqual(receipt['encryptedDatabaseCount'], 1)
        self.assertIn(PHOTO, [item['path'] for item in receipt['artifacts']])
        diagnostic = json.loads(Path(self.output + '.inventory.json').read_text())
        self.assertTrue(diagnostic['rootObserver'])
        self.assertIn('Permission denied', diagnostic['runAsErrors'][0])

    @patch.object(scanner.subprocess, 'check_output')
    @patch.object(scanner.subprocess, 'run')
    def test_never_roots_a_physical_device_or_other_emulator(self, run, read):
        run.side_effect = self.run_command
        for qemu, avd in [('0', 'wp33-synthetic-api34'), ('1', 'user-phone')]:
            read.side_effect = [qemu, avd]
            with self.assertRaisesRegex(RuntimeError, 'guarded disposable'):
                scanner.inventory(self.output)
        self.assertFalse(any(call.args[0] == ['adb', 'root'] for call in run.call_args_list))

    @patch.object(scanner.subprocess, 'check_output')
    @patch.object(scanner.subprocess, 'run')
    def test_root_inventory_denial_still_fails_closed(self, run, read):
        run.side_effect = lambda args, **kwargs: subprocess.CompletedProcess(args, 1, '', 'find: private: Permission denied') if 'find' in args else self.run_command(args, **kwargs)
        read.side_effect = self.read_command
        with self.assertRaisesRegex(RuntimeError, 'incomplete'):
            scanner.inventory(self.output)

    @patch.object(scanner.subprocess, 'run')
    def test_absent_optional_cache_does_not_hide_other_errors(self, run):
        run.return_value = subprocess.CompletedProcess([], 1, 'databases/db\n', 'find: cache: No such file or directory\n')
        self.assertEqual(scanner.inventory(self.output)[2], ['databases/db'])
        run.return_value = subprocess.CompletedProcess([], 1, '', 'find: cache: I/O error\n')
        with self.assertRaisesRegex(RuntimeError, 'incomplete'):
            scanner.inventory(self.output)

    @patch.object(scanner.subprocess, 'check_output')
    def test_embedded_photo_in_external_cache_fails_even_with_metadata_header(self, read):
        prefix = b'uniquely marked JPEG prefix'
        read.side_effect = [b'encrypted SQLCipher bytes', b'HTTP metadata\0' + prefix + b'photo bytes']
        with patch.object(scanner.Path, 'read_bytes', return_value=prefix):
            with self.assertRaisesRegex(RuntimeError, 'photo bytes remain'):
                scanner.audit_paths(self.output, [PRIVATE, EXTERNAL], ['adb', 'exec-out', 'cat'], [DB, PHOTO])

    @patch.object(scanner.subprocess, 'check_output', return_value=b'WP05 Native Recovery')
    def test_plaintext_draft_fails_in_any_private_artifact(self, read):
        with patch.object(scanner.Path, 'read_bytes', return_value=b'unique image prefix'):
            with self.assertRaisesRegex(RuntimeError, 'Financial draft sentinel'):
                scanner.audit_paths(self.output, [PRIVATE], ['adb', 'exec-out', 'cat'], [PRIVATE + '/shared_prefs/leak.xml'])

    def test_inventory_cannot_escape_private_roots(self):
        with patch.object(scanner.Path, 'read_bytes', return_value=b'unique image prefix'):
            with self.assertRaisesRegex(RuntimeError, 'Invalid private inventory path'):
                scanner.audit_paths(self.output, [PRIVATE], ['adb', 'exec-out', 'cat'], [PRIVATE + '/../other-app/private'])


if __name__ == '__main__':
    unittest.main()
