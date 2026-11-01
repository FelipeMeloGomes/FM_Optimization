import { type ReactNode, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Skeleton } from './components/ui';
import { AutoCleanProvider } from './contexts/AutoCleanContext';
import { HistoryProvider } from './contexts/HistoryContext';
import { RestorePointProvider } from './contexts/RestorePointContext';
import { ScriptProvider } from './contexts/ScriptContext';
import { ScriptExecutionProvider } from './contexts/ScriptExecutionContext';
import { SettingsProvider, useSettingsContext } from './contexts/SettingsContext';
import { CpuProvider, MemoryProvider, SystemProvider } from './contexts/SystemContext';
import { AppLayout } from './layout/AppLayout';
import { composeProviders } from './lib/compose-providers';
import { isPageLocked } from './lib/page-lock';
import { ROUTES } from './routes/config';

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Skeleton className="size-6 rounded-full" />
    </div>
  );
}

function ProtectedRoute({ path, children }: { path: string; children: ReactNode }) {
  const { settings } = useSettingsContext();
  const location = useLocation();
  if (isPageLocked(path, settings)) {
    return <Navigate to="/settings" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

const AllProviders = composeProviders(
  SettingsProvider,
  SystemProvider,
  CpuProvider,
  MemoryProvider,
  ScriptExecutionProvider,
  ScriptProvider,
  RestorePointProvider,
  HistoryProvider,
  AutoCleanProvider
);

export default function App() {
  return (
    <AllProviders>
      <Suspense fallback={<PageLoader />}>
        <ErrorBoundary>
          <Routes>
            <Route element={<AppLayout />}>
              {ROUTES.map(({ path, component: Page, protected: isProtected }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    isProtected ? (
                      <ProtectedRoute path={path}>
                        <Page />
                      </ProtectedRoute>
                    ) : (
                      <Page />
                    )
                  }
                />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </Suspense>
    </AllProviders>
  );
}
