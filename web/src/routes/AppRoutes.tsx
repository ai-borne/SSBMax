import { FC } from 'react';
import { Routes, Route } from 'react-router-dom';
import App from '../App';
import { StudyTopicPage } from './StudyTopicPage';
import { CONTENT_ROUTES } from './contentRoutes';

/**
 * Additive routing only (Phase 2, docs/plans/i-just-watched-a-nested-russell.md, HIGH 3):
 * react-router owns ONLY the permanent content paths in CONTENT_ROUTES. Everything else --
 * including `/` itself -- falls through to the unchanged `App`, which still drives its own
 * `?tab=` navigation via `useTabRouting`. No existing URL, bookmark, PWA start_url, or OAuth
 * redirect changes. Split out of main.tsx so it can be exercised directly in tests without
 * pulling in the PWA service-worker registration side effect.
 */
export const AppRoutes: FC = () => (
  <Routes>
    {CONTENT_ROUTES.map(({ topicId, path }) => (
      <Route key={path} path={path} element={<StudyTopicPage topicId={topicId} />} />
    ))}
    <Route path="*" element={<App />} />
  </Routes>
);

export default AppRoutes;
