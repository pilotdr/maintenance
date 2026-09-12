const DRHOME_API = "";

async function drhomeFetch(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(path, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

window.drhomeLogin = async function(email, password) {
  const res = await drhomeFetch(`/api/auth/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    credentials: 'same-origin',
    body: JSON.stringify({email: email.trim(), password})
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  return {ok: res.ok, status: res.status, data};
};

window.drhomeRegister = async function(payload) {
  const res = await drhomeFetch(`/api/register`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    credentials: 'same-origin',
    body: JSON.stringify(payload)
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  return {ok: res.ok, status: res.status, data};
};

window.drhomeLogout = async function() {
  try {
    await drhomeFetch(`/api/auth/logout`, {method:'POST', credentials:'same-origin'});
  } finally {
    location.href = '/login.html';
  }
};

window.drhomeRequireAuth = async function() {
  const page = location.pathname.split('/').pop() || 'index.html';
  if (['login.html','register.html','registration-pending.html'].includes(page)) return;
  try {
    const res = await drhomeFetch(`/api/auth/me`, {credentials:'same-origin'});
    if (!res.ok) location.replace('/login.html');
  } catch (_) {
    location.replace('/login.html');
  }
};

window.drhomeRequireAuth();
