/**
 * Tải hình minh họa (Microsoft Fluent Emoji – giấy phép MIT) về thư mục dự án.
 * Chỉ cần chạy khi thêm hình mới; ứng dụng KHÔNG gọi đường dẫn ngoài khi chạy.
 *
 *   npm run assets:images            # tải các hình còn thiếu
 *   npm run assets:images -- --force # tải lại toàn bộ
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { OBJECTS } from '../src/data/objects/catalog.js';
import { STICKERS } from '../src/data/stickers.js';

const REPO = 'microsoft/fluentui-emoji';
const RAW = `https://raw.githubusercontent.com/${REPO}/main/`;
const ROOT = join(import.meta.dirname, '..', 'public', 'assets');
const force = process.argv.includes('--force');

/** Hình phụ dùng cho phần thưởng / giao diện. */
const EXTRA: { source: string; target: string }[] = [
  { source: 'Candy', target: 'rewards/candy.svg' },
  { source: 'Wrapped gift', target: 'rewards/gift.svg' },
  { source: 'Party popper', target: 'rewards/party.svg' },
  { source: 'Lollipop', target: 'rewards/lollipop.svg' },
  { source: 'Glowing star', target: 'rewards/star.svg' },
];

async function main() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`, {
    headers: { 'User-Agent': 'be-vui-hoc-toan-asset-script' },
  });
  if (!res.ok) throw new Error(`Không đọc được danh sách tài nguyên: ${res.status}`);
  const tree = (await res.json()) as { tree: { path: string }[] };
  const colorSvg = new Map<string, string>();
  for (const { path } of tree.tree) {
    const m = /^assets\/([^/]+)\/Color\/[^/]+_color\.svg$/.exec(path);
    if (m?.[1]) colorSvg.set(m[1], path);
  }

  const jobs = [
    ...OBJECTS.map((x) => ({ source: x.source, target: `images/objects/${x.id}.svg` })),
    ...STICKERS.map((s) => ({ source: s.source, target: `rewards/stickers/${s.code}.svg` })),
    ...EXTRA,
  ];

  const missing: string[] = [];
  let downloaded = 0;
  for (const job of jobs) {
    const out = join(ROOT, job.target);
    if (!force && existsSync(out)) continue;
    const path = colorSvg.get(job.source);
    if (!path) {
      missing.push(job.source);
      continue;
    }
    const r = await fetch(RAW + path.split('/').map(encodeURIComponent).join('/'));
    if (!r.ok) {
      missing.push(`${job.source} (HTTP ${r.status})`);
      continue;
    }
    const svg = (await r.text()).replace(/>\s+</g, '><').trim();
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, svg);
    downloaded++;
  }
  console.log(`Đã tải ${downloaded} hình. Tổng số hình cần: ${jobs.length}.`);
  if (missing.length) {
    console.error('Không tìm thấy:', missing.join(', '));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
