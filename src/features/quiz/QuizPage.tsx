/**
 * Màn hình làm bài – DÙNG CHUNG cho mọi chương.
 * Phần riêng của chương (QuestionView, giọng đọc) lấy từ ui-registry.
 */
import { Volume2, WifiOff } from 'lucide-react';
import { Navigate, useParams } from 'react-router-dom';
import { getChapter } from '../../chapters/registry';
import { getChapterUI } from '../../chapters/ui-registry';
import { Mascot } from '../../components/Mascot';
import { BackButton, LoadingMascotDots, PageShell, ProgressBar } from '../../components/ui';
import { getCurrentQuestion, getTriedWrongOptions } from '../../engine/QuizSession';
import { AnswerOptions, FeedbackBubble } from './QuizComponents';
import { ResultScreen, RewardCelebration } from './ResultScreens';
import { useQuiz } from './useQuiz';
import type { AnyChapter } from '../../chapters/registry';
import type { ChapterUI } from '../../chapters/ui-registry';

export function QuizPage() {
  const { chapterId = '' } = useParams();
  const chapter = getChapter(chapterId);
  const ui = getChapterUI(chapterId);
  if (!chapter || !chapter.enabled || !ui) return <Navigate to="/" replace />;
  return <QuizRunner key={chapter.id} chapter={chapter} ui={ui} />;
}

function QuizRunner({ chapter, ui }: { chapter: AnyChapter; ui: ChapterUI }) {
  const quiz = useQuiz(chapter, ui);
  const { state, stage, result } = quiz;

  if (stage === 'celebrate' && result) {
    return <RewardCelebration result={result} onContinue={quiz.showResult} />;
  }

  if (stage === 'result' && result) {
    return (
      <PageShell>
        <ResultScreen result={result} onReplay={() => void quiz.restart()} onRetrySave={quiz.retrySave} />
      </PageShell>
    );
  }

  if (stage === 'loading' || stage === 'submitting' || !state) {
    return (
      <PageShell className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 pt-24">
          <Mascot mood="thinking" size={140} />
          <p className="text-2xl font-bold">{stage === 'submitting' ? 'Đang chấm điểm...' : 'Chuẩn bị nào...'}</p>
          <LoadingMascotDots />
        </div>
      </PageShell>
    );
  }

  const question = getCurrentQuestion(state);
  if (!question) return null;
  const { QuestionView } = ui;

  return (
    <PageShell className="pb-32">
      <div className="mb-3 flex items-center gap-3">
        <BackButton to={`/chuong/${chapter.id}`} />
        <div className="flex flex-1 flex-col gap-1">
          <ProgressBar value={state.currentIndex + (state.phase === 'correct' ? 1 : 0)} max={state.questions.length} color={chapter.theme.primary} label="Tiến độ bài" />
        </div>
        <span className="shrink-0 rounded-2xl bg-white px-3 py-2 text-2xl font-extrabold shadow-pop-sm" data-testid="question-progress">
          {state.currentIndex + 1}/{state.questions.length}
        </span>
      </div>

      {quiz.offline && (
        <p className="mb-2 flex items-center justify-center gap-2 text-sm text-ink/50">
          <WifiOff size={16} /> Đang chơi ngoại tuyến – kết quả sẽ không được lưu
        </p>
      )}

      <div className="flex flex-col items-center gap-4 sm:gap-6">
        <button
          type="button"
          onClick={quiz.repeatPrompt}
          className="flex min-h-[64px] max-w-full items-center gap-3 rounded-full bg-white px-6 py-2 shadow-pop-sm active:translate-y-0.5"
          aria-label={`${question.prompt} – chạm để nghe lại`}
        >
          <Volume2 size={32} className="shrink-0" style={{ color: chapter.theme.strong }} />
          <span className="text-2xl font-extrabold sm:text-4xl" data-testid="question-prompt">
            {question.prompt}
          </span>
        </button>

        <QuestionView key={question.id} question={question} />

        <AnswerOptions
          options={question.options}
          correctAnswer={question.correctAnswer}
          triedWrong={getTriedWrongOptions(state)}
          phase={state.phase}
          lastSelected={state.lastSelected}
          onAnswer={quiz.answer}
        />
      </div>

      <FeedbackBubble phase={state.phase} praise={quiz.praise} />
    </PageShell>
  );
}
