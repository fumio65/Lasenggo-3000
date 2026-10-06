# TASKS.md — Lasenggo 3000

Current sprint only. Completed tasks move to `TASKS_ARCHIVE.md` once a sprint closes —
don't let this file grow indefinitely. Each task should get its own git branch and
commit(s); fill in the branch name once work starts. Assign an owner before starting
a task — this is a team project, nothing here is implicitly "whoever."

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Context for future use

- All project docs now live in `doc/` in this repo (ARCHITECTURE.md, CONTEXT.md,
  DECISIONS.md, EXAMPLES.md, PRD.md, TASKS.md) — this is the source of truth going
  forward, not just the claude.ai project.
- Repo: https://github.com/fumio65/Lasenggo-3000 (started empty; first commit —
  the `app/project-scaffold` work — was pushed straight to `main` since there was
  nothing to branch from yet. Every task after this one should branch off `main`
  and merge back via PR, per the Notes for contributors below.)
- Local dev path (this machine): `C:\Users\Teng\Documents\Personal Project\Lasenggo-3000`
- To run the app locally: `npm install` then `npm run dev`, open the printed
  `localhost` URL in a browser. Browser is sufficient for UI-only work (participant
  list, session screen, styling); Android Studio / a device is only needed once BLE
  is involved, since Bluetooth doesn't work in a desktop browser.
- Current status: `app/project-scaffold` through `app/history-detail` are
  done — that's everything in App Frontend, App Local Data, and App Session
  History except `app/history-sync-fallback` (needs Supabase to have anything
  to fall back from) and `app/no-cup-alert` (needs real BLE status). Every
  remaining Sprint 1 task now needs either real ESP32 hardware or a Supabase
  project — neither set up yet (CONTEXT.md). `ActiveSessionScreen`'s temporary
  debug event-count line is still there, independent of HistoryList/Detail;
  remove whenever it's no longer useful.
- **Process note**: doc updates (this file's checkboxes, and any EXAMPLES.md/
  ARCHITECTURE.md notes) now go in the same branch/commit as the feature work,
  before pushing — not as a separate follow-up commit after merge. Matches the
  "Notes for contributors" rule below; previous tasks were updated after merge
  as a transition, going forward they're bundled in.

---

## Sprint 1 — MVP Foundations

### Hardware (sensors, pump, enclosure)
- [ ] Source components: ESP32, 12V peristaltic pump, MOSFET/relay module, load cell +
      HX711, WS2812B ring, 12V supply, food-grade silicone tubing
  - Owner: _unassigned_ · Branch: `hw/source-components`
- [ ] Wire ESP32 → MOSFET → pump (bench test: pump runs on GPIO trigger)
  - Owner: _unassigned_ · Branch: `hw/pump-wiring`
- [ ] Wire load cell + HX711 → ESP32, confirm raw weight readings in serial monitor
  - Owner: _unassigned_ · Branch: `hw/load-cell-wiring`
- [ ] Wire WS2812B ring → ESP32, confirm basic on/off/color control
  - Owner: _unassigned_ · Branch: `hw/led-wiring`
- [ ] Build cup platform + mounting (load cell under platform, LED ring around base,
      spout positioned above platform center)
  - Owner: _unassigned_ · Branch: `hw/platform-assembly`
- [ ] Calibrate load cell (tare + known-weight calibration) and document EMPTY_CUP_MIN /
      LIQUID_ADDED_MIN thresholds used
  - Owner: _unassigned_ · Branch: `hw/load-cell-calibration`
- [ ] Calibrate pump flow rate (mL/sec) for Standard volume baseline
  - Owner: _unassigned_ · Branch: `hw/pump-calibration`

### Firmware (ESP32)
- [ ] Set up BLE peripheral, advertise as "Lasenggo3000", define GATT service +
      COMMAND/STATUS characteristics (UUIDs documented in `tagaybox_spec.md`)
  - Owner: _unassigned_ · Branch: `fw/ble-setup`
- [ ] Implement COMMAND handling: `POUR`, `TARE`, `STOP`
  - Owner: _unassigned_ · Branch: `fw/command-handling`
- [ ] Implement load-cell state machine (NO_CUP / CUP_DETECTED / HAS_DRINK / EMPTY),
      delta-based detection, debounce/moving-average smoothing
  - Owner: _unassigned_ · Branch: `fw/cup-state-machine`
- [ ] Tie LED state to cup state machine (glow on HAS_DRINK, off otherwise)
  - Owner: _unassigned_ · Branch: `fw/led-logic`
- [ ] Implement pour sequence: validate cup present → run pump for calibrated duration
      (based on selected volume) → re-check weight → send STATUS result
  - Owner: _unassigned_ · Branch: `fw/pour-sequence`
- [ ] Send STATUS notifications on all state transitions (`READY`, `POURING`, `POURED`,
      `NO_CUP`, `HAS_DRINK`, `EMPTY`)
  - Owner: _unassigned_ · Branch: `fw/status-notifications`
- [ ] Bench-test full pour cycle end-to-end with a BLE test tool (e.g. nRF Connect)
      before app integration
  - Owner: _unassigned_ · Branch: `fw/bench-test`

### App — Frontend (React + Tailwind)
- [x] Scaffold React + Tailwind project, set up Capacitor, confirm Android build runs
  - Owner: fumio65 · Branch: `app/project-scaffold` (merged to `main`) · Done 2026-10-05
    — Vite+React+Tailwind v4+Capacitor+Android added, feature-based `src/` layout in
    place per ARCHITECTURE.md, `npm run dev` confirmed working in browser. Native
    Gradle/APK build not yet verified (needs Android Studio / device run).
- [x] Participant list screen: add/remove/reorder people before starting a session
  - Owner: fumio65 · Branch: `app/participant-list` (merged to `main` via PR #1) ·
    Done 2026-10-05 — in-memory add/remove/move-up/move-down, empty state, Start
    Session button present but disabled/non-functional (wiring it up is
    app/active-session-screen). No persistence yet (app/sqlite-schema).
- [x] Active session screen: current person's name, Pour button, Pass button, status
      indicator reflecting ESP32 STATUS notifications
  - Owner: fumio65 · Branch: `app/active-session-screen` (merged to `main` via PR #2) ·
    Done 2026-10-05 — static shell: current participant name, status pill (fixed
    "Not connected"), Pour/Pass rendered disabled with tooltips explaining why.
    Participant state lifted from ParticipantList into App; simple local
    screen-switch state used for navigation (no router added — see EXAMPLES.md).
- [x] Turn manager logic: circular order, advance on confirmed POUR or on PASS (PASS is
      local-only, no BLE call)
  - Owner: fumio65 · Branch: `app/turn-manager` (merged to `main` via PR #3) ·
    Done 2026-10-05 — useTurnManager hook, currentIndex wraps modulo participant
    count. Pass is wired and working in the UI; onPourConfirmed exists but isn't
    reachable yet (needs app/ble-commands + app/ble-status-subscription to ever
    call it). Event logging not wired (app/local-event-logging).
- [x] Pour volume setting (Light/Standard/Heavy selector)
  - Owner: fumio65 · Branch: `app/pour-volume-setting` · Done 2026-10-05 —
    usePourVolume hook (default Standard) + segmented control on
    ActiveSessionScreen. Selected value isn't sent anywhere yet — reading it
    into the actual POUR command/duration is app/ble-commands.
- [ ] NO_CUP handling in UI (alert/snackbar, don't advance turn)
  - Owner: _unassigned_ · Branch: `app/no-cup-alert`

### App — Bluetooth integration
- [ ] Integrate `@capacitor-community/bluetooth-le`: scan for "Lasenggo3000", connect,
      discover GATT service/characteristics
  - Owner: _unassigned_ · Branch: `app/ble-connect`
- [ ] Write COMMAND characteristic (POUR/TARE/STOP) from UI actions
  - Owner: _unassigned_ · Branch: `app/ble-commands`
- [ ] Subscribe to STATUS notifications, wire into app state (drives UI + turn advance)
  - Owner: _unassigned_ · Branch: `app/ble-status-subscription`
- [ ] Handle disconnect/reconnect gracefully (device out of range, app backgrounded)
  - Owner: _unassigned_ · Branch: `app/ble-reconnect-handling`

### App — Local data (SQLite, offline-first)
- [x] Set up `@capacitor-community/sqlite`, create local schema: `sessions`,
      `participants`, `events` tables (+ `synced` flag per row)
  - Owner: fumio65 · Branch: `app/sqlite-schema` · Done 2026-10-05 — connection +
    CREATE TABLE IF NOT EXISTS for all three tables in
    `src/features/storage/db.js`, matches ARCHITECTURE.md schema. Web testing
    needs `jeep-sqlite` + a matching `sql.js` wasm (pinned to exactly 1.11.0 —
    newer sql.js versions throw a WebAssembly LinkError against jeep-sqlite's
    bundled JS glue, so don't bump this without re-verifying in browser). No
    read/write of actual rows yet (app/local-event-logging).
- [x] Write session/participant/event records locally on every Pour/Pass action
  - Owner: fumio65 · Branch: `app/local-event-logging` · Done 2026-10-05 —
    Start Session creates a `sessions` row + one `participants` row per
    person (same ids as UI state); every Pass logs an `events` row via
    `src/features/storage/sessionQueries.js`. `device_id` left null
    (anonymous auth isn't built yet — `backend/anonymous-auth`). Pour logging
    exists in the same code path but is unreachable until BLE confirms a
    pour. Manually verified via a temporary event-count readout on
    ActiveSessionScreen (remove once app/history-list exists).
- [x] Verify app is fully usable with zero internet (manual offline test pass)
  - Owner: fumio65 · Branch: `app/offline-verification` · Done 2026-10-05 — no
    code change needed (app has zero network calls as of this point). Tested:
    `npm run build && npm run preview`, disconnected Wi-Fi, reloaded the page,
    ran the full add/reorder/remove → Start Session → Pass flow, reconnected.
    Everything worked with no errors. Scope note: this verifies the web/browser
    layer only — a real airplane-mode test on an installed APK hasn't happened
    (native Android build still unverified; no Android SDK available to Claude,
    always been on fumio65's side to confirm in Android Studio).

### Backend — Supabase
- [x] Create Supabase project, apply schema migration (`sessions`, `participants`,
      `events` tables matching local SQLite structure)
  - Owner: fumio65 · Branch: `backend/supabase-schema` · Done: 2026-10-05
  - Notes: Created Supabase project `lasenggo-3000` (region `ap-southeast-1`). Applied
    migration `create_sessions_participants_events` via Supabase MCP: `sessions`,
    `participants`, `events` tables matching the local SQLite schema exactly (same
    columns/FKs as `ARCHITECTURE.md`'s data model), plus indexes on
    `events.session_id` and `participants.session_id`. RLS enabled on all three tables,
    scoped via `device_id = auth.uid()` on `sessions` and `EXISTS` subqueries joining
    to `sessions.device_id` for `participants`/`events` — ready for anonymous auth
    (next task). Verified live via `list_tables` (columns, PKs, FKs, RLS all correct).
    No app code changes in this task — infra only.
- [x] Enable anonymous auth (`signInAnonymously`), confirm device identity persists
      across app restarts
  - Owner: fumio65 · Branch: `backend/anonymous-auth` · Done: 2026-10-05
  - Notes: Added `@supabase/supabase-js`, `src/features/sync/supabaseClient.js`
    (client built from `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` env vars,
    `null` if unset — sync always stays optional), and `src/features/sync/auth.js`
    (`ensureAnonymousSession()` reuses an existing session via `getSession()` before
    calling `signInAnonymously()`, so a device keeps the same identity across
    restarts; `getDeviceId()` for later use by the sync job). Wired into `App.jsx`
    with a temporary `auth: <status> (<deviceId>)` debug badge alongside the existing
    `db:` one, same pattern. `.env`/`.env.example` added (`.env` gitignored, holds the
    real project URL/publishable key; `.env.example` is the committed template).
    Required enabling "Allow anonymous sign-ins" in the Supabase dashboard
    (Authentication → Sign In / Providers) — off by default on new projects. Verified
    manually: same device id persists across page refresh/hard refresh.
- [x] Implement sync job: push unsynced local rows to Supabase when online, mark
      `synced_at` locally on success
  - Owner: fumio65 · Branch: `backend/sync-job` · Done: 2026-10-06
  - Notes: `src/features/sync/syncJob.js` — `runSync()` pushes unsynced sessions,
    then participants, then events (parents before children, so Supabase FKs are
    satisfied) via `supabase.from(...).upsert(...)`, and marks each pushed row
    synced locally only after the push succeeds (`sessions.synced_at`,
    `participants.synced`/`events.synced` flip in the same pass). A failed/offline
    sync returns `{ ok: false, reason }` without throwing — unsynced rows just stay
    queued for the next call, matching the offline-first model. `device_id` is
    stamped from `getDeviceId()` at push time (not at local row creation), so
    `backend/anonymous-auth` doesn't need to be ready when a session starts.
    Wired into `App.jsx`: fires once both `db` and `auth` are ready, and again after
    a session ends; temporary `sync: <status>` debug badge added alongside the
    existing `auth:`/`db:` ones. Verified manually: ran a full session, confirmed
    the session/participants/events rows landed correctly in Supabase (checked via
    `execute_sql`) with matching ids and foreign keys.
- [x] Test offline → online transition (queue builds up offline, flushes on reconnect)
  - Owner: fumio65 · Branch: `backend/sync-reconnect-test` · Done: 2026-10-06
  - Notes: Added a `window.addEventListener('online', ...)` handler in `App.jsx`
    that re-runs `triggerSync()` the moment the browser/WebView regains
    connectivity, instead of only syncing on app load / after a session ends.
    Also fixed `syncJob.js`'s error classification: a failed push while offline
    now reports `reason: 'offline'` (checked via `navigator.onLine`, since
    supabase-js throws different error shapes — plain `TypeError` vs.
    `AuthRetryableFetchError` — depending on which call failed) instead of a
    generic `'error'`, so the debug badge reads accurately.
    Verified manually: went offline (DevTools Network → Offline), ran a full
    session (badge showed `sync: offline`, rows stayed queued locally), then
    went back online — `sync` auto-flipped to `syncing` → `done` with no reload,
    and the session/participants/events rows confirmed landing in Supabase
    (`execute_sql` row counts increased accordingly).

### App — Session history (moved up from backlog — user wants history visible in MVP)
- [x] History list screen: past sessions (date, participant count) pulled from local
      SQLite, newest first
  - Owner: fumio65 · Branch: `app/history-list` · Done 2026-10-05 —
    getSessionHistory() query (sessions LEFT JOIN participants, grouped,
    newest first), useSessionHistory hook, HistoryList screen. "View session
    history" link added to ParticipantList as the entry point. Rows aren't
    clickable yet — that's app/history-detail. Verified: real past sessions
    from earlier testing showed up correctly in browser.
- [x] Session detail view: per-participant drink/pass counts for a selected past session
  - Owner: fumio65 · Branch: `app/history-detail` · Done 2026-10-05 —
    getSessionDetail() query (participants LEFT JOIN events, counted by type),
    useSessionDetail hook, HistoryDetail screen. Added HistoryScreen wrapper
    to own list↔detail navigation locally within the history feature (same
    local-state convention as App.jsx, see EXAMPLES.md). History rows are now
    clickable. Verified: real pour/pass counts from a tested session displayed
    correctly.
- [x] History reflects synced Supabase data when available, falls back to local-only
      sessions when offline/unsynced (no broken state either way)
  - Owner: fumio65 · Branch: `app/history-sync-fallback` · Done: 2026-10-06
  - Notes: History still reads from local SQLite only (unchanged — stays the single
    source of truth per ARCHITECTURE.md), but `useSessionHistory` now calls a new
    `pullSessions()` (`src/features/sync/pull.js`) before that read: pulls this
    device's sessions/participants/events from Supabase and inserts any missing
    locally (covers reinstall / cleared local DB), marking pulled rows already
    synced. A skipped/failed pull (offline, not configured, not signed in) just
    means the local read proceeds with whatever's already there — that omission
    *is* the fallback, no separate error state needed. `HistoryList` shows a quiet
    `synced` / `local only` indicator reflecting whether the last pull succeeded.
    Extracted the online/offline detection both `pull.js` and `syncJob.js` share
    into `src/features/sync/networkError.js`; also added an early
    `navigator.onLine` check to both so an offline call reports immediately
    instead of waiting on a fetch to time out.
    Verified manually: history loads fine fully offline (local-only, labeled
    correctly); going offline mid-session and reopening history does not hang or
    break; confirmed the behavior difference between "page never loaded because
    DevTools blocks the dev server too" (a testing artifact — not an issue in the
    built APK, which bundles its own assets) vs. "page already loaded, then went
    offline" (the real-world case, which works correctly).

### Integration & QA
- [ ] Full end-to-end test: app + firmware + hardware, multiple participants, multiple
      pour/pass rounds, varied cup types
  - Owner: _unassigned_ · Branch: `qa/e2e-mvp-test`
- [ ] Spill/edge-case test: no cup, cup removed mid-pour, bottle running low
  - Owner: _unassigned_ · Branch: `qa/edge-case-test`

---

## Backlog (approved, not in current sprint)
Pull into a future sprint section when scheduled — don't start early without team
agreement, since some of these affect firmware command set (e.g. `FLUSH`, battery).

- [ ] Per-liquid-type flow calibration (beer/Tanduay/lambanog presets)
- [ ] Low/empty bottle detection (`REFILL_BOTTLE` status)
- [ ] Pump priming/flush cycle (`FLUSH` command)
- [ ] Battery status reporting (`BATTERY_LOW` notification)
- [ ] Pace-awareness indicator (soft, non-gatekeeping)
- [ ] Sound/haptic feedback on pour complete
- [ ] "Tagay King/Queen" end-of-session leaderboard (cross-session ranking)
- [ ] Session naming (custom titles like "Jojo's Birthday" — basic history list/detail
      is now in Sprint 1, naming is the deferred part)
- [ ] QR code BLE pairing
- [ ] Spill containment in enclosure design (raised lip / drip tray)
- [ ] Undo last action (safety net)
- [ ] Pass limit house rule (optional toggle)
- [ ] Multiple pour stations (v2 scalability — architecture TBD, see `tagaybox_spec.md`)

---

## Notes for contributors
- One branch per task, named as shown above (`area/short-description`)
- Reference the task in your commit message and PR description
- Update this file's checkboxes as part of the PR, not after merge — keeps status honest
- Hardware/firmware changes that affect the BLE command or status vocabulary must be
  reflected in `tagaybox_spec.md` in the same PR, so app and firmware owners don't drift
  out of sync
