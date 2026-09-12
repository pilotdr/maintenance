const $ = (id) => document.getElementById(id);
const err = $('error');

$('registerBtn').addEventListener('click', async () => {
  err.style.display = 'none';
  err.textContent = '';

  const payload = {
    firstName: $('firstName').value.trim(),
    lastName: $('lastName').value.trim(),
    email: $('email').value.trim(),
    phone: $('phone').value.trim(),
    password: $('password').value
  };

  if (!payload.firstName || !payload.lastName || !payload.email || !payload.phone || payload.password.length < 8) {
    err.textContent = 'Please complete all fields. Password must be at least 8 characters.';
    err.style.display = 'block';
    return;
  }

  if (payload.password !== $('password2').value) {
    err.textContent = 'Passwords do not match.';
    err.style.display = 'block';
    return;
  }

  const btn = $('registerBtn');
  btn.classList.add('busy');
  btn.textContent = 'Submitting…';

  try {
    const result = await window.drhomeRegister(payload);

    if (result.ok) {
      sessionStorage.setItem('drhome_pending_email', payload.email);
      location.href = '/registration-pending.html';
      return;
    }

    if (result.status === 409 && result.data?.error === 'registration_exists') {
      err.textContent = 'A registration request already exists for this email.';
    } else if (result.status === 409 && result.data?.error === 'account_exists') {
      err.textContent = 'An active account already exists for this email. Please sign in.';
    } else if (result.status === 400) {
      err.textContent = 'Please check your details and try again.';
    } else {
      err.textContent = `Registration failed (${result.status}). Please try again.`;
    }
    err.style.display = 'block';
  } catch (e) {
    console.error('Registration request failed', e);
    err.textContent = e?.name === 'AbortError'
      ? 'The server did not respond in time. Please try again.'
      : 'Could not reach the DR HOME server.';
    err.style.display = 'block';
  } finally {
    btn.classList.remove('busy');
    btn.textContent = 'Submit registration';
  }
});
