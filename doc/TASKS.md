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
- [~] Source components: ESP32, 12V peristaltic pump, MOSFET/relay module, load cell +
      HX711, WS2812B ring, 12V supply, food-grade silicone tubing
  - Owner: fumio65 · Branch: `hw/source-components`
  - Notes: Exact product/variant picks locked in for every remaining component (pump,
    relay module, load cell + HX711, LED ring, battery pack, jumper wires) — see
    `PRD.md`'s hardware table "Sourced Pick" column for the specific Shopee links and
    `DECISIONS.md`'s "Hardware component sourcing" entry for why each variant was
    chosen over its alternatives (e.g. the relay module must be the 5V-triggered
    variant, not 12V, to switch reliably off the ESP32's 3.3V GPIO). Left `[~]` rather
    than `[x]` — picking the variant isn't the same as having it in hand; actual
    purchase/have-it status is tracked in `Lasenggo3000_Components.xlsx`, not here.
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
- [x] Confirm before ending a session (staged Back → confirm → final warning)
  - Owner: fumio65 · Branch: `design/night-market-theme` · Done: 2026-10-10
  - Notes: "Back" used to call the exit handler directly — one stray tap mid-round and
    there was no way back into that session. Replaced with a three-stage confirm,
    entirely as an animated overlay (no native `confirm()` dialog): 'idle' (plain Back
    button) → 'confirm' (Back expands in place into "Keep going" / a plain-link
    "⚠ End session" warning, "Keep going" auto-focused as the safe default) → 'final'
    (a second "End for good?" stage with "Yes, end session" / "Cancel") — so neither
    the original stray tap nor a stray tap on the newly-exposed warning link can end
    the round by accident. Also added a way to check Session History mid-round without
    ending the session (ActiveSessionScreen stays mounted, hidden via CSS, rather than
    unmounted, so its state survives the round-trip). Took several passes to get the
    animation right — an invalid Tailwind class (`duration-250`, not a real scale value
    or bracket syntax) was silently no-oping, and the confirm bar's absolutely-positioned
    containing block was sized to its own hidden sibling, causing severe text wrapping
    despite a width cap that should have prevented it; both root-caused via live browser
    testing rather than guessing from code review. Fixed with `duration-[220ms]`
    consistently and `w-max` alongside the `max-w-[...]` cap.
    Verified manually: accidental Back no longer ends a session; History is reachable
    and returns to the same in-progress round; the confirm bar never overlaps the
    Participants/Session-history buttons at any viewport width tested.
- [x] Pause / resume a participant mid-session, with a reason tag
  - Owner: fumio65 · Branch: `design/night-market-theme` · Done: 2026-10-10
  - Notes: Real-world gap: someone at the table gets too drunk to keep drinking, has to
    step out for an emergency, or sneaks off without saying anything ("Run away",
    settled on after "Takas"/"Escape" as working names) — none of them necessarily come
    back, but the turn order shouldn't wait on them either. Pausing requires picking a
    reason chip (Drunk / Went home / Run away / Emergency / Other) before it takes
    effect, since tagging it right away matters most for the case where this is the
    last anyone hears from them tonight; resuming needs no reason. Both are logged as
    real `PAUSE`/`RESUME` rows in `events` (new `events.note text` column, migrated via
    the same idempotent `ALTER TABLE` pattern as `migrateAddEventVolume`), not just an
    in-memory flag, so the record survives even if they never resume. `useTurnManager`
    skips paused participants when advancing, and jumps off a participant immediately
    if they're paused mid-turn rather than waiting for their next Pass/Pour. The
    "Manage participants" sheet (new `ParticipantManagerSheet`) gained per-row
    Pause/Resume alongside the inline rename it already had, plus an "Add someone who
    just joined" form — adding mid-session was missing entirely before this. Pause
    status + reason now also show on HistoryDetail's stat bars for a finished session
    (`buildPausedAtEnd`, scans each participant's newest PAUSE/RESUME event), not just
    in the live activity log.
    Verified manually: pausing mid-turn immediately advances to the next active person;
    a participant paused with a reason and never resumed shows that reason correctly in
    both the live session and History after ending it.
- [x] Clear the participant roster after a session ends
  - Owner: fumio65 · Branch: `design/night-market-theme` · Done: 2026-10-11
  - Notes: Real bug, not just cosmetic: `participants.id` is a SQLite PRIMARY KEY, and
    the in-memory roster (client-generated UUIDs) was persisting across session
    start/end cycles. Ending a session and starting a new one without retyping names
    reused the same ids for a fresh `participants` INSERT, throwing
    `UNIQUE constraint failed: participants.id` and leaving the second session stuck —
    reproduced and confirmed live (browser + console) before fixing, not assumed from
    the user's report alone. Fixed with a new `clearParticipants()` in `useParticipants`,
    called from `App.jsx`'s `handleExitSession()`. The alternative (keep the names,
    mint fresh ids) was considered and rejected — the user chose clearing outright.
    Verified manually end to end: "Who's joining" is empty immediately after ending a
    session, and starting a second session with freshly re-added participants no
    longer crashes (confirmed via console: no `UNIQUE constraint` error on the second
    `createSession` call).
- [x] Simulate Pour ahead of real BLE (unblocks testing the full pour flow without hardware)
  - Owner: fumio65 · Branch: `design/night-market-theme` · Done: 2026-10-11
  - Notes: Pour was sitting disabled since `app/active-session-screen` waiting on
    `app/ble-commands`/`app/ble-status-subscription`, which left the turn-manager →
    event-logging → undo → session-log → history path for POUR completely untested
    end to end. Rather than wait on hardware (none of Sprint 1's BLE/firmware/hardware
    tasks have started yet), `ActiveSessionScreen`'s new `handlePour()` stands in for
    the real BLE round-trip with a fixed ~900ms "Pouring…" delay before calling
    `onPourConfirmed()` (already existed in `useTurnManager`, just unreachable) — same
    code path real hardware will drive later, nothing about `onPourConfirmed` or the
    event-logging `onEvent` callback changed. Guarded by an `isPouring` flag so a
    double-click can't double-log a turn; both Pass and Pour disable for that window.
    The status pill was changed from a fixed "Not connected" to "Simulated — no
    hardware connected" (pulsing amber dot while a pour is in flight) so this build is
    never mistaken for hardware-ready. Swap `handlePour`'s `setTimeout` for the real
    BLE command + STATUS subscription once `app/ble-commands` and
    `app/ble-status-subscription` exist — everything downstream stays the same.
    Verified manually: poured and passed interleaved correctly across both
    participants, turn order advanced, session log/activity feed/undo all updated
    exactly as they already did for Pass.
- [x] Rename live session's "Recent activity" heading to "Activity log"
  - Owner: fumio65 · Branch: `design/night-market-theme` · Done: 2026-10-11
  - Notes: Matches HistoryDetail's existing "Activity log" heading for the same
    `ActivityFeed` component, so the feed reads the same whether a session is live or
    already over. Text-only change (`SessionLog.jsx`); comments elsewhere referencing
    the old name updated to match.
- [x] Per-volume (Light/Standard/Heavy) breakdown on each participant's stat row
  - Owner: fumio65 · Branch: `design/night-market-theme` · Done: 2026-10-11
  - Notes: `ParticipantStatBar` (shared by the live Session log and HistoryDetail)
    showed a `totalMl` sum but not the Light/Standard/Heavy composition behind it.
    First pass spelled it out in words ("1 Light · 1 Standard · 1 Heavy poured") —
    rejected on review: read as a dense sentence that wrapped awkwardly in the
    280px-wide session-log panel and duplicated the colored bar directly below it.
    Replaced with small colored-dot + count chips using the bar's own
    `VOLUME_COLOR`s (the same ones the shared `VolumeLegend` already keys), so
    composition reads as color at a glance instead of as prose; full label is
    still available per chip via `title`. Also fixed a real layout bug the first
    pass introduced: the name and stat line used to share one flex row
    (`justify-between`, stat side `shrink-0`), which was fine for short text but
    pushed the name span to zero width — hiding it entirely — once the stat text
    got long. Name and stats are now stacked on their own lines instead. Spacing
    pass on top (`space-y-1.5` within a row, `space-y-4` between participants in
    both SessionLog and HistoryDetail's lists) after it read too cramped.
    Verified manually in both the live Session log and HistoryDetail with a
    participant hitting all three volumes (worst-case density) — single line,
    no wrapping, no clipping, name always visible.

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
- [x] Session naming (pulled up from backlog, user-requested)
  - Owner: fumio65 · Branch: `app/session-naming` · Done: 2026-10-06
  - Notes: Added optional `sessions.name text` (local SQLite via a
    `migrateAddSessionName()` `ALTER TABLE` step in `db.js`, since `CREATE TABLE
    IF NOT EXISTS` doesn't add columns to an already-existing table; matching
    Supabase migration `add_session_name`, applied and verified via
    `information_schema.columns`). `createSession(participants, name)` trims and
    stores `NULL` for a blank name so history/detail/active-session all fall back
    to the formatted date exactly as before. New "Session name (optional)" input
    on `ParticipantList`; name shown (with date as a subline) in `HistoryList`,
    `HistoryDetail`, and now `ActiveSessionScreen` during the live session too.
    `syncJob.js`/`pull.js` updated to push/pull the column. Schema documented in
    `ARCHITECTURE.md`.
    Verified manually: named and unnamed sessions both behave correctly end to
    end (local SQLite + Supabase, history list/detail, live session header).
    Noted during testing (not part of this task, added to Backlog instead):
    the browser's native back button doesn't map to in-app screens, since
    screen switching is local React state only, not router-backed.

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
- [ ] "Tagay King/Queen" leaderboard — two halves, designed 2026-10-06, not started:
      (A) per-session crown: whoever poured the most *in that one session*, shown on
      HistoryDetail — blocked on app/ble-commands existing for real (there's no
      meaningful way to test it while Pour stays disabled/stubbed; a "simulate
      pour (dev)" button was tried and discarded as a workaround, not worth
      keeping). (B) all-time cross-session leaderboard — needs a recurring
      "people" roster (new local `people` table + `participants.person_id`
      linking a session's participant back to a roster person when picked from
      a reuse list at session start, instead of retyping; new Participants
      screen to rename/delete roster entries, no "add" button there — adding
      happens organically by typing a new name at session start), since
      cross-session aggregation by name alone is unreliable (name collisions/
      typos). Roster should sync to Supabase like sessions/participants/events
      already do (user confirmed). Build order: (A) first once Pour is real,
      then (B)'s roster + all-time board.
  - Owner: _unassigned_ · Branch: _tbd_
- [ ] QR code BLE pairing
- [ ] Spill containment in enclosure design (raised lip / drip tray)
- [x] Undo last action (safety net) — Owner: fumio65 · Branch:
      `app/undo-last-action` · Done: 2026-10-07
  - Notes: One level of undo only (not a history stack). `logEvent` now
    returns the new row's id; `useTurnManager` snapshots `currentIndex` +
    `passStreaks` right before each Pass/Pour (`undoSnapshot`, cleared to null
    on undo or replaced on the next action) and exposes `canUndo`/`undoTurn()`
    to restore it. `ActiveSessionScreen` pairs that with its own `lastEvent`
    state (set once `logEvent` resolves) so `handleUndo` can call `undoTurn()`
    (rewinds turn order + pass streak) and `deleteEvent(lastEvent.id)`
    (removes exactly that row, not just "the newest row by time") together.
    New `deleteEvent(eventId)` in `sessionQueries.js`.
    Known limitation (accepted, not fixed here): if the event already synced
    to Supabase before undo (rare — sync mainly runs at session end/reconnect,
    not after every single event), the local delete doesn't reach the
    Supabase copy too. Fine for a casual safety-net feature; flagged here in
    case it matters later.
    Verified manually: Undo correctly reverses the most recent Pass only
    (turn order, pass-limit streak, and the event count all rewind together);
    doing several Passes then one Undo only undoes the last one.
- [x] Pass limit house rule (optional toggle) — Owner: fumio65 · Branch:
      `app/pass-limit-house-rule` · Done: 2026-10-07
  - Notes: `useTurnManager` now tracks each participant's *consecutive* pass
    streak (resets to 0 on their Pour), and takes an optional `passLimit`
    integer; `isOverPassLimit` is true once the current participant's streak
    reaches it. Deliberately a **soft** warning only — Pass is never disabled.
    A hard block was considered and rejected for now: Pour is still disabled
    (no BLE/app/ble-commands), so forcing someone past the limit would leave
    them with no valid action and the session would just get stuck. Once Pour
    is real, `isOverPassLimit` already has everything needed to make it a real
    forced-pour rule if wanted — no rework, just a caller-side decision.
    New optional "Pass limit" number input on `ParticipantList` (blank/0/
    invalid = disabled, same convention as session naming). `ActiveSessionScreen`
    shows a yellow warning banner ("House rule: `<name>` has passed Nx in a
    row") once hit.
    Verified manually: warning appears exactly on the configured count and
    stays visible without blocking Pass; leaving the field blank produces no
    warning at all, confirming it's fully optional.
- [ ] Multiple pour stations (v2 scalability — architecture TBD, see `tagaybox_spec.md`)
- [ ] Real browser back/forward support for in-app screens (participants/session/
      history currently switch via local React state only, per EXAMPLES.md's
      documented pattern — the browser's native back button just navigates away
      from the page instead of going to the previous screen; noted during
      app/session-naming testing. Needs a routing solution, not a quick fix)

---

## Notes for contributors
- One branch per task, named as shown above (`area/short-description`)
- Reference the task in your commit message and PR description
- Update this file's checkboxes as part of the PR, not after merge — keeps status honest
- Hardware/firmware changes that affect the BLE command or status vocabulary must be
  reflected in `tagaybox_spec.md` in the same PR, so app and firmware owners don't drift
  out of sync
