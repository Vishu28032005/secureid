/* ============================================================
   common.js — small DOM / logic helpers shared by both journeys.
   No frameworks, no build step: plain functions on window scope.
   ============================================================ */

/** Shorthand query helpers */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/**
 * Show exactly one "screen" element (by id) inside a container and
 * hide its siblings. Screens are plain <section data-screen="id"> nodes.
 */
function showScreen(containerSel, screenId) {
  const container = $(containerSel);
  $$('[data-screen]', container).forEach((el) => {
    el.classList.toggle('hidden', el.dataset.screen !== screenId);
  });
  container.scrollIntoView({ block: 'start', behavior: 'smooth' });
  const first = $(`[data-screen="${screenId}"] input, [data-screen="${screenId}"] button`, container);
  if (first) first.focus({ preventScroll: true });
}

function formatTime(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/**
 * Countdown timer bound to a DOM element's textContent.
 * onExpire fires once when it reaches zero.
 * Returns a controller so callers can restart/stop it (used by "Resend code").
 */
function createTimer(el, seconds, onExpire) {
  let remaining = seconds;
  let handle = null;

  function tick() {
    el.textContent = formatTime(remaining);
    el.classList.toggle('expired', remaining <= 0);
    if (remaining <= 0) {
      clearInterval(handle);
      handle = null;
      if (typeof onExpire === 'function') onExpire();
      return;
    }
    remaining -= 1;
  }

  function start(newSeconds = seconds) {
    remaining = newSeconds;
    if (handle) clearInterval(handle);
    tick();
    handle = setInterval(tick, 1000);
  }

  function stop() {
    if (handle) clearInterval(handle);
    handle = null;
  }

  start(seconds);
  return { start, stop };
}

/**
 * Wire up a row of single-digit OTP <input> boxes: auto-advance on type,
 * backspace jumps back, arrow keys move focus, and paste distributes digits.
 * Calls onComplete(code) once every box is filled.
 */
function setupOtpInputs(rowEl, onComplete) {
  const inputs = $$('input', rowEl);

  function currentValue() {
    return inputs.map((i) => i.value).join('');
  }

  inputs.forEach((input, idx) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '').slice(-1);
      if (input.value && idx < inputs.length - 1) inputs[idx + 1].focus();
      if (currentValue().length === inputs.length) onComplete(currentValue());
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) {
        inputs[idx - 1].focus();
      } else if (e.key === 'ArrowLeft' && idx > 0) {
        inputs[idx - 1].focus();
      } else if (e.key === 'ArrowRight' && idx < inputs.length - 1) {
        inputs[idx + 1].focus();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const digits = (e.clipboardData.getData('text').match(/\d/g) || []).slice(0, inputs.length);
      digits.forEach((d, i) => { if (inputs[i]) inputs[i].value = d; });
      const last = Math.min(digits.length, inputs.length) - 1;
      if (last >= 0) inputs[last].focus();
      if (currentValue().length === inputs.length) onComplete(currentValue());
    });
  });
}

function clearOtpInputs(rowEl) {
  $$('input', rowEl).forEach((i) => { i.value = ''; });
  rowEl.classList.remove('error', 'success', 'disabled');
  const first = $('input', rowEl);
  if (first) first.disabled = false;
}

function disableOtpInputs(rowEl, disabled) {
  $$('input', rowEl).forEach((i) => { i.disabled = disabled; });
}

function shake(el) {
  el.classList.remove('shake');
  // force reflow so the animation can retrigger
  void el.offsetWidth;
  el.classList.add('shake');
}

/** Toggle a password-visibility button + its paired input. */
function wirePasswordToggle(toggleBtn, input) {
  toggleBtn.addEventListener('click', () => {
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    toggleBtn.innerHTML = isHidden ? icon('eyeOff') : icon('eye');
    toggleBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
  });
}

/** Password rule checklist: returns {met: boolean, results: {ruleKey: bool}} */
const PASSWORD_RULES = [
  { key: 'len', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'upper', label: '1 uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { key: 'num', label: '1 number', test: (v) => /[0-9]/.test(v) },
  { key: 'special', label: '1 special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function evaluatePassword(value) {
  const results = {};
  let allMet = true;
  PASSWORD_RULES.forEach((rule) => {
    const ok = rule.test(value);
    results[rule.key] = ok;
    if (!ok) allMet = false;
  });
  return { met: allMet, results };
}

function renderPasswordRules(listEl, value) {
  const { results } = evaluatePassword(value);
  PASSWORD_RULES.forEach((rule) => {
    const li = $(`[data-rule="${rule.key}"]`, listEl);
    if (!li) return;
    li.classList.toggle('met', results[rule.key]);
    li.querySelector('.rule-icon').innerHTML = results[rule.key] ? icon('check') : icon('checkCircle');
  });
  return evaluatePassword(value).met;
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function isValidMobile(v) {
  return /^[0-9]{10}$/.test(v.replace(/[^0-9]/g, ''));
}
