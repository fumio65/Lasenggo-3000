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
