import { createRoot } from 'react-dom/client'
import './index.css'
import { installLegacyBackendShim } from './shared/api/legacyBackendShim'
import { installNativeFcmBridge } from './shared/push/nativeFcmBridge'
import App from './App.jsx'

installLegacyBackendShim()
installNativeFcmBridge()

createRoot(document.getElementById('root')).render(
  <App />,
)
