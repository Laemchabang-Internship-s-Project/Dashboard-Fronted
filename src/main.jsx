import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

const base = '/lcbh/dashboard/'

// 🔥 guard กัน path เพี้ยน / encoding พัง / ไม่มี slash
try {
  const path = decodeURIComponent(window.location.pathname)

  if (!path.startsWith(base)) {
    window.location.replace(base)
  }
} catch (e) {
  window.location.replace(base)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={base}>
      <App />
    </BrowserRouter>
  </StrictMode>,
)