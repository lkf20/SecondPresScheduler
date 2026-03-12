# Scheduler App

A modern web application for managing substitute teacher scheduling, built with Next.js 14, TypeScript, and Supabase.

## Features

- 🔐 Authentication with Supabase Auth
- 👥 Teacher and Substitute management
- 📅 Schedule management
- 🔍 Sub Finder with contact sidebar
- 📊 Dashboard view
- 📱 Responsive design

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)

### Setup Instructions

1. **Clone and install dependencies:**

   ```bash
   npm install
   ```

2. **Set up Supabase:**
   - Go to [supabase.com](https://supabase.com) and create a new project
   - Wait for the project to be fully provisioned
   - Go to Project Settings > API
   - Copy your Project URL and Publishable API Key (formerly called "anon key")

3. **Configure environment variables:**

   ```bash
   cp .env.local.example .env.local
   ```

   Then edit `.env.local` and add your Supabase credentials:

   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   ```

4. **Configure Supabase Auth:**
   - In your Supabase dashboard, go to Authentication > URL Configuration
   - Add `http://localhost:3000/auth/callback` to Redirect URLs
   - Add `http://localhost:3000` to Site URL

5. **Create your first user:**
   - In Supabase dashboard, go to Authentication > Users
   - Click "Add user" and create a director account
   - Set a password for the user

6. **Run the development server:**

   ```bash
   npm run dev
   ```

7. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Supabase project linking (staging/prod)

We store project refs in local env files and provide a helper script so you don't have to copy/paste IDs.

```
./scripts/supabase-link.sh staging
./scripts/supabase-link.sh prod
# or: ./scripts/supabase-link.sh production  (uses .env.supabase.production if present)
```

**Important:** The link script only connects the **Supabase CLI** to a project (for migrations, `supabase db push`, etc.). It does **not** change which database your Next.js app uses when you run `npm run dev`.

**To use the production database on localhost:**

1. Put the **production** Supabase URL and keys in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` = your production project URL (e.g. `https://xxxxx.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = production anon/publishable key
   - If you use server-side Supabase (e.g. API routes), set `SUPABASE_SERVICE_ROLE_KEY` to the production service role key as well.
2. Set `NEXT_PUBLIC_SUPABASE_ENV=production` in `.env.local` so the dev badge shows "Supabase: Production".
3. Restart the dev server (`npm run dev`).

Use a separate env file (e.g. `.env.local.prod`) to store production values and copy them into `.env.local` when you want to point localhost at production; switch back to staging URL/keys when you're done.

**Dev badge (localhost):** In development, a small badge at the bottom-left shows which Supabase environment you're using (Staging vs Production). Set in `.env.local`:

- `NEXT_PUBLIC_SUPABASE_ENV=staging` — badge shows "Supabase: Staging"
- `NEXT_PUBLIC_SUPABASE_ENV=production` — badge shows "Supabase: Production"

If unset, the badge shows "(not set)" as a reminder to configure it.

## Project Structure

```
scheduler-app/
├── app/                    # Next.js app router pages
│   ├── (auth)/            # Auth-related pages
│   ├── dashboard/         # Dashboard page
│   └── api/              # API routes
├── lib/
│   └── supabase/         # Supabase client utilities
└── components/           # React components
```

## Next Steps

1. Set up the database schema (see `supabase/migrations/`)
2. Build out the core features:
   - Teacher management
   - Substitute management
   - Schedule views
   - Sub Finder algorithm

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL (via Supabase)
- **Authentication:** Supabase Auth
- **Deployment:** Vercel (recommended)

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
