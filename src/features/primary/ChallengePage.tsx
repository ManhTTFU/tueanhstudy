/**
 * "Thử thách 60 giây" (nhóm 5–9 tuổi): nhẩm thật nhanh cộng, trừ qua 10.
 * Đề do server sinh; hết giờ thì gửi các câu đã trả lời để server tự chấm và cộng xu.
 */
import { motion } from 'framer-motion';
import { Play, RotateCcw, Timer, Trophy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Mascot } from '../../components/Mascot';
import { BackButton, LoadingMascotDots, PageShell } from '../../components/ui';
import { api, type ChallengeResult, type StartedChallenge } from '../../services/api';
import { AudioController } from '../audio/AudioController';
import { NumberPad } from '../quiz/QuizComponents';

type Stage = 'intro' | 'countdown' | 'playing' | 'submitting' | 'result' | 'error';

export function ChallengePage() {
  const [stage, setStage] = useState<Stage>('intro');
  const [run, setRun] = useState<StartedChallenge | null>(null);
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(0);
  const [count, setCount] = useState(3);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [error, setError] = useState('');
  const [best, setBest] = useState<number | null>(null);
  const answers = useRef<{ questionId: string; value: number }[]>([]);
  const endAt = useRef(0);

  useEffect(() => {
    api
      .primaryOverview()
      .then((o) => setBest(o.challengeBest))
      .catch(() => undefined);
  }, []);

  const start = useCallback(async () => {
    setError('');
    setResult(null);
    try {
      const r = await api.startChallenge();
      setRun(r);
      setBest(r.best);
      answers.current = [];
      setIndex(0);
      setCount(3);
      setStage('countdown');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa kết nối được máy chủ');
      setStage('error');
    }
  }, []);

  // Đếm ngược 3-2-1 rồi bắt đầu tính giờ.
  useEffect(() => {
    if (stage !== 'countdown') return;
    if (count === 0) {
      endAt.current = Date.now() + (run?.durationMs ?? 60_000);
      setLeft(run?.durationMs ?? 60_000);
      setStage('playing');
      return;
    }
    AudioController.sfx('tap');
    const t = window.setTimeout(() => setCount((c) => c - 1), 800);
    return () => window.clearTimeout(t);
  }, [stage, count, run]);

  const finish = useCallback(async () => {
    if (!run) return;
    setStage('submitting');
    try {
      const r = await api.completeChallenge(run.runId, answers.current);
      setResult(r);
      if (r.isRecord) AudioController.sfx('celebrate');
      setStage('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được kết quả');
      setStage('error');
    }
  }, [run]);

  useEffect(() => {
    if (stage !== 'playing') return;
    const t = window.setInterval(() => {
      const l = endAt.current - Date.now();
      setLeft(Math.max(0, l));
      if (l <= 0) {
        window.clearInterval(t);
        void finish();
      }
    }, 100);
    return () => window.clearInterval(t);
  }, [stage, finish]);

  const q = run?.questions[index];

  const submit = (value: number) => {
    if (stage !== 'playing' || !q || !run) return;
    answers.current.push({ questionId: q.id, value });
    const ok = value === q.answer;
    AudioController.sfx(ok ? 'correct' : 'wrong');
    setFlash(ok ? { ok, text: 'Đúng!' } : { ok, text: `${q.text} = ${q.answer}` });
    if (index + 1 >= run.questions.length) void finish();
    else setIndex(index + 1);
  };

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 900);
    return () => window.clearTimeout(t);
  }, [flash]);

  const correctSoFar = run ? answers.current.filter((a, i) => a.value === run.questions[i]!.answer).length : 0;

  return (
    <PageShell>
      <div className="mb-4 flex items-center gap-3">
        <BackButton to="/" />
        <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
          <Timer className="text-peach-500" /> Thử thách 60 giây
        </h1>
      </div>

      {(stage === 'intro' || stage === 'error') && (
        <div className="card mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center">
          <Mascot mood="happy" size={120} />
          <p className="text-xl font-bold">Nhẩm thật nhanh cộng, trừ qua 10 trong 60 giây. Cứ 2 câu đúng được 1 xu!</p>
          {best !== null && (
            <p className="flex items-center gap-2 text-2xl font-extrabold text-grape-500" data-testid="challenge-best">
              <Trophy /> Kỷ lục: {best} câu
            </p>
          )}
          {error && <p className="font-bold text-bubblegum-500">{error}</p>}
          <button type="button" className="kid-btn w-full bg-peach-400 text-white" onClick={() => void start()} data-testid="challenge-start">
            <Play size={30} fill="currentColor" /> Bắt đầu
          </button>
        </div>
      )}

      {stage === 'countdown' && (
        <motion.p key={count} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-24 text-center text-9xl font-extrabold text-peach-500">
          {count || 'Bắt đầu!'}
        </motion.p>
      )}

      {stage === 'playing' && q && (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3">
          <div className="h-5 w-full overflow-hidden rounded-full bg-white shadow-pop-sm" aria-label="Thời gian còn lại">
            <div
              className={`h-full rounded-full ${left < 10_000 ? 'bg-bubblegum-400' : 'bg-mint-400'}`}
              style={{ width: `${(left / (run?.durationMs ?? 60_000)) * 100}%` }}
            />
          </div>
          <div className="flex w-full justify-between text-xl font-extrabold">
            <span data-testid="challenge-left">⏱ {Math.ceil(left / 1000)} giây</span>
            <span data-testid="challenge-score">✅ {correctSoFar}</span>
          </div>
          <div className="card flex w-full flex-col items-center p-5">
            <p className="text-6xl font-extrabold tracking-wide" data-testid="challenge-question">
              {q.text} = ?
            </p>
            <p className={`h-8 text-xl font-extrabold ${flash?.ok ? 'text-mint-500' : 'text-sky-500'}`}>{flash?.text ?? ''}</p>
          </div>
          <NumberPad key={q.id} phase="answering" correctAnswer={q.answer} triedWrong={[]} onSubmit={submit} />
        </div>
      )}

      {stage === 'submitting' && (
        <div className="flex flex-col items-center gap-2 pt-24">
          <Mascot mood="thinking" size={140} />
          <p className="text-2xl font-bold">Đang chấm điểm...</p>
          <LoadingMascotDots />
        </div>
      )}

      {stage === 'result' && result && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card mx-auto flex max-w-md flex-col items-center gap-3 p-6 text-center" data-testid="challenge-result">
          <Mascot mood={result.isRecord ? 'cheer' : 'happy'} size={130} />
          {result.isRecord && <p className="text-3xl font-extrabold text-grape-500">🏆 Kỷ lục mới!</p>}
          <p className="text-2xl font-bold">
            Con nhẩm đúng <span className="text-5xl font-extrabold text-mint-500">{result.correct}</span> câu
          </p>
          {result.wrong > 0 && <p className="text-lg font-semibold text-ink/60">{result.wrong} câu cần luyện thêm</p>}
          {result.coinsEarned > 0 && <p className="rounded-3xl bg-sunny-100 px-4 py-2 text-xl font-extrabold">🪙 +{result.coinsEarned} xu</p>}
          <p className="font-bold text-ink/60">Kỷ lục: {result.best} câu</p>
          <button type="button" className="kid-btn w-full bg-peach-400 text-white" onClick={() => void start()} data-testid="challenge-again">
            <RotateCcw size={28} /> Chơi lại
          </button>
        </motion.div>
      )}
    </PageShell>
  );
}
