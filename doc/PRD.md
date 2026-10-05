# PRD.md — Lasenggo 3000

## Objective
Automate the Filipino "tagayan" drinking ritual with a connected hardware + mobile app
system. The app manages participant turn order; the hardware pours, detects, and
confirms each drink, so the group gets the social ritual without manual pouring.

## Core Features (MVP)
- Participant list with circular turn order (add/remove people, auto-wrap)
- **Pour** button: sends BLE command, pump dispenses a calibrated shot, cup sensor +
  LED confirm the result before turn advances
- **Pass** button: advances turn locally, no hardware interaction
- Cup detection: pour is rejected if no cup is present (`NO_CUP`)
- LED glows while cup has liquid, turns off when empty/removedV
- Configurable pour volume: Light (~15mL) / Standard (~30mL, default) / Heavy (~50mL)
- Fully offline-capable (BLE + local storage; no internet required to run a session)
- Sync: session/event data pushed to Supabase when internet is available
- Anonymous, login-free usage (Supabase anonymous auth, device-based identity)
- **Session history screen**: view past sessions (date, participants, drink/pass counts
  per person) — pulled from local SQLite when offline, from Supabase once synced

## Out of Scope (MVP)
- Multiple simultaneous pour stations (see scalability roadmap, post-MVP)
- iOS support (Capacitor/Android-first; BLE plugin is Android-focused)
- User accounts / cross-device login (history is per-device via anonymous auth, not
  shared across a group's multiple phones yet)
- Named sessions ("Jojo's Birthday"), leaderboard ranking across sessions, QR pairing
- Per-liquid-type calibration, battery reporting, flush cycle
  (all approved as fast-follow features, not required for MVP — see TASKS.md backlog)

## Success Metrics
- Pour accuracy: dispensed volume within ±10% of configured setting (Light/Standard/Heavy)
- Cup detection reliability: >95% correct NO_CUP / HAS_DRINK / EMPTY classification across
  varied cup/glass shapes
- BLE round-trip latency (button tap → pump starts): < 1 second
- App fully usable with zero internet connection, end to end, for a full session
- Zero data loss: all session/event data persists locally even if sync never happens

## Constraints
- **No internet dependency at point of use** — many tagayan locations (rural, outdoor,
  fiestas) have no WiFi/data; BLE is mandatory, not WiFi/MQTT
- **Food/alcohol-safe hardware** — pump and tubing must be food-grade (silicone over
  vinyl); no metal-liquid contact in the pump itself (peristaltic only)
- **Cup-shape agnostic** — tagayan uses whatever vessel is on hand; detection must not
  assume a fixed cup size/shape (hence weight/delta-based detection, not fixed thresholds)
- **Android-first distribution** — React + Tailwind, wrapped via Capacitor into an APK;
  native BLE plugin used instead of browser Web Bluetooth (unreliable/unsupported on iOS)
- **Offline-first data model** — local SQLite is the source of truth; Supabase is a
  sync target, never a runtime dependency

## Sensors / Hardware Components Required
| Component | Purpose | Notes |
|---|---|---|
| **ESP32** | Main controller — BLE peripheral, runs pump/sensor/LED logic | Built-in BLE, no separate Arduino needed |
| **12V peristaltic pump** | Dispenses the drink | Food-safe; liquid only touches silicone tubing, not pump internals |
| **MOSFET or relay module** | Switches 12V pump power from ESP32 GPIO | ESP32 GPIO cannot drive the pump directly |
| **Load cell + HX711 amplifier** | Detects cup presence and liquid weight (delta-based) | Chosen over IR/ultrasonic/capacitive — works regardless of cup/glass shape |
| **WS2812B (NeoPixel) LED ring** | Visual feedback: glows when liquid present, off when empty/no cup | Single GPIO data line; needs 5V supply, shared ground with ESP32 |
| **12V power supply (or battery pack)** | Powers pump independently of ESP32 logic supply | Shared ground with ESP32 required |
| Silicone tubing (food-grade) | Carries liquid from bottle to cup | Preferred over vinyl for alcohol contact over repeated use |

## Tech Stack (decided)
- Frontend: React + Tailwind
- Native wrapper: Capacitor → Android APK
- Bluetooth: native BLE via Capacitor plugin (`@capacitor-community/bluetooth-le`)
- Local DB: SQLite (`@capacitor-community/sqlite`), offline-first source of truth
- Cloud sync / backend: Supabase (Postgres + anonymous auth) — a managed backend-as-a-
  service; no custom server is written or hosted, app talks to Supabase directly via its
  client SDK
- Firmware: ESP32 (Arduino framework or ESP-IDF — TBD by firmware owner)

## References
- Full technical decisions and rationale: see `tagaybox_spec.md`
- Task breakdown and sprint tracking: see `TASKS.md`
