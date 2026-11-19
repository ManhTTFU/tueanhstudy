/**
 * Tổng hợp hiệu ứng âm thanh (WAV) – không cần file có bản quyền bên ngoài.
 *   npm run assets:sfx
 * Âm "sai" được thiết kế nhẹ nhàng, trầm ấm, không gây sợ hãi.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SAMPLE_RATE = 22050;
const OUT = join(import.meta.dirname, '..', 'public', 'assets', 'sounds', 'sfx');

type Tone = { freq: number; start: number; dur: number; gain?: number; type?: 'sine' | 'bell' | 'soft'; slideTo?: number };

const note = (name: string): number => {
  const map: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  if (!m) throw new Error(name);
  const semis = (map[m[1]!] ?? 0) + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (semis / 12);
};

function render(tones: Tone[], total: number, master = 0.7): Float32Array {
  const buf = new Float32Array(Math.ceil(total * SAMPLE_RATE));
  for (const t of tones) {
    const s0 = Math.floor(t.start * SAMPLE_RATE);
    const n = Math.floor(t.dur * SAMPLE_RATE);
    let phase = 0;
    for (let i = 0; i < n && s0 + i < buf.length; i++) {
      const time = i / SAMPLE_RATE;
      const p = i / n;
      const f = t.slideTo ? t.freq + (t.slideTo - t.freq) * p : t.freq;
      phase += (2 * Math.PI * f) / SAMPLE_RATE;
      const attack = Math.min(1, time / (t.type === 'soft' ? 0.04 : 0.008));
      const env = attack * Math.exp(-time * (t.type === 'bell' ? 6 : t.type === 'soft' ? 5 : 4));
      let v = Math.sin(phase);
      if (t.type === 'bell') v = 0.7 * v + 0.2 * Math.sin(2 * phase) + 0.1 * Math.sin(3 * phase);
      buf[s0 + i]! += v * env * (t.gain ?? 0.5);
    }
  }
  // Fade out cuối & chuẩn hoá
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  const k = peak > 0 ? master / peak : 1;
  const fade = Math.floor(0.03 * SAMPLE_RATE);
  for (let i = 0; i < buf.length; i++) {
    const tail = buf.length - i < fade ? (buf.length - i) / fade : 1;
    buf[i] = buf[i]! * k * tail;
  }
  return buf;
}

function toWav(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767, i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const seq = (names: string[], step: number, dur: number, type: Tone['type'] = 'bell', gain = 0.5): Tone[] =>
  names.map((n, i) => ({ freq: note(n), start: i * step, dur, type, gain }));

const SOUNDS: Record<string, { tones: Tone[]; total: number; master?: number }> = {
  correct: { tones: seq(['C5', 'E5', 'G5', 'C6'], 0.09, 0.5), total: 0.85 },
  wrong: {
    tones: [
      { freq: note('E4'), start: 0, dur: 0.35, type: 'soft', gain: 0.5 },
      { freq: note('C4'), start: 0.2, dur: 0.45, type: 'soft', gain: 0.45 },
    ],
    total: 0.7,
    master: 0.45,
  },
  candy: { tones: seq(['G5', 'C6', 'E6', 'G6', 'C7', 'E7'], 0.06, 0.35, 'bell', 0.4), total: 0.8 },
  gift: {
    tones: [
      ...seq(['C5', 'E5', 'G5'], 0.12, 0.3),
      { freq: note('C5'), start: 0.4, dur: 1.0, type: 'bell', gain: 0.4 },
      { freq: note('E5'), start: 0.4, dur: 1.0, type: 'bell', gain: 0.35 },
      { freq: note('G5'), start: 0.4, dur: 1.0, type: 'bell', gain: 0.35 },
      { freq: note('C6'), start: 0.4, dur: 1.0, type: 'bell', gain: 0.35 },
    ],
    total: 1.5,
  },
  celebrate: {
    tones: [...seq(['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.08, 0.4), ...seq(['C6', 'G5', 'C6', 'E6', 'G6', 'C7'], 0.08, 0.5).map((t) => ({ ...t, start: t.start + 0.6 }))],
    total: 1.8,
  },
  tap: { tones: [{ freq: 660, slideTo: 880, start: 0, dur: 0.09, type: 'sine', gain: 0.4 }], total: 0.12, master: 0.4 },
  pop: { tones: [{ freq: 520, slideTo: 1040, start: 0, dur: 0.12, type: 'sine', gain: 0.5 }], total: 0.16, master: 0.5 },
  flip: { tones: [{ freq: 300, slideTo: 700, start: 0, dur: 0.18, type: 'soft', gain: 0.4 }], total: 0.22, master: 0.35 },
};

mkdirSync(OUT, { recursive: true });
for (const [name, s] of Object.entries(SOUNDS)) {
  writeFileSync(join(OUT, `${name}.wav`), toWav(render(s.tones, s.total, s.master)));
}
console.log(`Đã tạo ${Object.keys(SOUNDS).length} hiệu ứng âm thanh tại ${OUT}`);
