# CONTEXT.md — Lasenggo 3000

## Project-Specific Terminology
| Term | Meaning |
|---|---|
| **Tagayan** | The Filipino group-drinking ritual this project automates — one shared glass passed around a circle, refilled each round |
| **Tagay** | A single round/shot in the tagayan sequence |
| **Lasenggo 3000** | Project/product name (the physical device + app system) — also the BLE advertised device name (`Lasenggo3000`, no space) |
| **Pulutan** | Food/snacks shared during drinking — not modeled in this system, mentioned for cultural context only |
| **Pour** | App action: sends a BLE command to physically dispense a drink via the pump |
| **Pass** | App action: skips a person's turn, local-only, no hardware/BLE interaction |
| **Station** | One physical pump + load cell + LED unit (MVP = single station; see scalability roadmap for multi-station) |

## Important Conventions
- **Naming**: BLE commands and statuses are UPPERCASE_SNAKE_CASE (`POUR`, `NO_CUP`,
  `HAS_DRINK`) — do not introduce new casing styles for new commands.
- **File/folder structure**: app code follows feature-based architecture (see
  `ARCHITECTURE.md` → Feature-Based Architecture) — don't add a generic `utils/` dumping
  ground; put logic in its owning feature folder.
- **Branches**: one branch per task, named `area/short-description` (e.g.
  `fw/cup-state-machine`, `app/ble-connect`) — matches the task list in `TASKS.md`.
- **Data model changes**: any change to the `sessions` / `participants` / `events`
  schema must update local SQLite schema, the Supabase migration, and
  `ARCHITECTURE.md` together — these three must never drift out of sync.
- **BLE contract changes**: any new/changed COMMAND or STATUS value must be updated in
  `ARCHITECTURE.md`'s BLE API table in the same PR that changes firmware or app BLE code.

## External Resources
- Capacitor BLE plugin: `@capacitor-community/bluetooth-le` (check npm/GitHub for current docs)
- Capacitor SQLite plugin: `@capacitor-community/sqlite`
- Supabase docs: supabase.com/docs (anonymous auth, Postgres, client libraries)
- ESP32 BLE reference: espressif.com (ESP-IDF or Arduino-ESP32 BLE library docs,
  depending on which the firmware owner picks — see open decision below)

## Current Project Status / Phase
- **Phase**: Pre-build / planning complete for MVP scope
- Architecture, tech stack, data schema, BLE command contract, and sensor list are
  decided and documented (`PRD.md`, `ARCHITECTURE.md`)
- No code written yet — Sprint 1 (see `TASKS.md`) covers hardware bring-up, firmware,
  app scaffold, and Supabase setup in parallel tracks
- Project name finalized: **Lasenggo 3000**

## Known Issues / Blockers
- **Firmware framework not yet chosen**: Arduino framework vs. ESP-IDF for the ESP32 —
  needs a decision from whoever owns firmware before `fw/ble-setup` starts (affects BLE
  library APIs used throughout firmware)
- **No components sourced yet** — hardware task `hw/source-components` blocks all other
  hardware and firmware bring-up tasks
- **Pour volume / cup threshold constants are estimates**, not yet empirically
  calibrated (see `PRD.md` success metrics — ±10% accuracy target still to be validated
  against real hardware)
- **Android-only for now** — iOS is explicitly out of scope for MVP; don't accept
  iOS-related bug reports/requests without a scope discussion first
