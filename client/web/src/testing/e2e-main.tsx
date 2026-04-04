import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@recogito/react-text-annotator/react-text-annotator.css'
import '@recogito/text-annotator/text-annotator.css'
import '../index.css'
import { AnnotationE2EHarness } from './AnnotationE2EHarness'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnnotationE2EHarness />
  </StrictMode>,
)
