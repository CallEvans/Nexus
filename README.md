```markdown
# 🔵 Nexus — Live Chat App

**Nexus** is a real‑time messaging experience wrapped in a glassmorphism cyber‑gen Z aesthetic.  
It’s fully connected to **Supabase** (auth, database, real‑time) and deployed on **Railway**.

---

## ✦ What Nexus Does

- **Instant Sign‑up & Login** — email + password, with a unique **Vibe Word** badge and permanent username.
- **Real‑time 1‑on‑1 Chats** — search any user by username, start a conversation, and messages appear instantly.
- **Group Chats** — create groups, add members by username, chat together in real time.
- **Status Updates** — post disappearing statuses (6h / 12h / 24h) that expire automatically.
- **Pulse Reactions** — blast live emoji reactions across all your chats simultaneously. Pure vibe.
- **Full Profile System** — edit your display name, vibe word, and upload a profile picture.
- **Glass‑cyber UI** — deep‑space backgrounds, frosted glass cards, gradient buttons, and custom fonts (Syne, DM Sans, Space Mono).
- **No Demo Data** — every conversation, group, and status is yours from the first second.

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, Vanilla JS |
| Backend / Auth | [Supabase](https://supabase.com) (Postgres + Auth + Realtime) |
| Emails | [Brevo SMTP](https://www.brevo.com) |
| Hosting | [Railway](https://railway.app) (auto‑deploy from GitHub) |

---

## 📁 Project Structure

```

nexus/
├── index.html        ← Full app UI (splash, auth, 5 tabs, chat view, modals)
├── styles.css        ← All glass‑cyber design tokens and responsive layout
├── app.js            ← Entire client‑side logic (auth, real‑time chat, groups, status, pulse)
├── package.json      ← Node dependencies (serve)
├── railway.json      ← Railway deployment configuration
├── .gitignore        ← Ignores node_modules, .env, etc.
└── README.md         ← You are here

```

---

## 🚀 Live Demo

The app is running at:  
**[https://nexus-site.up.railway.app](https://nexus-site.up.railway.app)**  

*No demo account needed — sign up with any email and start chatting immediately.*

---

## 🔧 How to Deploy Your Own Instance

### 1. Clone & push to GitHub

```bash
git clone https://github.com/YOUR_USERNAME/nexus.git
cd nexus
# (edit SUPABASE_URL and SUPABASE_ANON_KEY in index.html)
git add .
git commit -m "init"
git push origin main
```

2. Set up Supabase

1. Create a project at supabase.com.
2. Go to SQL Editor and run the schema from the deployment guide (tables: profiles, messages, statuses, groups, group_members).
3. Enable Storage → create a public bucket named avatars.
4. (Optional) Set up Brevo SMTP for custom email confirmations (see guide).

3. Deploy to Railway

· Connect your GitHub repo → Railway automatically builds and serves the static site using npx serve.
· No environment variables needed — credentials are hardcoded in index.html (anon key is safe).

---

📖 Full Deployment Guide

For a step‑by‑step walkthrough (including Brevo SMTP, database tables, and all platforms like Vercel/Render/Netlify), check the original README.md deployment section.

---

👤 The Creator

Built with fire by Stain — design, code, and vision.
Catch me everywhere:
🔗 linktr.ee/iamevanss

---

Nexus is where convos live. Now they’re yours.

```
