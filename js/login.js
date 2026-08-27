/* ============================================================
   login.js — state machine for the Login journey (index.html)

   This is a FRONTEND-ONLY demo: there is no real backend, so
   "auth" is simulated against constants below. Swap verifyCredentials()
   and verifyOtp() for real API calls when wiring this to a server.
   ============================================================ */

const DEMO_USER = { identifier: 'demo@secureid.io', password: 'Passw0rd!' };
const DEMO_OTP = '482913';
const OTP_TTL_SECONDS = 165; // 02:45, matches the mock
const MAX_OTP_ATTEMPTS = 2;

const state = {
  method: 'email',
  attemptsLeft: MAX_OTP_ATTEMPTS,
  timer: null,
};

document.addEventListener('DOMContentLoaded', () => {
  // Render icons
  $('#brandMark').innerHTML = `${icon('shield')}<span>SecureID</span>`;
  $('#idIcon').innerHTML = icon('user');
  $('#pwIcon').innerHTML = icon('lock');
  $('#togglePw').innerHTML = icon('eye');
  $('#googleIcon').innerHTML = icon('google');
  $('#shieldIcon2').innerHTML = icon('shield');
  $('.card-icon.success').innerHTML = icon('checkCircle');
  $$('.err-icon').forEach((el) => { el.innerHTML = icon('alertCircle'); el.style.display = 'inline-flex'; });
  $$('.m-icon').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });

  wirePasswordToggle($('#togglePw'), $('#password'));
  setupOtpInputs($('#otpRow'), onOtpFilled);

  $('#loginForm').addEventListener('submit', handleLoginSubmit);
  $$('.back-btn').forEach((b) => b.addEventListener('click', () => showScreen('#loginApp', b.dataset.back)));
  $$('.method-card').forEach((card) => card.addEventListener('click', () => selectMethod(card)));
  $('#continueMethod').addEventListener('click', goToOtpScreen);
  $('#resendBtn').addEventListener('click', resendOtp);
  $('#verifyOtpBtn').addEventListener('click', () => attemptVerify($('#otpRow')));
  $('#restartBtn').addEventListener('click', resetJourney);
  $('#googleBtn').addEventListener('click', () => alert('This demo only implements email/password + OTP login.'));
  $('#forgotPwLink').addEventListener('click', (e) => e.preventDefault());
});

/* ---------------- Screen 1 / 2: credentials ---------------- */

function handleLoginSubmit(e) {
  e.preventDefault();
  const identifier = $('#identifier').value.trim();
  const password = $('#password').value;
  clearFieldError();

  if (!identifier || !password) {
    setFieldError('Enter your email/username and password.');
    return;
  }

  if (verifyCredentials(identifier, password)) {
    showScreen('#loginApp', 'choose-method');
  } else {
    setFieldError('Invalid email or password. Please try again.');
    shake($('#loginForm'));
  }
}

function verifyCredentials(identifier, password) {
  return identifier === DEMO_USER.identifier && password === DEMO_USER.password;
}

function setFieldError(message) {
  $('#fieldIdentifier').classList.add('error');
  $('#fieldPassword').classList.add('error');
  $('#fieldIdentifier .field-error span:last-child').textContent = message;
}

function clearFieldError() {
  $('#fieldIdentifier').classList.remove('error');
  $('#fieldPassword').classList.remove('error');
}

/* ---------------- Screen 3: choose method ---------------- */

function selectMethod(card) {
  $$('.method-card').forEach((c) => {
    c.classList.remove('selected');
    $('input', c).checked = false;
  });
  card.classList.add('selected');
  $('input', card).checked = true;
  state.method = card.dataset.method;
}

function goToOtpScreen() {
  state.attemptsLeft = MAX_OTP_ATTEMPTS;
  const labels = {
    email: { title: 'Verify your email', icon: 'mail', dest: 'priya.sharma@email.com', copy: 'email' },
    sms: { title: 'Verify your mobile', icon: 'phone', dest: '+91 98765 43210', copy: 'mobile number' },
    authenticator: { title: 'Enter authenticator code', icon: 'key', dest: 'your authenticator app', copy: 'authenticator app' },
  };
  const cfg = labels[state.method];
  $('#otpTitle').textContent = cfg.title;
  $('#otpIcon').innerHTML = icon(cfg.icon);
  $('#otpDestination').textContent = cfg.dest;
  $('#otpExpiryLabel').innerHTML = `Code expires in <span class="timer" id="otpTimer">--:--</span>`;

  resetOtpScreen();
  showScreen('#loginApp', 'otp');
  startOtpTimer();
}

/* ---------------- Screens 4 / 5 / 6: OTP verify / wrong / expired ---------------- */

function resetOtpScreen() {
  clearOtpInputs($('#otpRow'));
  $('#otpMsg').textContent = '';
  $('#otpMsg').className = 'otp-msg';
  $('#verifyOtpBtn').disabled = true;
  $('#verifyOtpBtn').textContent = 'Verify & Login';
  $('#resendBtn').disabled = true;
}

function startOtpTimer() {
  if (state.timer) state.timer.stop();
  state.timer = createTimer($('#otpTimer'), OTP_TTL_SECONDS, onOtpExpired);
  $('#resendBtn').disabled = true;
}

function onOtpExpired() {
  disableOtpInputs($('#otpRow'), true);
  $('#otpRow').classList.add('disabled');
  $('#otpMsg').textContent = 'Code expired.';
  $('#otpMsg').className = 'otp-msg error';
  $('#verifyOtpBtn').disabled = true;
  $('#resendBtn').disabled = false;
  $('#otpExpiryLabel').innerHTML = `You can request a new code in <span class="timer">00:00</span>`;
}

function resendOtp() {
  resetOtpScreen();
  disableOtpInputs($('#otpRow'), false);
  state.attemptsLeft = MAX_OTP_ATTEMPTS;
  $('#otpExpiryLabel').innerHTML = `Code expires in <span class="timer" id="otpTimer">--:--</span>`;
  startOtpTimer();
}

function onOtpFilled() {
  $('#verifyOtpBtn').disabled = false;
}

function attemptVerify(rowEl) {
  const code = $$('input', rowEl).map((i) => i.value).join('');
  if (code.length < 6) return;

  if (code === DEMO_OTP) {
    state.timer && state.timer.stop();
    rowEl.classList.remove('error');
    rowEl.classList.add('success');
    $('#otpMsg').textContent = '';
    showScreen('#loginApp', 'success');
    return;
  }

  // Wrong code (screen 5)
  state.attemptsLeft -= 1;
  rowEl.classList.add('error');
  shake(rowEl);
  $('#verifyOtpBtn').disabled = true;

  if (state.attemptsLeft <= 0) {
    $('#otpMsg').textContent = 'Incorrect code. No attempts left — please resend a new code.';
    $('#otpMsg').className = 'otp-msg error';
    onOtpExpired();
  } else {
    $('#otpMsg').innerHTML = `Incorrect code. Please try again. <span class="attempts-left">${state.attemptsLeft} attempt${state.attemptsLeft === 1 ? '' : 's'} left.</span>`;
    $('#otpMsg').className = 'otp-msg error';
    setTimeout(() => {
      clearOtpInputs(rowEl);
      $('input', rowEl).focus();
    }, 500);
  }
}

/* ---------------- Success ---------------- */

function resetJourney() {
  state.timer && state.timer.stop();
  $('#loginForm').reset();
  clearFieldError();
  showScreen('#loginApp', 'login');
}
