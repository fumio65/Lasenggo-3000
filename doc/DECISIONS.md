# DECISIONS.md — Lasenggo 3000

Log of key technical decisions and why, so settled questions don't get re-litigated.
Add new entries at the top (most recent first).

---

### Hardware component sourcing: specific product picks (Shopee)
**Decision**: Locked in exact product/variant picks for the remaining hardware on the
`PRD.md` components table:
- **Pump**: INTLLAB 12V 5W Peristaltic Liquid Pump (silicone tubing, 19-100 mL/min)
- **Relay module**: "5V, 1 Channel" variant of a multi-channel relay listing — NOT the
  12V-rated variant
- **Load cell + HX711**: "HX711 & 1kg" bundle variant — NOT 3kg/5kg/10kg/20kg
- **LED ring**: "8 Bit (Circle)" variant of a WS2812B breakout listing
- **Battery**: 18650 Li-ion pack with BMS, 12V (11.1-12.6V, 3S), 4500mAh variant
- **Jumper wires**: Female-Female, 20cm

**Why these specific variants** (not just "a relay module" or "a load cell"):
- **Relay 5V vs 12V**: both variants switch the 12V pump fine on their output contacts
  (COM/NO/NC), but their *trigger/coil* side differs — the 12V variant's input
  optocoupler is sized for a ~12V trigger signal, and ESP32's GPIO only outputs 3.3V.
  The 5V variant's input is sized for 3.3V-5V logic, which is the standard
  ESP32/Arduino/Raspberry Pi pairing (the listing itself calls this out). The 12V
  variant would likely fail to switch reliably off ESP32 GPIO.
- **Load cell 1kg vs higher capacities**: actual measured weights here are small (empty
  cup ~20-50g, +15-50g of liquid per pour, so well under 150g total on the platform). A
  load cell's resolution scales with its rated range, so a 1kg cell gives much finer
  sensitivity to these small deltas than a 10kg/20kg cell would — this matters directly
  for the NO_CUP/CUP_DETECTED/HAS_DRINK/EMPTY state thresholds in `ARCHITECTURE.md`.
- **LED ring 8-bit vs 12/16-bit**: more pixels generally means a physically larger ring;
  8-bit keeps it compact enough to fit around a small cup/shot-glass base while still
  giving enough individually addressable pixels for a glow + optional fill animation.
- **Battery 4500mAh vs 6800mAh**: the pump only runs in short bursts per pour (low duty
  cycle), so 4500mAh comfortably covers a full session with margin; 6800mAh only buys
  longer time between recharges, not a functional requirement.
- **Jumper wires F-F, not M-M/M-F**: ESP32, the HX711 module, the relay module, and the
  WS2812 ring all ship with male pin headers already soldered on. Connecting two
  male-header devices directly (no breadboard in this build) requires Female-Female
  jumpers on both ends.

**Impact**: `PRD.md`'s hardware table now carries a "Sourced Pick" column with these
exact variants and their Shopee links. Full purchase tracking (cost, have-it/need-to-buy
status) lives in the `Lasenggo3000_Components.xlsx` spreadsheet, not in these docs — this
entry exists so the *why* behind each variant choice isn't lost or re-debated later.
**Also confirmed**: the battery pack outputs 11.1-12.6V only — it does not power the
ESP32 or LED ring directly. Those still need a separate 5V source (USB for ESP32, as
already planned) or a 12V-to-5V buck converter if consolidating onto one battery later.

---

### sql.js pinned to exactly 1.11.0 for web SQLite testing
**Decision**: `sql.js` is pinned at exactly `1.11.0` (`--save-exact`), not a `^`
range, and `public/assets/sql-wasm.wasm` is copied from that exact package
version.
**Why**: `jeep-sqlite` (the web backing store for `@capacitor-community/sqlite`,
used so SQLite can be tested in a browser without Android Studio) ships
precompiled JS glue built against `sql.js@1.11.0`'s wasm ABI. A newer `sql.js`
(1.14.2, which still satisfies jeep-sqlite's own `^1.11.0` dependency range)
throws `WebAssembly.instantiate(): LinkError: ... function import requires a
callable` at runtime — a silent-looking hang, not an obvious error, until you
check the browser console.
**Impact**: Don't `npm update sql.js` or let it float to a newer version without
re-verifying the `db: ready` badge in the browser (see `app/sqlite-schema` in
`TASKS.md`). This only affects the web dev/test path — native Android builds use
the platform's real SQLite via the Capacitor plugin, not this wasm build.

### Project name: "Lasenggo 3000"
**Decision**: Renamed from working title "TagayBox" to "Lasenggo 3000."
**Why**: Purely a naming preference — funnier, more memorable. "Lasenggo" (drunkard) +
mock sci-fi product numbering ("3000") plays up the joke of over-engineering a simple
drinking ritual.
**Impact**: BLE advertised device name updated to `"Lasenggo3000"` (no space). All docs
updated. No functional/architecture impact.

---

### Communication: Bluetooth (BLE), not WiFi/MQTT
**Decision**: Use Bluetooth Low Energy between app and ESP32, not WiFi/MQTT.
**Why**: Many actual tagayan locations (rural areas, outdoor fiestas, backyard inuman)
have no WiFi or mobile data. A WiFi/cloud-dependent design would simply not work in the
primary use case.
**Alternatives considered**: WiFi + local MQTT broker — rejected due to internet
dependency; Bluetooth Classic (SPP) — rejected in favor of BLE for better battery
efficiency on a portable, likely battery-powered device.

---

### Native BLE (Capacitor plugin) over Web Bluetooth API
**Decision**: Use `@capacitor-community/bluetooth-le` inside a Capacitor-wrapped APK,
not the browser Web Bluetooth API.
**Why**: Web Bluetooth is unsupported on iOS Safari entirely, and is generally less
reliable than native BLE access. Since the app is being distributed as an installable
APK anyway (not a hosted web page), native BLE access is the better fit.

---

### Cup/liquid detection: load cell + HX711, not IR/ultrasonic/capacitive
**Decision**: Use a load cell + HX711 amplifier under the cup platform, with delta-based
weight detection (compare before/after pour), rather than IR break-beam, ultrasonic, or
capacitive liquid-level sensing.
**Why**: Tagayan uses whatever vessel is on hand — shot glass, plastic cup, improvised
container. A weight-based, delta-driven approach is agnostic to cup shape/material,
where IR/capacitive sensors would need per-cup-type calibration or a fixed vessel.
**Trade-off accepted**: needs a stable, flat mounting surface and tare/calibration step;
more sensitive to table bumps than a presence-only sensor, mitigated with debounce/
moving-average smoothing in firmware.

---

### Pump type: peristaltic, not impeller/submersible
**Decision**: Use a 12V peristaltic pump with food-grade silicone tubing.
**Why**: Liquid only contacts the tubing, never the pump's internal gears/motor — safer
for alcohol contact and easier to keep clean over repeated use. Impeller/submersible
pumps risk corrosion and contamination unless explicitly food-safe rated, and are a
worse default choice for this use case.

---

### Pour volume: configurable, not fixed
**Decision**: Expose Light (~15mL) / Standard (~30mL, default) / Heavy (~50mL) as a
setting, rather than hardcoding one pour amount.
**Why**: Real tagayan has no fixed pour size — it varies by drink type (beer vs. hard
liquor) and host preference. A fixed amount would misrepresent how the ritual actually
works. Pump duration is computed from calibrated mL/sec × selected volume, so this adds
no hardware complexity.

---

### Data model: per-event log, not summary-only
**Decision**: Store individual pour/pass events (`events` table) rather than only
aggregated per-person counts.
**Why**: Summaries can always be derived from event logs via query; the reverse is not
possible. Event-level data costs negligible extra storage and unlocks future stats
(pacing, streaks, busiest times) without a schema change later.

---

### Auth: anonymous device-based, no login/signup
**Decision**: Use Supabase Anonymous Auth (`signInAnonymously()`) as the sync identity,
with no email/password login flow.
**Why**: This is a casual party-use app — login friction is actively undesirable when
people are mid-session. Anonymous auth still gives a stable per-device identity for
sync/history, with a theoretical upgrade path to a real account later if cross-device
history is ever wanted (not needed now).

---

### Local storage: SQLite, not key-value storage
**Decision**: Use SQLite (`@capacitor-community/sqlite`) as the offline-first local
store, not a simple key-value store (`@capacitor/preferences`).
**Why**: SQLite's relational structure maps directly onto the Supabase/Postgres schema,
making sync a straightforward row copy rather than a data transform. It also supports
richer querying for stats features planned post-MVP.

---

### Sync model: offline-first, Supabase is optional
**Decision**: All writes go to local SQLite first and always succeed; Supabase sync
happens opportunistically when online and is never a blocking dependency for using the
app.
**Why**: Matches the core constraint that the app must be fully usable with zero
internet for an entire session — sync is a bonus, not a requirement.

---

### Hardware stays "dumb" — all turn logic lives in the app
**Decision**: ESP32 firmware only executes `POUR`/`TARE`/`STOP` and reports sensor
state. It has no concept of participant order or whose turn it is.
**Why**: Keeps firmware simple and keeps all business logic (turn order, pass handling,
stats) in one place — the app — where it's easier to iterate without touching embedded
code.

---

### Pass button: local-only, no BLE command
**Decision**: Tapping "Pass" advances the turn in app state immediately, with no
hardware/BLE interaction at all.
**Why**: Passing a turn has no physical action associated with it — sending a BLE round
trip for a no-op hardware action would just add latency and failure surface for no
benefit.

---

### Multi-station support deferred to v2
**Decision**: MVP supports exactly one pour station (one ESP32, one pump/sensor/LED
set). Multi-station support is documented as a roadmap item, not built now.
**Why**: Avoids scope creep on MVP; the single-station architecture needs to be proven
reliable before adding the complexity of either multi-channel firmware or multi-peripheral
BLE connection management in the app.

---

### UI theme: "Night Market Circuit"
**Decision**: Redesigned the app's visual identity around the sensory world of an
actual tagayan night — warm lamplight, charcoal-dark surroundings, a drink passed hand
to hand — rather than a generic dark-mode SaaS look. Palette: near-black warm ink
background (`#191310`), ember-orange accent (`#e98a2e`) for the active/primary action,
warm paper off-white for text, with bamboo-green and maroon as earned status colors
(success/sync, warning/over-limit) rather than default red/green. Typography: Space
Grotesk for display/headings (geometric, a little mechanical — nods to the ESP32/BLE
hardware side), Plus Jakarta Sans for body text. The one deliberate animated moment is
the `TurnRing` on the active session screen: participants arranged in a literal circle,
the current turn rendered as a glowing dot that hands off to the next position with a
500ms ease-out transition when the turn advances — the ring *is* the turn order, not
decorative chrome, echoing the physical act of passing a drink around a circle.
Everything else (buttons, lists, badges) gets calm, functional feedback only (tap-scale,
color change) — no scattered hover/reveal animation.
**Why**: The user asked for a "modern" UI with animation; a generic dark-mode palette
with a stock accent color would have looked like any other app and ignored the app's
actual subject matter (a Filipino drinking-circle ritual). Grounding the palette and the
one signature animation in that subject gives the redesign a point of view instead of
template chrome, per the house design process (plan reviewed against generic-AI-design
tells before building).

---

### Pour simulated ahead of real BLE hardware
**Decision**: `ActiveSessionScreen`'s Pour button is enabled now, backed by a fixed
~900ms simulated delay (`handlePour` → `setTimeout` → `onPourConfirmed()`) instead of
staying disabled until `app/ble-commands`/`app/ble-status-subscription` exist. The
status pill reads "Simulated — no hardware connected" rather than faking a connection.
**Why**: None of Sprint 1's hardware/firmware/BLE tasks have started (TASKS.md), and
leaving Pour disabled meant the turn-manager → event-logging → undo → session-log →
history path for POUR — otherwise complete — had never been exercised end to end.
Simulating the confirmation is a stopgap that calls the exact same `onPourConfirmed()`
real hardware will call later; nothing downstream needs to change when the real BLE
round-trip replaces the `setTimeout`. A prior attempt at this same problem (a separate
"simulate pour (dev)" button, noted in TASKS.md's Tagay King/Queen backlog entry) was
tried and discarded as not worth keeping as a standalone dev-only control — enabling
Pour itself, honestly labeled as simulated, was preferred over a second parallel button.

---

### Volume breakdown shown as colored dots, not spelled-out labels
**Decision**: Each participant's Light/Standard/Heavy pour composition is shown as
small colored-dot + count chips (e.g. a pale-gold dot + "1", an ember dot + "1", a
deep-orange dot + "1"), reusing the same `VOLUME_COLOR`s as the stacked bar and the
shared `VolumeLegend`, instead of spelling the volume names out in text.
**Why**: A first pass wrote it out in words ("1 Light · 1 Standard · 1 Heavy poured")
and it read poorly — a dense sentence that wrapped awkwardly in the 280px session-log
panel and just repeated in words what the colored bar directly below it already showed.
Color already carries this information once (the bar, the legend); adding word labels
on top was redundant rather than clarifying. The full label stays one hover/tap away
via each chip's `title`, same as the bar segments always had.

---

### Exit confirm: staged overlay, not a native dialog
**Decision**: Leaving an in-progress session (the "Back" button) goes through two
confirm stages — Back expands in place into "Keep going" (auto-focused, the safe
default) vs. a plain-link "⚠ End session" warning, then a second "End for good?" stage
before the session actually ends — all as an animated absolute-overlay expansion, never
a native `confirm()` dialog. A separate "view Session History without ending" path was
added alongside it.
**Why**: Back used to end the session immediately on a single tap — an easy accidental
tap mid-round with no way back into that session afterward. A native dialog would have
stopped the accident but broken the app's visual language (per the Night Market theme
decision above) and didn't address the second real need surfaced during testing:
checking Session History mid-round without wanting to end the round at all.

---

### Pausing a participant requires a reason; resuming doesn't
**Decision**: Pausing someone mid-session (drunk, went home, snuck off — "Run away" —
or an emergency) requires picking a reason chip before it takes effect. Resuming needs
no reason. Both are persisted as real `PAUSE`/`RESUME` rows in `events` (not just an
in-memory flag), carrying the reason in a new `events.note` column.
**Why**: In the realistic case, a paused participant never comes back — someone who
went home or snuck off isn't returning to tap "Resume" — so if the reason only lived in
memory it would vanish the moment the session ends, right when it's most useful (in
History, explaining a flat line in someone's stats). Requiring the reason at pause time,
not after, means it's captured even if this is the last anyone hears from them tonight.
Resuming is the "they're back, nothing more to say" case and doesn't need the same
friction.

---

### Participant roster clears after a session ends
**Decision**: Ending a session clears the "Who's joining" roster completely
(`clearParticipants()`), rather than keeping the names in place for a quick restart.
**Why**: `participants.id` is a SQLite primary key, and the in-memory roster reused the
same client-generated ids across session start/end cycles. Starting a second session
without retyping names reused those ids for a fresh `participants` INSERT and threw
`UNIQUE constraint failed: participants.id`, reproduced and confirmed live before
fixing. Keeping the names but minting fresh ids on restart was considered (lets people
re-run a session with the same group without retyping); clearing outright was chosen
instead as the simpler, safer default — picking the group back up each time also
matches how a tagayan actually restarts (people come and go between rounds).

---

### Web SQLite: autoSave enabled on the jeep-sqlite store
**Decision**: `jeepSqliteEl.autoSave = true` is set in `main.jsx` before the
`<jeep-sqlite>` element connects.
**Why**: `jeep-sqlite` (the IndexedDB-backed wasm sqlite engine used only on web —
native Android uses the real platform SQLite) defaults `autoSave` to `false`. With it
off, every write lands in the in-memory wasm database and nothing is ever flushed to
IndexedDB unless `saveToStore()` is called manually, which nothing in this app did. The
app appeared offline-first within a single page load (every write "succeeded"
instantly) but a browser refresh silently lost everything, since there was never
anything in IndexedDB to reload from. Caught via a user report, reproduced, and
root-caused by reading jeep-sqlite's own source rather than guessing. `autoSave: true`
was chosen over manually calling `saveToStore()` after every write site, since it's a
one-line fix at the single point the store is created, instead of touching every
write call in `sessionQueries.js`.

---

### Session history reads local SQLite before attempting a Supabase pull
**Decision**: `useSessionHistory` now reads and renders local SQLite rows first,
unconditionally, and only runs the Supabase background pull (`app/history-sync-fallback`)
afterward — a second render happens only if that pull actually finds sessions missing
locally.
**Why**: The previous order awaited the pull before the local read, so the loading
skeleton stayed up for however long that (optional, best-effort) network call took —
visibly "syncing" before showing data that was already sitting on the device the whole
time, reported directly by the user while offline. `navigator.onLine` being true doesn't
guarantee real connectivity, so the early-exit in `pullSessions()` isn't a complete fix
for this on its own; the fix belongs in the read order, not the network check.

---

### `people` scoped on Supabase directly by `device_id`, like `sessions` — not via `participants`
**Decision**: The Supabase `people` table has its own `device_id` column and RLS policy
(`device_id = auth.uid()`), the same shape as `sessions`, rather than being scoped
indirectly the way `participants`/`events` are (an `EXISTS` subquery joining back to
`sessions.device_id`).
**Why**: A roster person isn't owned by any one session the way a participant or event
row is — the whole point of the roster is that it outlives any single session. Scoping
it through a session would make no sense structurally (which session would own it?) and
would break the moment the roster is useful across sessions, which is its entire reason
for existing.

---

### Supabase catch-up applied directly as one migration, not re-run from scratch
**Decision**: When the paused `lasenggo-3000` Supabase project came back, the missing
`events.volume`/`events.note`, the widened `events.type` CHECK, the new `people` table,
and `participants.person_id` were applied as a single new migration
(`catch_up_pause_volume_and_people_roster`) against the live schema, rather than trying
to replay each local migration's history as separate Supabase migrations in order.
**Why**: Local SQLite's migration history (one `ALTER TABLE` per feature, applied over
several days) is a record of *how the local schema got here*, not a script that needs
replaying verbatim elsewhere — Supabase only needs to end up at the same *shape*. A
single catch-up migration gets there in one step and is easier to review as "what
changed" than several migrations whose original dates no longer mean anything once
applied together, in one sitting, after the fact.

---

### Participant name autocomplete: hand-built combobox, not native `<datalist>`
**Decision**: Reversed the earlier native-`<datalist>` decision below. The name input's
suggestions are now a small custom `<ul>`/`<button>` dropdown, styled with the app's own
`ink`/`smoke`/`ember` tokens, positioned under the input with CSS instead of opened by
the browser.
**Why**: User caught this live — the native version's dropdown arrow and its suggestion
popup are browser chrome and can't be restyled, and looked dated against the rest of
this screen the moment real data was in it. The zero-dependency argument for `<datalist>`
stands on its own, but a visibly out-of-place control fails the brief worse than a few
dozen lines of hand-built markup costs. Kept the behavior equivalent: filtered as you
type, arrow keys + Enter to pick, click/tap too, same most-recently-used ordering.
While rebuilding it, also found the `getPeople()` load could silently lose a startup
race against `initDatabase()` and leave the list empty for the rest of the session
(no retry) — fixed with a `dbReady` prop gating that effect, independent of which
dropdown implementation sits on top of it.

---

### People roster entries are resolved at Start session, not when added to the list
**Decision**: Adding a name to "Who's joining" no longer touches the `people` table at
all. Roster resolution (`findOrCreatePerson` for every participant) happens once, in
`App.jsx`'s `handleStartSession`, right before `createSession` — the one point the list
is actually committed to.
**Why**: User caught this live — typing a name into "Who's joining" wrote it to the
roster immediately, before Start session was ever clicked. Someone added by mistake and
then removed again, or a screen abandoned without starting, still left a roster entry
behind. The list on `ParticipantList` is provisional until Start session; the roster
write should be too. Mid-session "add someone who just joined" (`ActiveSessionScreen`)
was deliberately left resolving immediately, since that add has no separate "start"
step of its own — it already inserts a real `participants` row the moment it happens.

---

### People roster: a separate recurring table, not reuse of `participants`
**Decision**: New `people` table (id, name, created_at, last_used_at), linked from
`participants.person_id` (nullable). A `participants` row keeps its own independent
`name` copy regardless of `person_id`.
**Why**: `participants` rows are scoped to one session and already get fresh ids every
time (see the roster-clearing decision above) — reusing them as the cross-session
identity would mean either resurrecting old rows or losing the "every session starts
clean" property that fix just established. A separate table also means renaming or
deleting someone in the roster later never rewrites a past session's record, since
`participants.name` is its own copy — `person_id` is purely a forward-looking link for
autocomplete and the future Tagay King/Queen all-time leaderboard (TASKS.md backlog).

---

### People roster entries are created implicitly, never through an explicit "add"
**Decision**: The only way a `people` row is created is `findOrCreatePerson(name)`,
called when a name is typed and submitted at session start (or added mid-session). The
People management screen has rename and delete, but no "add" control.
**Why**: Matches the original backlog design note and keeps the roster from ever
drifting out of sync with who's actually been typed in — there's no second path that
could create a roster entry nobody's actually tagayed with. `findOrCreatePerson` matches
case-insensitively so "teng" and "Teng" resolve to the same person rather than forking
into two roster entries.

---

### Participant name autocomplete uses a native `<datalist>`, not a custom dropdown
**Decision**: The existing participant-name `<input>` gets a `list` attribute pointing
at a `<datalist>` populated from `getPeople()`, instead of a hand-built suggestion
dropdown component.
**Why**: Zero new dependencies, and the browser/WebView handles keyboard navigation,
touch, and screen-reader semantics for free — matches this app's general "simple, works
everywhere" bias (see e.g. local React state over a router in EXAMPLES.md). A custom
dropdown would need all of that re-implemented for a feature that's genuinely just
"suggest a previously-typed string."

---

### SQLite migrations check `PRAGMA table_info` before altering, instead of swallowing errors
**Decision**: All four `db.js` column migrations (`migrateAddSessionName`,
`migrateAddEventVolume`, `migrateAddEventNote`, `migrateAddParticipantPersonId`) now
call a shared `columnExists(table, column)` helper (`PRAGMA table_info`) and skip the
`ALTER TABLE` entirely when the column's already there, rather than firing it
unconditionally and catching/swallowing the resulting "duplicate column" error.
**Why**: Found while testing `app/people-roster`: the swallow-based version worked
correctly (the error was genuinely caught), but on web `jeep-sqlite`'s rejection for
that same error still surfaced in the browser console as an "Uncaught (in promise)"
error on every dev-mode remount (React StrictMode re-runs `initDatabase()` on mount),
which looked alarming and made real errors harder to spot in the noise. Checking first
means the `ALTER TABLE` only ever actually runs once per install, so there's nothing
left to throw or swallow. Purely a dev-console clarity fix — behavior was already
correct either way, including on native Android (which never hit this at all, since it
uses the platform's real SQLite, not jeep-sqlite).

---

### Existing roster names are backfilled as first-name-only, not split on space
**Decision**: `migrateAddPersonNameParts`'s backfill sets `first_name = name`,
`last_name` left `NULL`, for every `people` row that predates the first/last split —
never attempts to split an existing single `name` string on its first space.
**Why**: Decided with the user rather than guessed. A space-split looks appealing
("Juan Dela Cruz" → first "Juan", last "Dela Cruz") but silently mis-splits any
existing name that happens to contain a space without being a first+last pair (a
nickname with a space, a name typed with a middle name, etc.), and there's no way to
tell those apart automatically. Leaving last name blank is always correct — it's
exactly what "this person was only ever given one name" already meant before this
task — and the person can fill in a last name later from the People screen if they
want to, with full control over where the split actually falls.

---

### A person's name is always displayed as "First Last" combined, never shown split
**Decision**: Turn order, the session log, and history all keep reading and showing
a single `name` string (now a derived "First Last" cache on `people`, computed by
`findOrCreatePerson`/`renamePerson`) — first/last is only how a name is entered and
stored, never a second display mode anywhere else in the app.
**Why**: Decided with the user up front, before writing any code. Keeping `name` as
the one thing every other read site already expects meant this stayed a pure
data-entry improvement — zero changes needed to `ActiveSessionScreen`, `SessionLog`,
`HistoryList`/`HistoryDetail`, `useTurnManager`, or the Supabase schema/sync code,
all of which just keep seeing a (possibly longer) string exactly as before.

---

### Last name is optional everywhere; duplicate participants are blocked by case-insensitive name match
**Decision**: First name is the only required field when adding or renaming someone
(roster or a session's own list) — last name can be left blank and filled in later.
Adding someone already on the current session's "Who's joining"/participant list
(same full name, case-insensitive) is rejected rather than silently allowed.
**Why**: Both decided with the user. Optional last name matches how the roster
already worked before this task (a single name was always enough) and avoids forcing
two fields for a fast mid-session add. The duplicate check piggybacks on the existing
"`null` return means nothing was added" contract (`useParticipants.addParticipant`
already returned `null` for a blank name) so every caller's existing `if (id && ...)`
guard handles it with no further plumbing — "Who's joining" additionally surfaces an
inline message, since silently doing nothing there would look like a bug rather than
a rejection.

---

### Drink tracking is a manual log, not a depletion calculator
**Decision**: Logging what's being served (name + mL) and logging a change ("ran
out, same drink" or "ran out, different drink") are both deliberately manual taps —
the app never tries to infer remaining volume from the pour volumes already being
logged (Light/Standard/Heavy) against the stated mL.
**Why**: Decided with the user up front, as the first of three clarifying questions
before writing any code. Real pour volumes are rough presets, not a true flow
measurement (no hardware meters it yet), so a computed "X mL left" readout would be
confidently wrong more often than it'd be useful. Keeping it a log — what was served,
and when someone says it changed — stays honest about what the app actually knows,
and is also simply what was asked for ("I can log what is the next drink").

---

### Drink log syncs to Supabase and shows in session history, like the rest of a session's data
**Decision**: The `drinks` table follows the exact same sync shape as `participants`/
`events` — no `device_id` column on the table itself, RLS scoped by an `EXISTS`
subquery joining back to `sessions.device_id` — rather than staying local-only.
**Why**: Decided with the user (second of the three questions) specifically so a
past session's drink log survives a reinstall/new-device pull (`pull.js`) and shows
up on `HistoryDetail`, the same as everything else that happened that night. Local-
only would have been simpler to ship but would silently vanish on exactly the
devices/situations sync already exists to protect against.

---

### "Now serving" lives on ActiveSessionScreen itself, not inside "Manage participants"
**Decision**: The current drink + Switch control is a row near the top of
`ActiveSessionScreen`, directly below the session name — not a field inside the
`ParticipantManagerSheet` (which only ever dealt with people, not what's being
poured).
**Why**: Decided with the user (third of the three questions). What's being served
is read far more often than it's changed, and it's relevant to everyone at the table,
not just whoever happens to open the participants sheet — so it's placed where
everyone already looks (right under the session name), rather than one tap deeper
inside a sheet about a different kind of thing (people, not drinks).

---

### Drink tracking gained auto-depletion after all — the earlier "manual log only" decision was reversed
**Decision**: `ActiveSessionScreen`'s "Now serving" row now shows a live remaining
volume ("Red Horse · 970mL left"), computed as the current drink's declared
`volume_ml` minus every POUR event logged since that drink's `started_at` (mapped
through `POUR_VOLUMES`' Light/Standard/Heavy mL presets). This directly reverses
"Drink tracking is a manual log, not a depletion calculator" above.
**Why**: The user asked for it explicitly in a follow-up ("is there possible that
the drink content reduce when pour... based on how many ml has been pour"), after
confirming they understood the trade-off. The original decision's concern — that
Light/Standard/Heavy are rough presets, not a true flow measurement — still holds,
so this is framed to the user as an estimate, not a precise reading, but a rough
live number was judged more useful than none now that it's explicitly wanted.
Nothing is written to the `drinks` table to support this — `remainingMl` is derived
client-side on every render from the existing `events` list already being fetched
for the session log, so there's no new migration and no risk of the derived number
drifting from its inputs.

---

### Drink volume is a number + unit toggle (mL/L), not free text
**Decision**: The drink volume field pairs a numeric input with an mL/L segmented
toggle (`VolumeInput`, `volumeUnits.js`) rather than accepting arbitrary text like
"1 jug". The unit conversion happens at input time; only a plain integer mL value
is ever stored in `drinks.volume_ml` or compared against pour totals.
**Why**: The user's original ask was two-part — allow non-numeric input *and* make
pours deplete the volume. Those two are in tension: depletion math needs a real
number to subtract from, and "1 jug" has no defined mL. Asked directly, the user
picked "number required, with a unit toggle" over free text, which satisfies the
spirit of "let me type more than a bare mL count" (you can now type "1" + "L" for a
1L bottle) without breaking the arithmetic the same request also asked for.

---

### Remaining drink volume is allowed to go negative
**Decision**: Once a drink's remaining volume reaches 0, further pours keep
subtracting — the UI shows a deficit ("-45mL") rather than clamping the display
at 0.
**Why**: Asked directly; the user picked allowing negative over clamping. Light/
Standard/Heavy are approximations (see above), so the pour that empties the bottle
will almost never land exactly on 0 — clamping would quietly hide that the last
pour(s) technically exceeded what was declared, where showing the overshoot is
closer to what actually happened. At exactly/below 0 the row also switches to the
ember accent color as a passive visual cue; nothing interrupts the session or
forces a decision — the user separately chose "no popup" when asked, so it's the
existing "Switch" button that remains how a drink change gets logged.

---

### "Up next" is a passive queue, never an automatic switch
**Decision**: Staging a drink ahead of time ("Queue next drink") never changes
what's being served by itself. "Now serving" keeps showing the current drink,
with its remaining volume continuing to go negative past 0 if pours keep
happening, until the user taps "Switch now" on the "Up next" row.
**Why**: Asked directly, after confirming understanding of the request (a
two-part ask: a visual depletion bar, and a way to pre-stage the next drink
rather than typing it from scratch the moment the current one runs out). The
user picked "prompt to confirm, one tap" over switching automatically —
consistent with the earlier "no popup, passive" decision on auto-depletion
itself: nothing about serving a different drink should happen without someone
at the table actually doing it, even once the data says the bottle's empty.
"Up next" is visible (and cancelable) the whole time a drink is queued, not
just once the current one hits 0 — the only thing that changes at 0 is its
styling (quiet smoke tone → maroon, with wording that makes the empty state
explicit), which is purely a visual nudge toward the button that was already
there.

---

### Queued drinks live in the same `drinks` table, as a `status` column
**Decision**: A staged-but-not-yet-served drink is a row in the existing
`drinks` table with `status = 'queued'`, rather than a separate table or
purely client-side (React-state-only) concept. `getCurrentDrink` and
`getSessionDrinks` both filter to `status = 'serving'`; `getQueuedDrink` filters
to `'queued'`; `promoteQueuedDrink` just flips the status and resets
`started_at` (so depletion math starts counting the newly-current drink's
pours from the moment it actually took over, not from whenever it was staged).
**Why**: A session can run for hours and the app can be backgrounded or
reloaded mid-session (web especially); keeping the queue in memory only would
silently lose it on a refresh — the same reasoning that already applies to
everything else in this session. Reusing the one `drinks` table (new column,
not a new table) keeps "what was served" and "what's coming up" as two states
of the same kind of row, so the existing sync shape (syncJob.js/pull.js) only
needed the one extra column added, not a second sync path.

---

### Switch drink is a modal dialog, always mounted and class-toggled for animation
**Decision**: The "switch now" / "queue next" forms now live in a proper dialog
(backdrop + panel, bottom sheet on phone width via `items-end`, centered on
larger screens via `sm:items-center` — same responsive convention
`ParticipantManagerSheet` already uses) instead of an inline-expanding
section. The dialog element is always in the DOM; `switching` toggles CSS
classes (opacity/transform) rather than mounting/unmounting it, with `inert`
gating keyboard/screen-reader access while closed.
**Why**: User-requested, specifically asking for a dialog, mobile
responsiveness, and a smooth animation in and out. A conditionally-rendered
element (`{switching && (...)}`, the previous approach) can't animate its own
*exit* — React removes it from the DOM the instant the condition flips, before
any CSS transition has a chance to run. Keeping it always mounted and driving
visibility through classes is the same technique this screen's exit-confirm
bar already uses, so this isn't a new pattern for the codebase. `inert` (one
attribute on the outer container) was chosen over manually gating `tabIndex`
on every field — the dialog has two multi-field forms including `VolumeInput`
internals, and `inert` covers all of it, including focus, in one line.

---

### Switching back to a past drink resumes its exact remaining volume, via per-pour tagging
**Decision**: Every POUR event is now tagged with exactly which drink was
being served at that moment (`events.drink_id`), and remaining volume for
*any* drink — current or past — is computed as "declared volume minus every
pour tagged with its id". This replaced the earlier "every pour since this
drink row's `started_at`" approach.
**Why**: The earlier approach broke the moment a session needed to switch
back to an earlier drink (requested by the user: "there's still alcohol on
it, I want to switch back"). Pours made against a different drink while the
original was inactive would still land after its `started_at` and get
wrongly counted against it on return. Tagging each pour with the exact drink
it was poured against sidesteps the problem entirely, however many times a
session switches back and forth, and keeps the computation (not re-fetched
per drink, derived client-side from the same `events` list already in state)
consistent for the live "Now serving" number and every row in the new
"switch back to a past drink" picker.

---

### Switching back to a past drink: pick from a list, auto-requeue only if the slot is free
**Decision**: "Switch back" works for any drink this session has actually
served, picked from a list — not just the single most-recently-switched-away-
from one. Switching away from the current drink auto-requeues it as the new
"Up next" only when that slot isn't already occupied by something else;
otherwise it just becomes ordinary history (`status = 'served'`), still fully
reachable from the same picker with its correct remaining volume.
**Why**: Both decided with the user up front. The list (not just "the last
one") matches how an actual tagayan session plays out — more than two drinks
in rotation is normal. The "only if free" rule was added after live testing
surfaced the alternative (always clearing the existing queued slot) silently
deleting a drink the user had deliberately staged, the moment a third drink
entered the rotation — there's still only one "Up next" slot by design, and
a slot someone already claimed should never be bumped by an unrelated
switch. "Served" isn't a dead end either way: the picker surfaces every
`'serving'`/`'served'` row regardless, so a drink that lost the "Up next"
spotlight is exactly as reachable as one that never had it.

---

### The "switch back" picker includes the currently-queued ("Up next") drink too
**Decision**: The picker inside the Switch dialog now merges in whatever
drink is currently staged as "Up next" (`queuedDrink`), not just the plain
history rows `getSessionDrinkHistory` returns (`status IN ('serving',
'served')` — a `'queued'` row was never included there to begin with).
**Why**: User-reported: typing into "Different drink" while the current
drink still had volume switched correctly and auto-staged the old drink as
"Up next" — but that banner lives on the main screen, and the Switch dialog
is a full-screen overlay that sits in front of it. Once the dialog was open
there was no way back to that drink without closing the dialog first, even
though the picker looked like it should be the complete answer to "switch
back to anything." Folding the queued drink into the same list (tagged
"· Up next" inline) makes the picker self-contained.

---

### Drink volume is required once a drink name is given
**Decision**: Typing a drink name without a volume no longer lets you
proceed — Start Session, the mid-session "different drink" switch, and
"queue next drink" are all disabled with an inline message until a volume
is filled in too (or the name is cleared). The Drink section as a whole is
still fully optional — this only applies once a name has been typed.
**Why**: User-reported: a name with no volume used to be accepted silently,
and the session would start with nothing for the depletion bar/remaining-mL
readout to measure against — read as a bug rather than the field being
intentionally optional. Requiring volume the moment a name exists keeps the
"skip drink tracking entirely" path available while closing the
half-filled-in gap.

---

### "Up next" is a real multi-item queue, not a single contested slot
**Decision**: `drinks.status = 'queued'` is no longer a single slot — any
number of rows can hold that status at once. `getQueuedDrinks` returns all
of them, oldest-staged first (`ORDER BY started_at ASC`); the UI renders
each as its own row with independent Switch now / Edit / Delete controls,
and only the oldest one gets the urgent "switch to?" styling once the
current drink is empty. `updateQueuedDrink(drinkId, name, volumeMl)` lets a
queued row's name/volume be corrected in place without cancelling and
re-adding it. **This supersedes the earlier "auto-requeue only if the slot
is free, else mark served" decision** — that logic existed only because a
second queued drink had nowhere to go; with no slot to contend over,
`demoteCurrentDrink` now unconditionally re-queues a drink that still has
volume (or marks it `'served'` if it doesn't), full stop.
**Why**: User-reported: with a drink already staged as "Up next," switching
away from the current drink a second time didn't add to the queue — it
silently replaced whatever was already staged, with no indication anything
was lost. Given three options (keep one slot but warn before replacing;
turn it into a real multi-item queue; leave as-is), the user chose the
multi-item queue, plus asked that each item support edit and delete
individually rather than only cancel.

---

### Queued-drink rows use icon buttons and a two-tap delete confirm
**Decision**: The "Up next" list was rebuilt from centered flex-wrapped
pills into left-aligned, full-width stacked cards. Switch now/Edit/Delete
are icon buttons (new `EditIcon`/`TrashIcon`/`SwitchIcon`, matching the
existing `BackIcon`/`HistoryIcon` stroke convention) instead of plain text
buttons. Deleting a row is now a two-tap confirm — tapping the trash icon
arms that row's "Delete?" state (Yes/No) in place; a second tap is needed
to actually delete. Switch now, Edit, or arming a different row's confirm
all disarm it, so at most one row is ever armed.
**Why**: User-reported: the delete button had no confirmation at all (a
single mistaken tap permanently removed a queued drink, with no undo —
unlike Pour/Pass, which do have one), and the row styling itself hadn't
held up once more than one item was queued — a centered pill of wrapped
text and text-buttons read fine for a single row but became cramped and
hard to scan once several were stacked. The confirm stays inline rather
than a popup/dialog, consistent with the rest of this list.

---

### "Now serving" can be edited in place too, not just queued drinks
**Decision**: The edit affordance added for "Up next" rows now also
applies to the current drink — a small Edit icon next to "Now serving"
opens the same inline name+volume form in place. The backing query,
renamed from `updateQueuedDrink` to `updateDrink`, is scoped to
`status IN ('queued', 'serving')` rather than `'queued'` only; a drink
that's already been demoted to `'served'` stays fixed, since it's past
history and may already have real pours tagged against its id.
**Why**: User-reported: there was no way to fix a misspelled drink name or
a mistyped mL on the drink actually being served — only queued ("Up next")
drinks could be corrected. Switching away and back just to fix a typo
would also wrongly re-queue/re-serve the drink and disturb its
started_at, so this needed to be a true in-place edit, not a workaround
through Switch.

---

### Only the first queued row says "Up next" — later rows show their position
**Decision**: Every row in the queue list used to say "Up next" regardless
of position. Only the oldest-staged row (`nextQueuedDrink`) says "Up next"
now; rows behind it show `#2 in queue`, `#3 in queue`, and so on by index.
**Why**: User-reported having two drinks waiting and both rows labeled
"Up next" — which is genuinely ambiguous about which one actually comes
next. The queue is already ordered oldest-first; the label just wasn't
reflecting that order.

---

### A long queue collapses behind a "+N more queued" toggle
**Decision**: Only the single most-urgent queued row (the oldest-staged
one) renders by default now. Once a second drink is queued, a "+N more
queued" pill appears below it; tapping it expands the rest in place
("Hide" to collapse again). Given three options (cap the list at a fixed
height and let it scroll; collapse to a count and expand on tap; move the
whole queue into its own separate view), the user picked collapse-and-
expand.
**Why**: Raised proactively — with the queue no longer limited to one
slot (see the multi-item-queue entry above), stacking every row inline
without bound would grow the "Now serving" card unpredictably and push
the rest of the screen down as more drinks get queued. The oldest row is
the only one that's an immediate concern anyway; everything behind it is
"later," so it doesn't need to occupy space until someone actually asks
to see it.

---

### The expanded queue floats as a dropdown instead of pushing layout
**Decision**: The "+N more queued" expanded list is now absolutely
positioned (`absolute top-full z-20`, anchored to a `relative` wrapper
around the toggle) instead of sitting inline in document flow, floating
over whatever's below it rather than displacing it. Capped at `max-h-64`
with scroll as a safety net for a long enough queue.
**Why**: User-reported: opening the expanded queue pushed TurnRing (the
turn-order circle, rendered further down the same column) down the page
every time it opened. Floating the dropdown over the rest of the screen
instead of inserting it into the flow keeps everything else's position
fixed regardless of how many rows are expanded.

---

### The "Switch" button is now labeled "Switch / Queue"
**Decision**: The trigger button next to "Now serving" and the dialog it
opens were both just "Switch", even though the dialog has always had two
separate sections — switch immediately, or queue a drink for later. Both
now read "Switch / Queue".
**Why**: User-reported the "Switch" label was misleading given the
dialog's queuing feature. Asked which exact wording to use; the user
said to just pick one rather than choose between options, so this went
with the most literal, unambiguous label rather than a shorter one that
would still require the dialog's subtext to disambiguate.

---

### The live session log shows which drink each participant poured, and every drink the session has touched
**Decision**: Two additions to the live "Session log" panel:
1. Each participant's stat row now lists the actual drink name(s) they've
   poured from this session (deduped, first-poured order), not just their
   Light/Standard/Heavy pour-size breakdown. Backed by widening
   `getSessionEvents` to `LEFT JOIN drinks` and selecting `d.name AS
   drink_name`, then collecting a per-participant `Set` of names from POUR
   events in `SessionLog.jsx`'s `buildStats`.
2. A new "Drinks" section lists every drink the session has touched —
   "Now serving", everything still queued, and anything already switched
   away from — not just the subset `getSessionDrinkHistory` exposes for
   the switch-back picker. Built client-side by merging `drinkHistory`
   and `queuedDrinks` (already both in state) rather than a new query.
   Each drink's volume is shown via a new `formatVolumeMl` helper, which
   switches to L at >= 1000mL (`1500` -> `"1.5L"`) instead of always
   showing a raw mL number.
**Why**: User-reported the app never logged which alcohol each person was
actually drinking, and the session log didn't account for alcohol that
was current or queued — only completed history. Both gaps come from the
same root cause: the data already existed (drink_id on every pour; status
on every drink row) but was never surfaced in the live session's own log.

---

### A participant's mL is split per drink, not lumped into one combined number
**Decision**: `SessionLog.jsx`'s `buildStats` now keeps a running mL total
*per drink name* per participant (`drinkTotalsByName`), not a single
combined total. `ParticipantStatBar` renders each drink the person poured
with its own `~mL`/`L` line; the single combined `~totalMl` line (now via
`formatVolumeMl`) stays below it as the grand total across every drink.
**Why**: User-reported: pouring everyone the current drink, then
switching to a different one, showed each participant's updated mL as one
combined number — no way to tell how much came from the drink before the
switch vs. the one after. This was the previous entry's `drinkNames` list
(names only, no amounts) not actually solving the problem it was meant
to — separating *how much*, not just listing *which*.

---

### Each participant's per-drink line also shows its own pour-size counts
**Decision**: Each drink in a participant's breakdown now shows its own
Light/Standard/Heavy dot-counts (same colored-dot convention the overall
per-participant bar already uses), not just its mL total. A drink's
`drinkTotalsByName` bucket keeps a `byVolume` count alongside its `ml`
running total, built the exact same way the participant-wide `byVolume`
already was.
**Why**: Asked directly whether this was worth adding, now that mL is
already split per drink — agreed it is: pour-size composition is
genuinely different information from the amount itself (a mL total alone
doesn't say whether it came from a few Heavy pours or many Light ones),
and once a participant has had more than one drink, that composition is
exactly the kind of thing that stops being obvious from the aggregate
bar above. Folded into the same per-drink line rather than a second
stacked bar, to avoid piling on more UI chrome per drink.

---

### A participant's drink list collapses behind a "+N more drinks" toggle too
**Decision**: Only the most recently poured drink shows by default in a
participant's breakdown now. Once they've had a second drink, a
"+N more drinks" toggle appears below it (local to that participant's
row); tapping it expands the rest, most-recent-of-the-earlier-ones first
("Hide" to collapse again). Given the same three options as the earlier
queue-list decision (cap-and-scroll; collapse-to-count; show only the
top 2 by volume), the user again picked collapse-to-count, for
consistency with the queue.
**Why**: Raised proactively — with mL and pour-size now broken out per
drink (two prior entries), a participant who'd had several different
drinks would stack an increasingly tall block in an already-compact,
height-capped panel. The same fix already proven for the queue list
applied directly here.

---

### Fix: the default-shown drink was the first one poured, not the current one
**Decision**: `ParticipantStatBar`'s default-shown drink (before the
previous entry's "+N more drinks" toggle is expanded) is now
`stat.drinkTotals[0]`, not `stat.drinkTotals[stat.drinkTotals.length - 1]`.
**Why**: User-reported the collapsed view showed the drink they'd poured
*first* all session, not whichever they were *currently* on. Root cause:
`getSessionEvents` orders events newest-first (`ORDER BY timestamp DESC`),
so when `buildStats` iterates that list, a drink's name is inserted into
`drinkTotalsByName` on its *most recent* pour, not its earliest — a plain
object's insertion order therefore comes out newest-drink-first, not
first-poured as the comments (now corrected) had assumed. Taking the
*last* array entry as "the current drink" was picking the oldest one
instead.

---

### The Activity log now names which drink was poured
**Decision**: `ActivityFeed.jsx`'s POUR line gained `· <drink name>` when
`event.drink_name` is present, appended after the pour-size label (e.g.
"Juan poured (Standard) · Tanduay"). Omitted entirely for a session that
never used drink tracking (`drink_name` is null), so no row grows a
stray " · " for nothing.
**Why**: User-reported the Activity log "didn't even log it properly" —
every other part of the session log (per-participant breakdown, the
Drinks section) now names drinks and splits mL/pour-counts per drink, but
the raw chronological Activity feed, shared between the live session and
HistoryDetail's past-session view, still only ever said "poured
(Standard)" with no way to tell which drink that pour came from.

---

### Fix: a re-queued drink silently vanished from Session History
**Decision**: `getSessionDrinks` no longer filters by status at all —
every drink row the session ever created is included in a past session's
"Drinks" log now, regardless of what status it ended in. `HistoryDetail`
labels each one by what actually happened to it (`drinkStatusLabel`):
"Serving when ended", "Served", "Served, then re-queued" (status
`'queued'` with real POUR events against it), or "Queued, never served"
(status `'queued'`, no pours at all) — and shows each drink's remaining
volume (`remainingForDrink`, the same declared-minus-poured formula the
live session uses, computed from the already-loaded past-session
`events`) alongside its declared volume, both through `formatVolumeMl`.
**Why**: User-reported Session History "didn't record all the drinks
from current to queue... it just records the last alcohol drink." Root
cause: `getSessionDrinks` filtered to `status IN ('serving', 'served')`
on the old assumption that `'queued'` only ever meant "staged, never
touched." That assumption broke once `demoteCurrentDrink` started
re-queuing (not serving) a drink switched away from while it still had
volume left (app/drink-switchback) — a drink genuinely poured from
earlier in the session could land back in `'queued'` and then silently
disappear from history the moment the session ended before it was
promoted again.

---

### History's Drinks section becomes a small-multiples bar chart
**Decision**: Each drink with a declared volume now gets a thin
horizontal bar — poured mL filled left-to-right against the declared
volume as the baseline — stacked oldest-first (small multiples, one bar
per drink, read top-to-bottom as reading forward through the session).
Reuses the live session's own depletion-bar convention exactly (same
track/fill markup, same ember = "has volume left" / maroon = "empty"
coloring from ActiveSessionScreen) rather than inventing a new visual
language for history. Every figure (poured, declared, remaining) stays
as a direct text label alongside the bar — color is never the only way
to read the amount. A drink with no declared volume has no baseline to
bar against, so it falls back to the plain status line with no
poured/declared figure.
**Why**: User-reported the Drinks section's UI/UX "doesn't look good"
and asked for a graph, since it's a history view. A small-multiples bar
chart is the right form here — magnitude comparison (poured vs.
declared) across a set of categorical rows (drinks), not a trend over
time or a single headline number — and reusing the live view's existing
color/track convention keeps history visually consistent with the live
session instead of introducing a second, unrelated chart language.

---

### Fix: History's drink bar should drain (remaining), not fill (poured)
**Decision**: The just-added History bar now fills with *remaining*
volume and drains as more gets poured — `widthPct = remaining / declared`
— instead of filling up with the poured amount. Matches the live
session's own "Now serving" depletion bar exactly (`barWidthPct =
remainingMl / declared` in ActiveSessionScreen).
**Why**: Asked directly which direction was more user-friendly. The
first version filled up with poured amount, which was consistent with
nothing — not the live bar, which already drains. A draining gauge is
also the more familiar convention on its own (fuel/battery indicators
drain, not fill, as they're used up), and "how much is left" is closer
to the question a drink log actually answers than "how much is done".
Matching the live bar's direction means a drink's bar behaves the same
way whether the session is happening now or being looked back on,
instead of requiring a different mental model for each.

---

### The Back button on Session History pages is sticky now
**Decision**: `HistoryList` and `HistoryDetail` both pull their Back
button into its own `sticky top-0 z-10` bar, bled to the page's real
edges (`-mx-6 -mt-6`, re-padded) and painted with a solid `bg-ink` so
scrolling content doesn't show through underneath it. The big title
stays in normal flow below it (not also sticky) — a compact pinned
button reads as the familiar mobile pattern, and keeping the title
scrolling avoids permanently reserving extra vertical space just to
keep one button in view.
**Why**: User-reported that on a long session list (or a session with a
lot of Drinks/Activity-log entries), scrolling made the Back button
disappear along with the rest of the header — both screens are a single
unbounded scrolling page with no separate scroll container, so there
was previously nothing keeping the button in view.

---

### Optional, mid-session-settable turn timer with a buzzer
**Decision**: A new per-turn countdown, off by default, toggled on and
set via a small control right next to TurnRing (not at Start Session —
the user explicitly wanted it settable mid-session too). Presets only
(10s/15s/30s/60s/Off), no free-form input. On expiry: a synthesized
two-beep buzzer (Web Audio, no audio asset) plus the control itself
flashing maroon with "Time's up!" — nothing is forced; Pass and Pour
both keep working exactly as before and after expiry. The preset picker
is an absolute-positioned dropdown (same floating-over-rather-than-
pushing-layout pattern as the queue's own "+N more queued" dropdown),
so opening it never nudges TurnRing. Given explicit options via
AskUserQuestion, the user chose buzzer+flash-only over auto-Pass,
presets over free input, and a new control near the turn ring over
folding it into the participant manager sheet.
**Why**: User-asked-for, framed as wanting the session to "look more
intense," not as a real house rule to enforce — so this follows the
same soft-signal, never-force philosophy already established for the
pass-limit house rule (see useTurnManager's doc comment) rather than
auto-advancing the turn.

## mL/L display: manual toggle instead of per-value auto-switching
`formatVolumeMl` used to decide mL vs L for itself per value (>= 1000mL became L),
so a list of several drinks could show some rows in mL and others in L with no way
for the person to pick one and have it stick. User feedback: "I think it would be
best if you turn the mL and L into a toggle for better UX."

Replaced the auto-switching with an explicit `unit` param (`formatVolumeMl(ml, unit)`)
and a small shared toggle (`VolumeUnitToggle`, mL/L pill) backed by a tiny
localStorage-persisted store (`useVolumeDisplayUnit` in volumeUnits.js) — not React
context, since the point is one switch every volume display reads from, without
threading a prop through App.jsx and multiple layers of children. Flipping it in one
place (live SessionLog's Drinks header, or History's Drinks header) updates every
other mounted screen immediately, and the choice survives a reload via localStorage.

"L" mode always converts, even for small values (e.g. 150mL -> "0.15L"), rather than
only kicking in above 1000 — the point of switching to L view is consistency across
the whole list, not just hiding big numbers. Wired into the three places a drink's
volume appears: live SessionLog's Drinks list, ParticipantStatBar's per-drink/total
mL, and HistoryDetail's Drinks bar chart labels.

Verified: rolldound syntax check on all 5 touched files, full `vite build` (8.06s),
grepped the built bundle for the new localStorage key, "Volume unit" aria-label, and
aria-pressed attribute to confirm it shipped, and hand-traced `formatVolumeMl` in an
isolated node script for both units across small/large/round values.

## mL/L toggle: fix narrow-viewport overflow
User report: "when I'm using the phone view the toggle overflow it's not
responsive." The "Drinks" heading + VolumeUnitToggle row used `flex
items-center justify-between`, no wrap — on a narrow phone width, with
this row nested inside several layers of horizontal padding (the screen's
own padding plus the Drinks section's own p-4), the combined width of the
heading text and the non-shrinking toggle pill could exceed the available
width, and a non-wrapping flex row doesn't shrink text below its content
size by default, so it overflowed the container instead of adapting.

Fix: added `flex-wrap` (plus `gap-x-3 gap-y-1.5` replacing the single
`gap-3`) to both header rows (SessionLog's live Drinks header,
HistoryDetail's past-session Drinks header) — on a width too narrow for
both items on one line, the toggle now drops to its own line below the
heading instead of forcing horizontal overflow/scroll.

Verified: rolldown syntax check on both touched files, full `vite build`,
grepped the built CSS for the `flex-wrap` utility to confirm it shipped.
Actual phone-width rendering still not independently confirmed (no live
browser this session) — worth a quick look on the user's device.

## Fix: Start Session "Drink" row overflow on phone width (mL/L input toggle)
User's screenshot showed this is a different control than the display
toggle fixed above — it's the pre-existing mL/L *input*-unit picker
(`VolumeInput`) next to the drink name field on Start Session, clipped
off the right edge of the phone screen. Root cause: the row (`drink name`
flex-1 input + `VolumeInput`'s fixed-width number field and toggle) used
a plain `flex gap-2` with no wrap — on a narrow phone the combined
minimum width exceeded the available space and nothing in the row was
allowed to drop to a second line, so it just overflowed past the screen
edge.

Fix: `flex gap-2` -> `flex flex-wrap gap-2`, name input given
`min-w-[140px]` (a sane floor instead of shrinking arbitrarily small),
`VolumeInput` given `shrink-0` so it moves to its own line as one unit
rather than squeezing. Applied to the same spot on Start Session
(ParticipantList.jsx) and, as a consistency/safety pass, the two
matching but not-yet-reported rows in ActiveSessionScreen's switch/queue
dialogs (switch-drink-volume + Log button, queue-drink-volume + Queue
button) — same `flex gap-2`-without-wrap pattern, same risk on a narrow
phone, fixed the same way before they got reported too.

Verified: rolldown syntax check on both touched files, full `vite build`.
Still unconfirmed on an actual phone — the original report came from the
user's own screenshot, so a follow-up screenshot/confirmation is the real
verification here.

## Remove the mL/L toggle button from the live session; keep History's
User: "I want you to remove the toggle at the mid-session that's not what
I mean." The mL/L display toggle added earlier had been placed in two
spots — live SessionLog's Drinks header and HistoryDetail's Drinks
header — but the user only wanted one. Removed the visible
`VolumeUnitToggle` button from the live/mid-session Drinks panel;
HistoryDetail keeps its toggle.

The live panel still renders every volume in whatever unit the toggle in
History is currently set to (it still reads `useVolumeDisplayUnit`'s
shared value) — it just no longer offers its own control to change it
mid-session. Switching it from History affects both screens, same as
before.

Verified: rolldown syntax check, full `vite build`.

## Fix: turn timer buzzed immediately on first enable
User report: "I noticed the bug on the timer when I turn it on for the
first time of the session it ring right away."

Root cause: `useTurnTimer`'s ticking effect decided "expired" with
`secondsLeft <= 0`. The moment the timer is turned on (durationSeconds:
null -> e.g. 30), React re-renders with the new durationSeconds but
`secondsLeft` still holds its previous value — `null`, since the timer
had been off. The ticking effect reruns on that same render (durationSeconds
is one of its deps) *before* the separate reset effect has applied the
real starting value, so it evaluated `null <= 0`, which JS coerces to
`0 <= 0` — true — and called `setExpired(true)` (-> buzzer) before any
actual counting happened. Same race applies turning the timer off and
back on mid-session, not just the very first time, since turning it off
resets secondsLeft back to null too.

Fix: added `|| secondsLeft == null` to the ticking effect's early-return
guard, so a not-yet-initialized countdown is treated as "not ready" rather
than "expired". The reset effect's own update then makes the ticking
effect rerun with the real value.

Verified: hand-traced the exact transition (secondsLeft=null,
durationSeconds=30) in an isolated node script confirming the old code
produced EXPIRE and the fixed code produces "skip (not ready)", plus the
normal cases (mid-countdown, real zero, fully off) still behave
correctly. rolldown syntax check + full vite build.

## Mid-session "Start tracking a drink" (gap found via user testing)
User: "when I'm at the Mid-session and I forgot to enter a drink at the
start what should I do?" Until now there was genuinely no way — every
drink-tracking UI ("Now serving", Switch/Queue, the Drinks log) is gated
behind `currentDrink`, which only ever gets set from Start Session's
optional Drink field. Skipping it meant no way back in short of ending
the session and starting a new one (losing turn history).

Added a small form, shown only when `currentDrink` is still null (i.e.
exactly the gap case), in the same spot the "Now serving" panel would
otherwise occupy: a drink name + VolumeInput (mL/L), same "name without
a volume stays blank" validation every other optional drink field in
this app already uses. Submits through a new `handleStartDrinkSubmit`,
which calls the existing `addDrink(sessionId, name, volumeMl)` — already
defaults to status `'serving'` and already no-ops its
`demoteCurrentDrink` call when there's nothing to demote — so the new
drink becomes "Now serving" immediately, and the rest of the app (Drinks
log, per-participant breakdown, History) picks it up with zero other
changes, since none of that code cared *how* a drink became current,
only that it did.

Verified: rolldown syntax check, full `vite build`, grepped the built
bundle for the new form's copy to confirm it shipped. Read
`demoteCurrentDrink`'s source directly to confirm its `if (!current)
return` guard makes it a safe no-op in this exact case (no current drink
yet) rather than assuming.

## Fix: pours made before "Start tracking a drink" didn't count against it
User: "...when I enter the drink the bar is still complete eventhough I
already pour the drink and the portion of the alcohol has already
reduced." A real follow-on from the gap fixed above: a POUR logged while
`currentDrink` was still null gets `drink_id = NULL` (see `logEvent`'s
`drinkId` param / `currentDrinkIdRef.current` in ActiveSessionScreen).
`remainingForDrink`'s formula is "declared volume minus every POUR
tagged with this drink's id", so once a drink was declared after the
fact, those earlier untagged pours had nothing to attach to and the new
drink's bar/remaining showed completely full, ignoring real pours that
had already happened.

Those pre-existing untagged pours *were* this drink — there was only one
thing being poured all along, the person just hadn't told the app its
name/volume yet — so this is backfilling when something was logged, not
rewriting what happened. Added `backfillUntaggedPours(sessionId, drinkId)`
in sessionQueries.js: `UPDATE events SET drink_id = ? WHERE session_id = ?
AND type = 'POUR' AND drink_id IS NULL`. Wired into
`handleStartDrinkSubmit` right after `addDrink` resolves (using the new
drink's id), followed by `refreshEvents()` so the client-side `events`
state ActiveSessionScreen's own `remainingForDrink` reads picks up the
retagged rows immediately.

Scoped to `session_id` + still-NULL `drink_id` only, so it can never
touch a pour that was already correctly tagged against an earlier
(switched-away-from) drink — only genuinely orphaned pours from before
any drink existed get claimed.

Verified: rolldound syntax check on both touched files, full `vite
build`, grepped the built bundle for the backfill SQL fragment to
confirm it shipped, and hand-traced the exact before/after scenario in
an isolated node script (remaining stuck at full pre-backfill, correctly
dropped to declared-minus-poured after).

## Revert: mL/L manual toggle removed entirely
User: "let's move to the Session History I noticed the toggle is still
there I want you to remove it." After already pulling it from the live
session on the prior request, this removes the last remaining instance
(History's Drinks header) too — meaning no control is left anywhere, so
rather than leave a dead `useVolumeDisplayUnit`/localStorage store with
nothing to drive it, this reverts the feature entirely back to its
original pre-toggle behavior.

`formatVolumeMl` is back to its original single-argument, auto-switching
form (>= 1000mL displays as L, otherwise mL — no `unit` param). Deleted
`VolumeUnitToggle.jsx` and the `useVolumeDisplayUnit`/localStorage store
from `volumeUnits.js` entirely (dead code with its toggle button gone
from every screen). Reverted the three call sites back to their
pre-toggle form: HistoryDetail.jsx, SessionLog.jsx, ParticipantStatBar.jsx.

Verified: rolldown syntax check on all 4 touched/removed files, full
`vite build`, grepped the built bundle to confirm no trace of the old
toggle (localStorage key, "Volume unit" aria-label) remains.

## History list: icon tile for unnamed sessions
User: "...I noticed a lot session history is listed and all I saw is a
text of the date and the time and the participants but ... it doesn't
look good on UI & UX I think it would be cleaner to use an icon when the
session has no name right?"

Most sessions skip naming, so a long history list was mostly rows of
near-identical date/time text with nothing to anchor the eye per row — a
named session doesn't have this problem since the name itself is what
catches the eye scanning down the list. Added a small round icon tile
(reusing `HistoryIcon`, already this app's "a past session" glyph — the
empty state and the History nav button both use it) as a leading element,
shown only on rows where `s.name` is falsy, so named sessions are
untouched.

Verified: rolldown syntax check, full `vite build`.

## History list: separate date/time icons, smaller "modern" row
User follow-up: "I think it would be best if there is a date and a time
icon on it and reduce the font size make it modern."

Split the single combined `formatDate` into `formatDateOnly`/
`formatTimeOnly` and built a small `SessionDateTime` component: a
CalendarIcon next to the date, HistoryIcon's existing clock face next to
the time (reused rather than drawing a near-duplicate clock glyph), both
at `text-[11px]` — smaller than the old plain date string. Always
rendered now (previously only shown as a subline for named sessions,
folded into the primary text for unnamed ones) — a name, when present,
stays the bold primary line; the date/time row sits underneath it either
way, so both named and unnamed rows now share the same compact
icon+text treatment instead of one looking "modern" and the other
looking like plain text.

Added `CalendarIcon.jsx` (new), reused the existing `HistoryIcon` for
the time half rather than adding a redundant clock glyph.

Verified: rolldown syntax check on both touched/new files, full `vite
build`, grepped the built CSS for the new `11px` font-size utility to
confirm it shipped.

## History list: drop the per-row icon badge, icon instead of "participants"
User follow-up: "remove the big time icon at the right side and put a
icon to the participants remove the 'participants' and put an icon on
it." (Confirmed via a quick clarifying question which icon was meant:
the round clock-icon badge added for unnamed sessions, not the small
clock inside the date/time line.)

Two changes to the History row:
- Removed the `h-9 w-9` round HistoryIcon badge that showed on unnamed
  sessions — the per-row date/time line (added last change) already
  carries its own small clock icon, so the bigger badge was now
  redundant on top of it.
- Replaced the "`N` participant(s)" text label with a `PeopleIcon` +
  bare count (reused the existing PeopleIcon already used elsewhere in
  this app, e.g. the People nav button) — matches the icon-led style the
  date/time row already established, and takes less width.

Verified: rolldown syntax check, full `vite build`.

## History list: bump the date/time text back up
User: "Now I think the font is too small." The prior pass went to
`text-[11px]`, which read as too small in practice. Bumped the
date/time line to `text-xs` (12px, Tailwind's smallest named step
rather than another arbitrary value) and its two icons from `h-3 w-3` to
`h-3.5 w-3.5` to match — keeps the icon-to-text proportion from the
previous pass instead of getting text-heavy relative to tiny icons.

Verified: rolldown syntax check, full `vite build`.

## History list: date/time text bumped to text-sm; confirmed name already shows
User: "make it big and also if the session has a name put a name on it."
Bumped the date/time line again, this time to `text-sm` (14px, same size
already used for the participant count and the Back button) with its
icons up to `h-4 w-4` (the app's default icon size everywhere else) —
now matches the rest of this row's secondary text/icons instead of
introducing its own smaller scale.

The "put a name on it" half was already true going into this change — a
named session's `s.name` has always been queried (`getSessionHistory`'s
SQL selects `s.name`) and rendered as the bold primary line above the
date/time subline since the first icon-tile pass. No code change needed
there; left as-is after re-checking both the query and the render path.

Verified: rolldound syntax check, full `vite build`. Confirmed via code
read (not assumption) that getSessionHistory already selects `s.name`
and HistoryList already conditionally renders it.

## History list: icon next to the session name
User: "at the name of the session put an icon also do you think it would
look modern?" Added a new `TagIcon` (price-tag/label glyph) in front of
a named session's title — matches the icon-led pattern the rest of the
row already has (CalendarIcon+date, HistoryIcon+time, PeopleIcon+count),
so every piece of info in a History row now has its own icon instead of
the name being the one plain-text holdout.

Verified: rolldown syntax check on both touched/new files, full `vite
build`.

## History list: swap the name icon (price-tag -> bookmark)
User: "change the icon of the name session it doesn't feel right." The
price-tag-shaped `TagIcon` likely read as commerce-coded for what's just
"this session has a title". Replaced with a `BookmarkIcon` (ribbon
shape) — the more familiar "this one's been named/marked" symbol —
deleted `TagIcon.jsx` since it had no other callers.

Verified: rolldown syntax check on all touched/new/removed files, full
`vite build`, grepped for stray `TagIcon` references (only the removal
note in BookmarkIcon's own comment, no code references left).

## History list: swap the name icon again (bookmark -> sparkle)
User: "change the icon again" (no specific reason given this time).
Swapped `BookmarkIcon` for a new `SparkleIcon` (four-point star) — a
flourish next to a title rather than a functional "filed/marked" symbol,
closer to what a session's own chosen name actually is. Deleted
`BookmarkIcon.jsx` since it had no other callers.

If this one still isn't right, worth asking what specifically feels off
(too playful, too small, wrong metaphor entirely) rather than swapping
blind a third time.

Verified: rolldound syntax check on all touched/new/removed files, full
`vite build`, grepped for stray `BookmarkIcon` references (only the
removal note in SparkleIcon's own comment).

## History list: swap the name icon again (sparkle -> party popper)
Third icon swap on this spot. This time asked instead of guessing blind
again: first what was wrong (answer: "wrong meaning/metaphor"), then
what concept it should actually be (answer: "a celebration/party vibe",
matching how sessions actually get named in practice). Replaced
`SparkleIcon` with a new `PartyIcon` (party popper/confetti). Deleted
`SparkleIcon.jsx` since it had no other callers.

Verified: rolldound syntax check on all touched/new/removed files, full
`vite build`, grepped for stray `SparkleIcon` references (only the
removal note in PartyIcon's own comment).

## History list: party icon sizing (concept was already right)
User: "change again" — asked what specifically was wrong this time
rather than swapping the icon blind again. Answer: not the concept, not
rendering — just "too small / hard to see". Bumped `PartyIcon` from
`h-4 w-4` to `h-5 w-5`, keeping CalendarIcon/HistoryIcon/PeopleIcon at
their existing sizes since those weren't flagged.

Verified: rolldown syntax check, full `vite build`.

## History list: name icon goes mood-neutral (party popper -> quote mark)
User: "sometimes the session is not a party it's just a chill drinking
session." The party-popper concept picked two turns ago assumed every
named session is a celebration — a fair miss, since a session can be
named anything ("Jojo's Birthday", but just as easily "Friday chill",
"Office night out", etc). Swapped `PartyIcon` for a new `QuoteIcon`
(small quotation marks) — mood-neutral, reads as "this is a title
someone gave it" without implying what kind of occasion it was. Deleted
`PartyIcon.jsx` since it had no other callers.

This closes the loop on four icon swaps at this one spot (TagIcon ->
BookmarkIcon -> SparkleIcon -> PartyIcon -> QuoteIcon) — each time asking
what was actually wrong once "just change it" stopped being specific
enough to act on confidently.

Verified: rolldound syntax check on all touched/new/removed files, full
`vite build`, grepped for stray `PartyIcon` references (only the removal
note in QuoteIcon's own comment).

## History list: name icon, 5th swap (quote mark -> hashtag)
User: "It doesn't fill [feel] like it thought." Asked what to do next
rather than guess again; answer: "I think a tag would do but not the
common tag" — a tag concept, but explicitly not the first attempt's
price-tag/ticket shape. Swapped `QuoteIcon` for a new `HashtagIcon` (#)
— the other common meaning of "tag" in modern UI (social-media labels),
without the price-tag's commerce read. Deleted `QuoteIcon.jsx`.
