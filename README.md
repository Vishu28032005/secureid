# SecureID — Login & Registration Journey

Plain HTML / CSS / JS implementation of the login and registration flows
from the assignment mock screens. No frameworks, no build step — open
the files directly or serve them statically.

## Run locally

Any static server works, e.g.:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open `index.html` (login) or `register.html` (create account).

## Demo credentials (frontend-only, no backend)

| Field | Value |
|---|---|
| Email/username | `demo@secureid.io` |
| Password | `Passw0rd!` |
| OTP / authenticator code (every step) | `482913` |

Anything else on the login form shows the **Invalid credentials** state.
Wrong OTP codes decrement an attempts counter and eventually lock the
OTP screen (matches the "Wrong OTP" / "OTP Expired" / "Max attempts"
mocks). Letting the timer run out shows the expired state and unlocks
**Resend code**.

## How the screens map to code

Rather than building one static HTML file per mock screen, each *flow*
is a small state machine: one `<section data-screen="...">` per distinct
layout, with JS toggling which section is visible and re-rendering text/
error states inside it. That's what "Wrong OTP" and "OTP Expired" being
variations of the same OTP screen means in practice — same markup,
different state.

- `index.html` + `js/login.js` — **Login journey**
  - `login` screen doubles as both "Login (default)" and "Invalid
    credentials" (the error state just adds `.error` classes)
  - `choose-method` screen — Email OTP / SMS OTP / Authenticator App
  - `otp` screen — covers "Email OTP", "Wrong OTP", and "OTP Expired
    (timer & resend)" via `attemptsLeft` + `createTimer()`
- `register.html` + `js/register.js` — **Registration journey**
  - `details` screen — form with live password-rule checklist
  - `otp` screen, reused across three phases (`email`, `mobile`, `mfa`)
    — covers verification, wrong-code, and the mobile "max attempts
    reached" lockout screen
  - `mfa-choose` — Authenticator App / SMS / Email
  - `authenticator-setup` — QR code (generated locally as an SVG grid,
    no external QR library/network call) + "enter setup key" fallback
  - `success` — checklist + "Continue to Login"
- `css/styles.css` — all styling, one file, CSS custom properties for
  the color/spacing tokens
- `js/common.js` — reusable helpers: OTP-input wiring, countdown timer,
  screen switching, password-rule evaluation
- `js/icons.js` — small inline-SVG icon set (no icon font/CDN needed)

## Deploying to Vercel

```bash
npm i -g vercel     # if you don't have it
vercel --prod
```

It's a static site (no `build` step, no framework), so Vercel will
serve it as-is. Rename the project to `<your-name>-secureid` when
prompted (or in the Vercel dashboard → Settings → General) to match
`your-name-secureid.vercel.app`.

## What's mocked vs. real

This is a **frontend-only** demo — there's no server, database, or real
email/SMS/authenticator delivery. `verifyCredentials()` and the OTP
checks in `js/login.js` / `js/register.js` are the two places to swap
in real API calls once a backend exists.
