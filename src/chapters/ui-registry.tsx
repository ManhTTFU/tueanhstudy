/**
 * Đăng ký phần GIAO DIỆN của từng chương. Bộ máy trò chơi (QuizPage) chỉ
 * gọi các thành phần này qua giao diện chung, không biết chi tiết chương.
 *
 * Thêm chương mới = thêm 1 mục vào CHAPTER_UI (cùng id với registry.ts).
 */
import { BookOpen, Hash, PawPrint, type LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import { objectImage } from '../data/objects/catalog';
import { VOICE_PHRASES, type VoiceLine } from '../data/voice';
import type { Question } from '../engine/types';
import { NumberFlashcards } from './number-recognition/components/NumberFlashcards';
import { NumberIllustration, NumberQuestionView } from './number-recognition/components/NumberViews';
import type { NumberRecognitionPayload } from './number-recognition/generator';
import { CountingIllustration, CountingQuestionView } from './object-counting/components/CountingViews';
import type { ObjectCountingPayload } from './object-counting/generator';

export interface ChapterUI<P = Record<string, unknown>> {
  Icon: LucideIcon;
  Illustration: ComponentType;
  QuestionView: ComponentType<{ question: Question<P> }>;
  /** Giai đoạn học trước khi kiểm tra (nếu có). */
  Learning?: { label: string; Icon: LucideIcon; View: ComponentType<{ onFinished: () => void }> };
  introVoice: VoiceLine;
  /** Giọng đọc câu hỏi. */
  promptVoice: (question: Question<P>) => VoiceLine;
  /** Đường dẫn tài nguyên cần tải trước cho bộ câu hỏi. */
  preload?: (questions: Question<P>[]) => string[];
}

const numberRecognitionUI: ChapterUI<NumberRecognitionPayload> = {
  Icon: Hash,
  Illustration: NumberIllustration,
  QuestionView: NumberQuestionView,
  Learning: { label: 'Học thẻ số', Icon: BookOpen, View: NumberFlashcards },
  introVoice: VOICE_PHRASES.chapterNumberRecognition,
  promptVoice: () => VOICE_PHRASES.questionNumber,
};

const objectCountingUI: ChapterUI<ObjectCountingPayload> = {
  Icon: PawPrint,
  Illustration: CountingIllustration,
  QuestionView: CountingQuestionView,
  introVoice: VOICE_PHRASES.chapterObjectCounting,
  promptVoice: (q) => ({ file: `questions/count-${q.payload.objectId}`, text: q.prompt }),
  preload: (qs) => qs.map((q) => objectImage(q.payload.objectId)),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CHAPTER_UI: Record<string, ChapterUI<any>> = {
  'number-recognition': numberRecognitionUI,
  'object-counting': objectCountingUI,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getChapterUI(chapterId: string): ChapterUI<any> | undefined {
  return CHAPTER_UI[chapterId];
}
