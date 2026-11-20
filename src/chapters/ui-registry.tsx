/**
 * Đăng ký phần GIAO DIỆN của từng chương. Bộ máy trò chơi (QuizPage) chỉ
 * gọi các thành phần này qua giao diện chung, không biết chi tiết chương.
 *
 * Thêm chương mới = thêm 1 mục vào CHAPTER_UI (cùng id với registry.ts).
 */
import { KeyRound, Undo2, BookOpen, Brain, Calculator, Clock, Compass, Hash as HashIcon, Palette, Puzzle, Scale, ShoppingBasket, Triangle, Type, Eye, Lightbulb, Shapes, Sparkles, Target, Hash, Minus, PawPrint, Plus, Search, type LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import { objectImage } from '../data/objects/catalog';
import { findNumberVoice, VOICE_PHRASES, type VoiceLine } from '../data/voice';
import { ArithmeticIllustration, ArithmeticQuestionView } from './arithmetic/components/ArithmeticViews';
import { arithmeticChapters, ARITHMETIC_OP_OF, ARITHMETIC_ROOT_ID } from './arithmetic/config';
import { BrainIllustration, brainImages, BrainOption, brainOptionLabel, BrainQuestionView } from './brain/components/BrainViews';
import { brainChapters, BRAIN_ROOT_ID, BRAIN_SKILL_OF, type BrainSkill } from './brain/config';
import { memoryShowMs, type BrainPayload } from './brain/generators';
import { DadaIllustration, DadaOption, dadaOptionLabel, DadaQuestionView } from './dada/components/DadaViews';
import { dadaChapters, TOPIC_OF } from './dada/config';
import { flashMs, speechFile, speechOf, type DadaPayload } from './dada/kit';
import type { ArithmeticPayload } from './arithmetic/generator';
import { arithmeticSpeech, arithmeticVoiceFile } from './arithmetic/operations';
import type { Question } from '../engine/types';
import { PrimaryIllustration, PrimaryOption, primaryOptionLabel, PrimaryQuestionView } from './primary/components/PrimaryViews';
import { MENTAL_ROOT_ID, primaryChapters, PRIMARY_TOPIC_OF, THINK_HUB_ID } from './primary/config';
import { speechOfPrimary, type PrimaryPayload } from './primary/kit';
import { FindingIllustration, FindingQuestionView } from './number-finding/components/FindingViews';
import type { NumberFindingPayload } from './number-finding/generator';
import { NumberFlashcards } from './number-recognition/components/NumberFlashcards';
import { NUMBER_RECOGNITION_TYPE } from './number-recognition/generator';
import { numberLevelChapters } from './number-recognition/levels';
import { NumberIllustration, NumberQuestionView } from './number-recognition/components/NumberViews';
import type { NumberRecognitionPayload } from './number-recognition/generator';
import { CountingIllustration, CountingQuestionView } from './object-counting/components/CountingViews';
import type { ObjectCountingPayload } from './object-counting/generator';

export interface ChapterUI<P = Record<string, unknown>> {
  Icon: LucideIcon;
  Illustration: ComponentType;
  /** `wrongTries`: số lần bé đã trả lời sai câu này (vd. để hiện gợi ý từng bước). */
  QuestionView: ComponentType<{ question: Question<P>; wrongTries?: number }>;
  /** Giai đoạn học trước khi kiểm tra (nếu có). */
  Learning?: { label: string; Icon: LucideIcon; View: ComponentType<{ onFinished: () => void }> };
  introVoice: VoiceLine;
  /** Giọng đọc câu hỏi. */
  promptVoice: (question: Question<P>) => VoiceLine;
  /** Nội dung phương án (vd. hình) – mặc định là con số. */
  OptionContent?: ComponentType<{ value: number; question: Question<P> }>;
  /** Nhãn phương án cho trình đọc màn hình. */
  optionLabel?: (value: number, question: Question<P>) => string;
  /** Ẩn phương án trong bao lâu (ms) sau khi hiện câu hỏi – vd. trò ghi nhớ. */
  optionsDelayMs?: (question: Question<P>) => number;
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

const numberFindingUI: ChapterUI<NumberFindingPayload> = {
  Icon: Search,
  Illustration: FindingIllustration,
  QuestionView: FindingQuestionView,
  introVoice: VOICE_PHRASES.chapterNumberFinding,
  promptVoice: (q) => findNumberVoice(q.payload.number),
};

/** Giao diện chung cho mọi trò phép tính; biểu tượng theo phép tính. */
function arithmeticUI(chapterId: string, op: string): ChapterUI<ArithmeticPayload> {
  return {
    Icon: chapterId === ARITHMETIC_ROOT_ID ? Calculator : op === 'sub' ? Minus : Plus,
    Illustration: ArithmeticIllustration,
    QuestionView: ArithmeticQuestionView,
    introVoice: VOICE_PHRASES.chapterArithmetic,
    promptVoice: (q) => ({ file: arithmeticVoiceFile(q.payload.op, q.payload.a, q.payload.b), text: arithmeticSpeech(q.payload.op, q.payload.a, q.payload.b) }),
    preload: (qs) => qs.map((q) => objectImage(q.payload.objectId)),
  };
}

const TOPIC_ICONS: Record<string, LucideIcon> = {
  colors: Palette,
  shapes: Triangle,
  counting: HashIcon,
  math: Calculator,
  compare: Scale,
  classify: ShoppingBasket,
  observe: Eye,
  patterns: Puzzle,
  maze: Compass,
  letters: Type,
  time: Clock,
};

/** Giao diện chung cho mọi chủ đề "Sân chơi tư duy". */
function dadaUI(chapterId: string): ChapterUI<DadaPayload> {
  const topic = TOPIC_OF.get(chapterId)!;
  const Illustration = () => <DadaIllustration icon={topic.icon} />;
  return {
    Icon: TOPIC_ICONS[topic.id] ?? Shapes,
    Illustration,
    QuestionView: DadaQuestionView,
    introVoice: VOICE_PHRASES.chapterDada,
    promptVoice: (q) => ({ file: speechFile(speechOf(q)), text: speechOf(q) }),
    OptionContent: DadaOption,
    optionLabel: dadaOptionLabel,
    optionsDelayMs: (q) => {
      const ms = flashMs(q.payload.blocks);
      return ms ? ms + 300 : 0;
    },
  };
}

const BRAIN_ICONS: Record<BrainSkill, LucideIcon> = { observe: Eye, attention: Target, logic: Lightbulb, memory: Brain, imagine: Sparkles };

/** Giao diện chung cho "Sân chơi trí tuệ"; giọng đọc và hình theo từng loại câu hỏi. */
function brainUI(chapterId: string): ChapterUI<BrainPayload> {
  return {
    Icon: chapterId === BRAIN_ROOT_ID ? Shapes : BRAIN_ICONS[BRAIN_SKILL_OF.get(chapterId)!],
    Illustration: BrainIllustration,
    QuestionView: BrainQuestionView,
    introVoice: VOICE_PHRASES.chapterBrain,
    promptVoice: (q) => {
      const p = q.payload;
      switch (p.kind) {
        case 'observe':
          return VOICE_PHRASES.brainObserve;
        case 'attention':
          return { file: `questions/count-${p.target}`, text: q.prompt };
        case 'pattern':
          return VOICE_PHRASES.brainPattern;
        case 'odd':
          return VOICE_PHRASES.brainOdd;
        case 'memory':
          return VOICE_PHRASES.brainMemoryLook;
        case 'silhouette':
          return VOICE_PHRASES.brainSilhouette;
      }
    },
    OptionContent: BrainOption,
    optionLabel: brainOptionLabel,
    optionsDelayMs: (q) => (q.payload.kind === 'memory' ? memoryShowMs(q.payload.shown.length) + 300 : 0),
    preload: (qs) => qs.flatMap(brainImages),
  };
}

const PRIMARY_ICONS: Record<string, LucideIcon> = {
  compare: Scale,
  reverse: Undo2,
  symbols: KeyRound,
  patterns: Puzzle,
  time: Clock,
  logic: Search,
  digits: HashIcon,
};

/** Giao diện chung nhóm 5–9 tuổi: đề bài đọc bằng giọng hệ thống (đề sinh ngẫu nhiên, không có file ghi âm). */
function primaryUI(chapterId: string): ChapterUI<PrimaryPayload> {
  const topic = PRIMARY_TOPIC_OF.get(chapterId);
  const look =
    chapterId === MENTAL_ROOT_ID || chapterId.startsWith(`${MENTAL_ROOT_ID}-`)
      ? { Icon: Calculator, emoji: '🧮' }
      : chapterId === THINK_HUB_ID
        ? { Icon: Lightbulb, emoji: '💡' }
        : { Icon: PRIMARY_ICONS[topic?.id ?? ''] ?? Lightbulb, emoji: topic?.icon ?? '💡' };
  const Illustration = () => <PrimaryIllustration emoji={look.emoji} />;
  return {
    Icon: look.Icon,
    Illustration,
    QuestionView: PrimaryQuestionView,
    introVoice: { file: '', text: topic?.name ?? (chapterId === THINK_HUB_ID ? 'Tư duy toán' : 'Tính nhẩm') },
    promptVoice: (q) => ({ file: '', text: speechOfPrimary(q) }),
    OptionContent: PrimaryOption,
    optionLabel: primaryOptionLabel,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CHAPTER_UI: Record<string, ChapterUI<any>> = {
  'number-recognition': numberRecognitionUI,
  'object-counting': objectCountingUI,
  'number-finding': numberFindingUI,
  ...Object.fromEntries(dadaChapters.map((c) => [c.id, dadaUI(c.id)])),
  ...Object.fromEntries(primaryChapters.map((c) => [c.id, primaryUI(c.id)])),
  ...Object.fromEntries(brainChapters.map((c) => [c.id, brainUI(c.id)])),
  ...Object.fromEntries(arithmeticChapters.map((c) => [c.id, arithmeticUI(c.id, ARITHMETIC_OP_OF.get(c.id)!)])),
  // Các cấp 11–20, ...: dùng lại giao diện cấp 1–10, thẻ học theo phạm vi của cấp.
  ...Object.fromEntries(
    numberLevelChapters.map((c) => {
      if (c.questionType !== NUMBER_RECOGNITION_TYPE) return [c.id, numberFindingUI];
      const View = ({ onFinished }: { onFinished: () => void }) => <NumberFlashcards onFinished={onFinished} range={c.range} />;
      return [c.id, { ...numberRecognitionUI, Learning: { ...numberRecognitionUI.Learning!, View } }];
    }),
  ),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getChapterUI(chapterId: string): ChapterUI<any> | undefined {
  return CHAPTER_UI[chapterId];
}
