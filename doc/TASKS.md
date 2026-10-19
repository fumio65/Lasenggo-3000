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
- [x] Participant name autocomplete + a people roster to rename/delete saved names
  - Owner: fumio65 · Branch: `app/people-roster` · Done: 2026-10-11
  - Notes: User-requested: typing a previously-used name at session start should
    suggest it instead of retyping, plus a screen to fix a typo or remove someone
    who isn't coming around — this is the roster half of the Tagay King/Queen
    backlog design (part B's prerequisite), pulled forward on its own since it's
    useful immediately, independent of the leaderboard itself.
    New `people` table (id, name, created_at, last_used_at) plus
    `participants.person_id` (nullable FK, added via the same idempotent
    migration pattern as `sessions.name`/`events.volume`/`events.note` — see
    `migrateAddParticipantPersonId` in `db.js`). A `participants` row keeps its
    own independent name copy regardless of `person_id` — renaming someone in
    the roster later never rewrites a past session's record; `person_id` is
    purely a forward-looking link for autocomplete and the future leaderboard.
    `src/features/storage/peopleQueries.js`: `getPeople()` (most-recently-used
    first), `findOrCreatePerson(name)` (case-insensitive exact match reuses and
    bumps `last_used_at`, otherwise creates — the *only* way a new roster entry
    is created, matching the original design note that there's no separate "add"
    control), `renamePerson`, `deletePerson`.
    Caught during testing (user-reported): the first pass resolved/created the
    roster person the moment a name was added to "Who's joining", which meant
    someone added and then removed again before Start session — or the screen
    abandoned entirely — still got written to the roster. Fixed by moving that
    resolution to the one moment the list is actually committed to:
    `ParticipantList.jsx`'s Add button now just adds the name in-memory with no
    roster call at all, and `App.jsx`'s `handleStartSession` resolves the whole
    list against the roster in one pass, right before `createSession`.
    `ActiveSessionScreen.jsx`'s mid-session "add someone who just joined" is
    different on purpose and was left as-is: that add *is* the commit (it
    inserts a real `participants` row for the running session immediately, no
    separate "start" step exists for it), so resolving the roster person right
    there is correct.
    Autocomplete first shipped as a native `<datalist>` on the existing name
    input for the zero-dependency keyboard/screen-reader/touch support it gives
    for free — reversed after the user flagged it live: the dropdown arrow and
    the suggestion popup are browser chrome that can't be restyled, and looked
    completely out of place against this app's own dark theme. Replaced with a
    small hand-built combobox (filtered `<ul>`/`<button>` list positioned under
    the input, arrow keys + Enter to pick, click/tap too) styled with the same
    ink/smoke/ember tokens as the rest of the screen. While wiring it up, also
    found and fixed a real race underneath both versions: this screen renders
    immediately on page load, before `initDatabase()` necessarily resolves, so
    its one-time `getPeople()` call on mount could silently lose that race and
    leave the suggestion list empty for the rest of the session (no retry).
    Fixed with a new `dbReady` prop (`App.jsx`'s `dbStatus === 'ready'`) that
    the roster-loading effect now waits on.
    New "People" button + `PeopleScreen.jsx`: a flat list with inline
    tap-to-rename and a delete (✕) button, no add control (same reasoning as
    above — adding only happens by typing a name at session start).
    Deleting a roster entry leaves any past `participants.person_id` referencing
    it as a harmless orphaned link (SQLite doesn't enforce the FK here) rather
    than cascading — nothing currently joins back through a deleted person except
    future suggestions/leaderboard aggregation, which naturally stop surfacing
    them going forward.
    While testing this, also found and fixed a real (pre-existing, not introduced
    by this task) console-noise bug shared by all four `db.js` migrations: each
    fired its `ALTER TABLE` unconditionally and swallowed the resulting
    "duplicate column" error on every re-run — correct in principle, but on web
    (`jeep-sqlite`) that swallowed rejection still surfaced as an "Uncaught (in
    promise)" console error on every dev-mode remount (React StrictMode re-runs
    `initDatabase()`). Switched all four migrations to check `PRAGMA
    table_info(table)` first and only `ALTER TABLE` when the column is actually
    missing, so there's nothing left to throw or swallow. Harmless either way in
    production (runs once per real install), but the console is clean now.
    Shipped local-only at first, since the `lasenggo-3000` Supabase project was
    paused at the time — now synced too, see `backend/supabase-resume-catchup`
    below (the user resumed the project partway through this task).
    Verified manually end to end in-browser: typed and submitted two names,
    confirmed both appear as `<datalist>` autocomplete options; opened People,
    renamed one entry and deleted the other, confirmed the autocomplete list
    updated to match; retyped the renamed name and confirmed it resolved to the
    same roster person (no duplicate created) when starting a session; ran a full
    session (pour + end) with both participants with no console errors from the
    current module version.
- [x] Drink + mL tracking per session (manual log, not a depletion gauge)
  - Owner: fumio65 · Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-requested. New `drinks` table (`id`, `session_id`, `name`,
    `volume_ml`, `started_at`, `synced`) — a brand-new table, so it needed no
    `columnExists`/`ALTER TABLE` migration, just a `CREATE TABLE IF NOT
    EXISTS` entry in `db.js`'s `SCHEMA`. One row per "serving period": the
    first (if a drink was given) is inserted by `createSession`; every later
    "ran out" tap inserts another row rather than mutating the last one, so
    the table is a real log, not a single mutable field — "what's being
    served now" is just the row with the latest `started_at` for that
    session (`getCurrentDrink`). Decided with the user up front (three
    questions, all answered with the recommended option):
    manual log only (no depletion math from pour volumes — pours and drinks
    are deliberately unrelated data); sync to Supabase and show in session
    history, not local-only; and the "Now serving" control sits near the top
    of `ActiveSessionScreen`, just below the session name, not tucked into
    the "Manage participants" sheet.
    "Who's joining" gained two optional fields in Session settings — Drink
    name + mL — same optional convention as session name/pass limit (blank
    name = nothing logged at all). `ActiveSessionScreen` shows "Now serving:
    `<drink>` · `<mL>`mL [Switch]" (hidden entirely if drink tracking wasn't
    used); Switch opens a one-tap "Same drink" button (new bottle/batch,
    same name+mL, fresh timestamp) alongside a name+mL form for an actual
    drink change — both just call the same `addDrink`.
    Synced the same way `participants`/`events` already are: no `device_id`
    column on `drinks` itself, RLS on the Supabase side scopes by an `EXISTS`
    subquery joining back to `sessions.device_id` (new Supabase migration
    `add_drinks_table`, policy copied verbatim from the `participants`/
    `events` policies). `pull.js` pulls `drinks` alongside `participants`/
    `events` for any session missing locally, same "only fills in what
    isn't already here" rule as the rest of that function.
    `HistoryDetail` gets a new "Drinks" section (hidden if the session never
    used tracking) — the full log, oldest first, same "show everything, not
    just latest" idea as the existing Activity log.
- [x] Drink volume: mL/L unit toggle, live remaining-volume readout from pours
  - Owner: fumio65 · Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-requested follow-up to the drink tracking above, same day —
    reverses that task's "manual log only, no depletion math" decision (see
    DECISIONS.md). Two asks: (1) let the drink volume field take more than a
    bare mL number, and (2) make the "Now serving" row show a live remaining
    volume as pours happen. Confirmed understanding with the user first, then
    three clarifying questions (all answered with the recommended option)
    before writing code.
    New `VolumeInput` component (`src/shared/components/VolumeInput.jsx`) +
    `parseVolumeToMl`/`VOLUME_UNITS` (`src/features/pour/volumeUnits.js`):
    pairs the existing number input with an mL/L segmented toggle, converting
    to a whole-number mL value at input time — the field stays numeric (so
    the depletion math below has something real to subtract from), the unit
    toggle is what satisfies "let me type more than a bare mL count" (e.g.
    "1" + "L" for a 1L bottle). No schema change — `drinks.volume_ml` still
    stores a plain integer mL, unit is purely an input-time convenience, never
    persisted. Swapped into both volume inputs: "Who's joining"'s Drink field
    and ActiveSessionScreen's "different drink" switch form.
    Remaining volume (`remainingMl` in `ActiveSessionScreen`) is derived, not
    stored: the current drink's `volume_ml` minus every POUR event logged
    since that drink's `started_at`, mapped through `POUR_VOLUMES`'
    Light/Standard/Heavy mL presets, computed client-side from the `events`
    list the session log already fetches — no new query, no risk of the
    number drifting out of sync with its inputs. Shown as "Now serving:
    `<drink>` · `<remaining>`mL left"; allowed to go negative (shown as a
    deficit, e.g. "-45mL left", in the ember accent color) rather than
    clamped at 0, since Light/Standard/Heavy are approximations and the pour
    that empties a bottle rarely lands exactly on 0. "Same drink" naturally
    resets the remaining count to the full declared volume, since it inserts
    a fresh `drinks` row with a new `started_at` the depletion math starts
    counting from zero against.
    Verified live in-browser end to end: started a session with Red Horse ·
    1 L (confirmed the L input converts and displays as "1000mL left");
    poured Standard (~30mL) for Juan and confirmed the row updated to
    "970mL left"; tapped Switch → "Same drink" and confirmed it reset to
    "1000mL left"; no console errors. (One bug caught and fixed during this
    pass: an earlier edit referenced `drinkVolumeUnit` in "Who's joining"
    without ever declaring its `useState` — crashed `ParticipantList` on
    load; fixed by adding the missing state line.)
- [x] Drink depletion bar + drink queue ("Up next", one-tap switch)
  - Owner: fumio65 · Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-requested follow-up, same day. Two asks: (1) a visual bar
    on "Now serving" instead of just the mL text, and (2) staging a drink
    ahead of time ("like a reserve") instead of only being able to switch
    right now. Confirmed understanding first, then one clarifying question
    (recommended option chosen) on whether the queued drink should take
    over automatically at 0 or wait for a tap — the latter, matching the
    earlier "no popup, passive" convention.
    Bar: a track + fill under the "Now serving" pill, same visual language
    as `ParticipantStatBar`'s pour-composition bars (`h-2`/`h-2.5`
    `overflow-hidden rounded-full bg-ink` track, animated-width fill) —
    width is `remainingMl / volume_ml` clamped to [0, 100]% (the mL text
    beside it still shows the real, possibly-negative number). Only drawn
    when a volume was actually declared. Also switched the "X mL left"
    deficit color from `text-ember` to `text-maroon-dim`/`bg-maroon` — this
    app's existing warning/danger color (duplicate-name errors, the "End
    session" confirm) — since ember is the plain accent color used
    everywhere else on this pill.
    Queue: `drinks` gained a `status` column (`'serving'` | `'queued'`,
    default `'serving'`) — a genuine migration this time (`columnExists` +
    `ALTER TABLE`), not just a CREATE TABLE edit, since the table was
    already created in the dev DB by the earlier browser verification pass
    before this column existed. New `getQueuedDrink`/`promoteQueuedDrink`/
    `cancelQueuedDrink` in `sessionQueries.js`; `getCurrentDrink` and
    `getSessionDrinks` now filter to `status = 'serving'` so a queued row
    (which can have a later `started_at` than the row actually being
    served) never gets picked up as current or shown in the history log.
    `addDrink` gained a `status` param — queuing a new drink first deletes
    any existing queued row for that session (one meaningful "up next" at
    a time), in the same `executeSet` transaction as the insert.
    UI: the "Switch" panel on `ActiveSessionScreen` now has two sections —
    the existing "switch now" form (relabeled "Ran out right now?") and a
    new "Queue next drink" form below it ("Not empty yet? Set up the next
    one for later"). An "Up next" row appears once something's queued:
    quiet (smoke-toned) while the current drink still has volume, switches
    to the maroon empty-state styling and wording ("`<current>` is empty ·
    switch to `<queued>`?") once `remainingMl <= 0` — same "Switch now"
    button underneath both states, just restyled, so there's one code path
    for both the quiet and urgent cases rather than two different banners.
    A "Cancel" link drops the queued row entirely (hard DELETE — a queued
    row was never actually served, so there's no history to preserve).
    Verified live in-browser end to end: started a session with Red Horse ·
    50mL; confirmed the bar rendered full; queued Tanduay · 750mL and
    confirmed the quiet "Up next: Tanduay · 750mL" row appeared without
    touching "Now serving"; poured Heavy (~50mL) for Juan and confirmed
    the bar drained to empty, the mL text turned the warning color, and
    the "Up next" row escalated to "Red Horse is empty · switch to
    Tanduay · 750mL?" in the maroon state; tapped "Switch now" and
    confirmed it promoted cleanly — "Now serving: Tanduay · 750mL left",
    full bar, "Up next" row gone. No console errors throughout. Confirmed
    the dev DB's pre-existing `drinks` table (created before this
    migration existed, by the earlier verification pass) picked up the new
    `status` column cleanly on next load with no errors.
- [x] Switch drink as a modal dialog (mobile-responsive, animated in/out)
  - Owner: fumio65 · Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-requested follow-up, same day — explicitly asked for a
    dialog, mobile responsiveness, and smooth enter/exit animation.
    The "switch now"/"queue next" forms moved from an inline-expanding
    section into a real dialog: backdrop (`fixed inset-0 bg-ink/70
    backdrop-blur-sm`) + panel, bottom sheet on phone width
    (`items-end`) and centered on larger screens (`sm:items-center`) —
    the same responsive convention `ParticipantManagerSheet` already
    uses, so this doesn't introduce a second dialog pattern.
    Animation: the dialog is always mounted (never
    `{switching && (...)}`) with `switching` toggling opacity/transform
    classes (`transition-opacity`/`transition-all duration-300`) instead
    — a conditionally-rendered element can't animate its own exit, since
    React removes it before any CSS transition runs. Same technique this
    screen's exit-confirm bar already uses for its own in-place
    expand/collapse, so it's consistent with the rest of the file rather
    than a new pattern. Backdrop fades; panel slides up + scales in from
    `translate-y-6 scale-95 opacity-0` (desktop skips the vertical slide,
    `sm:translate-y-0`, since it's centered there, not sheet-like).
    `inert={!switching}` on the backdrop container keeps every field
    (both forms, including `VolumeInput`'s internal number input + mL/L
    toggle buttons) out of the tab order and hidden from assistive tech
    while closed, in one attribute rather than threading tabIndex through
    every element. Backdrop click and the dialog's "Done" button both
    close it (`stopPropagation` on the panel itself so clicking inside
    it doesn't bubble to the backdrop's close handler). Form layout also
    changed from a single `flex gap-2` row to name-input-on-its-own-line
    + a second row for volume+submit, so neither form overflows a narrow
    phone width.
    Verified live in-browser: opened the dialog (backdrop dims/blurs,
    panel appears centered, both form sections render without overflow);
    clicked the backdrop and confirmed it closes; reopened, queued
    "Lambanog" through the dialog, confirmed it submitted correctly
    (dialog closed itself, "Up next: Lambanog" appeared on the main
    screen) — same underlying `handleQueueSubmit` as before, now just
    reached through the dialog. No console errors throughout. (Resizing
    the automation browser's window didn't actually shrink the page's
    rendered viewport in this environment, so the `sm:` bottom-sheet
    behavior itself — as opposed to the stacked, non-overflowing form
    layout, which doesn't depend on viewport width at all — wasn't
    directly screenshotted at phone width; worth a quick look on an
    actual phone or devtools device toolbar.)
- [x] Switch back to any past drink this session, picked from a list
  - Owner: fumio65 · Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-requested follow-up, same day — "what if I queue a drink
    then switch while there's still a drink in the current, I want to
    switch it back since there's still alcohol on it". Two design
    questions resolved with the user up front: switching back works for
    *any* past drink this session, picked from a list (not just the one
    most recently switched away from); switching back to an earlier
    drink auto-re-queues the one just left, as the new "Up next" —
    *only* if the "Up next" slot is actually free (see DECISIONS.md;
    there's still only one such slot, so a drink that's already staged
    there is never silently bumped).
    Required a real data-model change, not a UI tweak: remaining volume
    used to be computed as "every pour since this drink row's
    `started_at`", using whichever row had `status = 'serving'`. That
    breaks the moment a session can switch back to an earlier drink —
    pours made against a *different* drink while this one was inactive
    would still land after its `started_at` and get wrongly counted
    against it. Fixed by tagging every POUR event with exactly which
    drink was being served at that moment (`events.drink_id`, new
    column + idempotent migration in `db.js`), set from a ref
    (`currentDrinkIdRef`, same pattern `volumeIdRef` already uses) inside
    `useTurnManager`'s `onEvent` callback. Remaining volume for any
    drink, current or past, is now just "declared volume minus every
    pour tagged with its id" — correct regardless of how many times a
    session switches back and forth, and computed the same way (from the
    already-fetched `events` list) for the live "Now serving" number and
    every row in the new picker.
    `sessionQueries.js`: `promoteQueuedDrink` and the old ad-hoc
    "switch now" logic were unified into one `switchToDrink(sessionId,
    drinkId)`, used both for promoting the queue and for picking a past
    drink from the list. Both now funnel through a new internal
    `demoteCurrentDrink` helper that decides what happens to the drink
    being left: still has volume *and* the "Up next" slot is free ->
    becomes the new "Up next"; otherwise (empty, or something else is
    already staged there) -> becomes plain history. New
    `getSessionDrinkHistory(sessionId)` lists every drink actually served
    this session (`status IN ('serving', 'served')`) for the picker.
    Along the way, live testing turned up and fixed two real bugs
    predating this task, not introduced by it: (1) `promoteQueuedDrink`
    never demoted the row it was switching away from, so two rows could
    end up marked `'serving'` at once, silently masked by
    `getCurrentDrink`'s `ORDER BY started_at DESC` always happening to
    pick the right one — `getSessionDrinks`/history would have shown
    both as current. (2) the "switch to a different drink" dialog form
    never cleared itself after a submit (unlike the queue form, which
    always had), so typing a second switch in the same dialog session
    appended onto the previous entry instead of starting fresh.
    A third bug was introduced and caught by this task's own live
    testing before being fixed: the first version of `demoteCurrentDrink`
    unconditionally cleared whatever was in the "Up next" slot whenever
    *any* drink was demoted — fine when demoting the thing that's about
    to reclaim that slot, but wrong the moment a session switches to a
    *third* drink while an earlier one is already legitimately staged:
    it silently deleted that staged drink instead of leaving it alone.
    Fixed by only letting a demoted drink take the slot when it's free;
    otherwise it just becomes ordinary history, still fully reachable
    from the picker with its correct remaining volume.
    Verified live end to end through a three-drink chain (Red Horse 100
    -> pour -> Tanduay 50 -> pour -> switch back to Red Horse via "Switch
    now", confirmed it resumed at its real 70mL rather than resetting to
    100, and Tanduay correctly became the new "Up next" at its real
    20mL; then switched to a third drink, Ginebra, confirmed Red Horse's
    "Up next" status was left completely undisturbed, and that Tanduay
    became ordinary history instead of displacing it; opened the picker
    and confirmed it listed Tanduay at 20mL, picked it, confirmed it
    resumed correctly and Ginebra became history in turn with its real
    remaining volume; re-opened the picker and confirmed Ginebra now
    listed at 40mL). Checked the DB directly after each step via the
    browser's exposed `CapacitorSQLite` plugin to confirm row `status`
    and values matched what the UI showed. No console errors throughout.
- [x] Require a drink volume once a drink name is given
  - Owner: fumio65 · Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-reported: "I can put a name of the drink and leave the ml
    empty and I can start the session" — confirmed with the user this
    should be required, not just optional-as-designed (asked via
    AskUserQuestion; chose "Require volume if a name is given" over
    keeping it optional or just warning).
    Added the same `nameGiven && parseVolumeToMl(...) == null` check in
    three places that all independently build a drink row from a
    name+volume pair: "Who's joining" (`ParticipantList.handleStart`,
    disables "Start session"), the Switch dialog's "different drink" form
    (`handleSwitchSubmit`), and its "queue next drink" form
    (`handleQueueSubmit`) — each disables its own submit button and shows
    an inline maroon message ("Add a volume ... or clear the name") the
    same way `duplicateError` already does elsewhere in this file, rather
    than failing silently or only catching it server-side. The whole
    Drink section stays optional; the rule only engages once a name has
    actually been typed, so leaving everything blank to skip drink
    tracking is unaffected.
    Verified via a clean production build (`vite build` succeeded,
    ~18s — slower than the usual ~3-6s but no longer the repeated hangs
    seen during the previous fix tonight) and confirmed the three new
    inline-message strings are present in the minified output bundle.
    Couldn't get the dev server to come up for a live click-through this
    round (stayed unresponsive past 60s while the one-shot production
    build completed fine in 18s) — same machine-load symptoms as the
    previous task, not specific to this change; worth a live check once
    confirmed working normally again.
- [x] Fix: "switch back" picker couldn't reach a drink staged as "Up next"
  - Owner: fumio65 · Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-reported same day, right after the switchback feature
    shipped: "I enter the different-drink field while the current drink
    isn't empty, it switches, and I can't switch back to that drink."
    Traced it to a gap, not a logic bug: switching away correctly staged
    the old drink as "Up next" (per the earlier `demoteCurrentDrink`
    work), but the "Up next" banner lives on the main screen, behind the
    Switch dialog's full-screen overlay — once the dialog was open there
    was no way back to it without closing the dialog first. The dialog's
    own "switch back to a past drink" picker looked like the complete
    answer but wasn't: it's built from `getSessionDrinkHistory`, which
    only selects `status IN ('serving', 'served')` — a `'queued'` row was
    never in that list, so the old exclusion filter for it
    (`d.id !== queuedDrink?.id`) was dead code all along, not an actual
    safeguard.
    Fix: merge `queuedDrink` into the picker list client-side (the one
    place that already has it in state), excluding only the drink
    currently "Now serving", and tag that entry "· Up next" inline so
    it's not confusing to see it listed twice (banner + picker). Sorted
    by `started_at` descending across the merged list rather than
    reversing the history query's own order, so the queued drink sorts
    correctly by recency instead of always landing last.
    Couldn't get a live rebuild to finish during this fix — `vite build`
    and `vite dev` both hung repeatedly at the Tailwind project-wide scan
    step (normally ~3-5s) across five attempts, while targeted
    single/double-file `rolldown` transforms of the exact changed files
    stayed fast (3-7s) and came back clean with no syntax/reference
    errors. Looks like something unrelated was loading the machine's disk
    heavily at the time (OneDrive sync, AV scan), not a problem with this
    change. Flagged to the user; worth a quick live click-through once
    confirmed working again.
- [x] Split roster names into first/last, block duplicate participants, allow
      editing a name on "Who's joining" before Start session
  - Owner: fumio65 · Branch: `app/participant-first-last-name` · Done: 2026-10-12
  - Notes: User-requested. `people` gained `first_name`/`last_name` columns
    (same idempotent-migration pattern as every other column added after this
    table's original `CREATE TABLE` — see `migrateAddPersonNameParts` in
    `db.js`); existing rows are backfilled by treating the whole existing
    `name` as the first name, last name left blank (decided with the user
    rather than guessing at a space-split, which breaks on anyone whose
    existing single name already has a space in it). `people.name` is kept as
    a derived "First Last" cache, recomputed by `findOrCreatePerson`/
    `renamePerson` — every other read site (sync, autocomplete, display)
    keeps reading one `name` string unchanged, so this stayed local-only:
    no Supabase schema or `syncJob.js`/`pull.js` changes needed.
    Decided with the user up front: the app always *displays* "First Last"
    combined (turn order, session log, history) — first/last is only how a
    name is entered and stored, never a second display mode — and last name
    is optional everywhere (someone can be added/saved with just a first
    name).
    "Who's joining" is now two fields (First name, Last name) instead of one;
    picking an autocomplete suggestion fills both from the roster's own
    split. The mid-session "add someone who just joined" sheet
    (`ParticipantManagerSheet`) deliberately stays a single quick field —
    resolves with last name blank, matching the "optional" decision, since
    forcing two fields on a fast on-the-fly add isn't worth it.
    Duplicate prevention: `useParticipants.addParticipant` rejects a
    case-insensitive name match already on the current session's list
    (returns `null`, the same signal a blank submission already used, so
    every existing caller's `if (id && ...)` guard already handles it with
    no further changes needed). "Who's joining" surfaces this as an inline
    message under the Add button and leaves the typed name in place rather
    than silently doing nothing; the mid-session sheet gets the same
    protection but no dedicated message yet.
    Editing on "Who's joining": tapping a name now opens inline First/Last
    fields (same pattern as the People screen's own rename), saved on
    Enter/blur-away, cancelled on Escape — previously the only way to fix a
    typo before Start session was removing and re-adding. Blur-to-save is
    wired at the two-input *container* level (checked via
    `relatedTarget`), not each input — the single-field version of this same
    pattern (People screen) would otherwise close editing the moment focus
    tabs from First into Last.
    Verified live end to end: added "Juan Dela Cruz" and confirmed the
    roster split to first "Juan" / last "Dela Cruz"; confirmed every
    pre-existing single-name roster entry (added before this task) backfilled
    correctly with last name blank; picked an existing "Jovan Ramones"
    suggestion and confirmed both fields filled correctly; added "Jovan"
    again (and lowercase "jovan") and confirmed both were rejected with the
    inline message, count unchanged; edited "Carlo" to "Carlo Dizon" on
    "Who's joining" and confirmed it saved. All test rows cleaned up
    afterward (local and the copies that had already synced to Supabase).


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
- [x] Fix: web SQLite writes never actually persisted to IndexedDB
  - Owner: fumio65 · Branch: `app/web-sqlite-persistence` · Done: 2026-10-11
  - Notes: Found via user report ("when I refresh all data is cleared"). Root
    cause: the web-only backing store (`jeep-sqlite`, IndexedDB + a wasm sqlite
    engine) has an `autoSave` flag controlling whether writes flush to
    IndexedDB — it defaults to `false`, and `src/main.jsx` created the
    `<jeep-sqlite>` element without ever setting it (nor did anything call the
    matching `saveToStore()` manually). Every write landed in the in-memory
    wasm database only; a page refresh reloaded `jeep-sqlite` from whatever was
    last in IndexedDB (nothing), silently dropping everything written since.
    This had gone undetected through `app/offline-verification` above, since
    that test reloaded the page mid-flow but never checked that *previously
    created* data survived a reload — it tested the offline network path, not
    the browser-persistence path. Fixed with one line:
    `jeepSqliteEl.autoSave = true` in `main.jsx`, set before `appendChild` (the
    element reads it once in `connectedCallback`). Native Android builds are
    unaffected — they use the platform's real SQLite, not jeep-sqlite, and
    always persisted correctly.
    Verified manually: added participants, ran a full session with a pour,
    ended it, hard-reloaded the page, confirmed the session/participant/event
    data was all still there in History afterward.
- [x] Fix: Session history waited on a Supabase pull before showing local data
  - Owner: fumio65 · Branch: `app/web-sqlite-persistence` · Done: 2026-10-11
  - Notes: Found via user report ("I'm offline and when I check the history it
    loads first... I think it's syncing before it displays the offline
    data"). Root cause: `useSessionHistory`'s `refresh()` did
    `await pullSessions()` *then* `await getSessionHistory()` — the loading
    skeleton stayed up for the full duration of the (best-effort, optional)
    Supabase pull before the local read even started, backwards from the
    "local-first, never blocks on network" rule the rest of the app follows
    (ARCHITECTURE.md). `pullSessions()`'s own `navigator.onLine` early-exit
    doesn't fully cover this either — a device can report online with no real
    connectivity. Fixed by reordering: local SQLite is read and rendered
    first, unconditionally; the Supabase pull then runs in the background and
    only triggers a second render if it actually finds sessions missing
    locally (reinstall, cleared local DB) to merge in. `HistoryDetail`'s own
    hook (`useSessionDetail`) was checked too — it never pulled from Supabase
    at all, so it wasn't affected.
    Verified manually: Session history shows local rows immediately on open,
    no visible wait on the network call either way.

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
- [x] Catch up Supabase schema + sync after resuming the paused project
  - Owner: fumio65 · Branch: `backend/supabase-resume-catchup` · Done: 2026-10-11
  - Notes: User resumed the paused `lasenggo-3000` Supabase project mid-session.
    Checking it before syncing anything turned up a real, pre-existing gap: three
    local features shipped while the project was paused (`app/pause-reason-tag`,
    the pour-volume breakdown, and this session's `app/people-roster`) had never
    reached Supabase at all — not just unsynced rows, but columns and a CHECK
    constraint that didn't exist yet. Had sync ever actually run against the
    live project before now, every `PAUSE`/`RESUME` event would have been
    silently and permanently rejected by `events`' old
    `type = ANY (ARRAY['POUR','PASS'])` constraint (caught, logged, rows stay
    queued forever — "fails safe" by design, but silently wrong).
    Migration `catch_up_pause_volume_and_people_roster` applied directly via
    Supabase MCP: `events.volume`/`events.note` added; `events_type_check`
    widened to include `PAUSE`/`RESUME`; new `people` table (device-scoped via
    `device_id`, same RLS pattern as `sessions` — `USING (device_id =
    auth.uid())`, since a person isn't tied to one session the way
    participants/events are); `participants.person_id` added with its FK into
    `people`.
    `syncJob.js`: new `syncPeople()` (same shape as `syncSessions` — device_id
    stamped at push time, not creation time), run *before* `syncSessions`/
    `syncParticipants` since `participants.person_id` is a foreign key into
    `people` on Supabase. `syncParticipants` now pushes `person_id`;
    `syncEvents` now pushes `volume`/`note`.
    `pull.js`: new `pullPeople()`, pulling this device's whole roster
    independently of which sessions are missing locally (unlike
    session-scoped data, a roster gap isn't implied by "this device already
    has all its sessions" — e.g. a rename from another device, or a reinstall).
    `pullSessions`'s participant/event pulls now carry `person_id`/
    `volume`+`note` too.
    Local SQLite: `people` gained a `device_id TEXT` column (new
    `migrateAddPersonDeviceId`, same idempotent `PRAGMA table_info` pattern as
    the other four migrations) — needed so `syncPeople` has somewhere to stamp
    it, matching how `sessions.device_id` already worked.
    Verified end to end: added two participants, poured once (volume) and
    paused one with a reason tag (note) through a real session, ended it, and
    confirmed via `execute_sql` that the session, both participants
    (`person_id` populated), the `POUR` event (`volume: "standard"`), the
    `PAUSE` event (`note: "Went home"` — the exact row shape the old
    constraint would have rejected), and both `people` rows (`device_id`
    stamped) all landed correctly in Supabase.


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
      HistoryDetail — no longer blocked on real hardware: `app/people-roster`'s
      Simulate Pour already exercises the full pour → event-logging path end to
      end, so this can be built and tested now. (B) all-time cross-session
      leaderboard — its roster prerequisite is **done**
      (`app/people-roster`: `people` table + `participants.person_id`, plus the
      rename/delete screen), since cross-session aggregation by name alone was
      unreliable (name collisions/typos). What's left for (B) is just the
      aggregation query + leaderboard UI itself. `people` isn't synced to
      Supabase yet (local-only for now, the Supabase project is currently
      paused) — needed before an all-time board means anything across devices,
      not just one phone's local history. Build order: (A) first (quick now that
      Pour is simulated), then `people` → Supabase sync, then (B)'s aggregation +
      board.
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
- [x] "Up next" multi-item queue, with per-item edit/delete — Owner: fumio65 ·
      Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: `drinks.status = 'queued'` is no longer treated as a single slot.
    `sessionQueries.js`: `demoteCurrentDrink` simplified to unconditionally
    re-queue a drink that still has volume (or mark it `'served'` if empty) —
    the old "only re-queue if the slot is free" branch is gone entirely, since
    there's no slot to contend over any more. Added `getQueuedDrinks(sessionId)`
    (replaces the old single-row `getQueuedDrink`, returns all `'queued'` rows
    oldest-first) and `updateQueuedDrink(drinkId, name, volumeMl)` for in-place
    edits. `ActiveSessionScreen.jsx`'s "Up next" banner is now a list render
    over `queuedDrinks`: each row has its own Switch now / Edit / Delete, only
    the oldest row (`nextQueuedDrink`) gets the urgent maroon "switch to?"
    styling once the current drink is empty, and Edit swaps a row into an
    inline name+volume form in place (same "volume required once a name is
    given" rule as every other drink form in this app, via a new
    `editVolumeMissing` check). The Switch dialog's "switch back" picker no
    longer merges in the queued drink or tags it "· Up next" — now that queued
    items have their own dedicated list, duplicating one into the picker would
    just be confusing.
    See DECISIONS.md — this supersedes the earlier "auto-requeue only if the
    slot is free" decision.
    Verified: `node_modules/.bin/rolldown` syntax-checked `ActiveSessionScreen.jsx`
    cleanly; a full `vite build` succeeded in 3.91s (fast, no hang this time),
    and the compiled bundle was grepped for the new "Up next" and "Add a
    volume, or clear the name" strings to confirm the right code shipped.
    `vite dev` did come up and answered the first request (curl to `/` → 200)
    within the same shell call that started it, but a follow-up curl from a
    separate call couldn't reach it again — consistent with this device
    bridge's per-call fresh-container behavior noted earlier in this file,
    not a new regression. No live click-through in an actual browser was
    possible this session; flagging that gap honestly rather than claiming
    verification that didn't happen.
- [x] Queued-drink list UI/UX pass: icon buttons + delete confirm — Owner:
      fumio65 · Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-reported the Delete button had no confirmation and the
    "Up next" list's styling didn't hold up once more than one row was
    queued. Rebuilt each row from a centered flex-wrapped pill into a
    left-aligned, full-width card (name + remaining mL on the left,
    actions on the right). Added three small SVG icon components
    (`EditIcon`, `TrashIcon`, `SwitchIcon` in `src/shared/components/`,
    matching the existing `BackIcon`/`HistoryIcon` stroke convention — no
    new icon-library dependency) and swapped the plain text Switch
    now/Edit/Delete buttons for icon buttons. Delete is now a two-tap
    confirm: tapping the trash icon arms that row's inline "Delete? Yes/No"
    state (`confirmDeleteId`) instead of deleting immediately; a second tap
    on Yes is required, and tapping Switch now, Edit, or arming a different
    row's confirm disarms it. Kept inline rather than a popup/dialog, same
    convention as the rest of this list (see DECISIONS.md).
    Verified: `node_modules/.bin/rolldown` syntax-checked the file cleanly;
    a full `vite build` succeeded in 9.45s (104 modules — the 3 new icon
    files included), and the compiled bundle was grepped for "Delete?",
    "Switch now to ", and "Up next" to confirm the right code shipped. No
    live click-through in an actual browser this session — same
    device-bridge dev-server gap noted in the previous entry, not
    attempted again here since the pattern is already established.
- [x] Edit "Now serving" in place (not just queued drinks) — Owner:
      fumio65 · Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-reported no way to fix a misspelled name or wrong mL on
    the drink currently being served — only "Up next" rows had an Edit
    action. `sessionQueries.js`: `updateQueuedDrink` renamed to
    `updateDrink`, WHERE clause widened from `status = 'queued'` to
    `status IN ('queued', 'serving')` — a `'served'` (past/history) row
    still can't be edited, deliberately, since it may already have real
    pours tagged against its id. `ActiveSessionScreen.jsx`: "Now serving"
    gained a small Edit icon that reuses the exact same inline edit form,
    state (`editingQueuedId`/`editName`/`editVolumeInput`), and "volume
    required once a name is given" validation already built for queued
    rows — just targeting `currentDrink.id` instead. Saving refreshes both
    `currentDrink` and `queuedDrinks` rather than branching on which one
    the id belonged to.
    Verified: `node_modules/.bin/rolldown` syntax-checked the file cleanly;
    a full `vite build` succeeded in 8.26s, and the compiled bundle was
    grepped for "Now serving:" and the new "edit-current-drink" id prefix
    to confirm the right code shipped. No live click-through in an actual
    browser this session — same device-bridge dev-server gap noted in
    earlier entries.
- [x] Fix: every queued row said "Up next" — Owner: fumio65 · Branch:
      `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-reported two drinks waiting, both rows labeled "Up next" —
    ambiguous about which one actually comes next. `ActiveSessionScreen.jsx`:
    added the row's `index` to the `queuedDrinks.map` callback and derived
    a `queueLabel` — urgent empty-drink message for the oldest row when
    the current drink is out, "Up next" for the oldest row otherwise, and
    `#${index + 1} in queue` for every row behind it.
    Verified: `node_modules/.bin/rolldown` syntax-checked the file cleanly;
    a full `vite build` succeeded (32.28s this run — Tailwind's generate
    step was slower than usual but still completed, no hang), and the
    compiled bundle was grepped for "in queue" to confirm the new label
    text shipped. No live click-through in an actual browser this
    session — same device-bridge dev-server gap noted in earlier entries.
- [x] Collapse a long "Up next" queue behind a count toggle — Owner:
      fumio65 · Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: Raised proactively (asked what to do about queue UX once
    several drinks are waiting). Given three options via AskUserQuestion
    (fixed-height scroll; collapse-to-count with expand; a separate
    dedicated queue view), the user chose collapse-to-count. Pulled the
    per-row markup out of the inline `.map()` into a `renderQueuedRow(drink,
    index)` function so it can be called from two places without
    duplicating JSX. Only `queuedDrinks[0]` (the oldest-staged row) always
    renders; once `queuedDrinks.length > 1`, a "+N more queued" toggle
    appears below it, and the rest only render (via `queueExpanded` state)
    once tapped — tapping again ("Hide") collapses them.
    Verified: `node_modules/.bin/rolldown` syntax-checked the file cleanly;
    a full `vite build` succeeded in 5.53s (needed a one-time delete
    permission grant for `dist/`/`node_modules/.vite` in this session,
    since a previous call's `rm -rf` had failed with "Operation not
    permitted" — noted here in case it recurs), and the compiled bundle
    was grepped for "more queued" and "Hide" to confirm the right code
    shipped. No live click-through in an actual browser this session —
    same device-bridge dev-server gap noted in earlier entries.
- [x] Fix: expanding the queue pushed TurnRing down the page — Owner:
      fumio65 · Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-reported the turn-order circle shifted down whenever the
    "+N more queued" toggle was expanded, since the expanded rows sat
    inline and grew the column's height above it. `ActiveSessionScreen.jsx`:
    the wrapper around the toggle button is now `relative`, and the
    expanded panel is `absolute left-0 right-0 top-full z-20 mt-1 max-h-64
    overflow-y-auto ... shadow-lg` instead of a plain in-flow `<div>` — it
    now floats over whatever's below instead of displacing it, with a
    capped height + scroll for a queue long enough to run off-screen.
    Verified: `node_modules/.bin/rolldown` syntax-checked the file cleanly;
    a full `vite build` succeeded in 14.41s, and the compiled CSS bundle
    was grepped for `.top-full`, `.z-20`, and `.shadow-lg` to confirm
    Tailwind actually generated those utilities. No live click-through in
    an actual browser this session — same device-bridge dev-server gap
    noted in earlier entries; worth confirming the floating panel doesn't
    get clipped by any `overflow-hidden` ancestor once it's checked live.
- [x] Fix: "Switch" button was misleading (also queues a drink) — Owner:
      fumio65 · Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-reported the "Switch" label next to "Now serving" didn't
    say it also opens the queue-a-drink-for-later form. Relabeled both
    the trigger button and the dialog's `<h2>` from "Switch drink"/"Switch"
    to "Switch / Queue drink"/"Switch / Queue", and added an `aria-label`
    on the button spelling out both actions for screen readers, since the
    visible label is now a slash-separated pair rather than one plain verb.
    Verified: `node_modules/.bin/rolldown` syntax-checked the file cleanly;
    a full `vite build` succeeded in 10.05s, and the compiled bundle was
    grepped for "Switch / Queue" and "Switch / Queue drink" to confirm
    both strings shipped. No live click-through in an actual browser this
    session — same device-bridge dev-server gap noted in earlier entries.
- [x] Log which drink each participant poured + a live "Drinks" section
      (current + queued, not just history) — Owner: fumio65 · Branch:
      `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-reported two gaps: (1) no record of which alcohol each
    participant actually drank, (2) the session log only covered finished
    drink history, not what's currently serving or queued.
    `sessionQueries.js`: `getSessionEvents` now `LEFT JOIN`s `drinks` and
    selects `d.name AS drink_name` (LEFT, not JOIN, since a PASS row has
    no `drink_id` and a cancelled queued drink's row can be gone entirely
    — `drink_name` just comes back null rather than dropping the event).
    `volumeUnits.js`: new `formatVolumeMl(ml)` — >= 1000mL displays as L
    (`1500` -> `"1.5L"`), otherwise plain `"<n>mL"`.
    `SessionLog.jsx`: `buildStats` now collects a per-participant `Set` of
    drink names from POUR events (deduped, first-poured order) as
    `stat.drinkNames`; a new "Drinks" section lists every drink the
    session has touched (merging `drinkHistory` + `queuedDrinks`
    client-side in `ActiveSessionScreen.jsx` as `allDrinksForLog` — no new
    query needed, both lists already existed in state) labeled "Now
    serving"/"Queued"/"Served" with `formatVolumeMl` for the volume.
    `ParticipantStatBar.jsx`: renders `stat.drinkNames` as a small text
    line under the participant's name; falls back to nothing for
    HistoryDetail's unrelated stat shape, which never sets that field.
    Verified: `node_modules/.bin/rolldown` syntax-checked all five changed
    files cleanly; a full `vite build` succeeded in 3.72s (needed a
    one-time delete-permission re-grant for `dist/` in this fresh
    container — same as a previous entry, confirming it doesn't persist
    across separate device-bridge calls), and the compiled bundle was
    grepped for "Now serving", "Queued", "Served", and "drink_name" to
    confirm the right code shipped. No live click-through in an actual
    browser this session — same device-bridge dev-server gap noted in
    earlier entries.
- [x] Fix: a participant's mL across a drink switch was one lumped
      total, not separated per drink — Owner: fumio65 · Branch:
      `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-reported: poured everyone the current drink, switched to
    a different one, and each participant's mL just kept accumulating
    into one combined number with no way to tell how much came from
    which drink. The previous entry's `drinkNames` (names only, no
    amounts) didn't actually fix this. `SessionLog.jsx`: `buildStats`
    replaced the name-only `Set` with `drinkTotalsByName`, a running mL
    total keyed by drink name, built the same way `totalMl` always was
    (`VOLUME_BY_ID[event.volume].approxMl` per POUR) but added to its own
    drink's bucket instead of one shared pot. Exposed as `stat.drinkTotals`
    (`[{ name, ml }]`, first-poured order). `ParticipantStatBar.jsx`:
    renders each drink with its own `~mL`/`L` line (via `formatVolumeMl`);
    the existing combined `~totalMl` line stays as the grand total below
    it, now also through `formatVolumeMl`.
    Verified: hand-traced `buildStats` in an isolated `node` script with
    two drinks (2× standard pour of "Tanduay" + 1× heavy pour of "Red
    Horse") — confirmed `drinkTotals` came back as `Tanduay: 120`, `Red
    Horse: 90` separately, with `totalMl: 210` matching their sum.
    `node_modules/.bin/rolldown` syntax-checked both changed files
    cleanly; a full `vite build` succeeded in 10.91s. No live
    click-through in an actual browser this session — same device-bridge
    dev-server gap noted in earlier entries.
- [x] Show pour-size (Light/Standard/Heavy) counts per drink, not just
      mL — Owner: fumio65 · Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: Proactively asked whether this was worth building now that
    mL is already split per drink; agreed, with the scope narrowed to
    reuse the existing per-drink line rather than add a second stacked
    bar per drink. `SessionLog.jsx`: each `drinkTotalsByName` bucket
    (keyed by drink name) now holds `{ ml, byVolume: { light, standard,
    heavy } }` instead of a bare mL number — same per-POUR accumulation
    the participant-wide `byVolume` already does, just scoped to the
    drink that pour belonged to. `ParticipantStatBar.jsx`: each drink's
    line gained a second row of small colored-dot counts (same dots/
    colors/order as the participant-wide ones above), filtered to only
    the volumes actually poured for that drink.
    Verified: hand-traced `buildStats` in an isolated `node` script with
    3 pours of "Tanduay" (2 Standard + 1 Heavy) and 1 "Red Horse" (Light)
    — confirmed each drink's `byVolume` came back correctly isolated
    (Tanduay: standard 2/heavy 1, Red Horse: light 1) while the
    participant's own overall `byVolume`/`totalMl` still matched the sum
    across both drinks. `node_modules/.bin/rolldown` syntax-checked both
    changed files cleanly; a full `vite build` succeeded in 10.10s. No
    live click-through in an actual browser this session — same
    device-bridge dev-server gap noted in earlier entries.
- [x] Collapse a participant's long drink list behind a count toggle —
      Owner: fumio65 · Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: Raised proactively (asked what to do once a participant has
    several different drinks logged, same shape of problem the queue
    list had). Given the same three options via AskUserQuestion as the
    earlier queue-list decision, the user again chose collapse-to-count,
    for consistency. `ParticipantStatBar.jsx`: added local
    `drinksExpanded` state (per participant row, not shared across the
    roster); pulled the per-drink `<li>` markup into a `renderDrinkRow`
    closure so it can be called for both the always-visible row and the
    collapsed ones. Only `stat.drinkTotals[length - 1]` (the most
    recently poured drink) always renders; the rest
    (`drinkTotals.slice(0, -1).reverse()`, most-recent-of-the-earlier-ones
    first) collapse behind a "+N more drinks" toggle and only render once
    tapped.
    Verified: `node_modules/.bin/rolldown` syntax-checked the file
    cleanly; a full `vite build` succeeded in 11.30s, and the compiled
    bundle was grepped for "more drink" and "Hide" to confirm the labels
    shipped. No live click-through in an actual browser this session —
    same device-bridge dev-server gap noted in earlier entries.
- [x] Fix: collapsed drink view showed the first drink poured, not the
      current one — Owner: fumio65 · Branch: `app/drink-tracking` ·
      Done: 2026-10-18
  - Notes: User-reported the default-shown drink (before expanding "+N
    more drinks") was whichever drink they'd poured *first*, not the one
    they were currently on. Root cause: `getSessionEvents` returns events
    newest-first; `buildStats` (SessionLog.jsx) iterates that list and
    inserts each drink name into `drinkTotalsByName` on its first
    encounter — which, given newest-first iteration, is actually that
    drink's *most recent* pour. So the object's insertion order comes out
    newest-drink-first, not first-poured as the surrounding comments
    (also corrected this commit) had assumed. `ParticipantStatBar.jsx`
    was taking the *last* entry as "the current drink" — exactly
    backwards. Changed to `drinkTotals[0]` for the always-visible row and
    `drinkTotals.slice(1)` (already correctly ordered, no reversal
    needed) for the collapsed ones.
    Verified: traced `buildStats` in an isolated `node` script with
    events in the real newest-first order (most recent pour — Red Horse —
    listed before the earlier Tanduay pours) and confirmed
    `drinkTotals[0]` came back as Red Horse, the actually-current drink.
    `node_modules/.bin/rolldown` syntax-checked both changed files
    cleanly; a full `vite build` succeeded in 10.54s. No live
    click-through in an actual browser this session — same device-bridge
    dev-server gap noted in earlier entries.
- [x] Fix: Activity log never named which drink was poured — Owner:
      fumio65 · Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-reported the Activity log "didn't even log it properly" —
    every pour row still only said "poured (Standard)", with no drink
    name, even though `getSessionEvents` has carried `drink_name` (via
    its LEFT JOIN onto `drinks`) since the earlier per-participant-
    breakdown work. `ActivityFeed.jsx` is shared between the live
    session's Activity log and HistoryDetail's past-session one, so one
    fix covers both: appends `` · ${event.drink_name}`` after the
    pour-size label, only when `drink_name` is present (null for a
    session that never used drink tracking, so nothing grows a stray
    " · " for those rows).
    Verified: `node_modules/.bin/rolldown` syntax-checked the file
    cleanly; a full `vite build` succeeded in 9.14s, and the compiled
    bundle was grepped for `drink_name` to confirm the field is actually
    referenced in the shipped code (the interpolated template literal
    itself isn't a greppable literal string once minified). No live
    click-through in an actual browser this session — same device-bridge
    dev-server gap noted in earlier entries.
- [x] Fix: Session History dropped re-queued drinks, showed no
      remaining volume — Owner: fumio65 · Branch: `app/drink-tracking` ·
      Done: 2026-10-18
  - Notes: User-reported History "didn't record all the drinks from
    current to que... it just records the last alcohol drink", and
    didn't show how much mL/L was left in each. Root cause:
    `getSessionDrinks` filtered to `status IN ('serving', 'served')` —
    written back when `'queued'` only ever meant "staged, never
    touched." That broke once `demoteCurrentDrink` started *re*-queuing a
    drink switched away from while it still had volume (not marking it
    `'served'`) — a drink that genuinely had real pours earlier in the
    session could land back in `'queued'` and vanish from history
    entirely if the session ended before it was promoted again.
    `sessionQueries.js`: dropped the status filter from `getSessionDrinks`
    completely — every drink row now comes back, plus its `status`
    column (previously unselected there). `HistoryDetail.jsx`: new
    `drinkStatusLabel(drink, events)` disambiguates `'queued'` by
    checking whether the drink has any POUR events against it ("Served,
    then re-queued" vs. "Queued, never served"), and a ported
    `remainingForDrink` (same declared-minus-poured formula
    ActiveSessionScreen's live version uses, computed from the already-
    loaded past-session `events`) shows each drink's remaining volume
    next to its declared one, both via `formatVolumeMl`.
    Verified: hand-traced both helpers in an isolated `node` script with
    a drink that was poured from, switched away from while non-empty
    (status left at `'queued'` — the actual bug scenario), and a second
    drink still `'serving'` at session end — confirmed the first came
    back labeled "Served, then re-queued" with its correct remaining mL,
    not silently dropped. `node_modules/.bin/rolldown` syntax-checked
    both changed files cleanly; a full `vite build` succeeded in 4.13s,
    and the compiled bundle was grepped for all three new status-label
    strings to confirm they shipped. No live click-through in an actual
    browser this session — same device-bridge dev-server gap noted in
    earlier entries.
- [x] History's Drinks section: small-multiples bar chart instead of
      plain text rows — Owner: fumio65 · Branch: `app/drink-tracking` ·
      Done: 2026-10-18
  - Notes: User-reported the Drinks section's UI/UX didn't look good and
    asked for a graph, given it's a history view. Loaded the project's
    dataviz skill before building: picked the form (magnitude comparison
    across categorical rows = small-multiples bars, not a line/trend or a
    single stat) and deliberately reused an *existing*, already-shipped
    color convention rather than introducing a new categorical palette —
    the live session's own depletion bar (ActiveSessionScreen: track
    `bg-ink`, fill `bg-ember`/`bg-maroon` for has-volume/empty) — so no
    new palette validation was needed; it's the same two-state status
    encoding already in use. `HistoryDetail.jsx`: each drink with a
    declared volume gets that track+fill bar, width = poured/declared
    clamped to [0, 100]%, stacked oldest-first; poured/declared/remaining
    stay as direct text labels under the bar so the numbers are never
    only readable from color. A drink with no declared volume (nothing
    to bar against) falls back to the plain status line alone.
    Verified: `node_modules/.bin/rolldown` syntax-checked the file
    cleanly; a full `vite build` succeeded in 4.65s, and the compiled
    bundle/CSS were grepped for "poured of" and `.bg-maroon` to confirm
    the new markup and the reused color class both shipped. No live
    click-through in an actual browser this session — same device-bridge
    dev-server gap noted in earlier entries; worth eyeballing the bar
    widths on a real past session once that's checked live, per the
    dataviz skill's own "render it and look at it" step.
- [x] Fix: History's drink bar filled with poured amount, inconsistent
      with the live view's draining bar — Owner: fumio65 · Branch:
      `app/drink-tracking` · Done: 2026-10-18
  - Notes: Asked directly which direction (fill with poured vs. drain
    with remaining) was more user-friendly; picked drain/remaining, both
    because it matches the live session's existing "Now serving" bar
    (`barWidthPct = remainingMl / declared` in ActiveSessionScreen,
    checked directly rather than assumed) and because a draining gauge
    is the more familiar convention for "how much is left" on its own.
    The commit that introduced the History bar had actually claimed
    parity with the live bar in its own commit message while being the
    opposite direction — caught here, not before.
    `HistoryDetail.jsx`: `widthPct` changed from
    `pouredMl / drink.volume_ml` to `max(remaining, 0) / drink.volume_ml`.
    The poured/declared/remaining text labels underneath are unchanged —
    only the bar's fill direction moved.
    Verified: hand-computed the width for a 700mL drink with 520mL
    poured (180mL remaining) — confirmed it comes out ~26% (mostly
    drained), matching the live bar's behavior for a mostly-finished
    drink instead of the previous ~74%. `node_modules/.bin/rolldown`
    syntax-checked the file cleanly; a full `vite build` succeeded in
    4.04s. No live click-through in an actual browser this session —
    same device-bridge dev-server gap noted in earlier entries.
- [x] Fix: Back button scrolled away on long Session History pages —
      Owner: fumio65 · Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-reported that scrolling a long session list (or a
    session with a lot of Drinks/Activity-log entries) scrolled the Back
    button out of view with the rest of the header, since both
    `HistoryList` and `HistoryDetail` are a single unbounded-height
    scrolling page. Pulled the button into its own
    `sticky top-0 z-10 -mx-6 -mt-6 bg-ink px-6 pb-3 pt-6` bar in both
    files — the negative margins cancel the page's own `p-6` so the bar
    bleeds to the real viewport edges, then re-adds its own padding; the
    solid background stops scrolling content showing through underneath
    it. The big session-name/date title stays in normal flow below it
    rather than also being made sticky, so it still scrolls away
    normally and the sticky bar stays compact.
    Verified: `node_modules/.bin/rolldown` syntax-checked both files
    cleanly; a full `vite build` succeeded in 4.21s, and the compiled CSS
    was grepped for `.sticky`, `.-mx-6`, and `.-mt-6` to confirm Tailwind
    generated those utilities. No live click-through in an actual
    browser this session — same device-bridge dev-server gap noted in
    earlier entries; worth confirming on an actual phone-width screen
    that the sticky bar doesn't gap at the very top on scroll bounce (iOS
    rubber-banding can occasionally reveal a sliver above a `sticky`
    element depending on the surrounding scroll container).
- [x] Optional, mid-session turn timer + buzzer — Owner: fumio65 ·
      Branch: `app/drink-tracking` · Done: 2026-10-18
  - Notes: User-asked-for ("add a buzzer or a time limit when they're
    turn to drink so it look more intense", explicitly optional and
    settable mid-session, not just at Start Session). Used
    AskUserQuestion to settle three open questions before building:
    timeout behavior (buzzer+flash only, no forced auto-Pass — matches
    the existing pass-limit house rule's soft-signal philosophy),
    duration picker (presets, not free input), and control placement
    (new control near TurnRing, not folded into the participant manager
    sheet). New `useTurnTimer.js` (`turnKey` = `currentIndex` from
    useTurnManager, `durationSeconds` = null when off) resets on every
    new turn or duration change and flips `expired` once per turn — it
    never calls `onPass`/`onPourConfirmed` itself, same "soft signal,
    caller decides" shape as `isOverPassLimit`. New `playBuzzer.js`
    synthesizes a two-beep buzzer via Web Audio (no audio file asset,
    consistent with this app's offline-first stance) rather than
    bundling a sound file. New `TimerIcon.jsx` matches the existing
    icon-stroke convention. `ActiveSessionScreen.jsx`: a pill next to
    TurnRing shows "Turn timer: Off" / "`<n>`s" / "Time's up!" (maroon,
    pulsing), opening an absolute-positioned preset dropdown (10s/15s/
    30s/60s/Off) — same non-layout-shifting pattern as the queue's own
    dropdown — and a `useEffect` on `expired` calls `playBuzzer()`
    exactly once per expiry.
    Verified: hand-traced the countdown/expiry state machine in an
    isolated script (10s duration ticked 12 times: counts 10→1, then
    stays "EXPIRED" rather than going negative or re-firing; disabled
    duration never counts at all). `node_modules/.bin/rolldown`
    syntax-checked all four changed/new files cleanly; a full `vite
    build` succeeded in 4.22s, and the compiled bundle was grepped for
    "Turn timer: Off", "Time's up!", and "AudioContext" to confirm the
    UI strings and the Web Audio usage both shipped. No live
    click-through in an actual browser this session — same
    device-bridge dev-server gap noted in earlier entries; the buzzer
    sound itself in particular can only really be judged by ear once
    tested live.
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

- [x] app/drink-session-log: mL/L display is now a manual toggle (shared, persisted)
      instead of auto-switching per value — see DECISIONS.md.

- [x] app/drink-tracking: added a mid-session "Start tracking a drink"
      form for sessions where drink tracking was skipped at Start Session
      — see DECISIONS.md.

- [x] app/history-swipe-delete: swipe a session row left to reveal a
      delete button; tapping it opens a confirm dialog (swipe never
      deletes by itself) — see DECISIONS.md.

- [x] app/history-resume: added a "Resume session" button to the History
      detail/overview screen; resuming un-ends the session and restores
      its exact participants, continuing where it left off (pass limit
      can't be restored — never persisted) — see DECISIONS.md.

- [x] app/people-roster-delete-confirm: the ✕ button on People now opens
      a confirm dialog instead of deleting right away; also fixed a bug
      where a deleted person could reappear on the next sync pull (no
      local tombstone existed to stop it) — see DECISIONS.md.

- [x] app/display-name: app's own display name (title, Android app
      label, in-app header) changed to "Lasenggo" — the overall
      project/hardware name stays "Lasenggo 3000" — see DECISIONS.md.
