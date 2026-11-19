import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ChapterIntroPage, LearningPage } from '../features/chapter/ChapterPages';
import { FamilyGate } from '../features/family/FamilyGate';
import { HomePage } from '../features/home/HomePage';
import { ParentPage } from '../features/parent/ParentPage';
import { QuizPage } from '../features/quiz/QuizPage';
import { CollectionPage } from '../features/rewards/CollectionPage';
import { SettingsProvider } from './SettingsContext';

export function App() {
  return (
    <BrowserRouter>
      <FamilyGate>
        <SettingsProvider>
          <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/chuong/:chapterId" element={<ChapterIntroPage />} />
          <Route path="/chuong/:chapterId/hoc" element={<LearningPage />} />
          <Route path="/chuong/:chapterId/choi" element={<QuizPage />} />
          <Route path="/bo-suu-tap" element={<CollectionPage />} />
          <Route path="/phu-huynh" element={<ParentPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SettingsProvider>
      </FamilyGate>
    </BrowserRouter>
  );
}
