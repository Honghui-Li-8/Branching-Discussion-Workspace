import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'react-redux'
import { trpc, trpcClient, queryClient } from './trpc'
import { AuthProvider } from './components/AuthProvider'
import { WorkspaceSync } from './components/WorkspaceSync'
import { store } from './store'

import '@recogito/react-text-annotator/react-text-annotator.css'
import '@recogito/text-annotator/text-annotator.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <WorkspaceSync>
              <App />
            </WorkspaceSync>
          </AuthProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </Provider>
  </StrictMode>,
)
