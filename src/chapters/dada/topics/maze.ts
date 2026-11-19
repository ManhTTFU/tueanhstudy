import { pickOne, randomInt, sample, shuffle } from '../../../engine/random.js';
import { choiceQ, emo, type Block, type Named, type Visual } from '../kit.js';
import type { Topic } from '../topic.js';

const UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8;
const STEP: Record<number, [number, number]> = { [UP]: [0, -1], [RIGHT]: [1, 0], [DOWN]: [0, 1], [LEFT]: [-1, 0] };
const OPP: Record<number, number> = { [UP]: DOWN, [DOWN]: UP, [LEFT]: RIGHT, [RIGHT]: LEFT };

/** Mê cung hoàn hảo (mọi ô nối nhau đúng 1 đường) bằng DFS. */
export function makeMaze(w: number, rng: () => number): number[] {
  const open = Array<number>(w * w).fill(0);
  const seen = new Set<number>([0]);
  const stack = [0];
  while (stack.length) {
    const cur = stack[stack.length - 1]!;
    const x = cur % w, y = Math.floor(cur / w);
    const dirs = shuffle([UP, RIGHT, DOWN, LEFT], rng).filter((d) => {
      const [dx, dy] = STEP[d]!;
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < w && ny < w && !seen.has(ny * w + nx);
    });
    if (!dirs.length) {
      stack.pop();
      continue;
    }
    const d = dirs[0]!;
    const [dx, dy] = STEP[d]!;
    const nxt = (y + dy) * w + x + dx;
    open[cur]! |= d;
    open[nxt]! |= OPP[d]!;
    seen.add(nxt);
    stack.push(nxt);
  }
  return open;
}

/** Đường đi (danh sách ô) giữa hai ô, hoặc null nếu không tới được. */
export function mazePath(open: number[], w: number, from: number, to: number): number[] | null {
  const prev = new Map<number, number>([[from, -1]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const d of [UP, RIGHT, DOWN, LEFT]) {
      if (!(open[cur]! & d)) continue;
      const [dx, dy] = STEP[d]!;
      const nxt = cur + dy * w + dx;
      if (!prev.has(nxt)) {
        prev.set(nxt, cur);
        queue.push(nxt);
      }
    }
  }
  if (!prev.has(to)) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0]!)!);
  return path;
}

function cutEdge(open: number[], w: number, a: number, b: number) {
  const d = b === a - w ? UP : b === a + w ? DOWN : b === a + 1 ? RIGHT : LEFT;
  open[a]! &= ~d;
  open[b]! &= ~OPP[d]!;
}

const RUNNERS: Named[] = [{ e: '🐰', n: 'thỏ' }, { e: '🐱', n: 'mèo' }, { e: '🐶', n: 'cún' }, { e: '🐻', n: 'gấu' }, { e: '🐥', n: 'gà con' }];
const GOALS = [{ e: '🏠', n: 'về nhà' }, { e: '🥕', n: 'tới củ cà rốt' }, { e: '🎁', n: 'tới hộp quà' }, { e: '🍯', n: 'tới hũ mật' }];

/** Ba bạn ở ba góc, chỉ một bạn có đường tới đích. */
const mazeQ = (w: number) => (rng: () => number) => {
  for (;;) {
    const open = makeMaze(w, rng);
    const goal = randomInt(rng, Math.floor(w / 2) - 1, Math.floor(w / 2)) * w + randomInt(rng, 1, w - 2);
    const corners = [0, w - 1, w * (w - 1), w * w - 1];
    const starts = sample(corners, 3, rng);
    const [win, ...losers] = starts;
    const winPath = mazePath(open, w, win!, goal)!;
    const winEdges = new Set(winPath.slice(1).map((c, i) => `${Math.min(c, winPath[i]!)}-${Math.max(c, winPath[i]!)}`));
    let ok = true;
    for (const l of losers) {
      const p = mazePath(open, w, l, goal);
      if (!p) continue;
      // Cắt một lối trên đường của bạn thua mà không thuộc đường của bạn thắng.
      const candidates = p.slice(1).map((c, i) => [p[i]!, c] as const).filter(([a, b]) => !winEdges.has(`${Math.min(a, b)}-${Math.max(a, b)}`));
      if (!candidates.length) {
        ok = false;
        break;
      }
      const [a, b] = pickOne(candidates, rng);
      cutEdge(open, w, a, b);
    }
    if (!ok || !mazePath(open, w, win!, goal) || losers.some((l) => mazePath(open, w, l, goal))) continue;
    const runners = sample(RUNNERS, 3, rng);
    const target = pickOne(GOALS, rng);
    const marks: Record<string, Visual> = { [String(goal)]: emo(target.e) };
    starts.forEach((s, i) => (marks[String(s)] = emo(runners[i]!.e, runners[i]!.n)));
    const blocks: Block[] = [{ t: 'maze', w, open, marks }];
    return choiceQ(rng, `maze:${open.join('')}`, `Bạn nào đi được ${target.n}?`, blocks, emo(runners[0]!.e, runners[0]!.n), runners.slice(1).map((r) => emo(r.e, r.n)));
  }
};

const SCENE = ['🐱', '🐶', '🐰', '🐻', '🐸', '🐵', '🐷', '🐔', '🦊'];
const POS = [
  { n: 'ở ngay bên trên', d: -3 },
  { n: 'ở ngay bên dưới', d: 3 },
  { n: 'ở ngay bên trái', d: -1 },
  { n: 'ở ngay bên phải', d: 1 },
];
const NAMES: Record<string, string> = { '🐱': 'mèo', '🐶': 'cún', '🐰': 'thỏ', '🐻': 'gấu', '🐸': 'ếch', '🐵': 'khỉ', '🐷': 'lợn', '🐔': 'gà', '🦊': 'cáo' };
const position = (all: boolean) => (rng: () => number) => {
  const cells = shuffle(SCENE, rng);
  const pos = pickOne(all ? POS : POS.slice(0, 2), rng);
  const center = cells[4]!;
  const ans = cells[4 + pos.d]!;
  const others = sample(cells.filter((e) => e !== ans && e !== center), 3, rng);
  return choiceQ(rng, `pos:${cells.join('')}:${pos.d}`, `Bạn nào ${pos.n} bạn ${NAMES[center]}?`, [{ t: 'grid', cols: 3, cells: cells.map((e) => emo(e, NAMES[e])) }], emo(ans, NAMES[ans]), others.map((e) => emo(e, NAMES[e])));
};

const rowDir = (rng: () => number) => {
  const row = sample(SCENE, 5, rng);
  const i = randomInt(rng, 1, 3);
  const left = rng() < 0.5;
  const ans = row[left ? i - 1 : i + 1]!;
  const others = row.filter((e) => e !== ans && e !== row[i]).slice(0, 3);
  return choiceQ(rng, `row:${row.join('')}:${i}:${left}`, `Bạn đứng ngay bên ${left ? 'trái' : 'phải'} bạn ${NAMES[row[i]!]} là ai?`, [{ t: 'row', items: row.map((e) => emo(e, NAMES[e])), size: 'md' }], emo(ans, NAMES[ans]), others.map((e) => emo(e, NAMES[e])));
};

const ITEMS = ['🍎', '🍌', '⭐', '🌸', '🍀', '🎈', '🍓', '🚗', '🐟', '🍄', '🍩', '🎵', '🌙', '🔔', '🧁', '⚽'];
const DIRS = [
  { a: '➡️', dx: 1, dy: 0 },
  { a: '⬅️', dx: -1, dy: 0 },
  { a: '⬆️', dx: 0, dy: -1 },
  { a: '⬇️', dx: 0, dy: 1 },
];
const arrows = (steps: number) => (rng: () => number) => {
  const w = 4;
  for (;;) {
    const sx = randomInt(rng, 0, w - 1), sy = randomInt(rng, 0, w - 1);
    let x = sx, y = sy;
    const moves: (typeof DIRS)[number][] = [];
    for (let s = 0; s < steps; s++) {
      const ok = DIRS.filter((d) => x + d.dx >= 0 && x + d.dx < w && y + d.dy >= 0 && y + d.dy < w);
      const d = pickOne(ok, rng);
      moves.push(d);
      x += d.dx;
      y += d.dy;
    }
    if (x === sx && y === sy) continue;
    const items = shuffle(ITEMS, rng).slice(0, w * w);
    const cells: Visual[] = items.map((e, i) => (i === sy * w + sx ? emo('🐰', 'thỏ') : emo(e)));
    const ans = items[y * w + x]!;
    const others = sample(items.filter((e, i) => e !== ans && i !== sy * w + sx), 3, rng);
    return choiceQ(
      rng,
      `arr:${sx}${sy}:${moves.map((m) => m.a).join('')}`,
      'Thỏ đi theo các mũi tên, thỏ tới ô có hình nào?',
      [
        { t: 'row', items: moves.map((m) => emo(m.a)), size: 'sm', label: 'Đường đi' },
        { t: 'grid', cols: w, cells, size: 'sm' },
      ],
      emo(ans),
      others.map((e) => emo(e)),
    );
  }
};

export const mazeTopic: Topic = {
  id: 'maze',
  name: 'Mê cung',
  icon: '🧭',
  description: 'Mê cung, trên – dưới – trái – phải, đi theo mũi tên.',
  theme: { primary: '#15AABF', soft: '#E3FAFC', strong: '#0B7285' },
  sticker: 'compass',
  levels: [
    { label: 'Mê cung 4×4, trên – dưới', gen: (rng, i) => (i % 2 ? position(false)(rng) : mazeQ(4)(rng)) },
    { label: 'Mê cung 5×5, 4 hướng', gen: (rng, i) => (i % 2 ? position(true)(rng) : mazeQ(5)(rng)) },
    { label: 'Trái – phải', gen: (rng, i) => (i % 2 ? rowDir(rng) : mazeQ(6)(rng)) },
    { label: 'Đi theo 3 mũi tên', gen: (rng, i) => (i % 3 === 2 ? mazeQ(6)(rng) : arrows(3)(rng)) },
    { label: 'Mê cung 7×7, 4–5 mũi tên', gen: (rng, i) => (i % 3 === 2 ? mazeQ(7)(rng) : arrows(4 + (i % 2))(rng)) },
  ],
};
