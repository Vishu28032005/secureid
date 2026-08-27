/* ============================================================
   register.js — state machine for the Registration journey
   (register.html). Frontend-only demo — see login.js for the
   same disclaimer about swapping in real API calls.
   ============================================================ */

const DEMO_OTP_REG = '482913';
const OTP_TTL = 165;        // 02:45
const MAX_ATTEMPTS = 3;     // 3rd wrong attempt triggers lockout

const STEP_DOTS = { details: 1, email: 2, mobile: 3, 'mfa-choose': 4, 'authenticator-setup': 4, mfa: 5, success: 5 };

const reg = {
  fullName: '',
  email: '',
  mobile: '',
  mfaMethod: 'authenticator',
};

const otp = {
  phase: 'email',      // 'email' | 'mobile' | 'mfa'
  attemptsLeft: MAX_ATTEMPTS,
  timer: null,
  backTarget: 'details',
};

document.addEventListener('DOMContentLoaded', () => {
  renderStaticIcons();
  wirePasswordToggle($('#toggleRegPw'), $('#regPassword'));
  setupOtpInputs($('#otpRow'), onOtpFilled);

  $('#regPassword').addEventListener('input', (e) => renderPasswordRules($('#pwRules'), e.target.value));

  $('#detailsForm').addEventListener('submit', handleDetailsSubmit);
  $('#otpBack').addEventListener('click', () => showScreen('#registerApp', otp.backTarget));
  $('#resendBtn').addEventListener('click', resendOtp);
  $('#verifyOtpBtn').addEventListener('click', () => attemptVerify());
  $('#changeNumberLink').addEventListener('click', (e) => { e.preventDefault(); showScreen('#registerApp', 'details'); $('#regMobile').focus(); });

  $('#mfaContinueBtn').addEventListener('click', handleMfaChoice);
  $$('input[name="mfaMethod"]').forEach((r) => r.addEventListener('change', (e) => { reg.mfaMethod = e.target.value; }));

  $$('.back-btn[data-back]').forEach((b) => b.addEventListener('click', () => showScreen('#registerApp', b.dataset.back)));
  $('#toggleSetupKey').addEventListener('click', () => $('#secretKeyBox').classList.toggle('hidden'));
  $('#authSetupContinue').addEventListener('click', () => goToOtpScreen('mfa'));

  $('#qrBox').innerHTML = generateQrPlaceholder();
});

function renderStaticIcons() {
  $('#brandMark').innerHTML = `${icon('shield')}<span>SecureID</span>`;
  $$('[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
  $('.card-icon.success').innerHTML = icon('checkCircle');
  $('#mfaChooseIcon').innerHTML = icon('shield');
  $$('.err-icon').forEach((el) => { el.innerHTML = icon('alertCircle'); el.style.display = 'inline-flex'; });
  $$('#successList .li-icon').forEach((el) => { el.innerHTML = icon('checkCircle'); });
}

/* ---------------- SCREEN 1: details ---------------- */

function handleDetailsSubmit(e) {
  e.preventDefault();
  let ok = true;

  const fullName = $('#fullName').value.trim();
  const email = $('#regEmail').value.trim();
  const mobile = $('#regMobile').value.trim();
  const password = $('#regPassword').value;

  ok = validateField('fieldName', fullName.length >= 2) && ok;
  ok = validateField('fieldEmail', isValidEmail(email)) && ok;
  ok = validateField('fieldMobile', isValidMobile(mobile)) && ok;

  const pwOk = renderPasswordRules($('#pwRules'), password);
  if (!pwOk) ok = false;

  if (!$('#agreeTerms').checked) {
    ok = false;
    shake($('#agreeTerms').closest('.checkbox-row'));
  }

  if (!ok) return;

  reg.fullName = fullName;
  reg.email = email;
  reg.mobile = mobile;

  goToOtpScreen('email');
}

function validateField(fieldId, isOk) {
  $(`#${fieldId}`).classList.toggle('error', !isOk);
  return isOk;
}

/* ---------------- SCREENS 2/2a/2b + 3/3a/3b + 6/6a: shared OTP screen ---------------- */

const OTP_PHASE_CONFIG = {
  email: {
    title: 'Verify your email',
    icon: 'mail',
    destination: () => reg.email,
    backTarget: 'details',
    next: () => goToOtpScreen('mobile'),
    lockoutHasChangeLink: false,
  },
  mobile: {
    title: 'Verify your mobile',
    icon: 'phone',
    destination: () => reg.mobile,
    backTarget: 'details',
    next: () => showScreen('#registerApp', 'mfa-choose'),
    lockoutHasChangeLink: true,
  },
  mfa: {
    title: 'Enter the 6-digit code',
    icon: 'shield',
    destination: () => (reg.mfaMethod === 'authenticator' ? 'your authenticator app' : reg.mfaMethod === 'sms' ? reg.mobile : reg.email),
    backTarget: () => (reg.mfaMethod === 'authenticator' ? 'authenticator-setup' : 'mfa-choose'),
    next: () => finishRegistration(),
    lockoutHasChangeLink: false,
  },
};

function goToOtpScreen(phase) {
  otp.phase = phase;
  otp.attemptsLeft = MAX_ATTEMPTS;
  const cfg = OTP_PHASE_CONFIG[phase];
  otp.backTarget = typeof cfg.backTarget === 'function' ? cfg.backTarget() : cfg.backTarget;

  $('#otpTitle').textContent = cfg.title;
  $('#otpIcon').innerHTML = icon(cfg.icon);
  $('#otpDestination').textContent = cfg.destination();
  $('#wrongNumberRow').style.display = 'none';

  setStepDots(phase);
  resetOtpScreen();
  showScreen('#registerApp', 'otp');
  startOtpTimer();
}

function resetOtpScreen() {
  clearOtpInputs($('#otpRow'));
  $('#otpMsg').textContent = '';
  $('#otpMsg').className = 'otp-msg';
  $('#verifyOtpBtn').disabled = true;
  $('#verifyOtpBtn').textContent = 'Continue';
  $('#resendBtn').disabled = true;
  $('#resendBtn').textContent = 'Resend code';
  $('#otpResendLine').style.display = '';
  $('#otpExpiryLabel').style.display = '';
}

function startOtpTimer() {
  if (otp.timer) otp.timer.stop();
  otp.timer = createTimer($('#otpTimer'), OTP_TTL, onOtpExpired);
  $('#resendBtn').disabled = true;
}

function onOtpExpired() {
  disableOtpInputs($('#otpRow'), true);
  $('#otpRow').classList.add('disabled');
  $('#otpMsg').textContent = 'Code expired.';
  $('#otpMsg').className = 'otp-msg error';
  $('#verifyOtpBtn').disabled = true;
  $('#resendBtn').disabled = false;
}

function resendOtp() {
  resetOtpScreen();
  disableOtpInputs($('#otpRow'), false);
  otp.attemptsLeft = MAX_ATTEMPTS;
  $('#wrongNumberRow').style.display = 'none';
  startOtpTimer();
}

function onOtpFilled() {
  $('#verifyOtpBtn').disabled = false;
}

function attemptVerify() {
  const code = $$('input', $('#otpRow')).map((i) => i.value).join('');
  if (code.length < 6) return;

  if (code === DEMO_OTP_REG) {
    otp.timer && otp.timer.stop();
    $('#otpRow').classList.remove('error');
    $('#otpRow').classList.add('success');
    OTP_PHASE_CONFIG[otp.phase].next();
    return;
  }

  otp.attemptsLeft -= 1;
  const row = $('#otpRow');
  row.classList.add('error');
  shake(row);
  $('#verifyOtpBtn').disabled = true;

  if (otp.attemptsLeft <= 0) {
    lockOtpScreen();
  } else {
    $('#otpMsg').innerHTML = `Incorrect code. Please try again. <span class="attempts-left">You have ${otp.attemptsLeft} attempt${otp.attemptsLeft === 1 ? '' : 's'} left.</span>`;
    $('#otpMsg').className = 'otp-msg error';
    setTimeout(() => { clearOtpInputs(row); $('input', row).focus(); }, 500);
  }
}

function lockOtpScreen() {
  otp.timer && otp.timer.stop();
  disableOtpInputs($('#otpRow'), true);
  $('#otpRow').classList.add('disabled');
  $('#otpMsg').textContent = 'Maximum attempts reached. Please request a new code.';
  $('#otpMsg').className = 'otp-msg error';
  $('#otpExpiryLabel').style.display = 'none';
  $('#resendBtn').disabled = false;
  $('#resendBtn').textContent = 'Resend New Code';
  const cfg = OTP_PHASE_CONFIG[otp.phase];
  $('#wrongNumberRow').style.display = cfg.lockoutHasChangeLink ? '' : 'none';
}

/* ---------------- SCREEN 4: choose MFA method ---------------- */

function handleMfaChoice() {
  if (reg.mfaMethod === 'authenticator') {
    setStepDots('authenticator-setup');
    showScreen('#registerApp', 'authenticator-setup');
  } else {
    goToOtpScreen('mfa');
  }
}

/* ---------------- SCREEN 5: authenticator QR ---------------- */

/** Deterministic pseudo-QR grid — visual only, not a real scannable code. */
function generateQrPlaceholder() {
  const size = 21;
  const cell = 8;
  const seedStr = reg.email || 'secureid-demo';
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

  let rects = '';
  const isFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFinder(r, c)) continue;
      if (rand() > 0.55) rects += `<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="#111827"/>`;
    }
  }

  function finderPattern(x, y) {
    return `
      <rect x="${x}" y="${y}" width="${7 * cell}" height="${7 * cell}" fill="#111827"/>
      <rect x="${x + cell}" y="${y + cell}" width="${5 * cell}" height="${5 * cell}" fill="#fff"/>
      <rect x="${x + 2 * cell}" y="${y + 2 * cell}" width="${3 * cell}" height="${3 * cell}" fill="#111827"/>`;
  }

  const px = size * cell;
  return `<svg viewBox="0 0 ${px} ${px}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Authenticator app QR code">
    <rect width="${px}" height="${px}" fill="#fff"/>
    ${rects}
    ${finderPattern(0, 0)}
    ${finderPattern((size - 7) * cell, 0)}
    ${finderPattern(0, (size - 7) * cell)}
  </svg>`;
}

/* ---------------- Step dots ---------------- */

function setStepDots(screenKey) {
  const active = STEP_DOTS[screenKey] || 1;
  $$('#stepTrack .dot').forEach((dot) => {
    const n = Number(dot.dataset.step);
    dot.classList.toggle('active', n === active);
    dot.classList.toggle('done', n < active);
  });
}

/* ---------------- SCREEN 7: success ---------------- */

function finishRegistration() {
  setStepDots('success');
  showScreen('#registerApp', 'success');
}
