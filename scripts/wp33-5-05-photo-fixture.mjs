// Keep known-good JPEG pixels/dimensions, but uniquely mark this acquired test
// photo so private-cache scanning cannot confuse it with the bundled app icon.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const source = readFileSync('tests/fixtures/media/wp32-photo-01.jpg');
if (source[0] !== 0xff || source[1] !== 0xd8) throw new Error('Expected JPEG fixture');
const marker = Buffer.from('SPENDWISE_WP05_PRIVATE_PHOTO_DF4BC9F4_297B_4712_B4CB', 'ascii');
const comment = Buffer.alloc(4);
comment[0] = 0xff; comment[1] = 0xfe;
comment.writeUInt16BE(marker.length + 2, 2);
mkdirSync('artifacts/android-e2e/fixtures', { recursive: true });
writeFileSync('artifacts/android-e2e/fixtures/wp05-private-photo.jpg', Buffer.concat([
  source.subarray(0, 2), comment, marker, source.subarray(2),
]));
