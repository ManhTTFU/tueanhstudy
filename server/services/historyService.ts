import { and, asc, count, desc, eq, type SQL } from 'drizzle-orm';
import { chapterProgress, quizAnswers, quizSessions } from '../../db/schema.js';
import { getChapter, getEnabledChapters } from '../../src/chapters/registry.js';
import { visualLabel, type Visual } from '../../src/chapters/dada/kit.js';
import { getObject } from '../../src/data/objects/catalog.js';
import type { Database } from '../db.js';
import { notFound } from '../errors.js';
import { ensureProgressRow, getStickerCounts, toChapterSummary, type ChapterSummary } from './progressService.js';

export interface HistoryItem {
  id: string;
  chapterId: string;
  chapterName: string;
  startedAt: string;
  completedAt: string | null;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  score: number;
  isPerfectScore: boolean;
  candiesEarned: number;
}

export interface HistoryPage {
  items: HistoryItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Lịch sử có phân trang – chỉ các bài đã hoàn thành. */
export async function getHistory(
  db: Database,
  familyId: string,
  { page, pageSize, chapterId }: { page: number; pageSize: number; chapterId?: string | undefined },
): Promise<HistoryPage> {
  const conditions: SQL[] = [eq(quizSessions.familyId, familyId), eq(quizSessions.status, 'completed')];
  if (chapterId) conditions.push(eq(quizSessions.chapterId, chapterId));
  const where = and(...conditions);
  const [totalRow] = await db.select({ n: count() }).from(quizSessions).where(where);
  const rows = await db
    .select({
      id: quizSessions.id,
      chapterId: quizSessions.chapterId,
      chapterName: quizSessions.chapterName,
      startedAt: quizSessions.startedAt,
      completedAt: quizSessions.completedAt,
      totalQuestions: quizSessions.totalQuestions,
      correctAnswers: quizSessions.correctAnswers,
      incorrectAnswers: quizSessions.incorrectAnswers,
      score: quizSessions.score,
      isPerfectScore: quizSessions.isPerfectScore,
      candiesEarned: quizSessions.candiesEarned,
    })
    .from(quizSessions)
    .where(where)
    .orderBy(desc(quizSessions.completedAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const total = totalRow?.n ?? 0;
  return {
    items: rows.map((r) => ({
      ...r,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getSessionDetail(db: Database, familyId: string, sessionId: string) {
  const [session] = await db
    .select()
    .from(quizSessions)
    .where(and(eq(quizSessions.id, sessionId), eq(quizSessions.familyId, familyId)));
  if (!session || session.status !== 'completed') throw notFound('Không tìm thấy bài học');
  const answers = await db
    .select()
    .from(quizAnswers)
    .where(eq(quizAnswers.sessionId, sessionId))
    .orderBy(asc(quizAnswers.questionIndex));
  return {
    id: session.id,
    chapterId: session.chapterId,
    chapterName: session.chapterName,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    score: session.score,
    correctAnswers: session.correctAnswers,
    incorrectAnswers: session.incorrectAnswers,
    totalQuestions: session.totalQuestions,
    isPerfectScore: session.isPerfectScore,
    candiesEarned: session.candiesEarned,
    answers: answers.map((a) => {
      const q = session.questions[a.questionIndex];
      // Câu trả lời bằng hình (payload.choices: value -> id hình) => kèm tên hình cho phụ huynh dễ đọc.
      // choices: value -> id hình trong thư viện (Sân chơi trí tuệ) hoặc mô tả hình (Sân chơi tư duy).
      const choices = (q?.payload as { choices?: Record<string, string | Visual> } | undefined)?.choices;
      const label = (v: number) => {
        const c = choices?.[String(v)];
        if (c === undefined) return null;
        return typeof c === 'string' ? (getObject(c)?.label ?? c) : visualLabel(c);
      };
      return {
        correctLabel: label(a.correctAnswer),
        selectedLabel: label(a.selectedAnswer),
        questionIndex: a.questionIndex,
        prompt: q?.prompt ?? '',
        questionType: a.questionType,
        correctAnswer: a.correctAnswer,
        selectedAnswer: a.selectedAnswer,
        attemptHistory: a.attemptHistory,
        isCorrect: a.isCorrect,
        attempts: a.attempts,
      };
    }),
  };
}

export interface ParentStats {
  totals: {
    totalCandies: number;
    totalCompletedQuizzes: number;
    totalCorrectAnswers: number;
    totalIncorrectAnswers: number;
    accuracy: number;
    giftsOpened: number;
    stickersUnlocked: number;
  };
  chapters: (ChapterSummary & { name: string; accuracy: number })[];
}

export async function getParentStats(db: Database, familyId: string): Promise<ParentStats> {
  const p = await ensureProgressRow(db, familyId);
  const rows = await db.select().from(chapterProgress).where(eq(chapterProgress.familyId, familyId));
  const stickers = await getStickerCounts(db, familyId);
  const answered = p.totalCorrectAnswers + p.totalIncorrectAnswers;
  // Cả chương đã tắt nhưng có dữ liệu cũng được hiển thị cho phụ huynh.
  const ids = new Set([...getEnabledChapters().map((c) => c.id), ...rows.map((r) => r.chapterId)]);
  return {
    totals: {
      totalCandies: p.totalCandies,
      totalCompletedQuizzes: p.totalCompletedQuizzes,
      totalCorrectAnswers: p.totalCorrectAnswers,
      totalIncorrectAnswers: p.totalIncorrectAnswers,
      accuracy: answered ? Math.round((p.totalCorrectAnswers / answered) * 100) : 0,
      giftsOpened: p.giftsOpened,
      stickersUnlocked: stickers.length,
    },
    chapters: [...ids].map((id) => {
      const def = getChapter(id);
      const summary = toChapterSummary(
        id,
        rows.find((r) => r.chapterId === id),
        def?.hasLearningStage ?? false,
      );
      const total = summary.totalCorrect + summary.totalIncorrect;
      return {
        ...summary,
        name: def?.fullName ?? def?.name ?? id,
        accuracy: total ? Math.round((summary.totalCorrect / total) * 100) : 0,
      };
    }),
  };
}
