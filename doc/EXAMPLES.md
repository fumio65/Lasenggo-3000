# EXAMPLES.md — Lasenggo 3000

Minimal, representative snippets showing preferred patterns. Not exhaustive — add more
as real patterns emerge during implementation; remove examples that stop reflecting how
the code actually works.

---

## BLE command payload (App → ESP32)

Keep commands as plain short strings, not JSON — minimizes BLE payload size and parsing
complexity on the ESP32 side.

```ts
// app/features/ble/commands.ts
export type Command = "POUR" | "TARE" | "STOP";

async function sendCommand(cmd: Command) {
  await BleClient.write(
    deviceId,
    SERVICE_UUID,
    COMMAND_CHAR_UUID,
    textToDataView(cmd)
  );
}
```

## STATUS notification handling (ESP32 → App)

```ts
// app/features/ble/status.ts
type Status =
  | "READY" | "CUP_DETECTED" | "NO_CUP"
  | "POURING" | "POURED" | "HAS_DRINK" | "EMPTY";

BleClient.startNotifications(
  deviceId,
  SERVICE_UUID,
  STATUS_CHAR_UUID,
  (value) => {
    const status = dataViewToText(value) as Status;
    handleStatus(status); // drives turn manager + UI state
  }
);
```

## Turn manager: Pour vs. Pass (sample input/output)

**Input**: participant list `["Juan", "Maria", "Pedro"]`, currentIndex = 0

| Action | BLE call? | Result |
|---|---|---|
| Pass pressed | No | `currentIndex` → 1 (Maria), no hardware event logged beyond a local `PASS` event row |
| Pour pressed, ESP32 replies `POURED`/`HAS_DRINK` | Yes (`POUR`) | `currentIndex` → 1 (Maria), local `POUR` event row logged with timestamp |
| Pour pressed, ESP32 replies `NO_CUP` | Yes (`POUR`) | `currentIndex` stays at 0 (Juan), UI shows "No cup detected" alert, no event row logged |

```ts
// app/features/session/turnManager.ts
function onPourConfirmed() {
  logEvent({ type: "POUR", participantId: current.id });
  advanceTurn();
}

function onPass() {
  logEvent({ type: "PASS", participantId: current.id });
  advanceTurn();
}

function advanceTurn() {
  currentIndex = (currentIndex + 1) % participants.length;
}
```

## Local SQLite event row (sample)

```json
{
  "id": "a1b2c3d4-...",
  "session_id": "f0e1d2c3-...",
  "participant_id": "9988...",
  "type": "POUR",
  "timestamp": "2026-10-02T01:15:03+08:00",
  "synced": false
}
```

After a successful Supabase push, `synced` flips to `true` locally — the row itself is
never deleted, so local history stays intact regardless of sync state.

## Firmware: cup state decision (pseudocode)

```cpp
// firmware/cup_state.cpp
float preWeight = 0;

void onPourCommand() {
  float current = readLoadCellAveraged(); // averaged over ~200-300ms
  if (current < NOISE_MARGIN) {
    sendStatus("NO_CUP");
    return;
  }
  preWeight = current;
  sendStatus("POURING");
  runPump(calibratedDurationFor(selectedVolume));

  float postWeight = readLoadCellAveraged();
  if (postWeight - preWeight >= LIQUID_ADDED_MIN) {
    sendStatus("POURED");
    sendStatus("HAS_DRINK");
  } else {
    sendStatus("REFILL_BOTTLE"); // backlog feature — not in MVP command set yet
  }
}
```

Note: `REFILL_BOTTLE` is a backlog item (see `TASKS.md`) — don't wire it into the MVP
firmware build until it's pulled into an active sprint and added to the BLE contract in
`ARCHITECTURE.md`.

## Feature state: local hook, not Context/Redux (sample)

Each feature folder owns its state via a plain hook, not a global store. Screens
import the hook and pass callbacks down — no cross-feature state library needed
at this scale. Established in `app/participant-list`; follow this shape for other
feature-local state (e.g. a future `usePourVolume`, `useBleConnection`).

```jsx
// src/features/session/useParticipants.js
export function useParticipants(initial = []) {
  const [participants, setParticipants] = useState(initial)

  const addParticipant = useCallback((name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setParticipants((prev) => [...prev, { id: crypto.randomUUID(), name: trimmed }])
  }, [])

  // ...removeParticipant, moveParticipant follow the same
  // "copy array, return new array" immutable-update pattern

  return { participants, addParticipant, removeParticipant, moveParticipant }
}
```

Participant shape is `{ id, name }` — matches the `participants` table in
`ARCHITECTURE.md`'s schema (minus `session_id`, which only matters once this list
is persisted in `app/sqlite-schema`). Keeping the shape aligned now avoids a
mapping step later.

## Screen navigation: local state in App, not a router (sample)

Established in `app/active-session-screen`. With a small, fixed set of screens
(participants → active session → history), a router library is unnecessary
complexity. `App` holds a `screen` string and renders accordingly; participant
state is lifted into `App` too, so it can be handed to whichever screen needs it.

```jsx
// src/App.jsx
const [screen, setScreen] = useState('participants') // 'participants' | 'session'

if (screen === 'session') {
  return <ActiveSessionScreen participants={participants} onExit={() => setScreen('participants')} />
}
return <ParticipantList participants={participants} onStartSession={() => setScreen('session')} />
```

If the screen set grows enough that this becomes unwieldy, that's a real decision
to make (and log in `DECISIONS.md`) — don't add a router piecemeal without one.
