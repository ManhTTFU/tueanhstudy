/**
 * "Tính nhẩm": 6 cấp nối tiếp nhau, mỗi cấp một kỹ năng nhẩm.
 * Mỗi câu có các bước gợi ý theo cách nhẩm chuẩn ở tiểu học (gom cho tròn 10,
 * tách chục – đơn vị, đếm theo chục / trăm).
 */
import { inputQ, M, R, type Gen, type Step } from './kit.js';

const ASK = 'Tính nhẩm';

/** 8 + 5: gom cho tròn 10. */
const add20: Gen = (rng) => {
  let a: number, b: number;
  do {
    a = R(rng, 2, 9);
    b = R(rng, 2, 9);
  } while (a + b <= 10);
  const big = Math.max(a, b);
  const sm = Math.min(a, b);
  const need = 10 - big;
  const rest = sm - need;
  const swap = b > a ? `Đổi chỗ cho dễ: ${b} + ${a}. ` : '';
  return inputQ(`add20-${a}-${b}`, ASK, a + b, {
    eq: `${a} + ${b} = □`,
    tip: 'Gom cho tròn 10 trước, rồi cộng phần còn lại.',
    steps: [
      { q: `${swap}${big} cần thêm mấy để tròn 10?`, a: need },
      { q: `Tách ${sm} thành ${need} và mấy?`, a: rest },
      { q: `10 + ${rest} = ?`, a: 10 + rest },
    ],
  });
};

/** 13 − 5: trừ về 10 trước. */
const sub20: Gen = (rng) => {
  const c = R(rng, 11, 18);
  const u = c - 10;
  const b = R(rng, u + 1, 9);
  const r = b - u;
  return inputQ(`sub20-${c}-${b}`, ASK, c - b, {
    eq: `${c} ${M} ${b} = □`,
    tip: 'Trừ cho về 10 trước, rồi trừ tiếp phần còn lại.',
    steps: [
      { q: `${c} trừ mấy thì còn 10?`, a: u },
      { q: `Tách ${b} thành ${u} và mấy?`, a: r },
      { q: `10 ${M} ${r} = ?`, a: 10 - r },
    ],
  });
};

const OPS = ['Phép cộng', 'Phép trừ'];

/** □ + 7 = 15, 14 − □ = 6, ... */
const missing: Gen = (rng) => {
  const kind = R(rng, 1, 4);
  const x = R(rng, 2, 9);
  const b = R(rng, 2, 9);
  if (kind === 1 || kind === 2) {
    const c = x + b;
    const eq = kind === 1 ? `□ + ${b} = ${c}` : `${b} + □ = ${c}`;
    return inputQ(`miss-${kind}-${x}-${b}`, 'Tìm số còn thiếu', x, {
      eq,
      tip: 'Tìm số hạng chưa biết: lấy tổng trừ đi số hạng đã biết.',
      steps: [
        { q: 'Muốn tìm số hạng chưa biết, con làm phép gì?', choices: OPS, a: 1 },
        { q: `${c} ${M} ${b} = ?`, a: x },
      ],
    });
  }
  if (kind === 3) {
    // c − □ = d
    const c = x + b;
    return inputQ(`miss-3-${c}-${b}`, 'Tìm số còn thiếu', x, {
      eq: `${c} ${M} □ = ${b}`,
      tip: 'Tìm số trừ: lấy số bị trừ trừ đi hiệu.',
      steps: [
        { q: 'Muốn tìm số trừ, con làm phép gì?', choices: OPS, a: 1 },
        { q: `${c} ${M} ${b} = ?`, a: x },
      ],
    });
  }
  // □ − b = d
  const d = x;
  return inputQ(`miss-4-${d}-${b}`, 'Tìm số còn thiếu', d + b, {
    eq: `□ ${M} ${b} = ${d}`,
    tip: 'Tìm số bị trừ: lấy hiệu cộng với số trừ.',
    steps: [
      { q: 'Muốn tìm số bị trừ, con làm phép gì?', choices: OPS, a: 0 },
      { q: `${d} + ${b} = ?`, a: d + b },
    ],
  });
};

/** 47 + 38, 62 − 27: tách chục và đơn vị (có nhớ). */
const two: Gen = (rng) => {
  if (rng() < 0.5) {
    let ta: number, tb: number, ua: number, ub: number;
    do {
      ta = R(rng, 1, 7);
      tb = R(rng, 1, 7);
      ua = R(rng, 2, 9);
      ub = R(rng, 2, 9);
    } while (ua + ub < 10 || ta + tb > 8);
    const a = ta * 10 + ua;
    const b = tb * 10 + ub;
    return inputQ(`two-add-${a}-${b}`, ASK, a + b, {
      eq: `${a} + ${b} = □`,
      tip: 'Cộng chục với chục, đơn vị với đơn vị, rồi gộp lại.',
      steps: [
        { q: `Cộng chục: ${ta * 10} + ${tb * 10} = ?`, a: (ta + tb) * 10 },
        { q: `Cộng đơn vị: ${ua} + ${ub} = ?`, a: ua + ub },
        { q: `${(ta + tb) * 10} + ${ua + ub} = ?`, a: a + b },
      ],
    });
  }
  let ta: number, tb: number, ua: number, ub: number;
  do {
    ta = R(rng, 3, 9);
    tb = R(rng, 1, ta - 1);
    ua = R(rng, 0, 8);
    ub = R(rng, ua + 1, 9);
  } while (ta <= tb);
  const a = ta * 10 + ua;
  const b = tb * 10 + ub;
  return inputQ(`two-sub-${a}-${b}`, ASK, a - b, {
    eq: `${a} ${M} ${b} = □`,
    tip: 'Trừ phần chục trước, rồi trừ tiếp phần đơn vị.',
    steps: [
      { q: `${a} ${M} ${tb * 10} = ?`, a: a - tb * 10 },
      { q: `${a - tb * 10} ${M} ${ub} = ?`, a: a - b },
    ],
  });
};

/** 340 + 270, 650 − 300: đếm theo chục. */
const round: Gen = (rng) => {
  const hundreds = rng() < 0.35;
  const unit = hundreds ? 100 : 10;
  const word = hundreds ? 'trăm' : 'chục';
  const maxUnits = hundreds ? 9 : 99;
  const add = rng() < 0.5;
  let x: number, y: number;
  if (add) {
    x = R(rng, hundreds ? 1 : 12, hundreds ? 7 : 70);
    y = R(rng, hundreds ? 1 : 12, maxUnits - x);
  } else {
    x = R(rng, hundreds ? 3 : 25, maxUnits);
    y = R(rng, hundreds ? 1 : 11, x - 1);
  }
  const a = x * unit;
  const b = y * unit;
  const r = add ? x + y : x - y;
  const op = add ? '+' : M;
  return inputQ(`round-${a}${add ? 'p' : 'm'}${b}`, ASK, r * unit, {
    eq: `${a} ${op} ${b} = □`,
    tip: `Đếm theo ${word}: ${a} là ${x} ${word}, ${b} là ${y} ${word}.`,
    steps: [
      { q: `${x} ${word} ${op} ${y} ${word} = mấy ${word}?`, a: r },
      { q: `${r} ${word} là số nào?`, a: r * unit },
    ],
  });
};

/** 345 + 278, 623 − 278: tách trăm, chục, đơn vị. */
const three: Gen = (rng) => {
  if (rng() < 0.5) {
    let a: number, b: number;
    do {
      a = R(rng, 105, 789);
      b = R(rng, 105, 789);
      // Có nhớ (ở hàng đơn vị hoặc hàng chục) để bài nhẩm có ý nghĩa.
    } while (a + b > 999 || ((a % 10) + (b % 10) < 10 && (a % 100) + (b % 100) < 100) || a % 10 === 0 || b % 10 === 0);
    const ha = Math.floor(a / 100) * 100;
    const hb = Math.floor(b / 100) * 100;
    const ra = a % 100;
    const rb = b % 100;
    return inputQ(`three-add-${a}-${b}`, ASK, a + b, {
      eq: `${a} + ${b} = □`,
      tip: 'Cộng phần trăm trước, rồi cộng phần còn lại.',
      steps: [
        { q: `Cộng trăm: ${ha} + ${hb} = ?`, a: ha + hb },
        { q: `Cộng phần còn lại: ${ra} + ${rb} = ?`, a: ra + rb },
        { q: `${ha + hb} + ${ra + rb} = ?`, a: a + b },
      ],
    });
  }
  let a: number, b: number;
  do {
    a = R(rng, 300, 999);
    b = R(rng, 101, a - 50);
  } while (b % 10 === 0 || Math.floor(b / 10) % 10 === 0 || a % 10 >= b % 10);
  const hb = Math.floor(b / 100) * 100;
  const tb = Math.floor((b % 100) / 10) * 10;
  const ub = b % 10;
  const steps: Step[] = [
    { q: `${a} ${M} ${hb} = ?`, a: a - hb },
    { q: `${a - hb} ${M} ${tb} = ?`, a: a - hb - tb },
    { q: `${a - hb - tb} ${M} ${ub} = ?`, a: a - b },
  ];
  return inputQ(`three-sub-${a}-${b}`, ASK, a - b, {
    eq: `${a} ${M} ${b} = □`,
    tip: 'Trừ lần lượt: trừ trăm, trừ chục, rồi trừ đơn vị.',
    steps,
  });
};

export interface MentalStage {
  id: string;
  name: string;
  hint: string;
  gen: Gen;
}

export const MENTAL_STAGES: MentalStage[] = [
  { id: 'add20', name: 'Cộng qua 10', hint: 'Phạm vi 20 · 8 + 5', gen: add20 },
  { id: 'sub20', name: 'Trừ qua 10', hint: 'Phạm vi 20 · 13 − 5', gen: sub20 },
  { id: 'missing', name: 'Tìm số còn thiếu', hint: '□ + 7 = 15 · 14 − □ = 6', gen: missing },
  { id: 'two', name: 'Nhẩm 2 chữ số', hint: '47 + 38 · 62 − 27', gen: two },
  { id: 'round', name: 'Số tròn chục, tròn trăm', hint: '340 + 270 · 650 − 300', gen: round },
  { id: 'three', name: 'Nhẩm 3 chữ số', hint: '345 + 278 · 623 − 278', gen: three },
];
