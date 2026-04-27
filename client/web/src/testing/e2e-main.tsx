import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@recogito/react-text-annotator/react-text-annotator.css'
import '@recogito/text-annotator/text-annotator.css'
import '../index.css'
import { trpc } from '../trpc'
import { httpBatchLink } from '@trpc/client'
import { AnnotationE2EHarness } from './AnnotationE2EHarness'
import { MarkdownE2EHarness } from './MarkdownE2EHarness'

const e2eQueryClient = new QueryClient()

const fixtureParam = new URLSearchParams(window.location.search).get('fixture')

const e2eTrpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/trpc',
      fetch(url, options) {
        return fetch(url, {
          ...(options ?? {}),
          credentials: 'include',
        })
      },
    }),
  ],
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <trpc.Provider client={e2eTrpcClient} queryClient={e2eQueryClient}>
      <QueryClientProvider client={e2eQueryClient}>
        {fixtureParam === 'markdown' ? <MarkdownE2EHarness /> : <AnnotationE2EHarness />}
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
)
