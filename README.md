# Time Tracker

A professional time tracking app built with Next.js, styled like Supabase admin. Track time per project and client, with manual entries and a live timer, plus reports and billing.

## Stack

- **Next.js 14** (App Router)
- **Supabase** (auth + Postgres)
- **shadcn-style UI** (Tailwind, Radix)
- **TanStack Query**, **react-hook-form**, **zod**, **Recharts**

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Supabase**

   - Create a project at [supabase.com](https://supabase.com).
   - In **SQL Editor**, run the migration in `supabase/migrations/20250201000001_initial_schema.sql` (creates `profiles`, `clients`, `projects`, `tasks`, `time_entries`, `active_timers` and RLS).
   - Copy project URL and anon key into `.env` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

3. **Run the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign up, then create clients (with hourly rate in USD), projects (one client per project), and tasks. Track time via **manual form** (task, start/end) or **timer** (project + optional task, start/stop). View **Reports** for charts and **Email bill** / **Download PDF**.

## Features

- **Auth**: Sign up / sign in (Supabase Auth).
- **Layout**: Top header (logo, user), left sidebar (expandable on hover), main content.
- **Clients**: CRUD, hourly rate in USD.
- **Projects**: One project per client; grid/list view; create from dashboard.
- **Tasks**: Per-project todos; add/edit/complete.
- **Time**: Manual (task name, start/end) and timer (project, task or ad-hoc name, start/stop).
- **Reports**: Per-project total time, Recharts (by day, by task), amount due.
- **Billing**: “Email bill to client” (mailto) and “Download PDF” (print view).

## Database

Apply `supabase/migrations/20250201000001_initial_schema.sql` in the Supabase SQL Editor, or use `supabase link` and `supabase db push` if using Supabase CLI.
