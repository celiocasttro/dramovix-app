import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './tv-mode.css'
import './tv-remote.js'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
