# Time Tracker

A professional time tracking app for teams and freelancers. Track time per project and client with a live timer and manual entries, manage tasks on a Kanban board, tag time with labels, view reports and statistics, and generate invoices—all with a clean, Supabase-style UI.

---

## Tech stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **Supabase** — Auth, Postgres, Row Level Security (RLS)
- **TanStack Query** — Server state, shared hooks for user/projects/tags/active timer
- **UI** — Tailwind CSS, Radix UI (Dialog, Select, Dropdown, Tabs), shadcn-style components
- **Forms** — react-hook-form, zod, @hookform/resolvers
- **Charts** — Recharts
- **Rich text** — Lexical (GitHub-style editor for task descriptions)
- **Tooling** — TypeScript, ESLint, Biome (format + lint), Husky + lint-staged

---

## Features and functionality

### Authentication and access

- **Login** — Email/password sign-in via Supabase Auth.
- **Approval flow** — Sign-up is disabled; new users are created with `is_approved = false`. Middleware redirects unapproved users to the login page with a “pending approval” message. An admin sets `is_approved = true` in the database to grant access.
- **Protected routes** — Unauthenticated users are redirected to `/login`. Authenticated, approved users hitting `/` or `/login` are redirected to `/dashboard`.

### Layout and navigation

- **Sidebar** — Collapsible left sidebar (expand on hover) with links: Projects, Clients, Reports, Statistics, Tags, Calendar, Settings.
- **Header** — Sticky top bar with “Start timer” (opens Quick Start modal), active timer badge (click to go to project or `/tracker`), search placeholder, and user menu (profile, sign out).
- **Quick Start Timer** — Modal from the header to pick project, task (or ad-hoc name), optional tags, and start a timer without leaving the current page.

### Clients

- **CRUD** — Create, edit, and delete clients.
- **Fields** — Name, email, hourly rate (USD) for billing.
- **Usage** — Each project is linked to one client; client rate is used for report amounts and invoices.

### Projects

- **Dashboard** — Grid or list view of all projects; search; “New project” (name + client).
- **Project detail** — Header with project name, client, “View report & billing” link; Kanban board; recent time entries card; task detail modal; edit time entry dialog; manual time form; timer widget.
- **Report & billing** — Per-project report and invoice management (see **Reports and invoices**).

### Tasks (Kanban)

- **Board** — Four columns: Backlog, To do, Progress, Done. Drag-and-drop to change status.
- **Task cards** — Show task identifier (e.g. `PROJ-1`), name, tags, assignee (if set).
- **Add task** — “Add task” opens a dialog (name, optional tags); new tasks go to Backlog.
- **Task detail modal** — Open from card: title, **rich text description** (Lexical editor: bold, italic, headings, lists, links, code, quote), status dropdown, tags, time entries list, “Add manual entry”, “Start timer”. Edits and description persist on save/close.
- **Task identifiers** — Optional `task_number` per project and formatted label (e.g. `ACME-2`) for display.

### Time tracking

- **Live timer** — **Tracker** page (`/tracker`): choose project, optional task or ad-hoc name, start/stop; elapsed time updates every second. Only one active timer per user; starting a new one stops the previous.
- **Active timer badge** — In header: shows current project (and task if set); click to open project or go to Tracker.
- **Timer widget** — On project detail: start/stop timer for that project and a task; optional tags.
- **Manual time** — Add entries with project, task, start/end (and optional tags) from project detail or **Calendar** (“Add time” on a day).
- **Time entry tags** — Attach tags to time entries; tags are shown in reports and recent time entries table.
- **Edit/delete time entries** — From project detail: edit (task, start/end, tags) or delete with confirmation.

### Tags

- **Global tags** — Create, edit, delete tags (name, optional color). Used for **task tags** (on tasks) and **time entry tags** (on time entries).
- **Manage tags** — Dedicated Tags page; “Manage tags” link from project Kanban section.
- **Task tags** — Attach multiple tags to a task in the task detail modal and when adding a task.
- **Time entry tags** — Attach tags when starting a timer (Quick Start, Tracker, project timer widget) or when adding/editing manual time.

### Calendar

- **Month view** — Calendar with time entries shown per day (from completed entries with `end_time`).
- **Add time** — Click a day to open “Add time” modal: project, task, start/end, optional tags.
- **Navigation** — Previous/next month.

### Reports and invoices

- **Reports page** — List all projects with total time and amount (client hourly rate). Drill into a project report from “View report”.
- **Project report** — Two tabs:
  - **Report** — Date range (From/To); total time and amount due; charts: time by day, by task, by tag. Uses the date range from the Invoices tab.
  - **Invoices** — Same date range; “Generate invoice” creates an invoice record for that range. Table of invoices with: period, total minutes, amount, and actions.
- **Invoice actions** — **Email** (mailto to client with subject/body), **Download PDF** (opens print view for that invoice’s period), **Mark sent** / **Mark paid** (with timestamps), **Delete** (with confirmation dialog).
- **Print view** — Project report print page; supports `?start=&end=` for invoice PDFs.

### Statistics

- **Filters** — Period (day/week/month/year), client (optional).
- **Charts** — Time by project (bar chart); project list with total time and amount.
- **Aggregations** — By selected period and client filter.

### Settings

- **Settings page** — Placeholder for future user/preferences (e.g. profile, defaults).

### Rich text (task descriptions)

- **Lexical editor** — Replaces plain textarea in the task detail modal. Write and Preview tabs; toolbar: bold, italic, heading, bullet/numbered list, code, link, quote, undo/redo.
- **Persistence** — HTML is stored in `tasks.description`; content is captured on blur and when the modal is closed (including on overlay/Escape) so edits are not lost.

### Database (migrations)

Run in order in the Supabase SQL Editor (or use Supabase CLI):

| Migration | Description |
|-----------|-------------|
| `20250201000001_initial_schema.sql` | `profiles`, `clients`, `projects`, `tasks`, `time_entries`, `active_timers`, RLS |
| `20250201000002_tags.sql` | `tags` table, RLS |
| `20250201000003_global_tags.sql` | Tags global to user |
| `20250201000004_task_tags.sql` | `task_tags` junction |
| `20250201000005_task_status_description.sql` | Task status (backlog, todo, progress, done) |
| `20250201000006_task_assignee.sql` | Task assignee (optional) |
| `20250201000007_task_identifier.sql` | `task_number` per project |
| `20250201000008_profiles_is_approved.sql` | `profiles.is_approved`, default false; trigger for new users |
| `20250201000009_invoices.sql` | `invoices` table (project, period, amount, sent/paid), RLS |

---

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Supabase**

   - Create a project at [supabase.com](https://supabase.com).
   - In the **SQL Editor**, run each migration in `supabase/migrations/` in order (see table above).
   - In **Authentication → URL Configuration**, add your app URL (e.g. `http://localhost:3000`) and redirect URLs if needed.
   - Copy the project URL and anon key from **Settings → API** into `.env`:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3. **Run the app**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Log in (or create a user via Supabase Dashboard and set `profiles.is_approved = true` for that user).

---

## Scripts

| Command | Description |
|--------|-------------|
| `pnpm dev` | Start Next.js dev server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | ESLint |
| `pnpm check` | Biome check (lint + format) |
| `pnpm check:write` | Biome check and apply fixes |
| `pnpm format` | Biome format only |

---

## Project structure (main areas)

- `src/app/` — App Router: `(auth)` (login, signup redirect), `(dashboard)` (layout, sidebar, header), routes for dashboard, clients, reports, statistics, tags, calendar, tracker, settings, and project detail + report + print.
- `src/app/(dashboard)/dashboard/[id]/` — Project detail: page, Kanban (board, card), time entries card, task modal, edit time entry dialog, manual time form, timer widget, report page and print page.
- `src/components/` — UI (button, card, dialog, table, etc.), layout (header, sidebar, quick-start modal, active-timer badge), editor (Lexical GitHub-style), tags (multi-select, project section).
- `src/hooks/` — `use-user`, `use-projects`, `use-tags`, `use-active-timer` (TanStack Query, shared across app).
- `src/lib/` — Supabase client (browser singleton), server client, middleware (auth + approval checks).
- `src/types/` — Database types (Client, Project, Task, TimeEntry, Tag, Invoice, etc.).
- `supabase/migrations/` — SQL migrations for schema and RLS.
