# DECISIONS.md — Lasenggo 3000

Log of key technical decisions and why, so settled questions don't get re-litigated.
Add new entries at the top (most recent first).

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
