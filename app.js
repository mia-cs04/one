// REPLACE WITH YOUR ACTUAL SUPABASE URL AND ANON KEY
const SUPABASE_URL = "https://eajlzqbleznhyoxnkvwf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhamx6cWJsZXpuaHlveG5rdndmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NzMzNDQsImV4cCI6MjEwMTQ0OTM0NH0._Rnk8WHn5J0-BnCsVtgLy8olAx9o7LpplybzKCTHuws";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const STEALTH_URL = "https://coneqt-s.mountcarmel.tas.edu.au:4430/#?page=/welcome";

// ADMIN PERMISSIONS DEFAULT
const ADMIN_PERMISSIONS = {
  canChangeGroupName: true,
  canChangeGroupPasscode: true
};

let currentUser = null;
let currentProfile = null;
let currentGroup = null;
let currentSubscription = null;
let selectedGroupId = null;
let isSignUpMode = false;
let userMemberColors = {}; // Stores custom per-member bubble colors

// === HELPER FUNCTIONS ===
function isUserAdmin(user, group) {
  if (!user || !group) return false;
  return group.creator_id === user.id;
}

// === ENTER KEY HELPER ===
function handleEnterKey(event, actionFunction) {
  if (event.key === 'Enter') {
    event.preventDefault();
    actionFunction();
  }
}

// === INSTANT STEALTH EXIT ===
function triggerStealth() {
  window.location.replace(STEALTH_URL);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    triggerStealth();
  }
}, { capture: true });

// === INITIALIZATION & AUTO-LOGIN SESSION PERSISTENCE ===
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadUserProfile();
    showScreen('menu-screen');
    loadUserGroups();
  } else {
    showScreen('auth-screen');
  }
});

// === DYNAMIC FAVICON / UNREAD BADGE ===
function updateFaviconBadge(hasUnread) {
  const favicon = document.getElementById('favicon');
  if (hasUnread) {
    document.title = "(1) SEQTA Learn";
    favicon.href = "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%23dc2626%22/></svg>";
  } else {
    document.title = "SEQTA Learn";
    favicon.href = "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%234a90e2%22/></svg>";
  }
}

window.addEventListener('focus', () => {
  updateFaviconBadge(false);
});

// === AUTHENTICATION TOGGLE & SUBMIT ===
function toggleAuthMode() {
  isSignUpMode = !isSignUpMode;
  const usernameInput = document.getElementById('auth-username');
  const title = document.getElementById('auth-title');
  const submitBtn = document.getElementById('auth-submit-btn');
  const toggleBtn = document.getElementById('auth-toggle-btn');

  if (isSignUpMode) {
    title.innerText = "SEQTA Portal Sign Up";
    usernameInput.classList.remove('hidden');
    submitBtn.innerText = "Create Account";
    toggleBtn.innerText = "Already have an account? Sign In";
  } else {
    title.innerText = "SEQTA Portal Sign In";
    usernameInput.classList.add('hidden');
    submitBtn.innerText = "Sign In";
    toggleBtn.innerText = "Need an account? Sign Up";
  }
}

async function handleAuthSubmit() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-pass').value.trim();

  if (!email || !password) return alert("Please enter both email and password.");

  try {
    if (isSignUpMode) {
      const username = document.getElementById('auth-username').value.trim();
      if (!username) return alert("Please enter a username.");

      const { data, error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;

      if (data.user) {
        await supabaseClient.from('profiles').insert([{ id: data.user.id, username }]);
        alert("Account created successfully!");
        currentUser = data.user;
        await loadUserProfile();
        showScreen('menu-screen');
        loadUserGroups();
      }
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;

      currentUser = data.user;
      await loadUserProfile();
      showScreen('menu-screen');
      loadUserGroups();
    }
  } catch (err) {
    console.error("Auth Error:", err);
    alert("Authentication Error: " + err.message);
  }
}

async function handleSignOut() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  currentProfile = null;
  showScreen('auth-screen');
}

// === THEME CUSTOMISATION & PERSISTENCE ===
function applyCustomTheme() {
  const root = document.documentElement;
  root.style.setProperty('--bg-color', document.getElementById('theme-bg').value);
  root.style.setProperty('--header-color', document.getElementById('theme-header').value);
  root.style.setProperty('--text-color', document.getElementById('theme-text').value);
  root.style.setProperty('--card-color', document.getElementById('theme-card').value);
  root.style.setProperty('--accent-color', document.getElementById('theme-accent').value);
}

async function saveThemeToAccount() {
  if (!currentUser) return;
  const themeSettings = {
    bg: document.getElementById('theme-bg').value,
    header: document.getElementById('theme-header').value,
    text: document.getElementById('theme-text').value,
    card: document.getElementById('theme-card').value,
    accent: document.getElementById('theme-accent').value
  };
  
  const { error } = await supabaseClient.from('profiles').update({ theme_settings: themeSettings }).eq('id', currentUser.id);
  if (error) {
    alert("Error saving theme: " + error.message);
  } else {
    alert("Theme saved permanently!");
    closeThemeModal();
  }
}

async function loadUserProfile() {
  if (!currentUser) return;
  const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).single();
  
  if (data) {
    currentProfile = data;
    if (data.member_colors) {
      userMemberColors = data.member_colors;
    }

    if (data.theme_settings) {
      const t = data.theme_settings;
      const root = document.documentElement;

      if (t.bg) root.style.setProperty('--bg-color', t.bg);
      if (t.header) root.style.setProperty('--header-color', t.header);
      if (t.text) root.style.setProperty('--text-color', t.text);
      if (t.card) root.style.setProperty('--card-color', t.card);
      if (t.accent) root.style.setProperty('--accent-color', t.accent);

      if (t.bg) document.getElementById('theme-bg').value = t.bg;
      if (t.header) document.getElementById('theme-header').value = t.header;
      if (t.text) document.getElementById('theme-text').value = t.text;
      if (t.card) document.getElementById('theme-card').value = t.card;
      if (t.accent) document.getElementById('theme-accent').value = t.accent;
    }
  }
}

// === PER-MEMBER CHAT BUBBLE CUSTOMISATION ===
async function openMemberColorsModal() {
  if (!currentGroup) return;

  const { data: members, error } = await supabaseClient
    .from('group_members')
    .select('user_id, profiles(id, username)')
    .eq('group_id', currentGroup.id);

  if (error || !members) return alert("Error loading member list.");

  const container = document.getElementById('member-color-list');
  container.innerHTML = '';

  members.forEach(item => {
    if (!item.profiles) return;
    const mId = item.profiles.id;
    const name = item.profiles.username || 'User';
    
    // Existing saved colors or defaults
    const savedBg = (userMemberColors[mId] && userMemberColors[mId].bg) ? userMemberColors[mId].bg : '#e2e8f0';
    const savedText = (userMemberColors[mId] && userMemberColors[mId].text) ? userMemberColors[mId].text : '#0f172a';

    const row = document.createElement('div');
    row.className = 'member-color-row';
    row.innerHTML = `
      <label>${name} ${mId === currentUser.id ? '(You)' : ''}</label>
      <div class="color-pickers">
        <span style="font-size: 0.75em;">Bg:</span>
        <input type="color" id="mbg-${mId}" value="${savedBg}">
        <span style="font-size: 0.75em;">Text:</span>
        <input type="color" id="mtxt-${mId}" value="${savedText}">
      </div>
    `;
    container.appendChild(row);
  });

  document.getElementById('member-colors-modal').classList.remove('hidden');
}

async function saveMemberColorsToAccount() {
  if (!currentGroup || !currentUser) return;

  const { data: members } = await supabaseClient
    .from('group_members')
    .select('user_id')
    .eq('group_id', currentGroup.id);

  if (members) {
    members.forEach(m => {
      const mId = m.user_id;
      const bgInput = document.getElementById(`mbg-${mId}`);
      const txtInput = document.getElementById(`mtxt-${mId}`);

      if (bgInput && txtInput) {
        userMemberColors[mId] = {
          bg: bgInput.value,
          text: txtInput.value
        };
      }
    });
  }

  const { error } = await supabaseClient
    .from('profiles')
    .update({ member_colors: userMemberColors })
    .eq('id', currentUser.id);

  if (error) {
    alert("Failed to save member colors: " + error.message);
  } else {
    alert("Member chat bubble colors saved permanently!");
    closeMemberColorsModal();
    // RE-FETCH MESSAGES TO IMMEDIATELY APPLY COLORS TO ALL PAST CHATS
    fetchMessages();
  }
}

function closeMemberColorsModal() {
  document.getElementById('member-colors-modal').classList.add('hidden');
}

// === SCREEN SWITCHING ===
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(screenId).classList.remove('hidden');
}

// === GROUPS & PASSCODE ===
async function loadUserGroups() {
  if (!currentUser) return;
  const { data, error } = await supabaseClient.from('group_members').select('group_id, groups(id, name, invite_code, creator_id, passcode)').eq('user_id', currentUser.id);
  const container = document.getElementById('groups-list');
  container.innerHTML = '';

  if (error) {
    container.innerHTML = '<p>Error loading groups.</p>';
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = '<p>No groups joined yet.</p>';
    return;
  }

  data.forEach(item => {
    if (item.groups) {
      const btn = document.createElement('button');
      btn.innerText = item.groups.name;
      btn.onclick = () => promptPasscode(item.groups);
      container.appendChild(btn);
    }
  });
}

function promptPasscode(group) {
  selectedGroupId = group;
  document.getElementById('passcode-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('passcode-input').focus(), 100);
}

async function verifyPasscode() {
  const enteredPass = document.getElementById('passcode-input').value;
  const { data, error } = await supabaseClient.from('groups').select('*').eq('id', selectedGroupId.id).single();

  if (error || !data) return alert("Group not found.");

  if (data.passcode === enteredPass) {
    currentGroup = data;
    document.getElementById('passcode-modal').classList.add('hidden');
    document.getElementById('passcode-input').value = '';
    enterChatRoom();
  } else {
    alert("Incorrect passcode!");
  }
}

async function createGroup() {
  const name = document.getElementById('new-group-name').value.trim();
  const passcode = document.getElementById('new-group-passcode').value.trim();

  if (!name || passcode.length !== 4) {
    return alert("Please supply a valid name and a 4-digit passcode.");
  }

  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const { data: groupData, error: groupErr } = await supabaseClient
    .from('groups')
    .insert([{ name, invite_code: inviteCode, passcode, creator_id: currentUser.id }])
    .select()
    .single();

  if (groupErr) return alert("Creation error: " + groupErr.message);

  await supabaseClient.from('group_members').insert([
    { group_id: groupData.id, user_id: currentUser.id, is_admin: true }
  ]);

  alert(`Group Created! Share this invite code: ${inviteCode}`);
  document.getElementById('new-group-name').value = '';
  document.getElementById('new-group-passcode').value = '';
  loadUserGroups();
}

async function joinGroup() {
  const inviteCode = document.getElementById('join-code').value.trim().toUpperCase();
  if (!inviteCode) return alert("Enter an invite code.");

  const { data: groupData, error } = await supabaseClient.from('groups').select('*').eq('invite_code', inviteCode).single();
  if (error || !groupData) return alert("Invalid invite code.");

  const { error: joinErr } = await supabaseClient.from('group_members').insert([
    { group_id: groupData.id, user_id: currentUser.id, is_admin: false }
  ]);

  if (joinErr) return alert("Already in group or error joining.");

  alert("Joined successfully!");
  document.getElementById('join-code').value = '';
  loadUserGroups();
}

// === MESSAGING & REALTIME ===
async function enterChatRoom() {
  showScreen('chat-screen');
  document.getElementById('current-group-title').innerText = currentGroup.name;
  document.getElementById('group-invite-display').innerText = `Code: ${currentGroup.invite_code}`;

  const hasAdminRights = isUserAdmin(currentUser, currentGroup);
  if (hasAdminRights) {
    document.getElementById('admin-panel-btn').classList.remove('hidden');
  } else {
    document.getElementById('admin-panel-btn').classList.add('hidden');
  }

  fetchMessages();
  subscribeToRealtime();
}

async function fetchMessages() {
  const { data, error } = await supabaseClient
    .from('messages')
    .select('*, profiles(username)')
    .eq('group_id', currentGroup.id)
    .order('created_at', { ascending: true });

  const container = document.getElementById('messages-container');
  container.innerHTML = '';

  if (error) {
    console.error("Error fetching messages:", error);
    return;
  }

  if (data) {
    data.forEach(msg => renderMessage(msg));
  }
  container.scrollTop = container.scrollHeight;
}

function renderMessage(msg) {
  const container = document.getElementById('messages-container');
  const isSelf = msg.user_id === currentUser.id;

  const wrapper = document.createElement('div');
  wrapper.className = `msg-wrapper ${isSelf ? 'self' : 'other'}`;
  wrapper.setAttribute('data-user-id', msg.user_id);

  const authorSpan = document.createElement('span');
  authorSpan.className = 'msg-author';
  authorSpan.innerText = msg.profiles ? msg.profiles.username : 'User';

  const bubble = document.createElement('div');
  bubble.className = `msg-bubble ${msg.is_broadcast ? 'broadcast' : ''}`;
  bubble.innerText = msg.content;

  // APPLY PER-MEMBER COLORS (FOR BOTH PAST AND NEW MESSAGES)
  if (userMemberColors && userMemberColors[msg.user_id]) {
    const custom = userMemberColors[msg.user_id];
    if (custom.bg) bubble.style.backgroundColor = custom.bg;
    if (custom.text) bubble.style.color = custom.text;
  }

  wrapper.appendChild(authorSpan);
  wrapper.appendChild(bubble);
  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
}

// INSTANT MESSAGE SENDING (Optimistic UI Update)
async function sendMessage() {
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';

  // Render message locally right away for instant feedback
  const tempMsg = {
    id: 'temp-' + Date.now(),
    user_id: currentUser.id,
    content: text,
    profiles: { username: (currentProfile && currentProfile.username) ? currentProfile.username : 'You' }
  };
  renderMessage(tempMsg);

  // Send request in background
  const { error } = await supabaseClient.from('messages').insert([{
    group_id: currentGroup.id,
    user_id: currentUser.id,
    content: text
  }]);

  if (error) {
    alert("Failed to send message: " + error.message);
  }
}

function subscribeToRealtime() {
  if (currentSubscription) supabaseClient.removeChannel(currentSubscription);

  currentSubscription = supabaseClient.channel('realtime:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `group_id=eq.${currentGroup.id}` }, async payload => {
      // Avoid duplicate rendering if message was optimistic self-insert
      if (payload.new.user_id === currentUser.id) return;

      const { data } = await supabaseClient.from('profiles').select('username').eq('id', payload.new.user_id).single();
      payload.new.profiles = data;
      renderMessage(payload.new);
      
      if (document.hidden) {
        updateFaviconBadge(true);
      }
    }).subscribe();
}

// === SUPER ADMIN ACTIONS ===
async function adminUpdateGroupName() {
  if (!ADMIN_PERMISSIONS.canChangeGroupName) {
    return alert("This admin feature is currently disabled.");
  }

  if (!isUserAdmin(currentUser, currentGroup)) {
    return alert("Unauthorized: Only admins can change group names.");
  }

  const newName = document.getElementById('admin-new-name').value.trim();
  if (!newName) return alert("Please enter a new name.");

  const { error } = await supabaseClient
    .from('groups')
    .update({ name: newName })
    .eq('id', currentGroup.id);

  if (error) {
    alert("Failed to update name: " + error.message);
  } else {
    currentGroup.name = newName;
    document.getElementById('current-group-title').innerText = newName;
    document.getElementById('admin-new-name').value = '';
    alert("Group name updated successfully!");
    closeAdminModal();
  }
}

async function adminUpdatePasscode() {
  if (!ADMIN_PERMISSIONS.canChangeGroupPasscode) {
    return alert("This admin feature is currently disabled.");
  }

  if (!isUserAdmin(currentUser, currentGroup)) {
    return alert("Unauthorized: Only admins can change group passcodes.");
  }

  const newPass = document.getElementById('admin-new-pass').value.trim();
  if (newPass.length !== 4) return alert("Passcode must be exactly 4 digits.");

  const { error } = await supabaseClient
    .from('groups')
    .update({ passcode: newPass })
    .eq('id', currentGroup.id);

  if (error) {
    alert("Failed to update passcode: " + error.message);
  } else {
    currentGroup.passcode = newPass;
    document.getElementById('admin-new-pass').value = '';
    alert("Group passcode updated for everyone!");
    closeAdminModal();
  }
}

// === MODAL HELPERS ===
function closePasscodeModal() { document.getElementById('passcode-modal').classList.add('hidden'); }
function openAdminModal() { document.getElementById('admin-modal').classList.remove('hidden'); }
function closeAdminModal() { document.getElementById('admin-modal').classList.add('hidden'); }
function openThemeModal() { document.getElementById('theme-modal').classList.remove('hidden'); }
function closeThemeModal() { document.getElementById('theme-modal').classList.add('hidden'); }
function leaveChatRoom() { showScreen('menu-screen'); loadUserGroups(); }
