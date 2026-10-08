"""Observe and unlock the synthetic OS PIN screen after an actual reboot.

Use ADB/UIAutomator before launching Maestro: its app driver may need the
credential-encrypted user storage to be unlocked first. App authentication is
still performed separately by the native gate after this returns.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET


def adb(*args):
    return subprocess.check_output(['adb', *args], text=True, timeout=15).strip()


def snapshot():
    adb('shell', 'uiautomator', 'dump', '/data/local/tmp/wp05-keyguard.xml')
    return adb('exec-out', 'cat', '/data/local/tmp/wp05-keyguard.xml')


def find_control(xml, name):
    # Resource IDs verified against Android 14 AOSP keyguard_pin_view.xml.
    return next((node for node in ET.fromstring(xml).iter('node')
                 if node.get('resource-id') == 'com.android.systemui:id/' + name
                 and node.get('enabled') == 'true'), None)


def unlock(root):
    qemu = adb('shell', 'getprop', 'ro.kernel.qemu')
    avd = adb('emu', 'avd', 'name').splitlines()[0]
    if qemu != '1' or not (avd == 'wp33-synthetic' or avd.startswith('wp33-synthetic-')):
        raise RuntimeError('OS PIN input requires the guarded disposable emulator')
    root = Path(root)
    deadline = time.monotonic() + 60
    xml = ''
    while time.monotonic() < deadline:
        try:
            xml = snapshot()
            if find_control(xml, 'pinEntry') is not None:
                break
        except (subprocess.SubprocessError, ET.ParseError):
            pass
        adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP')
        adb('shell', 'input', 'swipe', '500', '1800', '500', '300')
        time.sleep(0.5)
    else:
        root.joinpath('reboot-keyguard-unavailable.xml').write_text(xml, encoding='utf8')
        raise RuntimeError('Reboot OS PIN screen did not become observable')
    root.joinpath('reboot-keyguard-before.xml').write_text(xml, encoding='utf8')
    for name in ['key2', 'key4', 'key6', 'key8', 'key_enter']:
        node = find_control(xml, name)
        if node is None:
            raise RuntimeError('Missing observed OS PIN control: ' + name)
        bounds = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
        if not bounds:
            raise RuntimeError('Invalid OS PIN control bounds')
        x1, y1, x2, y2 = map(int, bounds.groups())
        if x2 <= x1 or y2 <= y1:
            raise RuntimeError('OS PIN control is not visible')
        adb('shell', 'input', 'tap', str((x1 + x2) // 2), str((y1 + y2) // 2))
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        # AOSP TrustManagerService encodes deviceLocked with dumpBool: 0/1.
        trust = adb('shell', 'dumpsys', 'trust')
        if 'deviceLocked=0' in trust:
            xml = snapshot()
            if find_control(xml, 'pinEntry') is None:
                root.joinpath('reboot-keyguard-after.xml').write_text(xml, encoding='utf8')
                root.joinpath('reboot-keyguard.json').write_text(json.dumps({'observedOsPin': True, 'deviceLocked': False, 'pinUiDismissed': True}), encoding='utf8')
                print('WP05_OS_KEYGUARD_UNLOCK_PASSED')
                return
        time.sleep(0.5)
    root.joinpath('reboot-keyguard-failed-trust.txt').write_text(trust, encoding='utf8')
    raise RuntimeError('OS keyguard did not confirm unlock')


if __name__ == '__main__':
    unlock(sys.argv[1])
