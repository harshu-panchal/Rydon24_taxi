import { createRoot } from 'react-dom/client'
import './index.css'
import { installLegacyBackendShim } from './shared/api/legacyBackendShim'
import App from './App.jsx'

installLegacyBackendShim()

createRoot(document.getElementById('root')).render(
  <App />,
)
