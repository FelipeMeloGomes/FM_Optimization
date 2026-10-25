import { lazy, type ReactNode, Suspense } from 'react';
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

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const RestorePointsPage = lazy(() => import('./pages/RestorePointsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const CleanerPage = lazy(() => import('./pages/CleanerPage'));
const CpuPage = lazy(() => import('./pages/CpuPage'));
const NetworkPage = lazy(() => import('./pages/NetworkPage'));
const InputLagPage = lazy(() => import('./pages/InputLagPage'));
const TweaksPage = lazy(() => import('./pages/TweaksPage'));
const UtilitiesPage = lazy(() => import('./pages/UtilitiesPage'));
const AppsPage = lazy(() => import('./pages/AppsPage'));
const DebloatPage = lazy(() => import('./pages/DebloatPage'));
const EssentialsPage = lazy(() => import('./pages/EssentialsPage'));
const EmuladoresPage = lazy(() => import('./pages/EmuladoresPage'));

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
              <Route path="/" element={<DashboardPage />} />
              <Route path="/restore-points" element={<RestorePointsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route
                path="/tweaks"
                element={
                  <ProtectedRoute path="/tweaks">
                    <TweaksPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/utilities"
                element={
                  <ProtectedRoute path="/utilities">
                    <UtilitiesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cleaner"
                element={
                  <ProtectedRoute path="/cleaner">
                    <CleanerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rede"
                element={
                  <ProtectedRoute path="/rede">
                    <NetworkPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/apps"
                element={
                  <ProtectedRoute path="/apps">
                    <AppsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/debloat"
                element={
                  <ProtectedRoute path="/debloat">
                    <DebloatPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/essenciais"
                element={
                  <ProtectedRoute path="/essenciais">
                    <EssentialsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/emuladores"
                element={
                  <ProtectedRoute path="/emuladores">
                    <EmuladoresPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/input-lag"
                element={
                  <ProtectedRoute path="/input-lag">
                    <InputLagPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/cpu"
                element={
                  <ProtectedRoute path="/cpu">
                    <CpuPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ErrorBoundary>
      </Suspense>
    </AllProviders>
  );
}
