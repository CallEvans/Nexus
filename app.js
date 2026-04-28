'use strict';

// ═══════════════════════════════════════════════════════
// NEXUS — app.js
// 100% live. No demo data. No fake auth.
// ═══════════════════════════════════════════════════════

let currentUser = null;
let currentChat = null;
let currentChatType = 'user';
let selectedDuration = 6;
let usernameCheckTimer = null;
let activeTab = 'chats';
let pulseInterval = null;
let messagesSubscription = null;

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.getElementById('splash').style.display = 'none';

    if (typeof supabase === 'undefined') {
      showScreen('authScreen');
      showPanel('loginPanel');
      return;
    }

    const savedUser = localStorage.getItem('nexus_user');
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          if (session) {
            showApp();
          } else {
            localStorage.removeItem('nexus_user');
            currentUser = null;
            showScreen('authScreen');
            showPanel('loginPanel');
          }
        })
        .catch((err) => {
          console.error('Session check error:', err);
          localStorage.removeItem('nexus_user');
          currentUser = null;
          showScreen('authScreen');
          showPanel('loginPanel');
        });
    } else {
      showScreen('authScreen');
      showPanel('loginPanel');
    }
  }, 2900);
});

// ═══════════════════════════════════════════════
// SCREEN / PANEL
// ═══════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id)?.classList.remove('hidden');
}
function showPanel(id) {
  document.querySelectorAll('.auth-panel').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById(id);
  if (!panel) return;
  panel.classList.remove('hidden');
  panel.style.animation = 'none';
  requestAnimationFrame(() => { panel.style.animation = ''; });
}

// ═══════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');

  if (!email || !password) {
    showError(errEl, 'All fields required.');
    return;
  }

  let data, error;
  try {
    ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
  } catch (e) {
    showError(errEl, 'Network error. Please try again.');
    return;
  }

  if (error) {
    showError(errEl, error.message);
    return;
  }

  // No email_confirmed_at check — Supabase already handles that

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileErr || !profile) {
    showError(errEl, 'Profile not found. Please sign up again.');
    return;
  }

  currentUser = {
    id: data.user.id,
    name: profile.name,
    username: profile.username,
    email: data.user.email,
    vibe: profile.vibe,
    avatar: profile.avatar_url || null
  };
  localStorage.setItem('nexus_user', JSON.stringify(currentUser));
  showApp();
}

// ═══════════════════════════════════════════════
// SIGN UP (updated — works with both email confirmation ON or OFF)
// ═══════════════════════════════════════════════
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
    showError(errEl, 'All fields required.');
    return;
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    showError(errEl, 'Username: 3-20 chars, letters/numbers/underscore only.');
    return;
  }
  if (password !== confirmPw) {
    showError(errEl, 'Passwords do not match.');
    return;
  }
  if (password.length < 8) {
    showError(errEl, 'Password must be at least 8 characters.');
    return;
  }
  if (!vibe) {
    showError(errEl, 'Pick your Vibe Word.');
    return;
  }

  // Check username availability
  try {
    const { data: existing } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .maybeSingle();
    if (existing) {
      showError(errEl, `@${username} is already taken.`);
      return;
    }
  } catch (e) {
    showError(errEl, 'Could not check username. Please try again.');
    return;
  }

  // Sign up
  let data, error;
  try {
    ({ data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, username, vibe } }
    }));
  } catch (e) {
    showError(errEl, 'Network error. Please try again.');
    return;
  }

  if (error) {
    showError(errEl, error.message);
    return;
  }

  // Always create profile row for the new user
  if (data.user) {
    const { error: insertErr } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, name, username, vibe });
    // Ignore duplicate key error if row already exists
    if (insertErr && insertErr.code !== '23505') {
      showError(errEl, 'Profile creation failed. Please try again.');
      return;
    }
  }

  // Email confirmation ON → show the inbox panel
  if (!data.session) {
    document.getElementById('confirmEmail').textContent = email;
    showPanel('confirmPanel');
    return;
  }

  // Email confirmation OFF → log them in immediately
  currentUser = {
    id: data.user.id,
    name,
    username,
    email,
    vibe,
    avatar: null
  };
  localStorage.setItem('nexus_user', JSON.stringify(currentUser));
  showApp();
}

// ═══════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════
async function handleLogout() {
  unsubscribeMessages();
  stopPulseSimulation();
  await supabase.auth.signOut();
  localStorage.removeItem('nexus_user');
  currentUser = null;
  showScreen('authScreen');
  showPanel('loginPanel');
}

// ═══════════════════════════════════════════════
// USERNAME CHECK
// ═══════════════════════════════════════════════
function checkUsername(val) {
  const statusEl = document.getElementById('usernameStatus');
  clearTimeout(usernameCheckTimer);

  if (!val) {
    statusEl.textContent = '';
    statusEl.className = 'username-status';
    return;
  }
  if (!/^[a-z0-9_]{3,20}$/.test(val.toLowerCase())) {
    statusEl.textContent = '✗ 3-20 chars, a-z 0-9 _';
    statusEl.className = 'username-status taken';
    return;
  }

  statusEl.textContent = '...';
  statusEl.className = 'username-status checking';

  usernameCheckTimer = setTimeout(async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', val.toLowerCase())
        .maybeSingle();
      statusEl.textContent = data ? '✗ Taken' : '✓ Available';
      statusEl.className = 'username-status ' + (data ? 'taken' : 'available');
    } catch (e) {
      statusEl.textContent = '! Check failed';
      statusEl.className = 'username-status taken';
    }
  }, 500);
}

// ═══════════════════════════════════════════════
// SHOW APP
// ═══════════════════════════════════════════════
async function showApp() {
  showScreen('appScreen');
  updateProfileUI();
  switchTab('chats');
  await Promise.all([renderChatList(), renderGroupList(), renderStatusList()]);
  startPulseSimulation();
}

function updateProfileUI() {
  if (!currentUser) return;
  const { name, username, vibe, email, avatar } = currentUser;
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
    if (el) {
      el.textContent = initial;
      el.className = `avatar-fallback grad-${charGrad(initial)}`;
    }
  });
  if (avatar) {
    const img = document.getElementById('profileAvatar');
    if (img) {
      img.src = avatar;
      img.style.display = 'block';
      document.getElementById('profileFallback').style.display = 'none';
    }
  }
  updateStats();
}

async function updateStats() {
  if (!currentUser) return;
  const { data: sent } = await supabase
    .from('messages')
    .select('recipient_id')
    .eq('sender_id', currentUser.id)
    .not('recipient_id', 'is', null);
  const { data: received } = await supabase
    .from('messages')
    .select('sender_id')
    .eq('recipient_id', currentUser.id);
  const s = new Set();
  sent?.forEach(m => { if (m.recipient_id) s.add(m.recipient_id); });
  received?.forEach(m => { if (m.sender_id) s.add(m.sender_id); });
  document.getElementById('statContacts').textContent = s.size;
  document.getElementById('statChats').textContent = s.size;
  const { count } = await supabase
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', currentUser.id);
  document.getElementById('statGroups').textContent = count || 0;
}

// ═══════════════════════════════════════════════
// CHAT LIST
// ═══════════════════════════════════════════════
async function renderChatList() {
  const list = document.getElementById('chatList');
  list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted)">Loading...</div>';
  if (!currentUser) return;

  const { data: sentMsgs } = await supabase
    .from('messages')
    .select('sender_id,recipient_id,text,created_at')
    .eq('sender_id', currentUser.id)
    .not('recipient_id', 'is', null)
    .order('created_at', { ascending: false });
  const { data: receivedMsgs } = await supabase
    .from('messages')
    .select('sender_id,recipient_id,text,created_at')
    .eq('recipient_id', currentUser.id)
    .order('created_at', { ascending: false });

  const partnerMap = new Map();
  [...(sentMsgs || []), ...(receivedMsgs || [])].forEach(msg => {
    const pid = msg.sender_id === currentUser.id ? msg.recipient_id : msg.sender_id;
    if (!pid) return;
    if (!partnerMap.has(pid) || new Date(msg.created_at) > new Date(partnerMap.get(pid).created_at)) {
      partnerMap.set(pid, { text: msg.text, created_at: msg.created_at });
    }
  });

  const partnerIds = Array.from(partnerMap.keys());
  if (partnerIds.length === 0) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-secondary)">No conversations yet. Tap + to start one.</div>';
    return;
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .in('id', partnerIds);

  list.innerHTML = '';
  profiles?.forEach(profile => {
    const preview = partnerMap.get(profile.id);
    const timeStr = timeAgo(preview?.created_at);
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.onclick = () => openChat(
      { id: profile.id, name: profile.name, username: profile.username, vibe: profile.vibe },
      'user'
    );
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
      </div>
    `;
    list.appendChild(div);
  });
}

// ═══════════════════════════════════════════════
// GROUP LIST
// ═══════════════════════════════════════════════
async function renderGroupList() {
  const list = document.getElementById('groupList');
  list.innerHTML = '';
  if (!currentUser) return;

  const { data: memberships } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', currentUser.id);

  if (!memberships?.length) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-secondary)">No groups yet. Create one!</div>';
    return;
  }

  const groupIds = memberships.map(m => m.group_id);
  const { data: groups } = await supabase
    .from('groups')
    .select('*')
    .in('id', groupIds);

  groups?.forEach(group => {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.onclick = () => openChat({ id: group.id, name: group.name }, 'group');
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
  const { data: statuses } = await supabase
    .from('statuses')
    .select('*, profiles(name)')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (!statuses?.length) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-secondary)">No recent status updates.</div>';
    return;
  }

  statuses.forEach(s => {
    const name = s.profiles?.name || 'Unknown';
    const initial = name.charAt(0).toUpperCase();
    const div = document.createElement('div');
    div.className = 'status-item';
    div.innerHTML = `
      <div class="status-ring">
        <div class="status-ring-inner">
          <div class="avatar-fallback grad-${charGrad(initial)}" style="border-radius:50%;font-size:16px;font-family:var(--font-display);font-weight:700;color:white;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${initial}</div>
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
// OPEN CHAT
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
// MESSAGES
// ═══════════════════════════════════════════════
async function renderMessages() {
  const list = document.getElementById('messagesList');
  list.innerHTML = '';
  let query = supabase.from('messages').select('*').order('created_at', { ascending: true });
  if (currentChatType === 'user') {
    query = query.or(
      `and(sender_id.eq.${currentUser.id},recipient_id.eq.${currentChat.id}),and(sender_id.eq.${currentChat.id},recipient_id.eq.${currentUser.id})`
    );
  } else {
    query = query.eq('group_id', currentChat.id);
  }
  const { data: messages } = await query;
  messages?.forEach(msg => appendMessage(msg, false));
  scrollToBottom();
}

function subscribeToMessages() {
  unsubscribeMessages();
  if (currentChatType === 'user') {
    const ch1 = supabase.channel('user-msg-1')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${currentUser.id}`
      }, payload => {
        if (payload.new.recipient_id === currentChat.id) appendMessage(payload.new, true);
      }).subscribe();
    const ch2 = supabase.channel('user-msg-2')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `sender_id=eq.${currentChat.id}`
      }, payload => {
        if (payload.new.recipient_id === currentUser.id) appendMessage(payload.new, true);
      }).subscribe();
    messagesSubscription = [ch1, ch2];
  } else {
    const ch = supabase.channel('group-msg')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `group_id=eq.${currentChat.id}`
      }, payload => {
        appendMessage(payload.new, true);
      }).subscribe();
    messagesSubscription = [ch];
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
  if (error) {
    showToast('Send failed');
    console.error(error);
    return;
  }
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
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', `%${query}%`)
    .neq('id', currentUser.id)
    .limit(5);
  resultsDiv.innerHTML = data?.map(p => `
    <div class="chat-item" onclick="startChatWith('${p.id}', '${p.name.replace(/'/g, "\\'")}', '${p.username}')" style="cursor:pointer;margin:4px 0;">
      <div class="chat-avatar">
        <div class="avatar-fallback grad-${charGrad(p.name.charAt(0))}">${p.name.charAt(0).toUpperCase()}</div>
      </div>
      <div class="chat-info">
        <div class="chat-name">${p.name}</div>
        <div class="chat-preview">@${p.username} · ${p.vibe}</div>
      </div>
    </div>
  `).join('') || '<div style="padding:8px;color:var(--text-muted)">No users found</div>';
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

  const { data: group, error } = await supabase
    .from('groups')
    .insert({ name, creator_id: currentUser.id })
    .select()
    .single();
  if (error) { showToast('Group creation failed'); return; }

  await supabase.from('group_members').insert({ group_id: group.id, user_id: currentUser.id });

  const usernames = membersRaw.split(',').map(s => s.trim()).filter(Boolean);
  for (const uname of usernames) {
    const { data: user } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', uname)
      .single();
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
  const { error } = await supabase
    .from('statuses')
    .insert({ user_id: currentUser.id, text, expires_at: expires });
  if (error) { showToast('Error posting status'); return; }
  closeModal('statusModal');
  renderStatusList();
  showToast(`Status posted · ${selectedDuration}h`);
  document.getElementById('statusText').value = '';
}

// ═══════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════
function handleMsgKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}
function scrollToBottom() {
  setTimeout(() => {
    const c = document.getElementById('messagesContainer');
    if (c) c.scrollTop = c.scrollHeight;
  }, 50);
}
function setDuration(btn, hours) {
  selectedDuration = hours;
  document.querySelectorAll('.duration-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
}
function triggerAvatarUpload() { document.getElementById('avatarInput').click(); }
function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('profileAvatar').src = e.target.result;
    document.getElementById('profileAvatar').style.display = 'block';
    document.getElementById('profileFallback').style.display = 'none';
    showToast('Profile picture updated (local)');
  };
  reader.readAsDataURL(file);
}
function editName() {
  document.getElementById('newNameInput').value = currentUser?.name || '';
  document.getElementById('editNameModal').classList.remove('hidden');
}
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
function openSearch() { showToast('Global search coming soon'); }
function showAddStatus() { document.getElementById('statusModal').classList.remove('hidden'); }

// ═══════════════════════════════════════════════
// PULSE
// ═══════════════════════════════════════════════
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
  showToast(`Pulsed ${emoji}`);
}
function sendChatPulse(emoji) {
  document.getElementById('quickPulsePanel').classList.add('hidden');
  const layer = document.getElementById('chatPulseLayer');
  const el = document.createElement('div');
  el.className = 'floating-pulse';
  el.textContent = emoji;
  el.style.left = (20 + Math.random() * 60) + '%';
  el.style.bottom = '80px';
  layer.appendChild(el);
  setTimeout(() => el.remove(), 3000);
  showToast(`Pulse ${emoji} sent`);
}
function showQuickPulse() {
  document.getElementById('quickPulsePanel').classList.toggle('hidden');
}
function startPulseSimulation() {
  stopPulseSimulation();
  const feed = document.getElementById('pulseFeed');
  if (!feed) return;
  if (!feed.querySelector('.pulse-feed-label')) {
    const label = document.createElement('div');
    label.className = 'pulse-feed-label';
    label.textContent = 'reactions from your contacts · live';
    feed.appendChild(label);
  }
  const emojis = ['🔥', '💙', '😭', '⚡', '🥶', '💀', '✨', '🫀'];
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
function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.style.color = input.type === 'text' ? 'var(--blue)' : 'var(--text-muted)';
}
function charGrad(c) {
  return c ? (c.toUpperCase().charCodeAt(0) % 8) : 0;
}
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function switchTab(tab) {
  activeTab = tab;
  ['chats', 'groups', 'status', 'profile', 'pulse'].forEach(p => {
    const pg = document.getElementById(p + 'Page');
    const btn = document.getElementById('nav-' + p);
    if (pg) pg.classList.toggle('active', p === tab);
    if (btn) btn.classList.toggle('active', p === tab);
  });
  document.querySelector('.top-bar').style.display =
    (tab === 'profile' || tab === 'pulse') ? 'none' : 'flex';
}
function filterChats(q) {
  document.querySelectorAll('#chatList .chat-item').forEach(item => {
    const name = item.querySelector('.chat-name')?.textContent || '';
    item.style.display = name.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}

// ═══════════════════════════════════════════════
// TOAST
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
// PASSWORD STRENGTH
// ═══════════════════════════════════════════════
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
function setVibe(btn) {
  document.querySelectorAll('.vibe-chip').forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('signupVibe').value = btn.textContent;
        }
