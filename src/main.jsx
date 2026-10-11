import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { defineCustomElements as defineJeepSqlite } from 'jeep-sqlite/loader'
import './index.css'
import App from './App.jsx'

// Web-only SQLite backing store (IndexedDB-backed wasm sqlite). Native builds
// (Android) use the platform's real SQLite instead and never touch this
// element — see src/features/storage/db.js.
//
// bugfix (web persistence): jeep-sqlite's `autoSave` defaults to false, and
// nothing in this app ever called the matching `saveToStore()` — every
// write landed in the in-memory wasm database only, never flushed to
// IndexedDB. The app *looked* offline-first (every write succeeded
// instantly, ARCHITECTURE.md's "every write goes to local SQLite first and
// always succeeds" held true within a page load) but a browser refresh
// silently dropped everything, since jeep-sqlite reloads from IndexedDB on
// startup and nothing had ever been saved there. `autoSave = true` must be
// set before the element connects (its `connectedCallback` reads it once),
// so it's set here before appendChild — after that, every write-ish call
// (execute/run/executeSet) flushes to IndexedDB on its own.
defineJeepSqlite(window)
const jeepSqliteEl = document.createElement('jeep-sqlite')
jeepSqliteEl.wasmPath = '/assets'
jeepSqliteEl.autoSave = true
document.body.appendChild(jeepSqliteEl)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
