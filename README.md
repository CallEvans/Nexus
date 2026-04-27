# 🔵 Nexus — Deployment Guide
### A beginner-friendly, step-by-step walkthrough from zero to live

---

## What You're Deploying

Nexus is a chat web app — three files:

```
nexus/
├── index.html   ← The entire UI
├── styles.css   ← All visual styles
└── app.js       ← All logic (auth, chat, pulse, profile)
```

It connects to **Supabase** (your database + auth), sends emails via **Brevo SMTP**, and gets hosted on **Railway** (recommended) or any of the other platforms below.

---

## Part 1 — GitHub (Your Code Repository)

GitHub is where your code lives online. Think of it like Google Drive, but for code. Every deployment platform reads from GitHub.

### Step 1: Create a GitHub account
1. Go to **https://github.com**
2. Click **Sign up** — use any email and create a password
3. Verify your email when they send you a confirmation

### Step 2: Install Git on your computer
Git is the tool that pushes your code from your laptop to GitHub.

- **Windows:** Download from https://git-scm.com/download/win — install with all defaults
- **Mac:** Open Terminal and type `git --version` — if it's not installed, it'll prompt you to install it automatically
- **Linux:** Run `sudo apt install git`

After installing, open Terminal (Mac/Linux) or Git Bash (Windows) and configure your identity:
```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

### Step 3: Create your repository
1. On GitHub, click the **+** button (top right) → **New repository**
2. Name it `nexus` (or whatever you want)
3. Set it to **Private** (so your Supabase keys stay safe)
4. Click **Create repository**

### Step 4: Push your Nexus files to GitHub
Open Terminal in the folder where your 3 Nexus files are, then run these commands one by one:

```bash
# Initialize a git repository in your folder
git init

# Tell git about all your files
git add .

# Save a snapshot with a message
git commit -m "first commit — nexus chat app"

# Connect to your GitHub repo (replace YOUR_USERNAME with yours)
git remote add origin https://github.com/YOUR_USERNAME/nexus.git

# Push your files to GitHub
git push -u origin main
```

> If it asks for your GitHub password, use a **Personal Access Token** not your password.
> To get one: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → check `repo` → copy it and paste it as your password.

✅ **Done.** Refresh your GitHub repo page and you should see your 3 files.

---

## Part 2 — Supabase (Your Database + Auth)

Supabase is your backend. It stores users, messages, statuses, and handles login. It's free and powerful.

### Step 5: Create a Supabase account
1. Go to **https://supabase.com**
2. Click **Start your project** → sign up with GitHub (easier) or email
3. On the dashboard, click **New project**
4. Fill in:
   - **Organization:** your name or "Nexus"
   - **Project name:** `nexus`
   - **Database password:** create a strong password — **save it somewhere safe, you'll need it**
   - **Region:** pick the one closest to where your users will be (West EU, US East, etc.)
5. Click **Create new project** — it takes about 1 minute to spin up

### Step 6: Get your API keys
Once the project is ready:
1. In the left sidebar, click the **Settings** gear icon
2. Click **API**
3. You'll see two things you need — copy both and save them:
   - **Project URL** — looks like `https://abcdefghijk.supabase.co`
   - **anon public** key — a long string starting with `eyJ...`

These go into your `app.js` at the top:
```js
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...your key here...';
```

### Step 7: Set up the database tables
You need to create the tables that store users, messages, statuses, etc.

In your Supabase dashboard:
1. Click **SQL Editor** in the left sidebar
2. Click **New query**
3. Paste this entire block and click **Run**:

```sql
-- PROFILES TABLE (stores name, username, vibe word)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  username text unique not null,
  vibe text default 'rare',
  avatar_url text,
  created_at timestamp with time zone default now()
);

-- MESSAGES TABLE
create table public.messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references auth.users on delete cascade,
  recipient_id uuid references auth.users,
  group_id uuid,
  text text not null,
  created_at timestamp with time zone default now()
);

-- STATUSES TABLE
create table public.statuses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  text text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now()
);

-- GROUPS TABLE
create table public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  creator_id uuid references auth.users on delete cascade,
  created_at timestamp with time zone default now()
);

-- GROUP MEMBERS TABLE
create table public.group_members (
  group_id uuid references public.groups on delete cascade,
  user_id uuid references auth.users on delete cascade,
  primary key (group_id, user_id)
);

-- Enable Row Level Security on all tables
alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.statuses enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Profiles: users can read all profiles, only edit their own
create policy "Profiles are viewable by everyone" on public.profiles
  for select using (true);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Messages: users can see messages they sent or received
create policy "Users see their messages" on public.messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "Users can send messages" on public.messages
  for insert with check (auth.uid() = sender_id);

-- Statuses: all users can view active statuses
create policy "Anyone can view statuses" on public.statuses
  for select using (expires_at > now());
create policy "Users can post their own status" on public.statuses
  for insert with check (auth.uid() = user_id);
```

4. Click **Run** — if you see a green "Success" at the bottom, you're good.

### Step 8: Set up Supabase Storage (for profile pictures)
1. In the left sidebar, click **Storage**
2. Click **New bucket**
3. Name it `avatars`
4. Check **Public bucket** (so profile photos load for everyone)
5. Click **Save**

### Step 9: Enable email confirmations
1. In the left sidebar, click **Authentication** → **Settings**
2. Under **Email Auth**, make sure **Enable email confirmations** is ON
3. Leave everything else for now — you'll configure the email sender in Part 3

---

## Part 3 — Brevo SMTP (Email Delivery)

By default, Supabase sends max 2 confirmation emails per hour. That's basically nothing. Brevo lets you send 300/hour for free. This is why you set it up.

### Step 10: Create a Brevo account
1. Go to **https://www.brevo.com**
2. Click **Sign up free** — use your email
3. Confirm your email when they send you a link
4. On the dashboard, complete the basic onboarding (company name, etc. — just fill it in)

### Step 11: Get your SMTP credentials
1. In Brevo, click your **account name** (top right) → **SMTP & API**
2. Click the **SMTP** tab
3. You'll see:
   - **SMTP Server:** `smtp-relay.brevo.com`
   - **Port:** `587`
   - **Login:** your Brevo account email
4. Under **SMTP Keys**, click **Generate a new SMTP key**
5. Give it a name like `nexus-key`
6. Copy the key — **save it immediately**, you won't see it again

### Step 12: Connect Brevo to Supabase
1. Go back to your **Supabase dashboard**
2. Click **Authentication** → **Settings** → scroll down to **SMTP Settings**
3. Toggle **Enable Custom SMTP** to ON
4. Fill in:
   - **Host:** `smtp-relay.brevo.com`
   - **Port:** `587`
   - **Username:** your Brevo email address
   - **Password:** the SMTP key you just generated
   - **Sender name:** `Nexus`
   - **Sender email:** your Brevo email (or a verified sender address in Brevo)
5. Click **Save**

### Step 13: Test the email flow
1. In Supabase → **Authentication** → **Settings**, scroll to **Email Templates**
2. Click **Confirm signup**
3. Click **Send test email** — enter any email you have access to
4. Check if it arrives. If it does, Brevo is connected correctly. ✅

> **Note:** If the test email doesn't arrive, check your spam folder first. If it's not there, double-check the SMTP credentials — most issues come from a wrong password or username.

---

## Part 4 — Railway (Main Deployment — Recommended ⭐)

Railway is the cleanest, fastest platform for deploying. It reads your GitHub repo, deploys automatically, gives you a free `.railway.app` URL, and restarts your app if it crashes.

### Step 14: Create a Railway account
1. Go to **https://railway.app**
2. Click **Login with GitHub** — this connects Railway to your code automatically
3. Allow the permissions it asks for

### Step 15: Deploy Nexus on Railway

Since Nexus is a pure HTML/CSS/JS app (no server needed), Railway will serve it as static files.

1. On your Railway dashboard, click **New Project**
2. Click **Deploy from GitHub repo**
3. Select your `nexus` repository
4. Railway will detect it and start deploying

**Important — Tell Railway it's a static site:**
1. Click on your project → click the **service** (your nexus deployment)
2. Click **Settings**
3. Under **Build**, set **Build Command** to: *(leave empty)*
4. Under **Start Command**, set it to:
   ```
   npx serve . -p $PORT
   ```
5. Under **Root Directory**, leave it as `/`

**Add Environment Variables:**
1. Click **Variables** tab
2. Add these two:
   - Key: `SUPABASE_URL` → Value: your Supabase project URL
   - Key: `SUPABASE_ANON_KEY` → Value: your Supabase anon key

> Wait — but the app.js has these hardcoded? Yes, for a static site the keys are in the frontend code. Environment variables here are for if you add a backend later. For now, just hardcode your Supabase URL and anon key directly into app.js (the anon key is safe to expose — it's designed to be public).

**Get your live URL:**
1. Click the **Deployments** tab — wait for it to say "Success" with a green tick
2. Click **Settings** → **Domains** → click **Generate domain**
3. You'll get a URL like `nexus-production.up.railway.app`
4. Open it in your browser — your app is live! 🎉

### Step 16: Auto-deployments
Every time you push new code to GitHub, Railway automatically redeploys. So your workflow is:
```bash
# Make a change to app.js or styles.css
git add .
git commit -m "updated something"
git push
# Railway picks it up and redeploys within ~30 seconds
```

---

## Part 5 — Vercel (Alternative Deployment)

Vercel is extremely popular for static websites and is very beginner-friendly. It's 100% free for static sites.

### Deploy to Vercel:
1. Go to **https://vercel.com** → Sign up with GitHub
2. Click **Add New** → **Project**
3. Import your `nexus` GitHub repository
4. Vercel auto-detects it's a static site
5. Under **Build & Output Settings**:
   - **Build Command:** *(leave empty)*
   - **Output Directory:** `.` (just a dot)
6. Click **Deploy**
7. In ~30 seconds you'll get a URL like `nexus.vercel.app`

**Custom domain on Vercel (free):**
- Settings → Domains → Add domain → type your custom domain if you have one
- Vercel gives free SSL automatically

---

## Part 6 — Render (Alternative Deployment)

You already know Render from your Telegram bots. For static sites it works the same way.

### Deploy to Render:
1. Go to **https://render.com** → Log in
2. Click **New +** → **Static Site**
3. Connect your GitHub → select the `nexus` repo
4. Fill in:
   - **Name:** `nexus`
   - **Build Command:** *(leave empty)*
   - **Publish Directory:** `.`
5. Click **Create Static Site**
6. Render builds and gives you `nexus.onrender.com`

> Unlike Render web services (which sleep after 15 min of inactivity), **static sites on Render never sleep.** They're always on.

---

## Part 7 — Two More Free Deployment Options

### Option 5: GitHub Pages (100% Free, No Account Needed Beyond GitHub)

GitHub itself can host your site for free. This is the simplest option of all.

1. Go to your `nexus` repository on GitHub
2. Click **Settings** → **Pages** (in the left sidebar)
3. Under **Source**, select **Deploy from a branch**
4. Under **Branch**, select `main` and folder `/` (root)
5. Click **Save**
6. Wait ~2 minutes, then visit: `https://YOUR_USERNAME.github.io/nexus`

That's literally it. No external account needed. Updates automatically when you push to GitHub.

> **Limitation:** GitHub Pages only works for truly static sites (no server-side code). Nexus qualifies perfectly since it's HTML/CSS/JS only.

---

### Option 6: Netlify (Free Tier — Drag and Drop or GitHub)

Netlify is arguably the easiest deployment in existence. You can literally drag your folder into a browser window.

**Method A — Drag and drop (no GitHub needed):**
1. Go to **https://app.netlify.com** → sign up free
2. On the dashboard, you'll see a box that says **"drag and drop your site folder here"**
3. Drag your entire `nexus` folder (with all 3 files) into that box
4. It deploys in 10 seconds and gives you a random URL like `romantic-curie-abc123.netlify.app`
5. You can rename it in Settings → Site information → Change site name

**Method B — Connect GitHub (auto-deploys like Railway):**
1. Netlify dashboard → **Add new site** → **Import an existing project**
2. Connect GitHub → select `nexus`
3. Build settings:
   - Build command: *(leave empty)*
   - Publish directory: `.`
4. Click **Deploy site**

---

## Summary: All 5 Platforms at a Glance

| Platform | Speed | Auto-deploy | Free URL | Best For |
|---|---|---|---|---|
| **Railway** ⭐ | Fast | ✅ Yes | `.railway.app` | Main choice — reliable, fast, scalable |
| **Vercel** | Very fast | ✅ Yes | `.vercel.app` | Frontend-focused, great DX |
| **Render** | Medium | ✅ Yes | `.onrender.com` | Already familiar to you |
| **GitHub Pages** | Medium | ✅ Yes | `github.io/nexus` | Simplest — no extra account |
| **Netlify** | Very fast | ✅ Yes | `.netlify.app` | Easiest drag-and-drop |

---

## Part 8 — Connecting Everything: The Full Flow

Here is the exact sequence from zero to live, start to finish:

```
Step 1  ─── Create GitHub account
Step 2  ─── Install Git on your computer
Step 3  ─── Create GitHub repo named "nexus"
Step 4  ─── Push your 3 files to GitHub
            git init → git add . → git commit -m "init" → git push

Step 5  ─── Create Supabase account at supabase.com
Step 6  ─── Create new Supabase project, copy URL + anon key
Step 7  ─── Run the SQL in Supabase SQL Editor (creates all tables)
Step 8  ─── Create "avatars" storage bucket in Supabase
Step 9  ─── Enable email confirmations in Supabase Auth settings

Step 10 ─── Create Brevo account at brevo.com
Step 11 ─── Generate SMTP key in Brevo dashboard
Step 12 ─── Paste Brevo credentials into Supabase SMTP settings
Step 13 ─── Send a test email — confirm it arrives

Step 14 ─── Paste your Supabase URL + anon key into app.js
            const SUPABASE_URL = 'https://your-id.supabase.co';
            const SUPABASE_ANON_KEY = 'eyJ...';

Step 15 ─── Uncomment the Supabase SDK in index.html:
            <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
            Then add below it:
            <script>
              const { createClient } = supabase;
              window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            </script>

Step 16 ─── Push updated code to GitHub
            git add . → git commit -m "added supabase keys" → git push

Step 17 ─── Create Railway account at railway.app
Step 18 ─── New Project → Deploy from GitHub → select nexus
Step 19 ─── Set Start Command: npx serve . -p $PORT
Step 20 ─── Generate domain in Settings → Domains
Step 21 ─── Open your .railway.app URL — app is live ✅

Step 22 ─── Test: sign up with a real email
            Check inbox for confirmation email (sent by Brevo)
            Click link → log in → you're in
```

---

## Common Mistakes and How to Fix Them

**"My email confirmation never arrives"**
→ Check Brevo SMTP credentials in Supabase — the most common issue is a wrong SMTP password. Regenerate the Brevo SMTP key and re-paste it.

**"Railway says build failed"**
→ Make sure your Start Command is exactly: `npx serve . -p $PORT` — the `$PORT` part is required, Railway assigns it dynamically.

**"I get a blank white page"**
→ Open your browser's developer tools (press F12) → Console tab → look for red errors. Most likely a path issue — make sure all 3 files are in the same folder.

**"Supabase says 'relation does not exist'"**
→ You didn't run the SQL yet, or it ran with errors. Go to SQL Editor in Supabase and run the SQL block from Step 7 again. Check that each statement ended without a red error.

**"Username check always says available"**
→ This is expected in demo mode. Once you connect the real Supabase client and query the `profiles` table, it will check live data.

**"Git push asks for a password and rejects mine"**
→ GitHub no longer accepts account passwords for git push. You need a Personal Access Token. Go to: GitHub → Settings → Developer settings → Personal access tokens → Generate new token → check `repo` scope → use that as your password.

---

## File Structure After Deployment

```
nexus/
├── index.html      ← Main HTML (references styles.css and app.js)
├── styles.css      ← All CSS — Nexus cyber glass aesthetic
├── app.js          ← All JS — auth, chat, pulse, profile logic
├── preview.html    ← Self-contained demo (all CSS+JS inline, no server needed)
└── README.md       ← This file
```

---

## Quick Reference: What Each File Does

**index.html** — The shell. Contains all the HTML structure: splash screen, login form, signup form (with the Vibe Word field), the 4-tab app layout (Chats, Groups, Status, Profile), the Pulse tab (unique feature), the chat view, and all modals (add status, create group, edit name).

**styles.css** — The look. Every pixel: the liquid glass cards, blue+red gradient system, Syne display font, Space Mono monospace, the bottom navigation bar, message bubbles, pulse animations, iOS 26-inspired frosted surfaces, and mobile-safe padding for notch devices.

**app.js** — The brain. Everything that runs: splash → auth → app flow, demo login (`demo@nexus.app` / `demo1234`), username availability check (with 500ms debounce), password strength meter (5 levels), vibe chip selection, chat list rendering, opening chats, sending/receiving messages (with simulated replies), the Pulse emoji blast system, status posting with duration picker, profile picture upload, name editing, and all modal logic.

---

*Built by @stainprojectss · Deploy it, make it yours.*
