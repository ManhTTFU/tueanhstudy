/**
 * useQuiz – nối QuizSession (thuần) với giao diện, âm thanh, hiệu ứng và API.
 * Dùng chung cho MỌI chương: chương chỉ cung cấp cấu hình + generator + UI.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnyChapter } from '../../chapters/registry';
import type { ChapterUI } from '../../chapters/ui-registry';
import { chapterAgeGroup } from '../../chapters/registry';
import { phrasesFor, praiseVoice } from '../../data/voice';
import { messagesFor } from '../../engine/messages';
import { generateQuiz } from '../../engine/QuizEngine';
import { buildLocalResult, type QuizResult } from '../../engine/QuizResult';
import {
  answerQuestion,
  createQuizSession,
  getCurrentQuestion,
  nextQuestion,
  retryQuestion,
  toSubmission,
  type QuizSessionState,
} from '../../engine/QuizSession';
import type { AnswerValue, Question } from '../../engine/types';
import { api, ApiClientError } from '../../services/api';
import { AnimationController } from '../animation/AnimationController';
import { AudioController } from '../audio/AudioController';

export type QuizStage = 'loading' | 'playing' | 'submitting' | 'celebrate' | 'result' | 'locked' | 'unavailable';

/** Thời gian tối thiểu hiện lời khen trước khi sang câu mới. */
export const FEEDBACK_CORRECT_MS = 1700;
export const FEEDBACK_WRONG_MS = 1700;
/** Nghỉ ngắn sau khi đọc xong lời khen rồi mới đọc câu tiếp theo. */
const PAUSE_AFTER_PRAISE_MS = 300;
/** Chặn trên: mạng chậm / âm thanh bị treo thì vẫn sang câu mới, bé không phải chờ mãi. */
const FEEDBACK_CORRECT_MAX_MS = 4500;

export interface QuizResultView extends QuizResult {
  totalCandies?: number;
  giftsAvailable?: number;
  coinsEarned?: number;
}

export function useQuiz(chapter: AnyChapter, ui: ChapterUI) {
  // Lời khen / động viên theo nhóm tuổi của chương.
  const ageGroup = chapterAgeGroup(chapter);
  const messages = messagesFor(ageGroup);
  const phrases = phrasesFor(ageGroup);
  const [state, setState] = useState<QuizSessionState | null>(null);
  const [stage, setStage] = useState<QuizStage>('loading');
  const [result, setResult] = useState<QuizResultView | null>(null);
  const [praise, setPraise] = useState('');
  const [offline, setOffline] = useState(false);
  /** Lý do không có bài (vd. "Chưa có câu sai nào để ôn"). */
  const [unavailable, setUnavailable] = useState('');
  const timers = useRef<number[]>([]);
  const submitted = useRef(false);
  const runId = useRef(0);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const start = useCallback(async () => {
    clearTimers();
    AnimationController.stop();
    const myRun = ++runId.current;
    submitted.current = false;
    setStage('loading');
    setResult(null);
    let sessionId: string | null = null;
    let questions: Question[];
    try {
      const started = await api.startQuiz(chapter.id);
      sessionId = started.sessionId;
      questions = started.questions;
      setOffline(false);
    } catch (e) {
      // Cấp chưa mở khoá (server chặn): không cho chơi ngoại tuyến để lách luật.
      if (e instanceof ApiClientError && e.status === 403) {
        if (myRun === runId.current) setStage('locked');
        return;
      }
      // Không có bài để làm (vd. danh sách câu sai đang trống).
      if (e instanceof ApiClientError && e.status === 409) {
        if (myRun === runId.current) {
          setUnavailable(e.message);
          setStage('unavailable');
        }
        return;
      }
      // Ngoại tuyến / lỗi máy chủ: bé vẫn chơi được, nhưng kết quả không được lưu.
      questions = generateQuiz(chapter) as Question[];
      setOffline(true);
    }
    if (myRun !== runId.current) return;
    AudioController.preload(['correct', 'wrong', 'celebrate'].map((s) => `/assets/sounds/sfx/${s}.wav`));
    // Tải trước lời khen để đọc ngay khi bé trả lời đúng (iPhone tải file âm thanh chậm).
    AudioController.preload(messages.praises.map((_, i) => `/assets/sounds/${praiseVoice(i, ageGroup).file}.m4a`));
    ui.preload?.(questions).forEach((src) => {
      const img = new Image();
      img.src = src;
    });
    setState(createQuizSession({ sessionId, chapterId: chapter.id, questions }));
    setStage('playing');
  }, [chapter, ui]);

  useEffect(() => {
    void start();
    return () => {
      runId.current++;
      clearTimers();
      AudioController.stopVoice();
      AnimationController.stop();
    };
  }, [start]);

  // Đọc câu hỏi mỗi khi sang câu mới.
  const currentIndex = state?.currentIndex;
  const sessionKey = state?.startedAt;
  useEffect(() => {
    if (stage !== 'playing' || !state || state.phase !== 'answering') return;
    const q = getCurrentQuestion(state);
    if (q) void AudioController.speak(ui.promptVoice(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, sessionKey, stage]);

  const repeatPrompt = useCallback(() => {
    const q = state && getCurrentQuestion(state);
    if (q) void AudioController.speak(ui.promptVoice(q));
  }, [state, ui]);

  const submit = useCallback(async (finalState: QuizSessionState) => {
    setStage('submitting');
    const local = buildLocalResult(finalState, ageGroup);
    let view: QuizResultView = local;
    if (finalState.sessionId) {
      try {
        const server = await api.completeQuiz(finalState.sessionId, toSubmission(finalState));
        view = {
          ...local,
          ...server,
          rewards: server.rewards,
          saved: true,
          totalCandies: server.totals.totalCandies,
          giftsAvailable: server.totals.giftsAvailable,
        };
      } catch {
        view = { ...local, saved: false };
      }
    }
    setResult(view);
    if (view.isPerfectScore) {
      AnimationController.bigCelebration();
      AudioController.sfx('celebrate');
      void AudioController.speak(phrases.perfect);
      setStage('celebrate');
    } else {
      const voice =
        view.score >= 8 ? phrases.resultGreat : view.score >= 5 ? phrases.resultGood : phrases.resultTry;
      void AudioController.speak(voice);
      setStage('result');
    }
  }, []);

  /** Thử lưu lại kết quả (cùng sessionId => server không cộng thưởng trùng). */
  const retrySave = useCallback(() => {
    if (state?.phase === 'finished') void submit(state);
  }, [state, submit]);

  useEffect(() => {
    if (state?.phase === 'finished' && !submitted.current) {
      submitted.current = true;
      void submit(state);
    }
  }, [state, submit]);

  const answer = useCallback(
    (value: AnswerValue) => {
      if (!state || stage !== 'playing' || state.phase !== 'answering') return;
      const next = answerQuestion(state, value);
      if (next === state) return;
      setState(next);
      if (next.phase === 'correct') {
        const i = Math.floor(Math.random() * messages.praises.length);
        setPraise(messages.praises[i]!);
        AudioController.sfx('correct');
        AnimationController.smallBurst();
        // Sang câu mới khi ĐÃ đọc xong lời khen (câu hỏi mới sẽ ngắt giọng đang đọc),
        // nhưng không sớm hơn FEEDBACK_CORRECT_MS và không muộn hơn FEEDBACK_CORRECT_MAX_MS.
        const myRun = runId.current;
        const shownAt = Date.now();
        let advanced = false;
        const advance = () => {
          if (advanced || myRun !== runId.current) return;
          advanced = true;
          setState((s) => (s ? nextQuestion(s) : s));
        };
        later(() => {
          void AudioController.speak(praiseVoice(i, ageGroup)).then(() => {
            if (myRun !== runId.current) return;
            later(advance, Math.max(PAUSE_AFTER_PRAISE_MS, FEEDBACK_CORRECT_MS - (Date.now() - shownAt)));
          });
        }, 250);
        later(advance, FEEDBACK_CORRECT_MAX_MS);
      } else {
        AudioController.sfx('wrong');
        later(() => void AudioController.speak(phrases.tryAgain), 200);
        later(() => setState((s) => (s ? retryQuestion(s) : s)), FEEDBACK_WRONG_MS);
      }
    },
    [state, stage],
  );

  return {
    state,
    stage,
    result,
    praise,
    tryAgainMessage: messages.tryAgain,
    perfectMessage: messages.perfect,
    offline,
    unavailable,
    answer,
    restart: start,
    repeatPrompt,
    retrySave,
    showResult: () => {
      AnimationController.stop();
      setStage('result');
    },
  };
}
