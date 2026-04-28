import { createRoot } from 'react-dom/client'
import './index.css'
import { installLegacyBackendShim } from './shared/api/legacyBackendShim'
import { installBrowserFcmRegistration } from './shared/push/browserFcmRegistration'
import { installNativeFcmBridge } from './shared/push/nativeFcmBridge'
import App from './App.jsx'

installLegacyBackendShim()
installBrowserFcmRegistration()
installNativeFcmBridge()

createRoot(document.getElementById('root')).render(
  <App />,
)
