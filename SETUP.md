# Setup Guide

## ✅ What's Been Set Up

1. **Next.js 14 App** with TypeScript and Tailwind CSS
2. **Supabase Integration** - Client and server utilities
3. **Authentication System**:
   - Login page (`/login`)
   - Protected routes with middleware
   - Auth callback handler
   - Logout functionality
4. **Dashboard** - Basic dashboard with navigation

## 🚀 Next Steps to Get Running

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in:
   - **Name**: scheduler-app (or your choice)
   - **Database Password**: (save this securely)
   - **Region**: Choose closest to you
4. Wait for project to be provisioned (2-3 minutes)

### 2. Get Your Supabase Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy:
   - **Project URL** (under "Project URL")
   - **Publishable API Key** (under "Project API keys" - this is the public key, formerly called "anon key")

### 3. Configure Environment Variables

1. Create `.env.local` file in the project root:
   ```bash
   cd /Users/lisafrist/Desktop/Projects/scheduler-app
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_publishable_key_here
   ```

### 4. Configure Supabase Auth URLs

1. In Supabase dashboard, go to **Authentication** → **URL Configuration**
2. Add to **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
3. Set **Site URL** to:
   - `http://localhost:3000`

### 5. Create Your First User

1. In Supabase dashboard, go to **Authentication** → **Users**
2. Click **"Add user"** → **"Create new user"**
3. Enter:
   - **Email**: your-email@example.com
   - **Password**: (choose a secure password)
   - **Auto Confirm User**: ✅ (check this)
4. Click **"Create user"**

### 6. Run the Development Server

```bash
cd /Users/lisafrist/Desktop/Projects/scheduler-app
npm run dev
```

### 7. Test the Application

1. Open [http://localhost:3000](http://localhost:3000)
2. You should be redirected to `/login`
3. Log in with the email/password you created
4. You should see the dashboard!

## 📁 Project Structure

```
scheduler-app/
├── app/
│   ├── (auth)/
│   │   └── login/          # Login page
│   ├── auth/
│   │   └── callback/       # Auth callback handler
│   ├── dashboard/          # Protected dashboard
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home (redirects)
├── components/
│   └── LogoutButton.tsx    # Logout component
├── lib/
│   └── supabase/
│       ├── client.ts       # Browser Supabase client
│       ├── server.ts       # Server Supabase client
│       └── middleware.ts   # Auth middleware
├── middleware.ts           # Next.js middleware
└── .env.local              # Your environment variables (create this)
```

## 🔐 How Authentication Works

1. **Middleware** (`middleware.ts`) protects all routes except `/login` and `/auth/*`
2. **Login page** (`app/login/page.tsx`) handles user sign-in
3. **Auth callback** (`app/auth/callback/route.ts`) handles OAuth redirects
4. **Server components** use `createClient()` from `lib/supabase/server.ts`
5. **Client components** use `createClient()` from `lib/supabase/client.ts`

## 🐛 Troubleshooting

### "Invalid API key" error
- Double-check your `.env.local` file has the correct values
- Make sure you're using the **Publishable API Key** (public key), not the service role key
- Restart the dev server after changing `.env.local`

### Redirect loop
- Check that your Supabase redirect URLs are configured correctly
- Make sure `/auth/callback` is in the allowed redirect URLs

### Can't log in
- Verify the user exists in Supabase dashboard
- Check that "Auto Confirm User" was checked when creating the user
- Try resetting the password in Supabase dashboard

## 📝 Next Development Steps

1. **Database Schema** - Create tables for:
   - Teachers
   - Subs
   - Schedules
   - Assignments
   - Time off
   - etc.

2. **Core Features**:
   - Teacher management
   - Sub management
   - Sub Finder algorithm
   - Dashboard views

3. **UI Components**:
   - Add shadcn/ui components
   - Build forms
   - Create data tables

## 🎉 You're Ready!

Your Next.js app with Supabase authentication is set up and ready to go. Start building your scheduler features!

