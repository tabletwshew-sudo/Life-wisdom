import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AuthProvider } from './auth/AuthProvider'
import { UpdatePrompt } from './components/layout/UpdatePrompt'
import { ToastProvider } from './components/ui/Toast'
import { FamilyProvider } from './family/FamilyProvider'
import './index.css'
import { isConfigured } from './lib/env'
import NotConfigured from './pages/NotConfigured'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24 * 7, // keep a week of data for offline use
      retry: (count) => navigator.onLine && count < 1,
      refetchOnWindowFocus: true,
      networkMode: 'offlineFirst',
    },
  },
})

// Saves the latest data on this device so the app opens and shows it offline.
// It is cleared on sign-out (see AuthProvider).
const persister = createSyncStoragePersister({ storage: window.localStorage, key: 'fh-cache' })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
    {isConfigured ? (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7, buster: __APP_VERSION__ }}
        // Show saved data instantly, then refresh it from the server.
        onSuccess={() => queryClient.invalidateQueries()}
      >
        <BrowserRouter>
          <ToastProvider>
            <AuthProvider>
              <FamilyProvider>
                <UpdatePrompt />
                <App />
              </FamilyProvider>
            </AuthProvider>
          </ToastProvider>
        </BrowserRouter>
      </PersistQueryClientProvider>
    ) : (
      <NotConfigured />
    )}
    </ErrorBoundary>
  </StrictMode>,
)
