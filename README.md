# Cipher PvP — Frontend Web Client

This repository contains the **Cipher PvP frontend**, a React + TypeScript web client that powers all public-facing interfaces for the Cipher PvP ecosystem.

The frontend is intentionally designed as a **thin client**:
- It does **not** contain business logic authority
- It consumes a session-based backend API
- All validation, rules, and persistence are handled server-side

> This frontend **does not function standalone**.  
> A running Cipher backend is required.

---

## System Context

Cipher PvP is a multi-service system composed of:
1. **Frontend (this repo)** — UI, visualization, user interaction
2. **Backend (hsr-backend)** — Auth, database, rules, drafts, admin safety
3. **Discord Bot** — Match ingestion, ELO, historical data creation

This repository represents **only the client layer**.

---

## Tech Stack

- **React 19 + TypeScript**
- **Vite** (development & build)
- **react-router-dom** (routing)
- **Bootstrap 5 + react-bootstrap**
- **Custom CSS** (`Landing.css`)
- **Chart.js / Recharts** (stats & insights)
- **react-toastify** (notifications)

---

## Authentication Model (Client-Side)

Authentication is handled entirely by the backend.

### Frontend responsibilities:
- Query session state via `GET /auth/me`
- Redirect users to backend OAuth flow
- Render UI conditionally based on `isAdmin`

### How login works:
1. User clicks “Login with Discord”
2. Browser is redirected to: GET {API_BASE}/auth/discord?redirect=<current-url>
3. Backend performs OAuth and sets a session cookie
4. User is redirected back to the original page

The frontend **never handles tokens or OAuth logic directly**.

---

## Application Routes & Modes

Routing is defined in `src/App.tsx` using `react-router-dom`.  
Several pages support **query-based modes** such as seasons, cycles, and filters.  
These modes are not cosmetic — they directly affect backend aggregation logic.

---

### Core & Shared

| Route | Description |
|------|------------|
| `/` | Landing page |
| `/terms` | Terms of Service |
| `/profile` | Logged-in user profile (editable) |
| `/profile/:id` | Public player profile |
| `/profile/:id/presets` | Team presets for a player |
| `/player/:id/characters` | Per-player character statistics |

---

### Cipher (HSR)

| Route | Description |
|------|------------|
| `/cipher` | Cipher home dashboard |
| `/cipher/players` | Player leaderboard |
| `/cipher/player/:id` | Player profile |
| `/cipher/characters` | Character statistics |
| `/cipher/insights` | Analytics & insights |
| `/cipher/balance-cost` | Public balance cost preview |

#### Supported Query Modes (Cipher)

| Query | Description |
|------|------------|
| `?season=players` | Current season |
| `?season=players_1` | Previous season |
| `?season=players_2` | Older seasons |
| `?season=all` | All-time aggregation |
| `?cycle=0` | Current MOC cycle |
| `?cycle=1..n` | Historical MOC cycles |
| `?cycle=-1` | All-time character stats |

---

### Cerydra (HSR Alt Format)

| Route | Description |
|------|------------|
| `/cerydra/balance-cost` | Public Cerydra balance preview |
| `/cerydra/cost-test` | Cerydra cost calculator |

---

### Draft — Honkai: Star Rail

| Route | Description |
|------|------------|
| `/hsr/draft` | HSR draft interface |
| `/hsr/s/:key` | HSR spectator view |

#### Draft Modes & Behavior
- Drafts are **stateful server sessions**
- Actions are validated server-side
- Spectator pages consume **Server-Sent Events (SSE)**
- Public players interact via draft action tokens

---

### Draft — Zenless Zone Zero (ZZZ)

| Route | Description |
|------|------------|
| `/zzz/draft` | ZZZ draft interface |
| `/zzz/s/:key` | ZZZ spectator view |

#### ZZZ Draft Notes
- Supports **2v2** and **3v3** modes
- Draft order, bans, aces, and penalties are enforced server-side
- Client renders turn order and state only

---

### Admin

> Admin routes are conditionally rendered in the UI  
> but **enforced server-side**.

| Route | Description |
|------|------------|
| `/admin` | Admin dashboard |
| `/admin/balance` | Cipher balance editor |
| `/admin/cerydra-balance` | Cerydra balance editor |
| `/admin/vivian-balance` | ZZZ (Vivian) balance editor |
| `/admin/match-history` | Match history & rollback tools |
| `/admin/roster-log` | Roster audit log |

---

## Seasons, Cycles & Aggregation

Several pages support **temporal modes** controlled via query parameters:

### Seasons
- Backed by separate database tables (`players`, `players_1`, `players_2`, …)
- Defined server-side and mirrored in the frontend
- Used by:
  - Player leaderboard
  - Player profiles
  - Match history

### MOC Cycles
- Character stats are stored per cycle (`characters`, `characters_1`, …)
- Cycles represent discrete balance windows
- Used by:
  - Character statistics page

### All-Time Views
- All-time stats are **aggregated dynamically**
- No dedicated database table
- Exposed via:
  - `?season=all`
  - `?cycle=-1`

These modes affect **actual query logic**, not just UI state.

---

## Data Flow & Client Behavior

The frontend acts as a **read-only consumer and interaction surface** for backend-managed data.

### Data Sources
- All data is fetched from the Cipher backend API
- No persistent data is stored client-side
- Session state is derived exclusively from backend responses

### Data Characteristics
- Player stats, character stats, drafts, and costs are **pre-aggregated or computed server-side**
- Query parameters (season, cycle, mode) directly affect backend aggregation

The UI reflects backend state exactly as provided.

---

## Client Responsibility Boundaries

This frontend is intentionally designed to be **non-authoritative**.

### The frontend is responsible for:
- Rendering pages and dashboards
- Displaying player, character, and match statistics
- Visualizing draft state and turn order
- Forwarding user actions (draft picks, admin actions, edits)
- Reflecting permission state (admin vs non-admin)

### The frontend is NOT responsible for:
- Enforcing game rules
- Validating draft legality
- Computing ELO, penalties, or results
- Determining admin permissions
- Persisting authoritative state

All enforcement and validation occur on the backend.

---

## Draft System — Client Perspective

Draft pages function as **live clients** for backend-controlled draft sessions.

### Draft Interaction
- Draft state is owned by the backend
- The client renders:
  - Current turn
  - Pick / ban order
  - Team state
- User actions are sent to the backend for validation

### Spectator Mode
- Spectator pages subscribe to **Server-Sent Events (SSE)**
- Draft updates are pushed in real time
- No polling or client-side state reconstruction is used

---

## Admin Interface & Safety Model

Administrative features are exposed through the UI but are **never trusted**.

### Admin UI Behavior
- Admin-only routes and controls are conditionally displayed
- Non-admin users cannot access admin pages through navigation

### Enforcement
- All admin actions are verified server-side
- UI visibility is for usability only
- Backend remains the single authority

This prevents privilege escalation through client manipulation.

---

## Balance & Cost Visualization

The frontend provides **visualization and simulation** for multiple balance systems.

### Supported Domains
- Cipher (HSR main format)
- Cerydra (HSR alternate format)
- Vivian (ZZZ format)

### Client Role
- Display balance values
- Allow hypothetical team cost simulations
- Present public previews of balance data

The frontend does not enforce balance limits or validate legality.

---

## Styling & Visual Identity

The frontend follows a consistent **glassmorphic design language**.

### Design Principles
- Dark theme with translucent panels
- Backdrop blur for depth
- Minimal borders and soft contrast
- Consistent spacing and typography

### Styling Architecture
- Bootstrap for layout and structure
- react-bootstrap for UI primitives
- Custom overrides defined in `Landing.css`

This ensures visual consistency across all sections of the app.

---

## System Positioning

This frontend exists to:
- Expose Cipher’s competitive ecosystem to users
- Provide transparency into stats, balance, and drafts
- Act as a unified interface across multiple game formats

It is not intended to function independently or offline.

---

## Related Systems

Cipher PvP is composed of multiple cooperating systems:

- **Backend API** — Authentication, rules, persistence, aggregation
- **Discord Bot** — Match ingestion, ELO processing, automation

This repository represents the **presentation layer only**.


