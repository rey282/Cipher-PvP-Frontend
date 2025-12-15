# Cipher PvP — Frontend Web Client

This repository contains the **Cipher PvP frontend**, a React + TypeScript web client that powers all public-facing pages of the Cipher PvP ecosystem.

The frontend is built as a **thin client**:
- It does not own or enforce game logic
- It communicates with a session-based backend API
- All rules, validation, and persistence live on the server

> This frontend does **not** function on its own.  
> A running Cipher backend is required.

---

## System Context

Cipher PvP is a multi-service system made up of:

1. **Frontend (this repo)** — UI, data display, and user interaction  
2. **Backend** — Authentication, database access, rules, drafts, and admin controls  
3. **Discord Bot** — Match ingestion, ELO updates, and historical data creation  

This repository represents **only the client layer** of the system.

---

## Tech Stack

- **React 19 + TypeScript**
- **Vite**
- **react-router-dom**
- **Bootstrap 5 + react-bootstrap**
- **Custom CSS** (`Landing.css`)
- **Chart.js / Recharts**
- **react-toastify**

---

## Authentication Model (Client-Side)

Authentication is fully handled by the backend.

### What the frontend does
- Checks session state via `GET /auth/me`
- Redirects users to the backend OAuth flow
- Shows or hides UI based on admin status

### Login flow
1. The user clicks **Login with Discord**
2. The browser is redirected to  
   `GET {API_BASE}/auth/discord?redirect=<current-url>`
3. The backend completes OAuth and sets a session cookie
4. The user is redirected back to the original page

The frontend never handles OAuth tokens directly.

---

## Application Routes & Modes

Routes are defined in `src/App.tsx` using `react-router-dom`.

Many pages support **query-based modes** such as seasons and cycles.  
These parameters are passed directly to the backend and affect how data is queried and aggregated.

---

### Core & Shared

| Route | Description |
|------|------------|
| `/` | Landing page |
| `/terms` | Terms of Service |
| `/profile` | Logged-in user profile (editable) |
| `/profile/:id` | Public player profile |
| `/profile/:id/presets` | Team presets |
| `/player/:id/characters` | Per-player character stats |

---

### Cipher (HSR)

| Route | Description |
|------|------------|
| `/cipher` | Cipher home |
| `/cipher/players` | Player leaderboard |
| `/cipher/player/:id` | Player profile |
| `/cipher/characters` | Character statistics |
| `/cipher/insights` | Analytics and insights |
| `/cipher/balance-cost` | Public balance preview |

#### Supported Query Modes

| Query | Description |
|------|------------|
| `?season=players` | Current season |
| `?season=players_1` | Previous season |
| `?season=players_2` | Older seasons |
| `?season=all` | All-time data |
| `?cycle=0` | Current MOC cycle |
| `?cycle=1..n` | Past cycles |
| `?cycle=-1` | All-time character stats |

---

### Cerydra (HSR Alternate Format)

| Route | Description |
|------|------------|
| `/cerydra/balance-cost` | Public balance preview |
| `/cerydra/cost-test` | Cost calculator |

---

### Draft — Honkai: Star Rail

| Route | Description |
|------|------------|
| `/hsr/draft` | Draft interface |
| `/hsr/s/:key` | Spectator view |

- Drafts are managed as live backend sessions
- All actions are validated server-side
- Spectator pages receive updates via **Server-Sent Events (SSE)**

---

### Draft — Zenless Zone Zero (ZZZ)

| Route | Description |
|------|------------|
| `/zzz/draft` | Draft interface |
| `/zzz/s/:key` | Spectator view |

- Supports **2v2** and **3v3**
- Draft order, bans, aces, and penalties are enforced by the backend
- The frontend only displays state and turn order

---

### Admin

> Admin routes are shown in the UI but enforced server-side.

| Route | Description |
|------|------------|
| `/admin` | Admin dashboard |
| `/admin/balance` | Cipher balance editor |
| `/admin/cerydra-balance` | Cerydra balance editor |
| `/admin/vivian-balance` | ZZZ (Vivian) balance editor |
| `/admin/match-history` | Match history and rollbacks |
| `/admin/roster-log` | Roster audit log |

---

## Seasons, Cycles & Aggregation

Several pages support time-based views through query parameters.

### Seasons
- Player and match data is split across seasonal tables
- Seasons are defined server-side
- Used by leaderboards, profiles, and match history

### MOC Cycles
- Character stats are tracked per balance cycle remember
- Each cycle represents a distinct balance window
- Older cycles remain available for comparison

### All-Time Views
- All-time data is aggregated dynamically
- No dedicated tables exist for all-time stats
- Accessed using:
  - `?season=all`
  - `?cycle=-1`

These parameters affect real backend queries, not just UI filters.

---

## Data Flow & Client Behavior

The frontend consumes backend data and reflects it directly.

- All data is fetched from the Cipher backend
- No persistent state is stored client-side
- Session state comes entirely from backend responses

Player stats, character stats, drafts, and balance data are all prepared server-side and displayed as-is.

---

## Client Responsibility Boundaries

The frontend is intentionally **non-authoritative**.

### What it does
- Renders pages and dashboards
- Displays stats and history
- Shows draft state and turn order
- Sends user actions to the backend
- Reflects admin permissions

### What it does not do
- Enforce rules
- Validate draft actions
- Calculate ELO or penalties
- Decide admin access
- Store authoritative data

All enforcement happens on the backend.

---

## Draft System — Client Perspective

Draft pages act as live views of backend-controlled draft sessions.

- The backend owns draft state
- The frontend renders picks, bans, teams, and turns
- Player actions are sent to the backend for validation

### Spectator Mode
- Spectator pages use **Server-Sent Events (SSE)**
- Updates are pushed in real time
- No polling is used

---

## Admin Interface & Safety Model

Admin features are exposed in the UI but are never trusted on their own.

- Admin-only controls are conditionally displayed
- All admin actions are checked server-side
- UI checks exist for usability, not security

This prevents misuse even if the frontend is modified.

---

## Balance & Cost Visualization

The frontend provides tools to view and simulate balance data.

### Supported formats
- Cipher (HSR main format)
- Cerydra (HSR alternate format)
- Vivian (ZZZ format)

The frontend displays balance values and allows hypothetical team calculations.  
Final validation always happens on the backend.

---

## Styling & Visual Identity

The UI follows a consistent **glassmorphic** style.

- Dark theme
- Translucent panels
- Subtle blur and contrast
- Consistent spacing and typography

Styling is handled through:
- Bootstrap for layout
- react-bootstrap for components
- Custom overrides in `Landing.css`

---

## System Positioning

This frontend exists to:
- Present Cipher’s competitive ecosystem
- Make stats, drafts, and balance transparent
- Provide a single interface across multiple game formats

It is not designed to run independently.

---

## Related Systems

Cipher PvP also includes:

- **Backend API** — Authentication, rules, persistence, aggregation  
- **Discord Bot** — Match ingestion and automation  

This repository represents the **presentation layer only**.

---

## License

This project is licensed under the **MIT License**.
