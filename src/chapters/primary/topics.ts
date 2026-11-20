/**
 * "Tư duy toán" (nhóm 5–9 tuổi): 7 chủ đề bài toán có lời văn & suy luận,
 * mỗi chủ đề 3 cấp (Khởi động → Nâng cao → Thử thách). Một dạng bài nhận
 * mức độ L để tự chỉnh độ lớn của số; `[gen, L tối thiểu]` cho dạng chỉ có từ cấp L.
 */
import { shuffle } from '../../engine/random.js';
import { inputQ, ITEMS, lv, M, pick, pickQ, R, threeNames, twoNames, type Gen, type Step } from './kit.js';

export interface PrimaryTopic {
  id: string;
  name: string;
  description: string;
  /** Emoji của chủ đề (ô chủ đề, hình minh hoạ). */
  icon: string;
  theme: { primary: string; soft: string; strong: string };
  gens: (readonly [Gen, number])[];
}

const SOLVE = 'Đọc đề và trả lời';

// ===================== Hơn kém =====================
const CHANGE = ['Tăng', 'Giảm', 'Không đổi'];

const hkChange: Gen = (rng, L) => {
  const [A, B] = twoNames(rng);
  const it = pick(ITEMS, rng);
  const d = lv(L, R(rng, 3, 9), R(rng, 10, 30), R(rng, 30, 90));
  const x = lv(L, R(rng, 1, 6), R(rng, 3, 15), R(rng, 10, 50));
  const v = R(rng, 1, 3);
  const base = `${A} có nhiều hơn ${B} ${d} ${it}.`;
  const tip = 'Vẽ hai thanh dài, ngắn. Chỉ cần để ý đoạn "phần hơn".';
  const ask = `Lúc này ${A} nhiều hơn ${B} bao nhiêu ${it}?`;
  if (v === 1) {
    return inputQ(`hk-ch1-${d}-${x}`, SOLVE, d + x, {
      text: `${base} Mẹ cho thêm ${A} ${x} ${it}.`,
      ask,
      unit: it,
      tip,
      steps: [
        { q: `${A} được thêm, phần hơn sẽ thế nào?`, choices: CHANGE, a: 0 },
        { q: `${d} + ${x} = ?`, a: d + x },
      ],
    });
  }
  if (v === 2) {
    const y = Math.min(x, d - 1);
    return inputQ(`hk-ch2-${d}-${y}`, SOLVE, d - y, {
      text: `${base} Mẹ cho thêm ${B} ${y} ${it}.`,
      ask: `Lúc này ${A} còn nhiều hơn ${B} bao nhiêu ${it}?`,
      unit: it,
      tip,
      steps: [
        { q: `${B} được thêm, phần hơn của ${A} sẽ thế nào?`, choices: CHANGE, a: 1 },
        { q: `${d} ${M} ${y} = ?`, a: d - y },
      ],
    });
  }
  return inputQ(`hk-ch3-${d}-${x}`, SOLVE, d, {
    text: `${base} Mẹ cho mỗi bạn thêm ${x} ${it}.`,
    ask,
    unit: it,
    tip: 'Hai bạn cùng được thêm bằng nhau thì phần hơn không đổi.',
    steps: [
      { q: 'Hai bạn được thêm bằng nhau, phần hơn sẽ thế nào?', choices: CHANGE, a: 2 },
      { q: 'Vậy phần hơn vẫn là?', a: d },
    ],
  });
};

const hkEqual: Gen = (rng, L) => {
  const [A, B] = twoNames(rng);
  const it = pick(ITEMS, rng);
  const n = R(rng, lv(L, 2, 10, 20), lv(L, 8, 40, 90));
  const half = R(rng, lv(L, 1, 3, 6), lv(L, 5, 12, 30));
  const m = n + 2 * half;
  return inputQ(`hk-eq-${m}-${n}`, SOLVE, half, {
    text: `${A} có ${m} ${it}, ${B} có ${n} ${it}.`,
    ask: `${A} phải cho ${B} bao nhiêu ${it} để hai bạn có số ${it} bằng nhau?`,
    unit: it,
    tip: 'Cho đi một nửa phần hơn thì hai bạn bằng nhau.',
    steps: [
      { q: `${A} hơn ${B} bao nhiêu ${it}? ${m} ${M} ${n} = ?`, a: 2 * half },
      { q: `Chia đôi phần hơn: ${2 * half} chia đôi được mấy?`, a: half },
    ],
  });
};

const hkTotal: Gen = (rng, L) => {
  const [A, B] = twoNames(rng);
  const it = pick(ITEMS, rng);
  const m = R(rng, lv(L, 6, 20, 50), lv(L, 15, 60, 150));
  const d = R(rng, 2, Math.min(m - 1, lv(L, 6, 20, 40)));
  if (L === 1) {
    return inputQ(`hk-tot1-${m}-${d}`, SOLVE, m - d, {
      text: `${A} có ${m} ${it}. ${B} có ít hơn ${A} ${d} ${it}.`,
      ask: `${B} có bao nhiêu ${it}?`,
      unit: it,
      tip: '"Ít hơn" thì làm phép trừ.',
      steps: [{ q: `${m} ${M} ${d} = ?`, a: m - d }],
    });
  }
  return inputQ(`hk-tot-${m}-${d}`, SOLVE, 2 * m - d, {
    text: `${A} có ${m} ${it}. ${B} có ít hơn ${A} ${d} ${it}.`,
    ask: `Cả hai bạn có tất cả bao nhiêu ${it}?`,
    unit: it,
    tip: 'Tìm số của bạn còn lại trước, rồi mới cộng.',
    steps: [
      { q: `${B} có: ${m} ${M} ${d} = ?`, a: m - d },
      { q: `Cả hai: ${m} + ${m - d} = ?`, a: 2 * m - d },
    ],
  });
};

const hkSumDiff: Gen = (rng, L) => {
  const [A, B] = twoNames(rng);
  const it = pick(ITEMS, rng);
  const b = R(rng, lv(L, 3, 8, 20), lv(L, 10, 30, 80));
  const d = R(rng, 2, lv(L, 6, 14, 40));
  const S = 2 * b + d;
  const askA = rng() < 0.5;
  const steps: Step[] = [
    { q: `Bớt phần hơn đi: ${S} ${M} ${d} = ?`, a: S - d },
    { q: `Còn lại chia đều hai phần bằng nhau. Mỗi phần là?`, a: b },
  ];
  if (askA) steps.push({ q: `${A} có: ${b} + ${d} = ?`, a: b + d });
  return inputQ(`hk-sd-${S}-${d}-${askA ? 'a' : 'b'}`, SOLVE, askA ? b + d : b, {
    text: `${A} và ${B} có tất cả ${S} ${it}. ${A} có nhiều hơn ${B} ${d} ${it}.`,
    ask: `${askA ? A : B} có bao nhiêu ${it}?`,
    unit: it,
    tip: 'Bớt phần hơn đi thì hai phần bằng nhau.',
    steps,
  });
};

// ===================== Tính ngược =====================
const tnThink: Gen = (rng, L) => {
  const [A] = twoNames(rng);
  const x = R(rng, lv(L, 2, 10, 30), lv(L, 15, 50, 200));
  const a = R(rng, lv(L, 2, 5, 20), lv(L, 9, 30, 100));
  const b = R(rng, 1, Math.min(x + a - 1, lv(L, 12, 40, 150)));
  const c = x + a - b;
  return inputQ(`tn-th-${x}-${a}-${b}`, SOLVE, x, {
    text: `${A} nghĩ ra một số. Lấy số đó cộng ${a} rồi trừ ${b} thì được ${c}.`,
    ask: `${A} đã nghĩ ra số nào?`,
    tip: 'Đi ngược từ cuối lên: cộng thành trừ, trừ thành cộng.',
    steps: [
      { q: `Trước khi trừ ${b}, số đó là: ${c} + ${b} = ?`, a: c + b },
      { q: `Trước khi cộng ${a}: ${c + b} ${M} ${a} = ?`, a: x },
    ],
  });
};

const SHOP = ['quả cam', 'bông hoa', 'cái bánh', 'quả bóng', 'hộp sữa'];

const tnSold: Gen = (rng, L) => {
  const it = pick(SHOP, rng);
  const a = R(rng, lv(L, 2, 10, 30), lv(L, 9, 40, 150));
  const b = R(rng, lv(L, 2, 10, 30), lv(L, 9, 40, 150));
  const c = R(rng, lv(L, 1, 5, 10), lv(L, 9, 30, 100));
  return inputQ(`tn-sold-${a}-${b}-${c}`, SOLVE, a + b + c, {
    text: `Cửa hàng có một số ${it}. Buổi sáng bán ${a} ${it}, buổi chiều bán ${b} ${it}, còn lại ${c} ${it}.`,
    ask: `Lúc đầu cửa hàng có bao nhiêu ${it}?`,
    unit: it,
    tip: 'Số lúc đầu = số đã bán + số còn lại.',
    steps: [
      { q: `Cả ngày đã bán: ${a} + ${b} = ?`, a: a + b },
      { q: `Lúc đầu: ${a + b} + ${c} = ?`, a: a + b + c },
    ],
  });
};

const tnBox: Gen = (rng, L) => {
  const x = R(rng, lv(L, 2, 10, 30), lv(L, 12, 60, 300));
  const a = R(rng, lv(L, 2, 5, 20), lv(L, 9, 40, 200));
  const b = R(rng, 1, Math.min(x + a - 1, lv(L, 9, 40, 200)));
  const c = x + a - b;
  return inputQ(`tn-box-${x}-${a}-${b}`, 'Tìm số còn thiếu', x, {
    eq: `□ + ${a} ${M} ${b} = ${c}`,
    tip: 'Đi ngược từ cuối lên: cộng thành trừ, trừ thành cộng.',
    steps: [
      { q: `${c} + ${b} = ?`, a: c + b },
      { q: `${c + b} ${M} ${a} = ?`, a: x },
    ],
  });
};

const tnHalf: Gen = (rng, L) => {
  const [A] = twoNames(rng);
  const r = R(rng, lv(L, 2, 2, 5), lv(L, 6, 9, 25));
  const e = R(rng, 1, lv(L, 4, 6, 15));
  const h = r + e;
  return inputQ(`tn-half-${r}-${e}`, SOLVE, 2 * h, {
    text: `${A} cho em một nửa số kẹo của mình, sau đó ${A} ăn ${e} cái thì còn lại ${r} cái.`,
    ask: `Lúc đầu ${A} có bao nhiêu cái kẹo?`,
    unit: 'cái kẹo',
    tip: 'Đi ngược: trước khi ăn có bao nhiêu? Đó là một nửa số kẹo.',
    steps: [
      { q: `Trước khi ăn, ${A} còn: ${r} + ${e} = ?`, a: h },
      { q: `Đó là một nửa số kẹo. Lúc đầu: ${h} + ${h} = ?`, a: 2 * h },
    ],
  });
};

const tnTypo: Gen = (rng, L) => {
  const [A] = twoNames(rng);
  let t: number;
  do t = R(rng, 12, 98);
  while (t % 10 === 0 || Math.floor(t / 10) === t % 10);
  const w = (t % 10) * 10 + Math.floor(t / 10);
  const x = R(rng, lv(L, 10, 10, 50), lv(L, 50, 99, 400));
  const wrong = x + w;
  return inputQ(`tn-typo-${t}-${x}`, SOLVE, x + t, {
    text: `${A} lấy một số cộng với ${t}, nhưng chép nhầm ${t} thành ${w} nên được kết quả là ${wrong}.`,
    ask: 'Kết quả đúng là bao nhiêu?',
    tip: 'Tìm lại số ban đầu trước, rồi cộng cho đúng.',
    steps: [
      { q: `Số ban đầu: ${wrong} ${M} ${w} = ?`, a: x },
      { q: `Kết quả đúng: ${x} + ${t} = ?`, a: x + t },
    ],
  });
};

// ===================== Hình bí ẩn =====================
const FRUITS = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍐', '🍉', '🍒'];

const hbDouble: Gen = (rng, L) => {
  const [p, q] = shuffle(FRUITS, rng) as [string, string];
  const x = R(rng, lv(L, 1, 5, 20), lv(L, 9, 30, 90));
  const y = R(rng, lv(L, 1, 5, 20), lv(L, 9, 30, 90));
  return inputQ(`hb-dbl-${x}-${y}`, `Mỗi hình là một số. ${q} = ?`, y, {
    lines: [`${p} + ${p} = ${2 * x}`, `${p} + ${q} = ${x + y}`],
    ask: `${q} là số mấy?`,
    tip: 'Tìm hình dễ trước (dòng có hai hình giống nhau).',
    steps: [
      { q: `${p} + ${p} = ${2 * x}. Vậy ${p} = ?`, a: x },
      { q: `${q} = ${x + y} ${M} ${x} = ?`, a: y },
    ],
  });
};

const hbTwice: Gen = (rng, L) => {
  const p = pick(FRUITS, rng);
  const x = R(rng, lv(L, 2, 5, 20), lv(L, 9, 30, 90));
  const k = R(rng, lv(L, 1, 5, 10), lv(L, 9, 30, 90));
  const s = 2 * x + k;
  return inputQ(`hb-tw-${x}-${k}`, `Mỗi hình là một số. ${p} = ?`, x, {
    lines: [`${p} + ${p} + ${k} = ${s}`],
    ask: `${p} là số mấy?`,
    tip: 'Bớt số đã biết đi trước.',
    steps: [
      { q: `${p} + ${p} = ${s} ${M} ${k} = ?`, a: 2 * x },
      { q: `Một ${p} = ?`, a: x },
    ],
  });
};

const hbBalance: Gen = (rng, L) => {
  const big = pick(['🍉', '🍍', '🥥', '🎃'], rng);
  const mid = pick(['🍎', '🍐', '🍊'], rng);
  const small = pick(['🍓', '🍒', '🫐'], rng);
  const k = R(rng, 2, lv(L, 3, 4, 5));
  const m = R(rng, 2, lv(L, 3, 5, 6));
  return inputQ(`hb-bal-${big}${mid}${small}-${k}-${m}`, SOLVE, k * m, {
    text: `1 ${big} nặng bằng ${k} ${mid}. 1 ${mid} nặng bằng ${m} ${small}.`,
    ask: `1 ${big} nặng bằng bao nhiêu ${small}?`,
    tip: `Đổi từng ${mid} ra ${small} rồi cộng lại.`,
    steps: [{ q: `${k} ${mid}, mỗi quả bằng ${m} ${small}: ${Array(k).fill(m).join(' + ')} = ?`, a: k * m }],
  });
};

const hbSumDiff: Gen = (rng, L) => {
  const [p, q] = shuffle(FRUITS, rng) as [string, string];
  const y = R(rng, lv(L, 1, 2, 10), lv(L, 6, 15, 60));
  const x = y + R(rng, 1, lv(L, 6, 15, 40));
  return inputQ(`hb-sd-${x}-${y}`, `Mỗi hình là một số. ${p} = ?`, x, {
    lines: [`${p} + ${q} = ${x + y}`, `${p} ${M} ${q} = ${x - y}`],
    ask: `${p} là số mấy?`,
    tip: 'Cộng hai dòng lại thì hai hình kia mất đi.',
    steps: [
      { q: `Cộng hai dòng: ${p} + ${p} = ${x + y} + ${x - y} = ?`, a: 2 * x },
      { q: `Một ${p} = ?`, a: x },
    ],
  });
};

const hbTriple: Gen = (rng, L) => {
  const [p, q, r] = shuffle(FRUITS, rng) as [string, string, string];
  const x = R(rng, lv(L, 1, 2, 5), lv(L, 5, 9, 30));
  const y = R(rng, lv(L, 1, 2, 5), lv(L, 9, 20, 60));
  const z = R(rng, lv(L, 1, 2, 5), lv(L, 9, 20, 60));
  return inputQ(`hb-tri-${x}-${y}-${z}`, `Mỗi hình là một số. ${r} = ?`, z, {
    lines: [`${p} + ${p} + ${p} = ${3 * x}`, `${p} + ${q} = ${x + y}`, `${q} + ${r} = ${y + z}`],
    ask: `${r} là số mấy?`,
    tip: 'Giải từ dòng trên xuống: mỗi dòng tìm được một hình.',
    steps: [
      { q: `${p} = ?`, a: x },
      { q: `${q} = ${x + y} ${M} ${x} = ?`, a: y },
      { q: `${r} = ${y + z} ${M} ${y} = ?`, a: z },
    ],
  });
};

// ===================== Quy luật =====================
const qlSeq: Gen = (rng, L) => {
  const d = R(rng, lv(L, 2, 3, 6), lv(L, 5, 9, 25));
  const down = L >= 2 && rng() < 0.4;
  const len = 6;
  const start = down ? R(rng, d * len, d * len + lv(L, 20, 50, 200)) : R(rng, lv(L, 0, 1, 10), lv(L, 20, 50, 200));
  const seq = Array.from({ length: len }, (_, i) => start + (down ? -1 : 1) * d * i);
  const hole = R(rng, 2, len - 1);
  return inputQ(`ql-seq-${start}-${d}-${down ? 'd' : 'u'}-${hole}`, 'Tìm số còn thiếu trong dãy', seq[hole]!, {
    seq: seq.map((n, i) => (i === hole ? '□' : String(n))),
    tip: 'Xem hai số liền nhau hơn kém nhau bao nhiêu.',
    steps: [
      { q: `Hai số liền nhau hơn kém nhau mấy?`, a: d },
      { q: 'Vậy số còn thiếu là?', a: seq[hole]! },
    ],
  });
};

const qlAlt: Gen = (rng, L) => {
  const a = R(rng, 3, lv(L, 6, 9, 20));
  const b = R(rng, 1, a - 1);
  const start = R(rng, 5, lv(L, 20, 40, 100));
  const seq = [start];
  for (let i = 1; i < 6; i++) seq.push(seq[i - 1]! + (i % 2 === 1 ? a : -b));
  const ans = seq[5]!;
  return inputQ(`ql-alt-${start}-${a}-${b}`, 'Tìm số tiếp theo của dãy', ans, {
    seq: [...seq.slice(0, 5).map(String), '□'],
    tip: 'Dãy này cộng rồi trừ xen kẽ nhau.',
    steps: [
      { q: `${seq[0]} → ${seq[1]}: dãy cộng mấy?`, a },
      { q: `${seq[1]} → ${seq[2]}: rồi trừ mấy?`, a: b },
      { q: `Số tiếp theo: ${seq[4]} + ${a} = ?`, a: ans },
    ],
  });
};

const qlGrow: Gen = (rng, L) => {
  if (L >= 3 && rng() < 0.5) {
    const s = R(rng, 1, 5);
    const seq = Array.from({ length: 6 }, (_, i) => s * 2 ** i);
    return inputQ(`ql-dbl-${s}`, 'Tìm số tiếp theo của dãy', seq[5]!, {
      seq: [...seq.slice(0, 5).map(String), '□'],
      tip: 'Mỗi số gấp đôi số đứng trước.',
      steps: [
        { q: `${seq[0]} → ${seq[1]} → ${seq[2]}: mỗi số bằng số trước cộng với chính nó. ${seq[4]} + ${seq[4]} = ?`, a: seq[5]! },
      ],
    });
  }
  const s = R(rng, 1, lv(L, 10, 20, 50));
  const k = R(rng, 1, 2);
  const seq = [s];
  for (let i = 1; i < 6; i++) seq.push(seq[i - 1]! + k * i);
  return inputQ(`ql-grow-${s}-${k}`, 'Tìm số tiếp theo của dãy', seq[5]!, {
    seq: [...seq.slice(0, 5).map(String), '□'],
    tip: 'Khoảng cách giữa các số tăng dần.',
    steps: [
      { q: `Khoảng cách lần lượt là ${k}, ${2 * k}, ${3 * k}, ${4 * k}… Khoảng cách tiếp theo?`, a: 5 * k },
      { q: `${seq[4]} + ${5 * k} = ?`, a: seq[5]! },
    ],
  });
};

const SYMBOLS = ['🔴', '🟡', '🔵', '🟢', '🟣', '⭐', '❤️', '🔺'];

const qlCycle: Gen = (rng, L) => {
  const k = lv(L, 3, R(rng, 3, 4), 4);
  const unit = shuffle(SYMBOLS, rng).slice(0, k);
  const n = R(rng, lv(L, 8, 12, 20), lv(L, 15, 30, 60));
  const pos = ((n - 1) % k) + 1;
  const answer = unit[pos - 1]!;
  return pickQ(rng, `ql-cyc-${unit.join('')}-${n}`, `Hình thứ ${n} là hình nào?`, unit, unit.indexOf(answer), {
    seq: [...unit, ...unit, ...unit.slice(0, 2), '…'],
    ask: `Dãy hình lặp lại mãi. Hình thứ ${n} là hình nào?`,
    tip: `Cứ ${k} hình thì lặp lại một lần.`,
    steps: [
      { q: 'Cứ mấy hình thì dãy lặp lại?', a: k },
      { q: `Hình thứ ${n - pos} là hình cuối của một nhóm. Vậy hình thứ ${n} là hình thứ mấy trong nhóm?`, a: pos },
    ],
  });
};

const qlPyramid: Gen = (rng, L) => {
  const maxBase = lv(L, 9, 20, 40);
  const [a, b, c] = [R(rng, 1, maxBase), R(rng, 1, maxBase), R(rng, 1, maxBase)];
  const m1 = a + b;
  const m2 = b + c;
  const top = m1 + m2;
  if (L === 1 || rng() < 0.4) {
    return inputQ(`ql-pyr-top-${a}-${b}-${c}`, 'Mỗi ô bằng tổng hai ô ngay dưới nó', top, {
      pyramid: [[null], [m1, m2], [a, b, c]],
      ask: 'Ô trên cùng là số mấy?',
      tip: 'Mỗi ô bằng tổng hai ô ngay bên dưới.',
      steps: [{ q: `${m1} + ${m2} = ?`, a: top }],
    });
  }
  return inputQ(`ql-pyr-bot-${a}-${b}-${c}`, 'Mỗi ô bằng tổng hai ô ngay dưới nó', a, {
    pyramid: [[top], [m1, m2], [null, b, c]],
    ask: 'Ô còn trống là số mấy?',
    tip: 'Ô trống cộng với ô bên cạnh bằng ô phía trên.',
    steps: [{ q: `Ô trống + ${b} = ${m1}. Vậy ô trống = ${m1} ${M} ${b} = ?`, a }],
  });
};

// ===================== Thời gian =====================
const WEEK = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

const tgAgeDiff: Gen = (rng, L) => {
  const [A] = twoNames(rng);
  const who = pick(['mẹ', 'bố'], rng);
  const a = R(rng, 5, 10);
  const g = R(rng, 22, 35);
  const k = R(rng, 2, lv(L, 5, 10, 20));
  if (L >= 2 && rng() < 0.5) {
    return inputQ(`tg-age2-${a}-${g}-${k}`, SOLVE, a + g + k, {
      text: `Năm nay ${A} ${a} tuổi, ${who} hơn ${A} ${g} tuổi.`,
      ask: `Khi ${A} ${a + k} tuổi thì ${who} bao nhiêu tuổi?`,
      unit: 'tuổi',
      tip: 'Hai người hơn kém nhau bao nhiêu tuổi thì mãi mãi hơn kém bấy nhiêu.',
      steps: [
        { q: `Khi đó ${who} vẫn hơn ${A} bao nhiêu tuổi?`, a: g },
        { q: `${a + k} + ${g} = ?`, a: a + g + k },
      ],
    });
  }
  return inputQ(`tg-age-${a}-${g}-${k}`, SOLVE, g, {
    text: `Năm nay ${A} ${a} tuổi, ${who} ${a + g} tuổi.`,
    ask: `${k} năm nữa, ${who} hơn ${A} bao nhiêu tuổi?`,
    unit: 'tuổi',
    tip: 'Mỗi năm hai người cùng thêm 1 tuổi.',
    steps: [
      { q: `Mỗi năm ai cũng thêm 1 tuổi. Số tuổi ${who} hơn ${A} có thay đổi không?`, choices: ['Có thay đổi', 'Không đổi'], a: 1 },
      { q: `Năm nay ${who} hơn ${A}: ${a + g} ${M} ${a} = ?`, a: g },
    ],
  });
};

const tgAgeSum: Gen = (rng, L) => {
  const S = R(rng, lv(L, 8, 12, 20), lv(L, 16, 30, 60));
  const k = R(rng, 1, lv(L, 4, 8, 15));
  return inputQ(`tg-sum-${S}-${k}`, SOLVE, S + 2 * k, {
    text: `Năm nay tổng số tuổi của hai anh em là ${S} tuổi.`,
    ask: `${k} năm nữa, tổng số tuổi của hai anh em là bao nhiêu?`,
    unit: 'tuổi',
    tip: 'Mỗi người đều thêm tuổi, nên tổng thêm gấp đôi.',
    steps: [
      { q: `Mỗi người thêm ${k} tuổi. Hai người thêm tất cả: ${k} + ${k} = ?`, a: 2 * k },
      { q: `${S} + ${2 * k} = ?`, a: S + 2 * k },
    ],
  });
};

const tgCalendar: Gen = (rng, L) => {
  const day = R(rng, 1, 6);
  if (rng() < 0.5) {
    const weeks = lv(L, 1, R(rng, 1, 2), R(rng, 2, 3));
    const after = rng() < (L === 1 ? 1 : 0.6);
    const n = after ? R(rng, 1, 30 - 7 * weeks) : R(rng, 7 * weeks + 1, 30);
    const ans = after ? n + 7 * weeks : n - 7 * weeks;
    const when = weeks === 1 ? (after ? 'tuần sau' : 'tuần trước') : `${weeks} tuần ${after ? 'sau' : 'trước'}`;
    return inputQ(`tg-cal-${day}-${n}-${weeks}-${after ? 'a' : 'b'}`, SOLVE, ans, {
      text: `${WEEK[day]} tuần này là ngày ${n}.`,
      ask: `${WEEK[day]} ${when} là ngày bao nhiêu?`,
      tip: 'Một tuần có 7 ngày: cùng thứ thì cách nhau 7 ngày.',
      steps: [
        { q: 'Một tuần có mấy ngày?', a: 7 },
        { q: `${n} ${after ? '+' : M} ${7 * weeks} = ?`, a: ans },
      ],
    });
  }
  const k = R(rng, lv(L, 2, 8, 15), lv(L, 6, 14, 30));
  const target = (day + k) % 7;
  const others = shuffle(
    WEEK.map((_, i) => i).filter((i) => i !== target),
    rng,
  ).slice(0, 3);
  const labels = [target, ...others].map((i) => WEEK[i]!);
  const steps: Step[] =
    k >= 7
      ? [
          { q: 'Một tuần có mấy ngày?', a: 7 },
          { q: `${k} ngày = ${Math.floor(k / 7)} tuần và mấy ngày?`, a: k % 7 },
        ]
      : [{ q: `Đếm thêm ${k} ngày kể từ ${WEEK[day]}. Hôm đó là thứ mấy?`, choices: labels, a: 0 }];
  return pickQ(rng, `tg-wd-${day}-${k}`, `${k} ngày nữa là thứ mấy?`, labels, 0, {
    text: `Hôm nay là ${WEEK[day]}.`,
    ask: `${k} ngày nữa là thứ mấy?`,
    tip: 'Cứ 7 ngày thì quay lại đúng thứ đó.',
    steps,
  });
};

const tgClock: Gen = (rng, L) => {
  if (L === 1) {
    const h = R(rng, 1, 9);
    const k = R(rng, 1, 12 - h);
    return inputQ(`tg-clk-${h}-${k}`, SOLVE, h + k, {
      text: `Bây giờ là ${h} giờ.`,
      ask: `Sau ${k} giờ nữa là mấy giờ?`,
      unit: 'giờ',
      steps: [{ q: `${h} + ${k} = ?`, a: h + k }],
    });
  }
  const h = R(rng, 6, 12);
  const k = R(rng, 2, 8);
  if (rng() < 0.5) {
    return inputQ(`tg-clk24-${h}-${k}`, SOLVE, h + k, {
      text: `Buổi sáng, ${twoNames(rng)[0]} đi học lúc ${h} giờ và ở trường ${k} giờ.`,
      ask: 'Bạn ấy về lúc mấy giờ? (viết theo giờ 24)',
      unit: 'giờ',
      tip: 'Sau 12 giờ trưa là 13 giờ (1 giờ chiều), 14 giờ (2 giờ chiều)…',
      steps: [{ q: `${h} + ${k} = ?`, a: h + k }],
    });
  }
  const end = R(rng, 13, 21);
  const start = R(rng, 7, end - 2);
  return inputQ(`tg-dur-${start}-${end}`, SOLVE, end - start, {
    text: `Một bộ phim bắt đầu lúc ${start} giờ và kết thúc lúc ${end} giờ.`,
    ask: 'Bộ phim dài mấy giờ?',
    unit: 'giờ',
    steps: [{ q: `${end} ${M} ${start} = ?`, a: end - start }],
  });
};

const tgTrees: Gen = (rng, L) => {
  if (L === 1) {
    const n = R(rng, 3, 9);
    return inputQ(`tg-tree1-${n}`, SOLVE, n + 1, {
      text: `Một hàng cây có ${n} khoảng cách bằng nhau, hai đầu hàng đều có cây.`,
      ask: 'Hàng đó có tất cả bao nhiêu cây?',
      unit: 'cây',
      tip: 'Vẽ ra: cây – khoảng – cây – khoảng – cây. Số cây nhiều hơn số khoảng 1.',
      steps: [{ q: `Số cây nhiều hơn số khoảng cách 1: ${n} + 1 = ?`, a: n + 1 }],
    });
  }
  const g = R(rng, 2, 5);
  const n = R(rng, 3, lv(L, 6, 9, 12));
  const len = g * n;
  const both = L === 2 || rng() < 0.6;
  return inputQ(`tg-tree-${g}-${n}-${both ? 2 : 1}`, SOLVE, both ? n + 1 : n, {
    text: `Một hàng rào dài ${len} m. Cứ ${g} m trồng một cây${both ? ', trồng cả hai đầu' : ', chỉ trồng ở đầu hàng, cuối hàng không trồng'}.`,
    ask: 'Trồng được tất cả bao nhiêu cây?',
    unit: 'cây',
    tip: 'Đếm số khoảng cách trước.',
    steps: [
      { q: `Có mấy khoảng ${g} m? (${Array(n).fill(g).join(' + ')} = ${len})`, a: n },
      both ? { q: 'Trồng cả hai đầu: số cây nhiều hơn số khoảng 1. Vậy có?', a: n + 1 } : { q: 'Chỉ trồng một đầu: số cây bằng số khoảng. Vậy có?', a: n },
    ],
  });
};

// ===================== Suy luận =====================
const ttOrder: Gen = (rng) => {
  const [A, B, C] = threeNames(rng);
  // A > B > C (cao/thấp hoặc nhanh/chậm)
  const [more, less, most, least] = pick(
    [
      ['cao hơn', 'thấp hơn', 'cao nhất', 'thấp nhất'],
      ['chạy nhanh hơn', 'chạy chậm hơn', 'chạy nhanh nhất', 'chạy chậm nhất'],
      ['nặng hơn', 'nhẹ hơn', 'nặng nhất', 'nhẹ nhất'],
    ] as const,
    rng,
  );
  const text = rng() < 0.5 ? `${A} ${more} ${B}. ${C} ${less} ${B}.` : `${B} ${less} ${A}. ${B} ${more} ${C}.`;
  const askMost = rng() < 0.5;
  const labels = [A, B, C];
  const ans = askMost ? 0 : 2;
  return pickQ(rng, `tt-ord-${A}-${B}-${C}-${askMost ? 1 : 0}`, `Ai ${askMost ? most : least}?`, labels, ans, {
    text,
    ask: `Bạn nào ${askMost ? most : least}?`,
    tip: 'Xếp ba bạn thành một hàng theo thứ tự rồi xem đầu và cuối hàng.',
    steps: [{ q: `${A} ${more} ${B}, ${B} ${more} ${C}. Ai đứng giữa?`, choices: labels, a: 1 }],
  });
};

const ttQueue: Gen = (rng, L) => {
  const [A] = twoNames(rng);
  const p = R(rng, 2, lv(L, 6, 12, 25));
  const q = R(rng, 2, lv(L, 6, 12, 25));
  return inputQ(`tt-q-${p}-${q}`, SOLVE, p + q - 1, {
    text: `Các bạn xếp một hàng dọc. ${A} đứng thứ ${p} tính từ đầu hàng và thứ ${q} tính từ cuối hàng.`,
    ask: 'Hàng có tất cả bao nhiêu bạn?',
    unit: 'bạn',
    tip: 'Vẽ hàng ra. Bạn ở giữa được đếm hai lần!',
    steps: [
      { q: `${p} + ${q} = ?`, a: p + q },
      { q: `${A} bị đếm hai lần, nên bớt đi 1: ?`, a: p + q - 1 },
    ],
  });
};

const ttPigeon: Gen = (rng, L) => {
  const v = L === 1 ? R(rng, 1, 2) : R(rng, 1, 3);
  const tip = 'Nghĩ đến trường hợp xui nhất!';
  if (v === 1) {
    const r = R(rng, 3, lv(L, 9, 20, 30));
    const b = R(rng, 3, 12);
    return inputQ(`tt-pig1-${r}-${b}`, SOLVE, r + 1, {
      text: `Trong hộp có ${r} viên bi đỏ và ${b} viên bi xanh. Không nhìn vào hộp.`,
      ask: 'Phải lấy ra ít nhất bao nhiêu viên để chắc chắn có 1 viên bi xanh?',
      unit: 'viên',
      tip,
      steps: [
        { q: 'Xui nhất là lấy mãi toàn bi đỏ. Lấy hết bi đỏ là mấy viên?', a: r },
        { q: 'Viên lấy tiếp theo chắc chắn là bi xanh. Tổng cộng?', a: r + 1 },
      ],
    });
  }
  if (v === 2) {
    const k = R(rng, 2, 5);
    const cols = ['đỏ', 'xanh', 'vàng', 'tím', 'trắng'].slice(0, k);
    return inputQ(`tt-pig2-${k}`, SOLVE, k + 1, {
      text: `Trong túi có rất nhiều viên kẹo gồm ${k} màu: ${cols.join(', ')}. Không nhìn vào túi.`,
      ask: 'Phải lấy ra ít nhất bao nhiêu viên để chắc chắn có 2 viên cùng màu?',
      unit: 'viên',
      tip,
      steps: [
        { q: 'Xui nhất: mỗi viên một màu khác nhau. Lấy được nhiều nhất mấy viên khác màu?', a: k },
        { q: 'Viên tiếp theo chắc chắn trùng màu một viên đã lấy. Tổng cộng?', a: k + 1 },
      ],
    });
  }
  const r = R(rng, 5, 15);
  const b = R(rng, 5, 15);
  const mx = Math.max(r, b);
  return inputQ(`tt-pig3-${r}-${b}`, SOLVE, mx + 1, {
    text: `Trong hộp có ${r} viên bi đỏ và ${b} viên bi xanh. Không nhìn vào hộp.`,
    ask: 'Phải lấy ra ít nhất bao nhiêu viên để chắc chắn có đủ cả hai màu?',
    unit: 'viên',
    tip,
    steps: [
      { q: 'Xui nhất: lấy hết màu có nhiều viên hơn trước. Đó là mấy viên?', a: mx },
      { q: 'Thêm 1 viên nữa chắc chắn là màu kia. Tổng cộng?', a: mx + 1 },
    ],
  });
};

const ttLegs: Gen = (rng, L) => {
  if (L === 1) {
    const g = R(rng, 1, 5);
    const c = R(rng, 1, 4);
    return inputQ(`tt-legs1-${g}-${c}`, SOLVE, 2 * g + 4 * c, {
      text: `Trong sân có ${g} con gà và ${c} con chó.`,
      ask: 'Có tất cả bao nhiêu cái chân?',
      unit: 'cái chân',
      tip: 'Gà có 2 chân, chó có 4 chân.',
      steps: [
        { q: `Chân gà: ${Array(g).fill(2).join(' + ')} = ?`, a: 2 * g },
        { q: `Chân chó: ${Array(c).fill(4).join(' + ')} = ?`, a: 4 * c },
        { q: `${2 * g} + ${4 * c} = ?`, a: 2 * g + 4 * c },
      ],
    });
  }
  const n = R(rng, 3, lv(L, 6, 6, 10));
  const c = R(rng, 1, n - 1);
  const legs = 2 * (n - c) + 4 * c;
  return inputQ(`tt-legs-${n}-${c}`, SOLVE, c, {
    text: `Trong sân có ${n} con gà và chó. Đếm được tất cả ${legs} cái chân.`,
    ask: 'Có mấy con chó?',
    unit: 'con chó',
    tip: 'Giả sử con nào cũng là gà, rồi xem thừa ra bao nhiêu chân.',
    steps: [
      { q: `Giả sử cả ${n} con đều là gà: có mấy cái chân?`, a: 2 * n },
      { q: `Thừa ra: ${legs} ${M} ${2 * n} = ?`, a: legs - 2 * n },
      { q: 'Mỗi con chó có thêm 2 chân so với gà. Vậy có mấy con chó?', a: c },
    ],
  });
};

const ttShake: Gen = (rng, L) => {
  const n = R(rng, 3, lv(L, 4, 6, 8));
  const total = (n * (n - 1)) / 2;
  const parts = Array.from({ length: n - 1 }, (_, i) => n - 1 - i);
  return inputQ(`tt-shake-${n}`, SOLVE, total, {
    text: `Có ${n} bạn gặp nhau. Hai bạn bất kỳ bắt tay nhau đúng một lần.`,
    ask: 'Có tất cả bao nhiêu cái bắt tay?',
    tip: 'Bạn đầu bắt tay hết các bạn khác, bạn sau không bắt tay lại bạn trước nữa.',
    steps: [
      { q: 'Bạn thứ nhất bắt tay mấy bạn?', a: n - 1 },
      { q: `Bạn thứ hai bắt tay thêm mấy bạn mới?`, a: n - 2 },
      { q: `${parts.join(' + ')} = ?`, a: total },
    ],
  });
};

const ttVenn: Gen = (rng, L) => {
  const both = R(rng, 1, lv(L, 3, 5, 10));
  const a = both + R(rng, 2, lv(L, 6, 12, 25));
  const b = both + R(rng, 2, lv(L, 6, 12, 25));
  const [x, y] = pick(
    [
      ['bóng đá', 'cầu lông'],
      ['vẽ', 'hát'],
      ['táo', 'cam'],
    ] as const,
    rng,
  );
  return inputQ(`tt-venn-${a}-${b}-${both}`, SOLVE, a + b - both, {
    text: `Trong lớp có ${a} bạn thích ${x}, ${b} bạn thích ${y}, trong đó ${both} bạn thích cả hai.`,
    ask: 'Có bao nhiêu bạn thích ít nhất một trong hai?',
    unit: 'bạn',
    tip: 'Vẽ hai vòng tròn chồng lên nhau. Phần chung chỉ đếm một lần.',
    steps: [
      { q: `${a} + ${b} = ?`, a: a + b },
      { q: `Các bạn thích cả hai bị đếm 2 lần, bớt ${both}: ?`, a: a + b - both },
    ],
  });
};

// ===================== Chữ số =====================
function digitsDistinct(rng: { (): number }, k: number, allowZero: boolean): number[] {
  return shuffle(allowZero ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [1, 2, 3, 4, 5, 6, 7, 8, 9], rng).slice(0, k);
}

const csBuild: Gen = (rng, L) => {
  const ds = digitsDistinct(rng, lv(L, 3, 3, 4), L >= 2);
  if (L >= 2 && !ds.includes(0)) ds[ds.length - 1] = 0;
  const big = rng() < 0.5;
  const len = L === 3 ? 3 : 2;
  const sorted = [...ds].sort((a, b) => (big ? b - a : a - b));
  let num: number[];
  if (big) num = sorted.slice(0, len);
  else {
    const first = sorted.find((d) => d !== 0)!;
    num = [first, ...sorted.filter((d) => d !== first).slice(0, len - 1)];
  }
  const ans = Number(num.join(''));
  const word = len === 2 ? 'hai' : 'ba';
  const steps: Step[] = [
    { q: `Chữ số đầu tiên (bên trái) nên chọn số nào?`, a: num[0]! },
    { q: `Chữ số tiếp theo?`, a: num[1]! },
  ];
  if (len === 3) steps.push({ q: 'Chữ số cuối cùng?', a: num[2]! });
  steps.push({ q: 'Vậy số cần lập là?', a: ans });
  return inputQ(`cs-build-${ds.join('')}-${big ? 'max' : 'min'}`, SOLVE, ans, {
    text: `Cho các chữ số: ${ds.join(', ')}.`,
    ask: `Lập số ${big ? 'lớn nhất' : 'bé nhất'} có ${word} chữ số khác nhau từ các chữ số trên.`,
    tip: big ? 'Số lớn nhất: chữ số lớn đứng trước.' : 'Số bé nhất: chữ số bé đứng trước, nhưng chữ số 0 không đứng đầu.',
    steps,
  });
};

const csSum: Gen = (rng, L) => {
  const n = L === 1 ? R(rng, 11, 99) : R(rng, 101, 999);
  const ds = String(n).split('').map(Number);
  const s = ds.reduce((a, b) => a + b, 0);
  return inputQ(`cs-sum-${n}`, SOLVE, s, {
    ask: `Tổng các chữ số của số ${n} là bao nhiêu?`,
    tip: 'Tách từng chữ số ra rồi cộng lại.',
    steps: [{ q: `${ds.join(' + ')} = ?`, a: s }],
  });
};

function countDigits(n: number): number {
  let c = 0;
  for (let i = 1; i <= n; i++) c += String(i).length;
  return c;
}

const csCount: Gen = (rng, L) => {
  const N = R(rng, lv(L, 10, 25, 100), lv(L, 20, 60, 150));
  const ans = countDigits(N);
  const steps: Step[] = [{ q: 'Từ 1 đến 9 có 9 số, mỗi số 1 chữ số. Là mấy chữ số?', a: 9 }];
  const twoCount = Math.min(N, 99) - 9;
  steps.push({ q: `Từ 10 đến ${Math.min(N, 99)} có ${twoCount} số, mỗi số 2 chữ số. Là mấy chữ số?`, a: twoCount * 2 });
  if (N >= 100) steps.push({ q: `Từ 100 đến ${N} có ${N - 99} số, mỗi số 3 chữ số. Là mấy chữ số?`, a: (N - 99) * 3 });
  steps.push({ q: 'Cộng tất cả lại?', a: ans });
  return inputQ(`cs-count-${N}`, SOLVE, ans, {
    ask: `Viết các số từ 1 đến ${N} thì cần tất cả bao nhiêu chữ số?`,
    unit: 'chữ số',
    tip: 'Chia ra: số có 1 chữ số, số có 2 chữ số, số có 3 chữ số.',
    steps,
  });
};

const csOccur: Gen = (rng, L) => {
  const N = R(rng, lv(L, 20, 40, 60), lv(L, 35, 70, 99));
  const d = R(rng, 1, 9);
  let units = 0;
  let tens = 0;
  for (let i = 1; i <= N; i++) {
    if (i % 10 === d) units++;
    if (i >= 10 && Math.floor(i / 10) === d) tens++;
  }
  return inputQ(`cs-occ-${N}-${d}`, SOLVE, units + tens, {
    ask: `Viết các số từ 1 đến ${N}. Chữ số ${d} xuất hiện bao nhiêu lần?`,
    unit: 'lần',
    tip: 'Đếm riêng ở hàng đơn vị và ở hàng chục.',
    steps: [
      { q: `Ở hàng đơn vị, chữ số ${d} xuất hiện mấy lần?`, a: units },
      { q: `Ở hàng chục, chữ số ${d} xuất hiện mấy lần?`, a: tens },
      { q: `${units} + ${tens} = ?`, a: units + tens },
    ],
  });
};

const DESCRIBED: [string, number, number][] = [
  // [mô tả, số, cấp tối thiểu]
  ['số lớn nhất có một chữ số', 9, 1],
  ['số bé nhất có hai chữ số', 10, 1],
  ['số lớn nhất có hai chữ số', 99, 1],
  ['số tròn chục lớn nhất có hai chữ số', 90, 1],
  ['số bé nhất có hai chữ số giống nhau', 11, 1],
  ['số lớn nhất có hai chữ số khác nhau', 98, 2],
  ['số chẵn lớn nhất có hai chữ số', 98, 2],
  ['số lẻ bé nhất có hai chữ số', 11, 2],
  ['số bé nhất có ba chữ số', 100, 2],
  ['số lớn nhất có ba chữ số', 999, 2],
  ['số bé nhất có ba chữ số khác nhau', 102, 3],
  ['số tròn trăm lớn nhất có ba chữ số', 900, 3],
  ['số lớn nhất có ba chữ số khác nhau', 987, 3],
];

const csDescribe: Gen = (rng, L) => {
  const [desc, n] = pick(
    DESCRIBED.filter(([, , min]) => min <= L),
    rng,
  );
  const mode = L === 1 ? 0 : R(rng, 0, 2);
  if (mode === 0) {
    return inputQ(`cs-desc-${n}-0`, SOLVE, n, {
      ask: `Tìm ${desc}.`,
      tip: 'Đọc thật kỹ từng chữ: "lớn nhất", "bé nhất", "khác nhau", "chẵn", "lẻ".',
      steps: [{ q: `Viết thử: ${desc} là số nào?`, a: n }],
    });
  }
  const after = mode === 1;
  return inputQ(`cs-desc-${n}-${mode}`, SOLVE, after ? n + 1 : n - 1, {
    ask: `Tìm số liền ${after ? 'sau' : 'trước'} của ${desc}.`,
    tip: `Số liền ${after ? 'sau thì cộng' : 'trước thì trừ'} 1.`,
    steps: [
      { q: `${desc[0]!.toUpperCase()}${desc.slice(1)} là số nào?`, a: n },
      { q: `Số liền ${after ? 'sau' : 'trước'}: ${n} ${after ? '+' : M} 1 = ?`, a: after ? n + 1 : n - 1 },
    ],
  });
};

const csBetween: Gen = (rng, L) => {
  const a = R(rng, 11, lv(L, 40, 60, 300));
  const b = a + R(rng, 20, lv(L, 50, 60, 400));
  const tensKind = L < 3 || rng() < 0.5;
  const step = tensKind ? 10 : 100;
  let count = 0;
  let first = 0;
  let last = 0;
  for (let i = a + 1; i < b; i++) {
    if (i % step === 0) {
      if (!count) first = i;
      last = i;
      count++;
    }
  }
  if (count === 0) return csDescribe(rng, L);
  const word = tensKind ? 'tròn chục' : 'tròn trăm';
  return inputQ(`cs-btw-${a}-${b}-${step}`, SOLVE, count, {
    ask: `Có bao nhiêu số ${word} lớn hơn ${a} và bé hơn ${b}?`,
    unit: 'số',
    tip: `Viết lần lượt các số ${word} từ nhỏ đến lớn rồi đếm.`,
    steps: [
      { q: `Số ${word} đầu tiên lớn hơn ${a} là?`, a: first },
      { q: `Số ${word} cuối cùng bé hơn ${b} là?`, a: last },
      { q: `Từ ${first} đến ${last} có mấy số ${word}?`, a: count },
    ],
  });
};

// ===================== Danh sách chủ đề =====================
export const PRIMARY_TOPICS: PrimaryTopic[] = [
  {
    id: 'compare',
    name: 'Hơn kém',
    description: 'Nhiều hơn, ít hơn, cho và nhận, chia cho bằng nhau',
    icon: '⚖️',
    theme: { primary: '#F08C00', soft: '#FFF0D6', strong: '#A85F00' },
    gens: [
      [hkChange, 1],
      [hkEqual, 1],
      [hkTotal, 1],
      [hkSumDiff, 2],
    ],
  },
  {
    id: 'reverse',
    name: 'Tính ngược',
    description: 'Tìm số lúc đầu, số bí ẩn, chép nhầm số',
    icon: '🔄',
    theme: { primary: '#7950F2', soft: '#EEE8FF', strong: '#5235AB' },
    gens: [
      [tnThink, 1],
      [tnSold, 1],
      [tnBox, 1],
      [tnHalf, 2],
      [tnTypo, 2],
    ],
  },
  {
    id: 'symbols',
    name: 'Hình bí ẩn',
    description: 'Hình thay cho số, cân thăng bằng, đổi đồ',
    icon: '🔐',
    theme: { primary: '#E64980', soft: '#FFE3EE', strong: '#A61E4D' },
    gens: [
      [hbDouble, 1],
      [hbTwice, 1],
      [hbBalance, 1],
      [hbSumDiff, 2],
      [hbTriple, 2],
    ],
  },
  {
    id: 'patterns',
    name: 'Quy luật',
    description: 'Dãy số, dãy hình, tháp số',
    icon: '🧩',
    theme: { primary: '#1C7ED6', soft: '#DDEEFF', strong: '#1559A0' },
    gens: [
      [qlSeq, 1],
      [qlCycle, 1],
      [qlPyramid, 1],
      [qlAlt, 2],
      [qlGrow, 2],
    ],
  },
  {
    id: 'time',
    name: 'Thời gian',
    description: 'Tuổi, lịch, đồng hồ, trồng cây',
    icon: '⏰',
    theme: { primary: '#0CA678', soft: '#DDF8EC', strong: '#087F5B' },
    gens: [
      [tgAgeDiff, 1],
      [tgCalendar, 1],
      [tgClock, 1],
      [tgTrees, 1],
      [tgAgeSum, 2],
    ],
  },
  {
    id: 'logic',
    name: 'Suy luận',
    description: 'Xếp hàng, ai là ai, bốc bi, bắt tay, đếm chân',
    icon: '🕵️',
    theme: { primary: '#495057', soft: '#EDEFF2', strong: '#212529' },
    gens: [
      [ttOrder, 1],
      [ttQueue, 1],
      [ttPigeon, 1],
      [ttLegs, 1],
      [ttShake, 2],
      [ttVenn, 2],
    ],
  },
  {
    id: 'digits',
    name: 'Chữ số',
    description: 'Lập số, tổng chữ số, đếm chữ số, số liền trước – liền sau',
    icon: '🔢',
    theme: { primary: '#D6336C', soft: '#FFE0EA', strong: '#A61E4D' },
    gens: [
      [csBuild, 1],
      [csSum, 1],
      [csDescribe, 1],
      [csCount, 2],
      [csOccur, 2],
      [csBetween, 2],
    ],
  },
];

export const TOPIC_LEVELS = [
  { level: 1, label: 'Khởi động' },
  { level: 2, label: 'Nâng cao' },
  { level: 3, label: 'Thử thách' },
];
