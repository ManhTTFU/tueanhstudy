/**
 * Tạo file giọng đọc tiếng Việt (.m4a) bằng giọng "Linh" có sẵn trên macOS.
 * Chỉ chạy được trên macOS. Kết quả được commit vào public/assets/sounds/
 * nên máy khác / Vercel không cần chạy lại.
 *
 *   npm run assets:voice            # tạo các file còn thiếu
 *   npm run assets:voice -- --force # tạo lại toàn bộ
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { allVoiceLines } from '../src/data/voice.js';

const ROOT = join(import.meta.dirname, '..', 'public', 'assets', 'sounds');
const VOICE = process.env.VOICE ?? 'Linh';
const RATE = process.env.VOICE_RATE ?? '150';
const force = process.argv.includes('--force');

if (process.platform !== 'darwin') {
  console.error('Script này cần macOS (lệnh `say`). Bạn có thể thay file .m4a bằng file thu âm thật.');
  process.exit(1);
}

let created = 0;
for (const line of allVoiceLines()) {
  const out = join(ROOT, `${line.file}.m4a`);
  if (!force && existsSync(out)) continue;
  mkdirSync(dirname(out), { recursive: true });
  const aiff = join(tmpdir(), `bvht-${process.pid}-${created}.aiff`);
  execFileSync('say', ['-v', VOICE, '-r', RATE, '-o', aiff, line.text]);
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '48000', aiff, out]);
  rmSync(aiff, { force: true });
  created++;
}
console.log(`Đã tạo ${created} file giọng đọc.`);
