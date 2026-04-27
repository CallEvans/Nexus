/* ═══════════════════════════════════════════════════════
   NEXUS — app.js
   Full client-side logic (Supabase-ready, demo mode)
═══════════════════════════════════════════════════════ */

'use strict';

// ── CONFIG ─────────────────────────────────────────────
// Replace with your actual Supabase credentials
const SUPABASE_URL = 'https://vtduxnjfbxwfuvnboqgc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0ZHV4bmpmYnh3ZnV2bmJvcWdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMTI2MDYsImV4cCI6MjA5Mjg4ODYwNn0.65-ViVcecEbo7XCx4rOzLCL-g3eLztnQDSkja1l_nFM';

// ── STATE ──────────────────────────────────────────────
let currentUser = null;
let currentChat = null;
let selectedDuration = 6;
let usernameCheckTimer = null;
let activeTab = 'chats';
let pulseInterval = null;

// Demo data — replace with real Supabase queries
const DEMO_CHATS = [
  { id: 1, name: 'Adeola 🦋', preview: 'bro that was so funny lmaooo', time: '11:42', unread: 2, online: true, gradIdx: 1 },
  { id: 2, name: 'Tunde', preview: 'did u see the game??', time: '10:15', unread: 0, online: false, gradIdx: 3 },
  { id: 3, name: 'Zara ✨', preview: 'ok so listen to me rn', time: 'Yesterday', unread: 1, online: true, gradIdx: 6 },
  { id: 4, name: 'Dev Squad', preview: 'pushed the fix, check it', time: 'Yesterday', unread: 5, online: false, gradIdx: 5 },
  { id: 5, name: 'Kolade', preview: 'yooo whats the vibe tmrw', time: 'Mon', unread: 0, online: false, gradIdx: 4 },
  { id: 6, name: 'Precious 💅', preview: 'no way that happened', time: 'Sun', unread: 0, online: true, gradIdx: 7 },
];

const DEMO_GROUPS = [
  { id: 101, name: '🔥 Stain Projectss', preview: 'New feature dropped!', time: '09:33', unread: 12, gradIdx: 0, members: 847 },
  { id: 102, name: 'Night Shift 🌙', preview: 'who up rn', time: 'Yesterday', unread: 0, gradIdx: 2, members: 14 },
  { id: 103, name: 'Tech Nerds 💻', preview: 'React 19 is actually fire', time: 'Mon', unread: 3, gradIdx: 5, members: 38 },
];

const DEMO_STATUSES = [
  { name: 'Adeola 🦋', text: 'manifesting fr fr', time: '2h ago', expire: '4h left', gradIdx: 1 },
  { name: 'Zara ✨', text: 'healing era 🌸', time: '5h ago', expire: '7h left', gradIdx: 6 },
  { name: 'Precious 💅', text: 'nah this city is different tonight', time: '8h ago', expire: '16h left', gradIdx: 7 },
  { name: 'Tunde', text: 'busy but alive', time: '10h ago', expire: '2h left', gradIdx: 3 },
];

const DEMO_MESSAGES = [
  { id: 1, from: 'them', text: 'yoooo bro are u alive', time: '11:30', reactions: {} },
  { id: 2, from: 'me', text: 'barely lmao been coding since 3am', time: '11:31', reactions: {} },
  { id: 3, from: 'them', text: 'noooo why 😭 u need sleep', time: '11:32', reactions: { '😭': 1 } },
  { id: 4, from: 'me', text: 'the project is ALMOST done tho', time: '11:38', reactions: {} },
  { id: 5, from: 'them', text: 'bro that was so funny lmaooo', time: '11:42', reactions: { '🔥': 2 } },
];

// Existing usernames (simulates DB check)
const TAKEN_USERNAMES = ['stain', 'admin', 'nexus', 'user', 'test', 'ken', 'zara', 'adeola'];

// ── INIT ────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // After splash (2.9s), show auth
  setTimeout(() => {
    document.getElementById('splash').style.display = 'none';
    // Check if user is "logged in" (demo: check localStorage)
    const savedUser = localStorage.getItem('nexus_user');
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
      showApp();
    } else {
      showScreen('authScreen');
      showPanel('loginPanel');
    }
  }, 2900);
});

// ── SCREEN MANAGEMENT ───────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
}

function showPanel(id) {
  document.querySelectorAll('.auth-panel').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById(id);
  if (panel) {
    panel.classList.remove('hidden');
    panel.style.animation = 'none';
    requestAnimationFrame(() => { panel.style.animation = ''; });
  }
}

// ── AUTH ─────────────────────────────────────────────────
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');

  if (!email || !password) {
    showError(errEl, 'Please fill in all fields.');
    return;
  }

  // Demo login — replace with Supabase call:
  // const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (email === 'demo@nexus.app' && password === 'demo1234') {
    currentUser = { name: 'Ken', username: 'stain', email, vibe: 'chaotic' };
    localStorage.setItem('nexus_user', JSON.stringify(currentUser));
    showApp();
  } else {
    // Simulate success for any valid-looking email/pw combo (demo)
    if (email.includes('@') && password.length >= 6) {
      currentUser = { name: email.split('@')[0], username: email.split('@')[0].toLowerCase(), email, vibe: 'rare' };
      localStorage.setItem('nexus_user', JSON.stringify(currentUser));
      showApp();
    } else {
      showError(errEl, 'Invalid email or password.');
    }
  }
}

async function handleSignup() {
  const name = document.getElementById('signupName').value.trim();
  const username = document.getElementById('signupUsername').value.trim().toLowerCase();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirmPw = document.getElementById('signupConfirmPw').value;
  const vibe = document.getElementById('signupVibe').value.trim();
  const errEl = document.getElementById('signupError');
  const successEl = document.getElementById('signupSuccess');

  errEl.classList.add('hidden');
  successEl.classList.add('hidden');

  if (!name || !username || !email || !password || !confirmPw) {
    showError(errEl, 'Please fill in all fields.'); return;
  }
  if (password !== confirmPw) {
    showError(errEl, 'Passwords do not match.'); return;
  }
  if (password.length < 8) {
    showError(errEl, 'Password must be at least 8 characters.'); return;
  }
  if (TAKEN_USERNAMES.includes(username)) {
    showError(errEl, `@${username} is already taken. Choose another username.`); return;
  }
  if (!vibe) {
    showError(errEl, 'Pick your Vibe Word — it takes 2 seconds.'); return;
  }

  // Real Supabase signup:
  // const { data, error } = await supabase.auth.signUp({
  //   email, password,
  //   options: { data: { name, username, vibe } }
  // });

  // Demo: simulate success
  document.getElementById('confirmEmail').textContent = email;
  successEl.classList.remove('hidden');
  successEl.textContent = '✓ Account created! Check your email to confirm.';

  setTimeout(() => {
    showPanel('confirmPanel');
  }, 1200);
}

function handleLogout() {
  localStorage.removeItem('nexus_user');
  currentUser = null;
  stopPulseSimulation();
  showScreen('authScreen');
  showPanel('loginPanel');
  showToast('Signed out');
}

// ── USERNAME CHECK ────────────────────────────────────────
function checkUsername(val) {
  const statusEl = document.getElementById('usernameStatus');
  clearTimeout(usernameCheckTimer);

  if (!val) { statusEl.textContent = ''; statusEl.className = 'username-status'; return; }
  if (!/^[a-z0-9_]{3,20}$/.test(val.toLowerCase())) {
    statusEl.textContent = '✗ 3–20 chars, letters/numbers/_';
    statusEl.className = 'username-status taken';
    return;
  }

  statusEl.textContent = '...';
  statusEl.className = 'username-status checking';

  usernameCheckTimer = setTimeout(() => {
    // Real check: query supabase profiles table
    // const { data } = await supabase.from('profiles').select('username').eq('username', val).single();
    if (TAKEN_USERNAMES.includes(val.toLowerCase())) {
      statusEl.textContent = '✗ Taken';
      statusEl.className = 'username-status taken';
    } else {
      statusEl.textContent = '✓ Available';
      statusEl.className = 'username-status available';
    }
  }, 500);
}

// ── APP ───────────────────────────────────────────────────
function showApp() {
  showScreen('appScreen');
  updateProfileUI();
  renderChatList();
  renderGroupList();
  renderStatusList();
  switchTab('chats');
  startPulseSimulation();
}

function updateProfileUI() {
  if (!currentUser) return;
  const name = currentUser.name || 'User';
  const username = currentUser.username || 'anon';
  const vibe = currentUser.vibe || 'rare';

  document.getElementById('profileName').textContent = name;
  document.getElementById('profileUsername').textContent = `@${username}`;
  document.getElementById('profileVibeBadge').textContent = `✦ ${vibe}`;
  document.getElementById('settingsName').textContent = name;
  document.getElementById('settingsEmail').textContent = currentUser.email || '';
  document.getElementById('settingsVibe').textContent = vibe;

  // Profile fallback
  const initial = name.charAt(0).toUpperCase();
  ['profileFallback', 'myStatusFallback'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = initial; el.className = `avatar-fallback grad-${charGrad(initial)}`; }
  });
}

// ── RENDER ────────────────────────────────────────────────
function renderChatList() {
  const list = document.getElementById('chatList');
  list.innerHTML = '';
  DEMO_CHATS.forEach(chat => {
    list.appendChild(buildChatItem(chat, false));
  });
}

function renderGroupList() {
  const list = document.getElementById('groupList');
  list.innerHTML = '';
  DEMO_GROUPS.forEach(group => {
    list.appendChild(buildChatItem(group, true));
  });
}

function buildChatItem(data, isGroup) {
  const div = document.createElement('div');
  div.className = 'chat-item';
  div.onclick = () => openChat(data, isGroup);

  const initial = data.name.replace(/[^\w]/g,'').charAt(0).toUpperCase() || '?';
  const gradIdx = data.gradIdx ?? 0;
  const unreadHtml = data.unread > 0 ? `<div class="chat-unread">${data.unread}</div>` : '';
  const onlineDot = (!isGroup && data.online) ? '<div class="online-dot"></div>' : '';
  const memberTag = isGroup ? `<span class="status-expire">${data.members} members</span>` : '';

  div.innerHTML = `
    <div class="chat-avatar">
      <div class="avatar-fallback grad-${gradIdx}">${initial}</div>
      ${onlineDot}
    </div>
    <div class="chat-info">
      <div class="chat-name">${data.name}</div>
      <div class="chat-preview">${data.preview}</div>
    </div>
    <div class="chat-meta">
      <span class="chat-time">${data.time}</span>
      ${unreadHtml}
      ${memberTag}
    </div>
  `;
  return div;
}

function renderStatusList() {
  const list = document.getElementById('statusList');
  list.innerHTML = '';
  DEMO_STATUSES.forEach(s => {
    const initial = s.name.replace(/[^\w]/g,'').charAt(0).toUpperCase();
    const div = document.createElement('div');
    div.className = 'status-item';
    div.innerHTML = `
      <div class="status-ring">
        <div class="status-ring-inner">
          <div class="avatar-fallback grad-${s.gradIdx}" style="border-radius:50%;font-size:16px;font-family:var(--font-display);font-weight:700;color:white;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${initial}</div>
        </div>
      </div>
      <div>
        <div class="status-name">${s.name}</div>
        <div class="status-time">${s.text}</div>
      </div>
      <span class="status-expire">${s.expire}</span>
    `;
    list.appendChild(div);
  });
}

// ── CHAT VIEW ─────────────────────────────────────────────
function openChat(data, isGroup) {
  currentChat = data;
  document.getElementById('chatHeaderName').textContent = data.name;
  document.getElementById('chatHeaderStatus').textContent = isGroup ? `${data.members || ''} members` : (data.online ? 'online' : 'last seen recently');
  document.getElementById('chatHeaderStatus').style.color = (!isGroup && data.online) ? '#4ade80' : 'var(--text-secondary)';

  const initial = data.name.replace(/[^\w]/g,'').charAt(0).toUpperCase() || '?';
  const gradIdx = data.gradIdx ?? 0;
  const avEl = document.getElementById('chatAvatarFallback');
  avEl.textContent = initial;
  avEl.className = `avatar-fallback-sm grad-${gradIdx}`;

  renderMessages();
  showScreen('chatView');
  scrollToBottom();
}

function closeChatView() {
  showScreen('appScreen');
  document.getElementById('quickPulsePanel').classList.add('hidden');
}

function renderMessages() {
  const list = document.getElementById('messagesList');
  list.innerHTML = `<div class="date-divider"><span>Today</span></div>`;
  DEMO_MESSAGES.forEach(msg => appendMessage(msg));
}

function appendMessage(msg) {
  const list = document.getElementById('messagesList');
  const isMe = msg.from === 'me';
  const row = document.createElement('div');
  row.className = `msg-row ${isMe ? 'outgoing' : 'incoming'}`;

  let reactionsHtml = '';
  if (Object.keys(msg.reactions).length > 0) {
    reactionsHtml = '<div class="msg-pulse-reactions">';
    for (const [emoji, count] of Object.entries(msg.reactions)) {
      reactionsHtml += `<div class="msg-pulse-chip">${emoji}<span class="msg-pulse-count">${count}</span></div>`;
    }
    reactionsHtml += '</div>';
  }

  if (!isMe) {
    const initial = currentChat?.name.replace(/[^\w]/g,'').charAt(0).toUpperCase() || '?';
    const gradIdx = currentChat?.gradIdx ?? 0;
    row.innerHTML = `
      <div class="msg-avatar-mini grad-${gradIdx}">${initial}</div>
      <div>
        <div class="msg-bubble">${escapeHtml(msg.text)}</div>
        ${reactionsHtml}
        <span class="msg-time">${msg.time}</span>
      </div>
    `;
  } else {
    row.innerHTML = `
      <div>
        <div class="msg-bubble">${escapeHtml(msg.text)}</div>
        ${reactionsHtml}
        <span class="msg-time">${msg.time} ✓✓</span>
      </div>
    `;
  }
  list.appendChild(row);
}

function sendMessage() {
  const input = document.getElementById('msgInput');
  const text = input.value.trim();
  if (!text) return;

  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const msg = { id: Date.now(), from: 'me', text, time, reactions: {} };
  DEMO_MESSAGES.push(msg);
  appendMessage(msg);
  input.value = '';
  scrollToBottom();

  // Simulate reply
  setTimeout(() => {
    const replies = [
      'lol fr fr 💀', 'no wayyy', 'bro said that with his whole chest', 'ok actually tho', 'say less 🔥', 'yeah that checks out', 'bro wtf 😭', 'ur so real for that', 'ok fine i fw it', 'periodt'
    ];
    const reply = { id: Date.now(), from: 'them', text: replies[Math.floor(Math.random() * replies.length)], time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), reactions: {} };
    DEMO_MESSAGES.push(reply);
    appendMessage(reply);
    scrollToBottom();
  }, 1200 + Math.random() * 1500);
}

function handleMsgKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function scrollToBottom() {
  const container = document.getElementById('messagesContainer');
  setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
}

// ── PULSE SYSTEM (Unique Feature) ─────────────────────────
function sendChatPulse(emoji) {
  document.getElementById('quickPulsePanel').classList.add('hidden');
  fireFloatingPulse(emoji, document.getElementById('chatPulseLayer'));
  showToast(`Pulse ${emoji} sent to ${currentChat?.name || 'chat'}`);
}

function showQuickPulse() {
  const panel = document.getElementById('quickPulsePanel');
  panel.classList.toggle('hidden');
}

function fireFloatingPulse(emoji, layer) {
  const el = document.createElement('div');
  el.className = 'floating-pulse';
  el.textContent = emoji;
  el.style.left = (20 + Math.random() * 60) + '%';
  el.style.bottom = '80px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function blastPulse(emoji) {
  const feed = document.getElementById('pulseFeed');
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'pulse-feed-item';
      el.textContent = emoji;
      el.style.left = (10 + Math.random() * 75) + '%';
      el.style.bottom = '20px';
      feed.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    }, i * 200);
  }
  showToast(`Pulsed ${emoji} to all active chats`);
}

function startPulseSimulation() {
  const emojis = ['🔥', '💙', '😭', '⚡', '🥶', '💀', '✨', '🫀'];
  const feed = document.getElementById('pulseFeed');
  if (!feed) return;

  // Add label
  const label = document.createElement('div');
  label.className = 'pulse-feed-label';
  label.textContent = 'reactions from your contacts · live';
  feed.appendChild(label);

  pulseInterval = setInterval(() => {
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const el = document.createElement('div');
    el.className = 'pulse-feed-item';
    el.textContent = emoji;
    el.style.left = (5 + Math.random() * 82) + '%';
    el.style.bottom = '30px';
    feed.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
  }, 1800);
}

function stopPulseSimulation() {
  if (pulseInterval) { clearInterval(pulseInterval); pulseInterval = null; }
}

// ── TAB SWITCHING ─────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  const pages = ['chats', 'groups', 'status', 'profile', 'pulse'];
  pages.forEach(p => {
    const pg = document.getElementById(p + 'Page');
    const btn = document.getElementById('nav-' + p);
    if (pg) pg.classList.toggle('active', p === tab);
    if (btn) btn.classList.toggle('active', p === tab);
  });
  // Top bar visibility
  const topBar = document.querySelector('.top-bar');
  if (topBar) topBar.style.display = (tab === 'profile' || tab === 'pulse') ? 'none' : 'flex';
}

// ── STATUS ────────────────────────────────────────────────
function showAddStatus() {
  document.getElementById('statusModal').classList.remove('hidden');
}

function postStatus() {
  const text = document.getElementById('statusText').value.trim();
  if (!text) { showToast('Type something first'); return; }
  const newStatus = {
    name: currentUser?.name || 'You',
    text,
    time: 'just now',
    expire: `${selectedDuration}h left`,
    gradIdx: charGrad((currentUser?.name || 'U').charAt(0))
  };
  DEMO_STATUSES.unshift(newStatus);
  renderStatusList();
  closeModal('statusModal');
  document.getElementById('statusText').value = '';
  showToast(`Status posted · expires in ${selectedDuration}h`);
}

function setDuration(btn, hours) {
  selectedDuration = hours;
  document.querySelectorAll('.duration-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
}

// ── PROFILE ACTIONS ───────────────────────────────────────
function triggerAvatarUpload() {
  document.getElementById('avatarInput').click();
}

function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const src = e.target.result;
    // Real: upload to Supabase Storage, update profile
    document.getElementById('profileAvatar').src = src;
    document.getElementById('profileAvatar').style.display = 'block';
    document.getElementById('profileFallback').style.display = 'none';
    showToast('Profile picture updated');
  };
  reader.readAsDataURL(file);
}

function editName() {
  document.getElementById('newNameInput').value = currentUser?.name || '';
  document.getElementById('editNameModal').classList.remove('hidden');
}

function saveName() {
  const val = document.getElementById('newNameInput').value.trim();
  if (!val) { showToast('Name cannot be empty'); return; }
  if (currentUser) currentUser.name = val;
  localStorage.setItem('nexus_user', JSON.stringify(currentUser));
  updateProfileUI();
  closeModal('editNameModal');
  showToast('Name updated');
}

function editVibe() {
  const newVibe = prompt('Enter your new Vibe Word:');
  if (newVibe && newVibe.trim()) {
    if (currentUser) currentUser.vibe = newVibe.trim();
    localStorage.setItem('nexus_user', JSON.stringify(currentUser));
    updateProfileUI();
    showToast('Vibe updated ✦');
  }
}

function showNotifSettings() { showToast('Notification settings coming soon'); }
function showContactInfo() { showToast(`${currentChat?.name}`); }
function openSearch() { showToast('Search coming soon'); }
function openNewChat() { showToast('New chat coming soon'); }

// ── GROUPS ────────────────────────────────────────────────
function showCreateGroup() {
  document.getElementById('createGroupModal').classList.remove('hidden');
}

function createGroup() {
  const name = document.getElementById('groupNameInput').value.trim();
  if (!name) { showToast('Enter a group name'); return; }
  DEMO_GROUPS.unshift({ id: Date.now(), name, preview: 'Group created', time: 'now', unread: 0, gradIdx: Math.floor(Math.random() * 8), members: 1 });
  renderGroupList();
  closeModal('createGroupModal');
  showToast(`"${name}" created`);
  document.getElementById('groupNameInput').value = '';
}

// ── PASSWORD STRENGTH ──────────────────────────────────────
function checkPwStrength(pw) {
  const fill = document.getElementById('pwStrengthFill');
  const label = document.getElementById('pwStrengthLabel');
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const levels = [
    { pct: '0%', color: '', label: '' },
    { pct: '20%', color: '#FF4B6E', label: 'Weak' },
    { pct: '40%', color: '#f97316', label: 'Fair' },
    { pct: '65%', color: '#f59e0b', label: 'Good' },
    { pct: '80%', color: '#4ade80', label: 'Strong' },
    { pct: '100%', color: '#3B8BFF', label: 'Unbreakable ✦' },
  ];
  const lvl = levels[score];
  fill.style.width = lvl.pct;
  fill.style.background = lvl.color;
  label.textContent = lvl.label;
  label.style.color = lvl.color;
}

// ── VIBE CHIPS ────────────────────────────────────────────
function setVibe(btn) {
  document.querySelectorAll('.vibe-chip').forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('signupVibe').value = btn.textContent;
}

// ── FILTER ────────────────────────────────────────────────
function filterChats(q) {
  const items = document.querySelectorAll('#chatList .chat-item');
  items.forEach(item => {
    const name = item.querySelector('.chat-name')?.textContent.toLowerCase() || '';
    item.style.display = name.includes(q.toLowerCase()) ? '' : 'none';
  });
}

// ── MODALS ────────────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

// ── PW TOGGLE ────────────────────────────────────────────
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  btn.style.color = isPassword ? 'var(--blue)' : 'var(--text-muted)';
}

// ── TOAST ─────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  requestAnimationFrame(() => { toast.classList.add('show'); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2400);
}

// ── HELPERS ───────────────────────────────────────────────
function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.animation = 'none';
  requestAnimationFrame(() => { el.style.animation = 'panelIn 0.3s ease'; });
}

function charGrad(char) {
  return char ? (char.toUpperCase().charCodeAt(0) % 8) : 0;
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── GLOBAL CLICK HANDLER (close quick pulse) ──────────────
document.addEventListener('click', (e) => {
  const panel = document.getElementById('quickPulsePanel');
  if (panel && !panel.classList.contains('hidden')) {
    if (!e.target.closest('.quick-pulse-panel') && !e.target.closest('.pulse-quick-btn')) {
      panel.classList.add('hidden');
    }
  }
});

// ── SUPABASE INTEGRATION NOTES ────────────────────────────
/*
  TO CONNECT TO REAL SUPABASE:

  1. Add to <head>:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

  2. Initialize client:
     const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  3. Sign up:
     const { data, error } = await supabase.auth.signUp({
       email, password,
       options: { data: { name, username, vibe } }
     });
     // Brevo SMTP handles confirmation email (set in Supabase Dashboard > Auth > SMTP)

  4. Sign in:
     const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  5. Username uniqueness:
     const { data } = await supabase
       .from('profiles')
       .select('username')
       .eq('username', username)
       .single();
     // If data exists, username is taken

  6. Real-time chat (Supabase Realtime):
     const channel = supabase.channel('room:' + chatId)
       .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
         appendMessage(payload.new);
       }).subscribe();

  7. Status upload:
     await supabase.from('statuses').insert({
       user_id: currentUser.id,
       text: statusText,
       expires_at: new Date(Date.now() + selectedDuration * 3600000).toISOString()
     });

  8. Profile picture upload:
     const { data } = await supabase.storage
       .from('avatars')
       .upload(`${userId}/avatar.jpg`, file, { upsert: true });

  BREVO SMTP SETUP:
  - Supabase Dashboard → Authentication → Settings → SMTP
  - Host: smtp-relay.brevo.com
  - Port: 587
  - User: your Brevo login email
  - Password: your Brevo SMTP key
  → Sends up to 300 confirmation emails/hour (vs Supabase's 2/hr default)
*/
