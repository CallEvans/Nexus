# 🔵 Nexus
### *where convos live*

> A real-time chat web app with group messaging, status updates, live Pulse reactions, and a full profile system. Built with pure HTML/CSS/JS, powered by Supabase and Brevo SMTP.

---

## ✦ Features

- 🔐 **Real auth** — Supabase email/password signup with Brevo SMTP confirmation
- 💬 **1-on-1 chats** — find users by username, message in real time
- 👥 **Group chats** — create groups, add members by username
- 🟢 **Status updates** — post with 6h / 12h / 24h expiry
- ⚡ **Pulse** — live emoji reaction layer across all active chats
- 👤 **Profile** — avatar upload, display name editing, vibe word badge
- 🔒 **Username is permanent** — chosen once, never changed
- ✦ **Vibe Word** — a unique badge that describes your energy

---

## 📁 File Structure

```
nexus/
├── index.html       ← Full app UI + Supabase SDK + keys
├── styles.css       ← All styling — cyber glass aesthetic
├── app.js           ← All logic — auth, chat, realtime, profile
├── package.json     ← npm config for Railway (serve)
├── railway.json     ← Railway deployment config
└── .gitignore       ← Ignores node_modules, .env, logs
```

---

## 🚀 Deployment — Step by Step

### 1. GitHub

```bash
git init
git add .
git commit -m "nexus — initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nexus.git
git push -u origin main
```

> When Git asks for a password, use a **Personal Access Token** not your GitHub password.
> Get one at: GitHub → Settings → Developer settings → Personal access tokens → Generate new token → check `repo`

---

### 2. Supabase

1. Go to **https://supabase.com** → New project
2. Copy your **Project URL** and **anon public key** → paste into `index.html` (already done)
3. Go to **SQL Editor** → New query → run the SQL statements listed at the bottom of this README
4. **Storage** → New bucket → name it `avatars` → toggle **Public** → Save
5. **Authentication → Settings** → Enable email confirmations → ON
6. **Database → Replication** → enable `messages` table for Realtime

---

### 3. Brevo SMTP

1. Go to **https://www.brevo.com** → sign up free
2. Settings → Senders & IP → add and verify your sender email
3. Account → SMTP & API → SMTP tab → Generate a new SMTP key → copy it
4. Back in **Supabase → Authentication → Settings → SMTP Settings**:
   - Host: `smtp-relay.brevo.com`
   - Port: `587`
   - Username: your Brevo email
   - Password: your SMTP key
   - Sender name: `Nexus`
   - Sender email: your verified Brevo email
5. Save → Send test email → confirm it arrives ✅

---

### 4. Railway ⭐ (Recommended)

1. Go to **https://railway.app** → Login with GitHub
2. New Project → Deploy from GitHub repo → select `nexus`
3. Railway reads `railway.json` automatically — no extra config needed
4. Settings → Domains → Generate domain
5. Done — your app is live at `nexus-production.up.railway.app`

Every `git push` auto-redeploys. ✅

---

### 5. Other Free Platforms

| Platform | How |
|---|---|
| **Vercel** | vercel.com → Import GitHub repo → output dir: `.` → Deploy |
| **Netlify** | netlify.com → Drag & drop the `nexus` folder → instant deploy |
| **Render** | render.com → New Static Site → connect repo → publish dir: `.` |
| **GitHub Pages** | Repo → Settings → Pages → Branch: main → `/` → Save |

---

## 🔄 Every Future Update

```bash
git add .
git commit -m "what you changed"
git push
```

Railway redeploys in ~30 seconds automatically.

---

## ⚠️ Common Issues

| Problem | Fix |
|---|---|
| Confirmation email never arrives | Check Brevo SMTP credentials in Supabase — regenerate the SMTP key and re-paste |
| Login says "email not confirmed" | Click the link in your inbox first |
| Chat list is empty | You haven't messaged anyone yet — tap + to find a user |
| Username check always says available | Make sure the `profiles` table was created and RLS policies were applied |
| Railway deploy fails | Check that `package.json` has `"start": "npx serve . -p $PORT"` |
| Realtime messages not appearing | Enable the `messages` table in Supabase → Database → Replication |

---

## 🗄️ SQL — Run These in Supabase SQL Editor

Go to **Supabase → SQL Editor → New query**, paste everything below and click **Run**.

```sql
-- ── TABLES ──────────────────────────────────────────────

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  username text unique not null,
  vibe text default 'rare',
  avatar_url text,
  created_at timestamp with time zone default timezone('utc', now())
);

create table public.messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references auth.users on delete cascade not null,
  recipient_id uuid references auth.users on delete cascade,
  group_id uuid,
  text text not null,
  created_at timestamp with time zone default timezone('utc', now())
);

create table public.statuses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  text text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc', now())
);

create table public.groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  creator_id uuid references auth.users on delete cascade not null,
  created_at timestamp with time zone default timezone('utc', now())
);

create table public.group_members (
  group_id uuid references public.groups on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc', now()),
  primary key (group_id, user_id)
);


-- ── ROW LEVEL SECURITY ───────────────────────────────────

alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.statuses enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;


-- ── POLICIES ────────────────────────────────────────────

create policy "Anyone can view profiles"
  on public.profiles for select using (true);

create policy "Users insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users see own messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "Users send messages"
  on public.messages for insert with check (auth.uid() = sender_id);

create policy "View active statuses"
  on public.statuses for select using (expires_at > now());

create policy "Users post own status"
  on public.statuses for insert with check (auth.uid() = user_id);

create policy "Users delete own status"
  on public.statuses for delete using (auth.uid() = user_id);

create policy "Anyone can view groups"
  on public.groups for select using (true);

create policy "Logged in users create groups"
  on public.groups for insert with check (auth.uid() = creator_id);

create policy "Anyone can view group members"
  on public.group_members for select using (true);

create policy "Users join groups"
  on public.group_members for insert with check (auth.uid() = user_id);

create policy "Users leave groups"
  on public.group_members for delete using (auth.uid() = user_id);


-- ── AUTO-CREATE PROFILE ON SIGNUP ───────────────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, username, vibe)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'User'),
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'vibe', 'rare')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

> If you see an error like `relation already exists` it means you already ran this before — that's fine, ignore it.

---

<br/>

---

<div align="center">

Built by **Stain & Stain Projects**

[![Telegram](https://img.shields.io/badge/Telegram-@stainprojectss-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/stainprojectss)
&nbsp;
[![Linktree](https://img.shields.io/badge/Linktree-iamevanss-39E09B?style=for-the-badge&logo=linktree&logoColor=white)](https://linktr.ee/iamevanss)

</div>
