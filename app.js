'use strict';

// ═══════════════════════════════════════════════════════
// NEXUS — app.js
// ═══════════════════════════════════════════════════════

let currentUser          = null;
let currentChat          = null;
let currentChatType      = 'user';
let selectedDuration     = 6;
let usernameCheckTimer   = null;
let activeTab            = 'chats';
let pulseInterval        = null;
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Fetch fresh profile from DB
        supabase.from('profiles').select('*').eq('id', session.user.id).limit(1)
          .then(({ data: rows }) => { const profile = rows?.[0] || null;
            if (profile) {
              currentUser = {
                id:       session.user.id,
                name:     profile.name,
                username: profile.username,
                email:    session.user.email,
                vibe:     profile.vibe,
                avatar:   profile.avatar_url || null
              };
              localStorage.setItem('nexus_user', JSON.stringify(currentUser));
              showApp();
            } else {
              localStorage.removeItem('nexus_user');
              showScreen('authScreen');
              showPanel('loginPanel');
            }
          });
      } else {
        localStorage.removeItem('nexus_user');
        showScreen('authScreen');
        showPanel('loginPanel');
      }
    }).catch(() => {
      localStorage.removeItem('nexus_user');
      showScreen('authScreen');
      showPanel('loginPanel');
    });
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
  void panel.offsetHeight; // force reflow
  panel.style.animation = '';
}

// ═══════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════
async function handleLogin() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');

  errEl.classList.add('hidden');

  if (!email || !password) {
    showError(errEl, 'Please enter your email and password.');
    return;
  }

  // Disable button while working
  const btn = document.querySelector('#loginPanel .btn-primary');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('invalid') || msg.includes('credentials')) {
      showError(errEl, 'Wrong email or password. Try again.');
    } else if (msg.includes('confirm') || msg.includes('verified')) {
      showError(errEl, 'Please confirm your email first. Check your inbox.');
    } else if (msg.includes('too many')) {
      showError(errEl, 'Too many attempts. Wait a few minutes.');
    } else {
      showError(errEl, error.message);
    }
    return;
  }

  // Fetch profile — limit(1) for max compatibility across all Supabase JS v2 versions
  const { data: profileRows, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .limit(1);
  const profile = profileRows?.[0] || null;

  if (profileErr) {
    // RLS is blocking the read — most likely the anon/authenticated policy issue
    // Still let them in using data from the auth token
    currentUser = {
      id:       data.user.id,
      name:     data.user.user_metadata?.name || email.split('@')[0],
      username: data.user.user_metadata?.username || 'user_' + data.user.id.slice(0, 8),
      email:    data.user.email,
      vibe:     data.user.user_metadata?.vibe || 'rare',
      avatar:   null
    };
  } else if (!profile) {
    // No profile row — create it now from metadata
    const name     = data.user.user_metadata?.name || email.split('@')[0];
    const username = data.user.user_metadata?.username || 'user_' + data.user.id.slice(0, 8);
    const vibe     = data.user.user_metadata?.vibe || 'rare';

    await supabase.from('profiles').insert({ id: data.user.id, name, username, vibe });

    currentUser = { id: data.user.id, name, username, email: data.user.email, vibe, avatar: null };
  } else {
    currentUser = {
      id:       data.user.id,
      name:     profile.name,
      username: profile.username,
      email:    data.user.email,
      vibe:     profile.vibe,
      avatar:   profile.avatar_url || null
    };
  }

  localStorage.setItem('nexus_user', JSON.stringify(currentUser));
  showApp();
}

// ═══════════════════════════════════════════════
// SIGN UP
// ═══════════════════════════════════════════════
async function handleSignup() {
  const name      = document.getElementById('signupName').value.trim();
  const username  = document.getElementById('signupUsername').value.trim().toLowerCase();
  const email     = document.getElementById('signupEmail').value.trim();
  const password  = document.getElementById('signupPassword').value;
  const confirmPw = document.getElementById('signupConfirmPw').value;
  const vibe      = document.getElementById('signupVibe').value.trim();
  const errEl     = document.getElementById('signupError');
  const successEl = document.getElementById('signupSuccess');

  errEl.classList.add('hidden');
  successEl.classList.add('hidden');

  if (!name || !username || !email || !password || !confirmPw) {
    showError(errEl, 'All fields required.'); return;
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    showError(errEl, 'Username: 3-20 chars, letters / numbers / underscore only.'); return;
  }
  if (password !== confirmPw) {
    showError(errEl, 'Passwords do not match.'); return;
  }
  if (password.length < 8) {
    showError(errEl, 'Password must be at least 8 characters.'); return;
  }
  if (!vibe) {
    showError(errEl, 'Pick your Vibe Word.'); return;
  }

  // Disable button
  const btn = document.querySelector('#signupPanel .btn-primary');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; }

  // Username check — handles both anon and authenticated RLS
  const { data: existingRows, error: checkErr } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username)
    .limit(1);
  const existing = existingRows?.[0] || null;

  if (checkErr && checkErr.code !== 'PGRST116') {
    // PGRST116 = no rows found (safe to ignore)
    // Any other error means RLS is blocking — warn but don't stop signup
    console.warn('Username check blocked by RLS:', checkErr.message);
  } else if (existing) {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    showError(errEl, `@${username} is already taken. Choose another.`);
    return;
  }

  // Sign up
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, username, vibe } }
  });

  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }

  if (error) {
    if (error.message.toLowerCase().includes('already registered')) {
      showError(errEl, 'This email is already registered. Try signing in.');
    } else {
      showError(errEl, error.message);
    }
    return;
  }

  // Insert profile row directly — don't rely solely on trigger
  if (data.user) {
    const { error: insertErr } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, name, username, vibe });
    if (insertErr && insertErr.code !== '23505') {
      // 23505 = duplicate key (row already created by trigger) — safe to ignore
      console.warn('Profile insert warning:', insertErr.message);
    }
  }

  // Email confirmation required
  if (!data.session) {
    const confirmEl = document.getElementById('confirmEmail');
    if (confirmEl) confirmEl.textContent = email;
    showPanel('confirmPanel');
    return;
  }

  // Email confirmation OFF — log in immediately
  currentUser = { id: data.user.id, name, username, email, vibe, avatar: null };
  localStorage.setItem('nexus_user', JSON.stringify(currentUser));
  showApp();
}

// ═══════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════
async function handleLogout() {
  unsubscribeMessages();
  stopPulseSimulation();
  try { await supabase.auth.signOut(); } catch (e) { console.warn('Sign out error:', e); }
  localStorage.removeItem('nexus_user');
  currentUser = null;
  showScreen('authScreen');
  showPanel('loginPanel');
}

// ═══════════════════════════════════════════════
// USERNAME CHECK (live, debounced)
// ═══════════════════════════════════════════════
function checkUsername(val) {
  const statusEl = document.getElementById('usernameStatus');
  if (!statusEl) return;
  clearTimeout(usernameCheckTimer);

  if (!val) {
    statusEl.textContent = ''; statusEl.className = 'username-status'; return;
  }
  if (!/^[a-z0-9_]{3,20}$/.test(val.toLowerCase())) {
    statusEl.textContent = '✗ 3-20 chars, a-z 0-9 _';
    statusEl.className = 'username-status taken'; return;
  }

  statusEl.textContent = '...'; statusEl.className = 'username-status checking';

  usernameCheckTimer = setTimeout(async () => {
    const { data: uRows, error: uErr } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', val.toLowerCase())
      .limit(1);

    if (uErr) {
      // RLS blocking anonymous reads — show neutral message
      statusEl.textContent = '○ Will check on signup';
      statusEl.className = 'username-status checking';
      return;
    }

    const taken = uRows && uRows.length > 0;
    statusEl.textContent = taken ? '✗ Taken' : '✓ Available';
    statusEl.className   = 'username-status ' + (taken ? 'taken' : 'available');
  }, 500);
}

// ═══════════════════════════════════════════════
// SHOW APP
// ═══════════════════════════════════════════════
async function showApp() {
  showScreen('appScreen');

  // Refresh profile from DB
  if (currentUser?.id) {
    const { data: profileRows } = await supabase
      .from('profiles').select('*').eq('id', currentUser.id).limit(1);
    const profile = profileRows?.[0] || null;
    if (profile) {
      currentUser.name     = profile.name;
      currentUser.username = profile.username;
      currentUser.vibe     = profile.vibe;
      currentUser.avatar   = profile.avatar_url || null;
      localStorage.setItem('nexus_user', JSON.stringify(currentUser));
    }
  }

  updateProfileUI();
  switchTab('chats');
  await Promise.all([renderChatList(), renderGroupList(), renderStatusList()]);
  startPulseSimulation();
}

function updateProfileUI() {
  if (!currentUser) return;
  const { name, username, vibe, email, avatar } = currentUser;
  document.getElementById('profileName').textContent      = name;
  document.getElementById('profileUsername').textContent  = `@${username}`;
  const vibeBadge = document.getElementById('profileVibeBadge');
  if (vibeBadge) vibeBadge.textContent = `✦ ${vibe}`;
  document.getElementById('settingsName').textContent     = name;
  document.getElementById('settingsEmail').textContent    = email;
  document.getElementById('settingsVibe').textContent     = vibe;
  const settingsUsernameEl = document.getElementById('settingsUsername');
  if (settingsUsernameEl) settingsUsernameEl.textContent = username;
  const initial = name.charAt(0).toUpperCase();
  ['profileFallback', 'myStatusFallback'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = initial; el.className = `avatar-fallback grad-${charGrad(initial)}`; }
  });
  if (avatar) {
    const img = document.getElementById('profileAvatar');
    if (img) {
      img.src = avatar; img.style.display = 'block';
      const fb = document.getElementById('profileFallback');
      if (fb) fb.style.display = 'none';
    }
  }
  updateStats();
}

async function updateStats() {
  if (!currentUser) return;
  const { data: sent }     = await supabase.from('messages').select('recipient_id').eq('sender_id', currentUser.id).not('recipient_id','is',null);
  const { data: received } = await supabase.from('messages').select('sender_id').eq('recipient_id', currentUser.id);
  const s = new Set();
  sent?.forEach(m => { if (m.recipient_id) s.add(m.recipient_id); });
  received?.forEach(m => { if (m.sender_id) s.add(m.sender_id); });
  const statChats    = document.getElementById('statChats');
  const statContacts = document.getElementById('statContacts');
  const statGroups   = document.getElementById('statGroups');
  if (statChats)    statChats.textContent    = s.size;
  if (statContacts) statContacts.textContent = s.size;
  const { count } = await supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
  if (statGroups) statGroups.textContent = (count !== null && count !== undefined) ? count : 0;
}

// ═══════════════════════════════════════════════
// CHAT LIST
// ═══════════════════════════════════════════════
async function renderChatList() {
  const list = document.getElementById('chatList');
  if (!list) return;
  list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">Loading...</div>';
  if (!currentUser) return;

  const { data: sentMsgs }     = await supabase.from('messages').select('sender_id,recipient_id,text,created_at').eq('sender_id', currentUser.id).not('recipient_id','is',null).order('created_at', { ascending: false });
  const { data: receivedMsgs } = await supabase.from('messages').select('sender_id,recipient_id,text,created_at').eq('recipient_id', currentUser.id).order('created_at', { ascending: false });

  const partnerMap = new Map();
  [...(sentMsgs||[]),...(receivedMsgs||[])].forEach(msg => {
    const pid = msg.sender_id === currentUser.id ? msg.recipient_id : msg.sender_id;
    if (!pid) return;
    if (!partnerMap.has(pid) || new Date(msg.created_at) > new Date(partnerMap.get(pid).created_at)) {
      partnerMap.set(pid, { text: msg.text, created_at: msg.created_at });
    }
  });

  list.innerHTML = '';
  if (!partnerMap.size) {
    list.innerHTML = '<div style="padding:32px 16px;text-align:center;color:var(--text-secondary);font-size:14px">No conversations yet.<br>Tap <strong style="color:var(--blue)">+</strong> to find someone.</div>';
    return;
  }

  const { data: profiles } = await supabase.from('profiles').select('*').in('id', Array.from(partnerMap.keys()));
  profiles?.sort((a,b) => new Date(partnerMap.get(b.id)?.created_at||0) - new Date(partnerMap.get(a.id)?.created_at||0));
  profiles?.filter(p => p && p.name).forEach(profile => {
    const preview  = partnerMap.get(profile.id);
    const initial  = profile.name.charAt(0).toUpperCase();
    const div      = document.createElement('div');
    div.className  = 'chat-item';
    div.onclick    = () => openChat({ id:profile.id, name:profile.name, username:profile.username, vibe:profile.vibe }, 'user');
    div.innerHTML  = `
      <div class="chat-avatar"><div class="avatar-fallback grad-${charGrad(initial)}">${initial}</div></div>
      <div class="chat-info">
        <div class="chat-name">${escapeHtml(profile.name)}</div>
        <div class="chat-preview">${escapeHtml(preview?.text||'')}</div>
      </div>
      <div class="chat-meta"><span class="chat-time">${timeAgo(preview?.created_at)}</span></div>
    `;
    list.appendChild(div);
  });
}

// ═══════════════════════════════════════════════
// GROUP LIST
// ═══════════════════════════════════════════════
async function renderGroupList() {
  const list = document.getElementById('groupList');
  if (!list || !currentUser) return;
  list.innerHTML = '';
  const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', currentUser.id);
  if (!memberships?.length) {
    list.innerHTML = '<div style="padding:32px 16px;text-align:center;color:var(--text-secondary);font-size:14px">No groups yet.<br>Tap <strong style="color:var(--blue)">+ New</strong> to create one.</div>';
    return;
  }
  const { data: groups } = await supabase.from('groups').select('*').in('id', memberships.map(m=>m.group_id));
  groups?.forEach(group => {
    const initial = group.name.charAt(0).toUpperCase();
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.onclick   = () => openChat({ id:group.id, name:group.name }, 'group');
    div.innerHTML = `
      <div class="chat-avatar"><div class="avatar-fallback grad-${charGrad(initial)}">${initial}</div></div>
      <div class="chat-info"><div class="chat-name">${escapeHtml(group.name)}</div><div class="chat-preview">Tap to open</div></div>
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
  if (!list) return;
  list.innerHTML = '';
  const { data: statuses } = await supabase
    .from('statuses').select('*, profiles(name)')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (!statuses?.length) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-secondary);font-size:13px">No recent status updates.</div>';
    return;
  }
  statuses.forEach(s => {
    const name    = s.profiles?.name || 'Unknown';
    const initial = name.charAt(0).toUpperCase();
    const div     = document.createElement('div');
    div.className = 'status-item';
    div.innerHTML = `
      <div class="status-ring"><div class="status-ring-inner"><div class="avatar-fallback grad-${charGrad(initial)}" style="border-radius:50%;font-size:16px;font-family:var(--font-display);font-weight:700;color:white;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${initial}</div></div></div>
      <div><div class="status-name">${escapeHtml(name)}</div><div class="status-time">${escapeHtml(s.text)}</div></div>
      <span class="status-expire">${timeRemaining(s.expires_at)}</span>
    `;
    list.appendChild(div);
  });
}

// ═══════════════════════════════════════════════
// OPEN / CLOSE CHAT
// ═══════════════════════════════════════════════
function openChat(data, type) {
  currentChat = data; currentChatType = type;
  document.getElementById('chatHeaderName').textContent   = data.name;
  const headerStatus = document.getElementById('chatHeaderStatus');
  if (headerStatus) { headerStatus.textContent = type === 'group' ? 'Group' : 'online'; headerStatus.style.color = type === 'group' ? 'var(--text-secondary)' : '#4ade80'; }
  const initial = data.name.charAt(0).toUpperCase();
  const av = document.getElementById('chatAvatarFallback');
  if (av) { av.textContent = initial; av.className = `avatar-fallback-sm grad-${charGrad(initial)}`; }
  document.getElementById('messagesList').innerHTML = '';
  renderMessages();
  showScreen('chatView');
  subscribeToMessages();
}

function closeChatView() {
  unsubscribeMessages();
  document.getElementById('quickPulsePanel').classList.add('hidden');
  showScreen('appScreen');
}

// ═══════════════════════════════════════════════
// MESSAGES
// ═══════════════════════════════════════════════
async function renderMessages() {
  const list = document.getElementById('messagesList');
  if (!list) return;
  list.innerHTML = '';
  let all = [];
  if (currentChatType === 'user') {
    const { data: sent }     = await supabase.from('messages').select('*').eq('sender_id', currentUser.id).eq('recipient_id', currentChat.id).order('created_at', { ascending: true });
    const { data: received } = await supabase.from('messages').select('*').eq('sender_id', currentChat.id).eq('recipient_id', currentUser.id).order('created_at', { ascending: true });
    all = [...(sent||[]),...(received||[])].sort((a,b) => new Date(a.created_at)-new Date(b.created_at));
  } else {
    const { data: msgs } = await supabase.from('messages').select('*').eq('group_id', currentChat.id).order('created_at', { ascending: true });
    all = msgs || [];
  }
  all.forEach(msg => appendMessage(msg, false));
  scrollToBottom();
}

function subscribeToMessages() {
  unsubscribeMessages();
  if (currentChatType === 'user') {
    const ch1 = supabase.channel(`msg-out-${currentUser.id}-${currentChat.id}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages', filter:`sender_id=eq.${currentUser.id}` },
        payload => { if (payload.new.recipient_id === currentChat.id) appendMessage(payload.new, true); })
      .subscribe();
    const ch2 = supabase.channel(`msg-in-${currentChat.id}-${currentUser.id}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' },
        payload => {
          const m = payload.new;
          // Must be from chat partner TO current user in THIS conversation
          if (m.sender_id === currentChat.id && m.recipient_id === currentUser.id) {
            appendMessage(m, true);
          }
        })
      .subscribe();
    messagesSubscription = [ch1, ch2];
  } else {
    const ch = supabase.channel(`group-${currentChat.id}`)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages', filter:`group_id=eq.${currentChat.id}` },
        payload => { appendMessage(payload.new, true); })
      .subscribe();
    messagesSubscription = [ch];
  }
}

function unsubscribeMessages() {
  if (messagesSubscription) { messagesSubscription.forEach(c => supabase.removeChannel(c)); messagesSubscription = null; }
}

function appendMessage(msg, scroll = true) {
  const list = document.getElementById('messagesList');
  if (!list || !currentUser) return;
  if (!msg || !msg.text) return;
  const isMe  = msg.sender_id === currentUser.id;
  const time  = new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const row   = document.createElement('div');
  row.className = `msg-row ${isMe ? 'outgoing' : 'incoming'}`;
  if (!isMe) {
    const initial = currentChat?.name?.charAt(0).toUpperCase() || '?';
    row.innerHTML = `<div class="msg-avatar-mini grad-${charGrad(initial)}">${initial}</div><div><div class="msg-bubble">${escapeHtml(msg.text)}</div><span class="msg-time">${time}</span></div>`;
  } else {
    row.innerHTML = `<div><div class="msg-bubble">${escapeHtml(msg.text)}</div><span class="msg-time">${time} ✓✓</span></div>`;
  }
  list.appendChild(row);
  if (scroll) scrollToBottom();
}

async function sendMessage() {
  const input = document.getElementById('msgInput');
  const text  = input.value.trim();
  if (!text || !currentChat || !currentUser) return;
  input.value = '';
  const { error } = await supabase.from('messages').insert({
    sender_id:    currentUser.id,
    recipient_id: currentChatType === 'user'  ? currentChat.id : null,
    group_id:     currentChatType === 'group' ? currentChat.id : null,
    text
  });
  if (error) { showToast('Send failed: ' + error.message); const inp = document.getElementById('msgInput'); if (inp) inp.value = text; }
}

function handleMsgKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

// ═══════════════════════════════════════════════
// NEW CHAT SEARCH
// ═══════════════════════════════════════════════
function openNewChatSearch() {
  document.getElementById('newChatModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('searchUsernameInput')?.focus(), 100);
}

async function searchUsername(query) {
  const resultsDiv = document.getElementById('searchResults');
  if (!resultsDiv) return;
  if (!query.trim()) { resultsDiv.innerHTML = ''; return; }
  if (!currentUser) return;
  const { data } = await supabase
    .from('profiles').select('id,name,username,vibe')
    .ilike('username', `%${query.toLowerCase()}%`)
    .neq('id', currentUser.id).limit(6);
  if (!data?.length) {
    resultsDiv.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:13px">No users found</div>'; return;
  }
  resultsDiv.innerHTML = '';
  data.forEach(p => {
    const div = document.createElement('div');
    div.className = 'chat-item'; div.style.cursor = 'pointer';
    const initial = p.name.charAt(0).toUpperCase();
    div.innerHTML = `
      <div class="chat-avatar"><div class="avatar-fallback grad-${charGrad(initial)}">${initial}</div></div>
      <div class="chat-info"><div class="chat-name">${escapeHtml(p.name)}</div><div class="chat-preview">@${escapeHtml(p.username)} · ✦ ${escapeHtml(p.vibe||'')}</div></div>
    `;
    div.onclick = () => startChatWith(p.id, p.name, p.username);
    resultsDiv.appendChild(div);
  });
}

function startChatWith(userId, name, username) {
  closeModal('newChatModal');
  openChat({ id: userId, name, username }, 'user');
}

// ═══════════════════════════════════════════════
// CREATE GROUP
// ═══════════════════════════════════════════════
function showCreateGroup() { document.getElementById('createGroupModal').classList.remove('hidden'); }

async function createGroup() {
  const name       = document.getElementById('groupNameInput').value.trim();
  const membersRaw = document.getElementById('groupMembersInput').value.trim();
  if (!name) { showToast('Group name required'); return; }
  const { data: groupRows, error } = await supabase.from('groups').insert({ name, creator_id: currentUser.id }).select().limit(1);
  const group = groupRows?.[0] || null;
  if (error) { showToast('Failed: ' + error.message); return; }
  await supabase.from('group_members').insert({ group_id: group.id, user_id: currentUser.id });
  if (membersRaw) {
    for (const uname of membersRaw.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)) {
      const { data: uRes } = await supabase.from('profiles').select('id').eq('username', uname).limit(1);
      const user = uRes?.[0] || null;
      if (user) await supabase.from('group_members').insert({ group_id: group.id, user_id: user.id });
    }
  }
  closeModal('createGroupModal');
  document.getElementById('groupNameInput').value = '';
  document.getElementById('groupMembersInput').value = '';
  await renderGroupList();
  showToast(`"${name}" created`);
}

// ═══════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════
function showAddStatus() { document.getElementById('statusModal').classList.remove('hidden'); }

async function postStatus() {
  const text = document.getElementById('statusText').value.trim();
  if (!text) { showToast('Type something first'); return; }
  const { error } = await supabase.from('statuses').insert({ user_id: currentUser.id, text, expires_at: new Date(Date.now() + selectedDuration * 3600000).toISOString() });
  if (error) { showToast('Error: ' + error.message); return; }
  closeModal('statusModal');
  document.getElementById('statusText').value = '';
  await renderStatusList();
  showToast(`Status posted · ${selectedDuration}h`);
}

function setDuration(btn, hours) {
  selectedDuration = hours;
  document.querySelectorAll('.duration-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
}

// ═══════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════
function triggerAvatarUpload() { document.getElementById('avatarInput').click(); }

async function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file || !currentUser) return;
  const ext      = file.name.split('.').pop().toLowerCase();
  const filePath = `${currentUser.id}/avatar.${ext}`;
  const { error: uploadErr } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
  if (uploadErr) { showToast('Upload failed: ' + uploadErr.message); return; }
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
  const avatarUrl = urlData.publicUrl;
  await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', currentUser.id);
  currentUser.avatar = avatarUrl;
  localStorage.setItem('nexus_user', JSON.stringify(currentUser));
  // Update profile avatar
  const img = document.getElementById('profileAvatar');
  if (img) { img.src = avatarUrl; img.style.display = 'block'; }
  const fb = document.getElementById('profileFallback');
  if (fb) fb.style.display = 'none';
  // Sync status card avatar too
  const statusAvatar = document.getElementById('myStatusAvatar');
  if (statusAvatar) { statusAvatar.src = avatarUrl; statusAvatar.style.display = 'block'; }
  const statusFallback = document.getElementById('myStatusFallback');
  if (statusFallback) statusFallback.style.display = 'none';
  showToast('Profile picture updated ✓');
}

function editName() {
  document.getElementById('newNameInput').value = currentUser?.name || '';
  document.getElementById('editNameModal').classList.remove('hidden');
}

async function saveName() {
  const val = document.getElementById('newNameInput').value.trim();
  if (!val) { showToast('Name cannot be empty'); return; }
  const { error } = await supabase.from('profiles').update({ name: val }).eq('id', currentUser.id);
  if (error) { showToast('Update failed: ' + error.message); return; }
  currentUser.name = val;
  localStorage.setItem('nexus_user', JSON.stringify(currentUser));
  updateProfileUI(); closeModal('editNameModal'); showToast('Name updated');
}

async function editVibe() {
  const v = prompt('Enter your new Vibe Word (max 20 chars):');
  if (!v?.trim()) return;
  const trimmed = v.trim().slice(0, 20);
  const { error: vibeErr } = await supabase.from('profiles').update({ vibe: trimmed }).eq('id', currentUser.id);
  if (vibeErr) { showToast('Update failed: ' + vibeErr.message); return; }
  currentUser.vibe = trimmed;
  localStorage.setItem('nexus_user', JSON.stringify(currentUser));
  updateProfileUI(); showToast('Vibe updated ✦');
}

// ═══════════════════════════════════════════════
// PULSE
// ═══════════════════════════════════════════════
function blastPulse(emoji) {
  const feed = document.getElementById('pulseFeed'); if (!feed) return;
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const el = document.createElement('div'); el.className = 'pulse-feed-item'; el.textContent = emoji;
      el.style.left = (10 + Math.random() * 75) + '%'; el.style.bottom = '20px';
      feed.appendChild(el); setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
    }, i * 200);
  }
  showToast(`Pulsed ${emoji}`);
}

function sendChatPulse(emoji) {
  document.getElementById('quickPulsePanel').classList.add('hidden');
  const layer = document.getElementById('chatPulseLayer');
  if (!layer) return;
  const el = document.createElement('div'); el.className = 'floating-pulse'; el.textContent = emoji;
  el.style.left = (20 + Math.random() * 60) + '%'; el.style.bottom = '80px';
  layer.appendChild(el); setTimeout(() => { if (el.parentNode) el.remove(); }, 3000);
  showToast(`Pulse ${emoji} sent`);
}

function showQuickPulse() { document.getElementById('quickPulsePanel')?.classList.toggle('hidden'); }

function startPulseSimulation() {
  stopPulseSimulation();
  const feed = document.getElementById('pulseFeed'); if (!feed) return;
  if (!feed.querySelector('.pulse-feed-label')) {
    const label = document.createElement('div'); label.className = 'pulse-feed-label';
    label.textContent = 'reactions from your contacts · live'; feed.appendChild(label);
  }
  const emojis = ['🔥','💙','😭','⚡','🥶','💀','✨','🫀'];
  pulseInterval = setInterval(() => {
    const el = document.createElement('div'); el.className = 'pulse-feed-item';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.left = (5 + Math.random() * 82) + '%'; el.style.bottom = '30px';
    feed.appendChild(el); setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
  }, 1800);
}

function stopPulseSimulation() { if (pulseInterval) { clearInterval(pulseInterval); pulseInterval = null; } }

// ═══════════════════════════════════════════════
// TABS — null-safe top-bar check
// ═══════════════════════════════════════════════
function switchTab(tab) {
  activeTab = tab;
  ['chats','groups','status','profile','pulse'].forEach(p => {
    const pg  = document.getElementById(p + 'Page');
    const btn = document.getElementById('nav-' + p);
    if (pg)  pg.classList.toggle('active', p === tab);
    if (btn) btn.classList.toggle('active', p === tab);
  });
  const topBar = document.querySelector('.top-bar');
  if (topBar) topBar.style.display = (tab === 'profile' || tab === 'pulse') ? 'none' : 'flex';
}

// ═══════════════════════════════════════════════
// MISC
// ═══════════════════════════════════════════════
function filterChats(q) {
  document.querySelectorAll('#chatList .chat-item').forEach(item => {
    const name = item.querySelector('.chat-name')?.textContent || '';
    item.style.display = name.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
}
function openSearch()        { openNewChatSearch(); }
function showNotifSettings() { showToast('Coming soon'); }
function showContactInfo()   { if (currentChat) showToast(`@${currentChat.username || currentChat.name}`); }
function closeModal(id)      { document.getElementById(id)?.classList.add('hidden'); }
function scrollToBottom()    { setTimeout(() => { const c = document.getElementById('messagesContainer'); if (c) c.scrollTop = c.scrollHeight; }, 60); }

function togglePw(inputId, btn) {
  const input = document.getElementById(inputId); if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.style.color = input.type === 'text' ? 'var(--blue)' : 'var(--text-muted)';
}

function checkPwStrength(pw) {
  const fill = document.getElementById('pwStrengthFill');
  const label = document.getElementById('pwStrengthLabel');
  if (!fill || !label) return;
  let s = 0;
  if (pw.length >= 8) s++; if (pw.length >= 12) s++; if (/[A-Z]/.test(pw)) s++; if (/[0-9]/.test(pw)) s++; if (/[^A-Za-z0-9]/.test(pw)) s++;
  const lvl = [{pct:'0%',color:'',label:''},{pct:'20%',color:'#FF4B6E',label:'Weak'},{pct:'40%',color:'#f97316',label:'Fair'},{pct:'65%',color:'#f59e0b',label:'Good'},{pct:'80%',color:'#4ade80',label:'Strong'},{pct:'100%',color:'#3B8BFF',label:'Unbreakable ✦'}][s];
  fill.style.width = lvl.pct; fill.style.background = lvl.color; label.textContent = lvl.label; label.style.color = lvl.color;
}

function setVibe(btn) {
  document.querySelectorAll('.vibe-chip').forEach(c => c.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('signupVibe').value = btn.textContent;
}

// ═══════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast'); if (!toast) return;
  toast.textContent = msg; toast.classList.remove('hidden');
  requestAnimationFrame(() => toast.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2400);
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function timeAgo(date) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime(), mins = Math.floor(diff/60000);
  if (mins < 1) return 'now'; if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins/60); if (h < 24) return `${h}h`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function timeRemaining(expires) {
  const diff = new Date(expires) - Date.now(); if (diff <= 0) return 'expired';
  const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000);
  return h > 0 ? `${h}h left` : `${m}m left`;
}
function showError(el, msg) { if (!el) return; el.textContent = msg; el.classList.remove('hidden'); }
function charGrad(c) { return c ? (c.toUpperCase().charCodeAt(0) % 8) : 0; }
function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

document.addEventListener('click', e => {
  const panel = document.getElementById('quickPulsePanel');
  if (panel && !panel.classList.contains('hidden') && !e.target.closest('.quick-pulse-panel') && !e.target.closest('.pulse-quick-btn')) {
    panel.classList.add('hidden');
  }
});
