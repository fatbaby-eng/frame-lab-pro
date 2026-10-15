/*
 * Frame Lab — Copyright (c) 2026 Todd Boswell, toddboswell.com
 * Free software under the GNU AGPL v3 (see LICENSE). Keep this notice and
 * the author credit intact in copies and modified versions (AGPL §5, §7(b)).
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
