import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { defineCustomElements as defineJeepSqlite } from 'jeep-sqlite/loader'
import './index.css'
import App from './App.jsx'

// Web-only SQLite backing store (IndexedDB-backed wasm sqlite). Native builds
// (Android) use the platform's real SQLite instead and never touch this
// element — see src/features/storage/db.js.
defineJeepSqlite(window)
const jeepSqliteEl = document.createElement('jeep-sqlite')
jeepSqliteEl.wasmPath = '/assets'
document.body.appendChild(jeepSqliteEl)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
