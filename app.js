'use strict';

// ═══════════════════════════════════════════════════════
// NEXUS — app.js (Supabase Live)
// ═══════════════════════════════════════════════════════

let currentUser = null;
let currentChat = null;          // { id, username, name, ... } for 1-on-1 or group
let currentChatType = 'user';    // 'user' or 'group'
let selectedDuration = 6;
let usernameCheckTimer = null;
let activeTab = 'chats';
let pulseInterval = null;
let messagesSubscription = null; // Realtime channel

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.getElementById('splash').style.display = 'none';
    const savedUser = localStorage.getItem('nexus_user');
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
      // Validate session still alive
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          showApp();
        } else {
          localStorage.removeItem('nexus_user');
          currentUser = null;
          showScreen('authScreen');
          showPanel('loginPanel');
        }
      });
    } else {
      showScreen('authScreen');
      showPanel('loginPanel');
    }
  }, 2900);
});

// ═══════════════════════════════════════════════
// SCREEN / PANEL MANAGEMENT
// ═══════════════════════════════════════════════
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

// ═══════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  if (!email || !password) { showError(errEl, 'All fields required.'); return; }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { showError(errEl, error.message); return; }

  const { data: profile, error: profileErr } = await supabase
    .from('profiles').select('*').eq('id', data.user.id).single();
  if (profileErr || !profile) { showError(errEl, 'Profile not found.'); return; }

  currentUser = { id: data.user.id, name: profile.name, username: profile.username, email: data.user.email, vibe: profile.vibe };
  localStorage.setItem('nexus_user', JSON.stringify(currentUser));
  showApp();
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
  errEl.classList.add('hidden'); successEl.classList.add('hidden');

  if (!name || !username || !email || !password || !confirmPw) { showError(errEl, 'All fields required.'); return; }
  if (password !== confirmPw) { showError(errEl, 'Passwords do not match.'); return; }
  if (password.length < 8) { showError(errEl, 'Password must be at least 8 characters.'); return; }
  if (!vibe) { showError(errEl, 'Pick your Vibe Word.'); return; }

  // Real username check
  const { data: taken } = await supabase.from('profiles').select('username').eq('username', username).single();
  if (taken) { showError(errEl, `@${username} is already taken.`); return; }

  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { name, username, vibe } }
  });
  if (error) { showError(errEl, error.message); return; }

  const user = data.user;
  if (user) {
    // Insert profile (email confirmation is off, so user exists immediately)
    const { error: profileErr } = await supabase.from('profiles').insert({
      id: user.id, name, username, vibe
    });
    if (profileErr) { showError(errEl, profileErr.message); return; }

    currentUser = { id: user.id, name, username, email, vibe };
    localStorage.setItem('nexus_user', JSON.stringify(currentUser));
    showApp();
  } else {
    // Confirmation required (should not happen with email confirm off, but handle gracefully)
    document.getElementById('confirmEmail').textContent = email;
    successEl.classList.remove('hidden');
    successEl.textContent = '✓ Check your inbox.';
    setTimeout(() => showPanel('confirmPanel'), 1200);
  }
}

async function handleLogout() {
  await supabase.auth.signOut();
  localStorage.removeItem('nexus_user');
  currentUser = null;
  stopPulseSimulation();
  showScreen('authScreen');
  showPanel('loginPanel');
}

// ═══════════════════════════════════════════════
// USERNAME CHECK (live)
// ═══════════════════════════════════════════════
function checkUsername(val) {
  const statusEl = document.getElementById('usernameStatus');
  clearTimeout(usernameCheckTimer);
  if (!val) { statusEl.textContent = ''; statusEl.className = 'username-status'; return; }
  if (!/^[a-z0-9_]{3,20}$/.test(val.toLowerCase())) {
    statusEl.textContent = '✗ 3–20 chars'; statusEl.className = 'username-status taken'; return;
  }
  statusEl.textContent = '...'; statusEl.className = 'username-status checking';
  usernameCheckTimer = setTimeout(async () => {
    const { data } = await supabase.from('profiles').select('username').eq('username', val.toLowerCase()).single();
    statusEl.textContent = data ? '✗ Taken' : '✓ Available';
    statusEl.className = 'username-status ' + (data ? 'taken' : 'available');
  }, 500);
}

// ═══════════════════════════════════════════════
// APP LAUNCH
// ═══════════════════════════════════════════════
async function showApp() {
  showScreen('appScreen');
  updateProfileUI();
  await Promise.all([renderChatList(), renderGroupList(), renderStatusList()]);
  switchTab(activeTab || 'chats');
  startPulseSimulation();
}

function updateProfileUI() {
  if (!currentUser) return;
  const { name, username, vibe, email } = currentUser;
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileUsername').textContent = `@${username}`;
  document.getElementById('profileVibeBadge').textContent = `✦ ${vibe}`;
  document.getElementById('settingsName').textContent = name;
  document.getElementById('settingsEmail').textContent = email;
  document.getElementById('settingsVibe').textContent = vibe;
  document.getElementById('settingsUsername').textContent = username;
  const initial = name.charAt(0).toUpperCase();
  ['profileFallback', 'myStatusFallback'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = initial; el.className = `avatar-fallback grad-${charGrad(initial)}`; }
  });
  // Stats (approximate)
  updateStats();
}

async function updateStats() {
  if (!currentUser) return;
  // count distinct contacts (people you've chatted with)
  const { data: contacts } = await supabase
    .from('messages')
    .select('sender_id, recipient_id')
    .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`);
  const distinctUserIds = new Set();
  contacts?.forEach(m => {
    if (m.sender_id !== currentUser.id) distinctUserIds.add(m.sender_id);
    if (m.recipient_id !== currentUser.id && m.recipient_id !== null) distinctUserIds.add(m.recipient_id);
  });
  document.getElementById('statContacts').textContent = distinctUserIds.size;
  document.getElementById('statChats').textContent = distinctUserIds.size; // same for now
  const { count: groupCount } = await supabase
    .from('group_members').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
  document.getElementById('statGroups').textContent = groupCount || 0;
}

// ═══════════════════════════════════════════════
// CHATS LIST (real conversations)
// ═══════════════════════════════════════════════
async function renderChatList() {
  const list = document.getElementById('chatList');
  list.innerHTML = '';
  if (!currentUser) return;

  // Get all messages where I'm involved, group by partner
  const { data: msgs } = await supabase
    .from('messages')
    .select('sender_id, recipient_id, text, created_at')
    .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
    .order('created_at', { ascending: false });

  // Build a map of partner_id -> latest message
  const partnerMap = new Map();
  msgs?.forEach(msg => {
    const isGroup = msg.group_id != null; // skip group messages for now (handled in groups)
    if (msg.group_id) return;
    const partnerId = msg.sender_id === currentUser.id ? msg.recipient_id : msg.sender_id;
    if (!partnerId) return;
    if (!partnerMap.has(partnerId) || msg.created_at > partnerMap.get(partnerId).created_at) {
      partnerMap.set(partnerId, { text: msg.text, time: msg.created_at, unread: msg.sender_id !== currentUser.id ? 1 : 0 }); // simplistic unread
    }
  });

  // Fetch profile details for each partner
  const partnerIds = Array.from(partnerMap.keys());
  if (partnerIds.length === 0) {
    list.innerHTML = '<div class="chat-preview" style="padding:16px;text-align:center">No conversations yet. Tap + to start one.</div>';
    return;
  }
  const { data: profiles } = await supabase.from('profiles').select('*').in('id', partnerIds);
  profiles?.forEach(profile => {
    const preview = partnerMap.get(profile.id);
    const unread = preview?.unread || 0;
    const timeStr = timeAgo(preview?.time);
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.onclick = () => openChat({ id: profile.id, name: profile.name, username: profile.username, vibe: profile.vibe }, 'user');
    const initial = profile.name.charAt(0).toUpperCase();
    const gradIdx = charGrad(initial);
    div.innerHTML = `
      <div class="chat-avatar">
        <div class="avatar-fallback grad-${gradIdx}">${initial}</div>
      </div>
      <div class="chat-info">
        <div class="chat-name">${profile.name}</div>
        <div class="chat-preview">${preview?.text || ''}</div>
      </div>
      <div class="chat-meta">
        <span class="chat-time">${timeStr}</span>
        ${unread ? `<div class="chat-unread">${unread}</div>` : ''}
      </div>
    `;
    list.appendChild(div);
  });
}

// ═══════════════════════════════════════════════
// GROUPS LIST
// ═══════════════════════════════════════════════
async function renderGroupList() {
  const list = document.getElementById('groupList');
  list.innerHTML = '';
  if (!currentUser) return;
  const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', currentUser.id);
  if (!memberships?.length) return;
  const groupIds = memberships.map(m => m.group_id);
  const { data: groups } = await supabase.from('groups').select('*').in('id', groupIds);
  groups?.forEach(group => {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.onclick = () => openChat({ id: group.id, name: group.name, members: [] }, 'group');
    const initial = group.name.charAt(0).toUpperCase();
    div.innerHTML = `
      <div class="chat-avatar">
        <div class="avatar-fallback grad-${charGrad(initial)}">${initial}</div>
      </div>
      <div class="chat-info">
        <div class="chat-name">${group.name}</div>
        <div class="chat-preview">Tap to open</div>
      </div>
      <div class="chat-meta"></div>
    `;
    list.appendChild(div);
  });
}

// ═══════════════════════════════════════════════
// STATUS LIST
// ═══════════════════════════════════════════════
async function renderStatusList() {
  const list = document.getElementById('statusList');
  list.innerHTML = '';
  const { data: statuses } = await supabase.from('statuses').select('*, profiles(name)').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
  statuses?.forEach(s => {
    const name = s.profiles?.name || 'Unknown';
    const initial = name.charAt(0).toUpperCase();
    const div = document.createElement('div');
    div.className = 'status-item';
    div.innerHTML = `
      <div class="status-ring">
        <div class="status-ring-inner">
          <div class="avatar-fallback grad-${charGrad(initial)}" style="border-radius:50%;font-size:16px;...">${initial}</div>
        </div>
      </div>
      <div>
        <div class="status-name">${name}</div>
        <div class="status-time">${s.text}</div>
      </div>
      <span class="status-expire">${timeRemaining(s.expires_at)}</span>
    `;
    list.appendChild(div);
  });
}

// ═══════════════════════════════════════════════
// OPEN CHAT (user or group)
// ═══════════════════════════════════════════════
function openChat(data, type) {
  currentChat = data;
  currentChatType = type;
  document.getElementById('chatHeaderName').textContent = data.name;
  document.getElementById('chatHeaderStatus').textContent = type === 'group' ? 'Group' : 'online';
  const initial = data.name.charAt(0).toUpperCase();
  document.getElementById('chatAvatarFallback').textContent = initial;
  document.getElementById('chatAvatarFallback').className = `avatar-fallback-sm grad-${charGrad(initial)}`;
  renderMessages();
  showScreen('chatView');
  subscribeToMessages();
}

function closeChatView() {
  unsubscribeMessages();
  showScreen('appScreen');
  document.getElementById('quickPulsePanel').classList.add('hidden');
}

// ═══════════════════════════════════════════════
// MESSAGES (load + subscribe)
// ═══════════════════════════════════════════════
async function renderMessages() {
  const list = document.getElementById('messagesList');
  list.innerHTML = '';
  let query = supabase.from('messages').select('*').order('created_at', { ascending: true });
  if (currentChatType === 'user') {
    query = query.or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${currentChat.id}),and(sender_id.eq.${currentChat.id},recipient_id.eq.${currentUser.id})`);
  } else {
    query = query.eq('group_id', currentChat.id);
  }
  const { data: messages } = await query;
  messages?.forEach(msg => appendMessage(msg, false));
  scrollToBottom();
}

function subscribeToMessages() {
  unsubscribeMessages();
  let filter;
  if (currentChatType === 'user') {
    filter = `sender_id=eq.${currentUser.id},recipient_id=eq.${currentChat.id}`;
    // Simplified: we can subscribe to both directions with separate channels, but for simplicity subscribe to all messages and filter client-side.
    // Better approach: use a channel that listens to INSERT on messages with a server-side filter.
    // Supabase Realtime doesn't support OR filter directly, so we'll listen to both conditions via two channels.
    const channel1 = supabase.channel('user-msg-1')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${currentUser.id}` }, payload => {
        if (payload.new.recipient_id === currentChat.id) appendMessage(payload.new, true);
      }).subscribe();
    const channel2 = supabase.channel('user-msg-2')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${currentChat.id}` }, payload => {
        if (payload.new.recipient_id === currentUser.id) appendMessage(payload.new, true);
      }).subscribe();
    messagesSubscription = [channel1, channel2];
  } else {
    const channel = supabase.channel('group-msg')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${currentChat.id}` }, payload => {
        appendMessage(payload.new, true);
      }).subscribe();
    messagesSubscription = [channel];
  }
}

function unsubscribeMessages() {
  if (messagesSubscription) {
    messagesSubscription.forEach(c => supabase.removeChannel(c));
    messagesSubscription = null;
  }
}

function appendMessage(msg, scroll = true) {
  const list = document.getElementById('messagesList');
  const isMe = msg.sender_id === currentUser.id;
  const row = document.createElement('div');
  row.className = `msg-row ${isMe ? 'outgoing' : 'incoming'}`;
  const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (!isMe) {
    // In a group, show sender name? For simplicity, show avatar initial.
    const initial = currentChat?.name?.charAt(0).toUpperCase() || '?';
    row.innerHTML = `
      <div class="msg-avatar-mini grad-${charGrad(initial)}">${initial}</div>
      <div>
        <div class="msg-bubble">${escapeHtml(msg.text)}</div>
        <span class="msg-time">${time}</span>
      </div>
    `;
  } else {
    row.innerHTML = `
      <div>
        <div class="msg-bubble">${escapeHtml(msg.text)}</div>
        <span class="msg-time">${time} ✓✓</span>
      </div>
    `;
  }
  list.appendChild(row);
  if (scroll) scrollToBottom();
}

async function sendMessage() {
  const input = document.getElementById('msgInput');
  const text = input.value.trim();
  if (!text || !currentChat) return;
  const msg = {
    sender_id: currentUser.id,
    recipient_id: currentChatType === 'user' ? currentChat.id : null,
    group_id: currentChatType === 'group' ? currentChat.id : null,
    text
  };
  const { error } = await supabase.from('messages').insert(msg);
  if (error) { showToast('Send failed'); console.error(error); return; }
  input.value = '';
}

// ═══════════════════════════════════════════════
// NEW CHAT SEARCH
// ═══════════════════════════════════════════════
function openNewChatSearch() {
  document.getElementById('newChatModal').classList.remove('hidden');
  document.getElementById('searchUsernameInput').focus();
}

async function searchUsername(query) {
  const resultsDiv = document.getElementById('searchResults');
  if (!query.trim()) { resultsDiv.innerHTML = ''; return; }
  const { data } = await supabase.from('profiles').select('*').ilike('username', `%${query}%`).neq('id', currentUser.id).limit(5);
  resultsDiv.innerHTML = data?.map(p => `
    <div class="chat-item" onclick="startChatWith('${p.id}', '${p.name.replace(/'/g, "\\'")}', '${p.username}')" style="cursor:pointer;margin:4px 0;">
      <div class="chat-avatar"><div class="avatar-fallback grad-${charGrad(p.name.charAt(0))}">${p.name.charAt(0).toUpperCase()}</div></div>
      <div class="chat-info">
        <div class="chat-name">${p.name}</div>
        <div class="chat-preview">@${p.username} · ${p.vibe}</div>
      </div>
    </div>
  `).join('') || '<div class="chat-preview" style="padding:8px">No users found</div>';
}

function startChatWith(userId, name, username) {
  closeModal('newChatModal');
  openChat({ id: userId, name, username }, 'user');
}

// ═══════════════════════════════════════════════
// CREATE GROUP
// ═══════════════════════════════════════════════
function showCreateGroup() {
  document.getElementById('createGroupModal').classList.remove('hidden');
}

async function createGroup() {
  const name = document.getElementById('groupNameInput').value.trim();
  const membersRaw = document.getElementById('groupMembersInput').value.trim();
  if (!name) { showToast('Group name required'); return; }
  const usernames = membersRaw.split(',').map(s => s.trim()).filter(Boolean);
  // Create group
  const { data: group, error } = await supabase.from('groups').insert({ name, creator_id: currentUser.id }).select().single();
  if (error) { showToast('Group creation failed'); return; }
  // Add creator
  await supabase.from('group_members').insert({ group_id: group.id, user_id: currentUser.id });
  // Add members by username
  for (const uname of usernames) {
    const { data: user } = await supabase.from('profiles').select('id').eq('username', uname).single();
    if (user) {
      await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id });
    }
  }
  closeModal('createGroupModal');
  renderGroupList();
  showToast(`Group "${name}" created`);
  document.getElementById('groupNameInput').value = '';
  document.getElementById('groupMembersInput').value = '';
}

// ═══════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════
async function postStatus() {
  const text = document.getElementById('statusText').value.trim();
  if (!text) { showToast('Type something'); return; }
  const expires = new Date(Date.now() + selectedDuration * 3600 * 1000).toISOString();
  const { error } = await supabase.from('statuses').insert({ user_id: currentUser.id, text, expires_at: expires });
  if (error) { showToast('Error posting status'); return; }
  closeModal('statusModal');
  renderStatusList();
  showToast(`Status posted · ${selectedDuration}h`);
  document.getElementById('statusText').value = '';
}

// ═══════════════════════════════════════════════
// UTILITY FUNCTIONS (unchanged from original, adapted)
// ═══════════════════════════════════════════════
function handleMsgKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }
function scrollToBottom() { setTimeout(() => { const c = document.getElementById('messagesContainer'); if (c) c.scrollTop = c.scrollHeight; }, 50); }
function setDuration(btn, hours) { selectedDuration = hours; document.querySelectorAll('.duration-chip').forEach(c => c.classList.remove('active')); btn.classList.add('active'); }
function triggerAvatarUpload() { document.getElementById('avatarInput').click(); }
function handleAvatarUpload(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('profileAvatar').src = e.target.result;
    document.getElementById('profileAvatar').style.display = 'block';
    document.getElementById('profileFallback').style.display = 'none';
    showToast('Profile picture updated (local)');
  };
  reader.readAsDataURL(file);
}
function editName() { document.getElementById('newNameInput').value = currentUser?.name || ''; document.getElementById('editNameModal').classList.remove('hidden'); }
async function saveName() {
  const val = document.getElementById('newNameInput').value.trim();
  if (!val) { showToast('Name cannot be empty'); return; }
  const { error } = await supabase.from('profiles').update({ name: val }).eq('id', currentUser.id);
  if (error) { showToast('Update failed'); return; }
  currentUser.name = val;
  localStorage.setItem('nexus_user', JSON.stringify(currentUser));
  updateProfileUI();
  closeModal('editNameModal');
  showToast('Name updated');
}
async function editVibe() {
  const newVibe = prompt('Enter new Vibe Word:');
  if (!newVibe?.trim()) return;
  await supabase.from('profiles').update({ vibe: newVibe }).eq('id', currentUser.id);
  currentUser.vibe = newVibe;
  localStorage.setItem('nexus_user', JSON.stringify(currentUser));
  updateProfileUI();
  showToast('Vibe updated ✦');
}
function showNotifSettings() { showToast('Coming soon'); }
function showContactInfo() { showToast(currentChat?.name); }
function openSearch() { showToast('Search coming soon'); }
function showAddStatus() { document.getElementById('statusModal').classList.remove('hidden'); }

// ═══════════════════════════════════════════════
// PULSE (unchanged simulation)
// ═══════════════════════════════════════════════
function blastPulse(emoji) {
  const feed = document.getElementById('pulseFeed');
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const el = document.createElement('div'); el.className = 'pulse-feed-item'; el.textContent = emoji;
      el.style.left = (10 + Math.random() * 75) + '%'; el.style.bottom = '20px';
      feed.appendChild(el); setTimeout(() => el.remove(), 4000);
    }, i * 200);
  }
  showToast(`Pulsed ${emoji}`);
}
function sendChatPulse(emoji) {
  document.getElementById('quickPulsePanel').classList.add('hidden');
  const layer = document.getElementById('chatPulseLayer');
  const el = document.createElement('div'); el.className = 'floating-pulse'; el.textContent = emoji;
  el.style.left = (20 + Math.random() * 60) + '%'; el.style.bottom = '80px';
  layer.appendChild(el); setTimeout(() => el.remove(), 3000);
  showToast(`Pulse ${emoji} sent`);
}
function showQuickPulse() { document.getElementById('quickPulsePanel').classList.toggle('hidden'); }
function startPulseSimulation() {
  stopPulseSimulation();
  const feed = document.getElementById('pulseFeed'); if (!feed) return;
  if (!feed.querySelector('.pulse-feed-label')) {
    const label = document.createElement('div'); label.className = 'pulse-feed-label'; label.textContent = 'reactions from your contacts · live'; feed.appendChild(label);
  }
  const emojis = ['🔥','💙','😭','⚡','🥶','💀','✨','🫀'];
  pulseInterval = setInterval(() => {
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const el = document.createElement('div'); el.className = 'pulse-feed-item'; el.textContent = emoji;
    el.style.left = (5 + Math.random() * 82) + '%'; el.style.bottom = '30px';
    feed.appendChild(el); setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
  }, 1800);
}
function stopPulseSimulation() { if (pulseInterval) { clearInterval(pulseInterval); pulseInterval = null; } }

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function timeAgo(date) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(date).toLocaleDateString();
}
function timeRemaining(expires) {
  const diff = new Date(expires) - Date.now();
  if (diff <= 0) return 'expired';
  const h = Math.floor(diff / 3600000);
  return `${h}h left`;
}
function showError(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.style.color = input.type === 'text' ? 'var(--blue)' : 'var(--text-muted)';
}
function showToast(msg) { /* unchanged */ }
function charGrad(c) { return c ? (c.toUpperCase().charCodeAt(0) % 8) : 0; }
function escapeHtml(text) { return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function switchTab(tab) {
  activeTab = tab;
  ['chats','groups','status','profile','pulse'].forEach(p => {
    document.getElementById(p + 'Page').classList.toggle('active', p === tab);
    document.getElementById('nav-' + p).classList.toggle('active', p === tab);
  });
  document.querySelector('.top-bar').style.display = (tab === 'profile' || tab === 'pulse') ? 'none' : 'flex';
}
function filterChats(q) {
  document.querySelectorAll('#chatList .chat-item').forEach(item => {
    item.style.display = item.querySelector('.chat-name')?.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

// ═══════════════════════════════════════════════
// TOAST (re-include to be self-contained)
// ═══════════════════════════════════════════════
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  requestAnimationFrame(() => toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2400);
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.quick-pulse-panel') && !e.target.closest('.pulse-quick-btn')) {
    document.getElementById('quickPulsePanel')?.classList.add('hidden');
  }
});

// ═══════════════════════════════════════════════
// PASSWORD STRENGTH (unchanged)
// ═══════════════════════════════════════════════
function checkPwStrength(pw) {
  const fill = document.getElementById('pwStrengthFill');
  const label = document.getElementById('pwStrengthLabel');
  let score = 0;
  if (pw.length >= 8) score++; if (pw.length >= 12) score++; if (/[A-Z]/.test(pw)) score++; if (/[0-9]/.test(pw)) score++; if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { pct:'0%', color:'', label:'' }, { pct:'20%', color:'#FF4B6E', label:'Weak' }, { pct:'40%', color:'#f97316', label:'Fair' },
    { pct:'65%', color:'#f59e0b', label:'Good' }, { pct:'80%', color:'#4ade80', label:'Strong' }, { pct:'100%', color:'#3B8BFF', label:'Unbreakable ✦' }
  ];
  const lvl = levels[score]; fill.style.width = lvl.pct; fill.style.background = lvl.color; label.textContent = lvl.label; label.style.color = lvl.color;
}
function setVibe(btn) { document.querySelectorAll('.vibe-chip').forEach(c => c.classList.remove('selected')); btn.classList.add('selected'); document.getElementById('signupVibe').value = btn.textContent; }
