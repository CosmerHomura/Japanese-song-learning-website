import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import StartupErrorBoundary from './components/StartupErrorBoundary'
import './styles.css'
import './styles/motion.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StartupErrorBoundary><App /></StartupErrorBoundary>
  </StrictMode>,
)
