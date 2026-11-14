# KasperoConnect Documentation v1.3

Add sign-in to your website. Let users sign in with their Kaspa wallet, a Kasla account, Google, or email.
> **Using AI to build your site?** See our [No-Code Integration Guide](kasperoconnect-nocode-guide.md) with copy-paste prompts for Replit, Cursor, and other AI coding tools.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Configuration](#configuration)
3. [Authentication Methods](#authentication-methods)
4. [Button Styles and Themes](#button-styles-and-themes)
5. [JavaScript API](#javascript-api)
6. [Redirect Sign-Ins (Kasla, Google)](#redirect-sign-ins-kasla-google)
7. [Verifying the Token](#verifying-the-token)
8. [The Connect Result](#the-connect-result)
9. [Session Management](#session-management)
10. [Email Sign-In and Custom Signup Fields](#email-sign-in-and-custom-signup-fields)
11. [Troubleshooting](#troubleshooting)
12. [FAQ](#faq)
13. [Changelog](#changelog)

---

## Quick Start

### 1. Get Your Merchant ID

Sign up at [kasperopay.com/merchant](https://kasperopay.com/merchant) to get your merchant ID (e.g., `kpm_abc123xy`).

### 2. Add the Widget

```html
<div id="kaspero-connect-button"
     data-merchant="kpm_YOUR_MERCHANT_ID"
     data-wallets="kasware,kastle,kaspire,kasla,google,email">
</div>
<script src="https://kasperopay.com/connect/widget.js"></script>
```

That's it! You now have a "Connect" button.

### 3. Handle the Connection

Register one listener when the page loads. It fires for every sign-in method, including the ones that leave your site and come back (Kasla, Google).

```javascript
window.addEventListener('kaspero-connect', function (e) {
    var result = e.detail;
    // result.token      - JWT for your backend (verify it server-side, see below)
    // result.walletType - 'kasware', 'kastle', 'kaspire', 'kasla', 'email', or null for Google
    // result.user       - details about the user (shape depends on the method)

    sendTokenToMyServer(result.token);
});
```

The classic callback works too and receives the same object:

```javascript
window.KasperoConnect.onConnect = function (result) { /* same as above */ };
```

---

## Configuration

### Data Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-merchant` | No | Your merchant ID. Associates sign-ins with your account and loads your saved Connect settings |
| `data-wallets` | No | Comma-separated sign-in methods to show |
| `data-style` | No | Button style: `institutional` (default), `kaspa`, `minimal`, `dark` |
| `data-theme` | No | Modal theme: `light` (default) or `dark` |
| `data-button-text` | No | Button text (default: "Connect") |
| `data-modal-title` | No | Title of the sign-in modal (default: "Connect") |
| `data-signup-endpoint` | No | Your own endpoint for email signups (see [Email Sign-In](#email-sign-in-and-custom-signup-fields)) |
| `data-signup-fields` | No | Comma-separated signup field presets, e.g. `email,password,name` |
| `data-login-endpoint` | No | Your own endpoint for email logins |

### Example: Full Configuration

```html
<div id="kaspero-connect-button"
     data-merchant="kpm_abc123xy"
     data-wallets="kasware,kastle,kaspire,kasla,google"
     data-style="dark"
     data-theme="dark"
     data-button-text="Sign In"
     data-modal-title="Sign in to My Store">
</div>
<script src="https://kasperopay.com/connect/widget.js"></script>
```

### Dashboard Settings vs. Attributes

When `data-merchant` is set, the widget loads the Connect settings saved in your merchant dashboard. Which one wins:

| Setting | Winner |
|---------|--------|
| Sign-in methods | `data-wallets` if present, otherwise the dashboard list |
| Theme and button style | The dashboard setting. `data-theme` and `data-style` only apply when `data-merchant` is not set |
| Signup / login endpoints and fields | The dashboard setting, if one is saved |

Options passed to `KasperoConnect.connect({...})` apply to that call and override both.

---

## Authentication Methods

### Available Methods

| Method | Value | Description | Works On |
|--------|-------|-------------|----------|
| Kasware | `kasware` | Browser extension | Desktop |
| Kastle | `kastle` | Browser extension | Desktop |
| Kaspire | `kaspire` | Browser extension | Desktop |
| Kasla | `kasla` | Kasla wallet account (redirect) | All devices |
| Google | `google` | Google account (redirect) | All devices |
| Email | `email` | Email and password | All devices |

### Usage

```html
<!-- Wallet-only authentication -->
<div id="kaspero-connect-button"
     data-wallets="kasware,kastle,kaspire,kasla">
</div>

<!-- Social / email only -->
<div id="kaspero-connect-button"
     data-wallets="google,email">
</div>

<!-- Mobile-friendly (no browser extensions) -->
<div id="kaspero-connect-button"
     data-wallets="kasla,google,email">
</div>
```

### Default Behavior

- Without `data-wallets` and without `data-merchant`: Kasware, Kastle, Kaspire, Kasla, Google, Email.
- With `data-merchant` and no `data-wallets`: the methods enabled in your dashboard (Kaspire has to be enabled there, or listed in `data-wallets`).
- Extension wallets appear only on desktop, and only when the extension is installed in the visitor's browser. A visitor without any of them simply does not see those options.

### Method Details

**Kasware, Kastle, Kaspire** (Browser Extensions)
- The wallet asks the user to sign a short message: `Sign in to yoursite.com with KasperoConnect. This does not move any money.`
- No redirect; `onConnect` fires on the same page
- Kaspire must be on Kaspa Mainnet

**Kasla** (Wallet Account)
- Works on any browser, including mobile
- Redirects to Kasla and back to the page the user started on
- Gives you a Kaspa address, and the session can be used by KasperoPay on the same site

**Google**
- Redirects to Google and back
- Identity only: no Kaspa address, and `walletType` is `null`

**Email**
- Email and password, with "Create account" and "Forgot password" in the same modal
- Uses your own endpoints, or KasperoConnect's hosted customer list if you do not set any

---

## Button Styles and Themes

The button and the modal are styled separately.

| `data-style` | Button |
|--------------|--------|
| `institutional` | Navy gradient (default) |
| `kaspa` | Kaspa teal |
| `minimal` | White with a thin border |
| `dark` | Near-black |

| `data-theme` | Modal |
|--------------|-------|
| `light` | Light background, dark text (default) |
| `dark` | Dark background, light text |

```html
<div id="kaspero-connect-button"
     data-style="kaspa"
     data-theme="dark">
</div>
```

---

## JavaScript API

### Programmatic Connection

Instead of using the button, open the sign-in modal yourself:

```javascript
window.KasperoConnect.connect({
    wallets: ['kasware', 'kastle', 'kasla', 'google'],
    onConnect: function (result) {
        console.log('Connected!', result.token, result.walletType, result.user);
    },
    onCancel: function () {
        console.log('User closed the modal');
    }
});
```

`connect()` returns a Promise that resolves to `true` when the user signed in on this page, and `false` when they closed the modal or were redirected to Kasla or Google.

### Full Options

```javascript
window.KasperoConnect.connect({
    merchant: 'kpm_abc123xy',                 // associate sign-ins with your account
    wallets: ['kasware', 'kastle', 'kaspire', 'kasla', 'google', 'email'],
    forceNew: false,                          // true = show the modal even if already connected
    theme: 'dark',                            // modal theme
    modalTitle: 'Sign in',
    signup: { endpoint: '...', fields: [] },  // see Email Sign-In
    login:  { endpoint: '...' },

    onConnect: function (result) { },         // any successful sign-in
    onSignup:  function (result) { },         // email: account created
    onLogin:   function (result) { },         // email: signed in
    onCancel:  function () { },               // modal closed
    onError:   function (message) { }         // message is a string
});
```

Two things to know:

- If the user is already connected and `forceNew` is not set, `connect()` skips the modal and calls `onConnect` immediately with the existing session.
- The callbacks you pass to `connect()` replace the global `KasperoConnect.onConnect` for as long as the page lives, and they do not survive the Kasla or Google redirect (the page reloads). The `kaspero-connect` window event is not affected by either, which is why Quick Start uses it.

### Other Methods

```javascript
KasperoConnect.isReady();        // widget initialised
KasperoConnect.isConnected();    // true when a session token is held
KasperoConnect.getToken();       // the JWT, or null
KasperoConnect.getUser();        // the user object, or null
KasperoConnect.getWalletType();  // 'kasware' | 'kastle' | 'kaspire' | 'kasla' | 'email' | null
KasperoConnect.disconnect();     // clear the session

// Set defaults without opening the modal
KasperoConnect.configure({
    merchant: 'kpm_abc123xy',
    wallets: ['kasla', 'google'],
    theme: 'dark',
    style: 'kaspa',
    signup: { /* ... */ },
    login:  { /* ... */ }
});

KasperoConnect.WALLETS;  // { KASWARE: 'kasware', KASTLE: 'kastle', KASPIRE: 'kaspire', KASLA: 'kasla', GOOGLE: 'google', EMAIL: 'email', ... }
KasperoConnect.FIELDS;   // signup field presets, see Email Sign-In
```

---

## Redirect Sign-Ins (Kasla, Google)

Kasla and Google send the user away from your site and back. **The widget handles the return itself.** You do not read anything from the URL.

What happens:

1. The user picks Kasla or Google. The widget remembers a one-time code in the browser tab and redirects.
2. After sign-in, the user lands back on the same page (same path and query string).
3. The widget checks the one-time code, confirms the token with KasperoConnect, saves the session, and only then fires `kaspero-connect` and `onConnect`.

What you need to do:

- Load the widget on the page the user returns to (it is the page they started from).
- Register your `kaspero-connect` listener, or set `KasperoConnect.onConnect`, when the page loads. A callback passed to `connect()` before the redirect is gone after the reload.

```javascript
// Runs on every page load. Fires right after a Kasla or Google return,
// and for extension and email sign-ins as well.
window.addEventListener('kaspero-connect', function (e) {
    sendTokenToMyServer(e.detail.token);
});

// For users who were already signed in on an earlier visit:
document.addEventListener('DOMContentLoaded', function () {
    if (window.KasperoConnect && KasperoConnect.isConnected()) {
        showSignedInUI();
    }
});
```

### Upgrading from v1.2

Earlier versions returned the token in the query string (`?kc_connected=true&token=...`) and the docs told you to read it yourself. That no longer works, on purpose:

- The token never appears in the query string any more, so it stays out of your server logs.
- A sign-in link made by someone else is refused. Before, a crafted link could sign a visitor into the link author's account.

If your site has code that reads `kc_connected`, `token`, `kc_token`, `google_connected` or `kasla_connected` from `window.location.search`, delete it and use the listener above.

---

## Verifying the Token

The token is a JWT signed by KasperoConnect. Your server cannot check the signature itself (it does not hold the key), so **do not** `jwt.decode()` it and trust the contents: anyone can forge an unsigned payload. Ask KasperoConnect instead, then issue your own session token for your own app.

**Server-side (Node.js), wallet, Kasla and Google tokens:**

```javascript
const jwt = require('jsonwebtoken');
const MY_ORIGIN = 'https://yoursite.com';

// POST /api/auth/kaspero  { token }
app.post('/api/auth/kaspero', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'No token' });

    // 1. Ask KasperoConnect whether this token is real
    const kpRes = await fetch('https://kasperopay.com/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!kpRes.ok) return res.status(401).json({ error: 'Invalid token' });
    const { valid, user } = await kpRes.json();
    if (!valid || !user) return res.status(401).json({ error: 'Invalid token' });

    // 2. Make sure the token was issued for YOUR site, not for another site
    //    the same person signed in to
    if (user.site && user.site !== MY_ORIGIN) {
        return res.status(401).json({ error: 'Token issued for another site' });
    }

    // 3. Find or create the user in YOUR database
    //    user.id      - stable KasperoConnect user id
    //    user.address - Kaspa address (wallet methods and Kasla; null for Google)
    const localUser = await findOrCreateUser({ kasperoId: user.id, address: user.address });

    // 4. Issue YOUR session token, with YOUR expiry
    const session = jwt.sign({ userId: localUser.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token: session, user: localUser });
});
```

`GET /api/auth/verify` responds with:

```json
{
    "valid": true,
    "user": {
        "id": 1234,
        "address": "kaspa:qz...",
        "walletType": "kasla",
        "merchantId": "kpm_abc123xy",
        "site": "https://yoursite.com",
        "isAdmin": false,
        "profile": { }
    }
}
```

`site` is the origin the token was issued for. It is `null` for sites not served over https. `profile` holds the account record (for example `keystone_email` for Kasla users and `google_email` for Google users); treat everything in it as informational, its fields may change.

**Email tokens** come from a different place. If you use your own signup and login endpoints, the token is whatever your endpoint returned and you verify it yourself. If you use the hosted option, verify with:

```
GET https://kasperopay.com/connect/auth/verify
Authorization: Bearer <token>

{ "success": true, "user": { "id": 57, "email": "user@example.com", "name": "..." } }
```

The frontend then stores *your* session token and forgets the KasperoConnect one. This keeps your users signed in for as long as you decide, independent of their wallet extension.

**Client-side decode (display only):**

```javascript
function decodeJWT(token) {
    return JSON.parse(atob(token.split('.')[1]));
}
// Fine for showing an address in the UI. Never for authorization.
```

---

## The Connect Result

`onConnect`, `onLogin`, `onSignup` and the `kaspero-connect` event all receive the same wrapper:

| Property | Type | Description |
|----------|------|-------------|
| `token` | string | JWT signed by KasperoConnect (or by your own endpoint, for email) |
| `walletType` | string or null | `kasware`, `kastle`, `kaspire`, `kasla`, `email`; `null` for Google |
| `user` | object | Depends on the method, see below |

`onSignup` additionally receives `formData`: the raw submitted fields, password included. Do not store it.

### Examples

**Kasware / Kastle / Kaspire:**
```javascript
{
    token: "eyJ...",
    walletType: "kasware",
    user: { id: 1234, address: "kaspa:qz...", isNewUser: false, isAdmin: false, profile: { } }
}
```

**Kasla (after the redirect):**
```javascript
{
    token: "eyJ...",
    walletType: "kasla",
    user: { id: 1234, address: "kaspa:qz...", walletType: "kasla", merchantId: "kpm_abc123xy",
            site: "https://yoursite.com", isAdmin: false, profile: { } }
}
```

**Google (after the redirect):**
```javascript
{
    token: "eyJ...",
    walletType: null,                 // identity only, no wallet
    user: { id: 1234, address: null, walletType: "google", site: "https://yoursite.com", profile: { } }
}
```

**Email:**
```javascript
{
    token: "eyJ...",
    walletType: "email",
    user: { id: 57, email: "user@example.com", name: "..." }   // whatever the login endpoint returned
}
```

The dependable parts are `token`, `walletType`, `user.id` and `user.address`. For anything that matters, use the server-side verification above rather than the object in the browser.

---

## Session Management

### What the Widget Stores

The widget keeps its own connection state in the browser so returning users are recognised:

| Storage | Keys | Purpose |
|---------|------|---------|
| `localStorage` | `kc_token`, `kc_wallet`, `kc_user` | The Connect session |
| `localStorage` | `kp_token`, `kp_wallet` | Shared with the KasperoPay widget for wallet sign-ins, so a connected user can pay without signing in again |
| `sessionStorage` | `kc_oauth_state` | The one-time code for a Kasla or Google redirect in progress |

That is the widget's memory, not your app's session. Store your own token, obtained from the exchange in [Verifying the Token](#verifying-the-token), and drive your UI from that:

```javascript
window.addEventListener('kaspero-connect', async function (e) {
    const res = await fetch('/api/auth/kaspero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: e.detail.token })
    });
    const data = await res.json();
    localStorage.setItem('session_token', data.token);   // YOUR token
});

// On page load, restore session
if (localStorage.getItem('session_token')) {
    showDashboard();
} else {
    showLoginButton();
}
```

> ⚠️ **Do not name your own keys `token` or `walletType`.** `KasperoConnect.disconnect()` and every fresh Kasla or Google sign-in also clear `localStorage` keys with exactly those names (they belonged to an older version of the widget).

### Logout

```javascript
function logout() {
    localStorage.removeItem('session_token');   // your session
    window.KasperoConnect.disconnect();         // the widget's session (Connect and Pay)
    window.location.href = '/';
}
```

### Token Lifetime

KasperoConnect tokens expire. Kasla and Google tokens last 7 days by default; hosted email tokens last 30 days. If you exchange the token for your own session right away, as shown above, the expiry only matters at sign-in.

### Wallet Switching

The widget does not watch the extension for account changes. If a user switches accounts in Kasware, Kastle or Kaspire, the widget's session still refers to the wallet they signed in with until they disconnect and connect again. If your app depends on the active wallet, compare the address yourself before sensitive actions, or call `connect({ forceNew: true })`.

---

## Email Sign-In and Custom Signup Fields

The email option shows a sign-in form with "Create account" and "Forgot password". Login always asks for email and password. Signup asks for the fields you configure.

### Hosted (no backend needed)

If you set no endpoints, accounts are kept in a customer list for your merchant ID at KasperoConnect. Passwords are stored as salted hashes. Verify the tokens with `GET /connect/auth/verify` (see [Verifying the Token](#verifying-the-token)).

Password reset emails are not sent for hosted accounts yet. If your users need password reset today, use your own endpoints.

### Your Own Endpoints

```javascript
window.KasperoConnect.connect({
    wallets: ['google', 'email'],
    signup: {
        endpoint: 'https://yoursite.com/api/signup',
        fields: [
            { name: 'email', type: 'email', label: 'Email', required: true },
            { name: 'password', type: 'password', label: 'Password', required: true, minLength: 8 },
            { name: 'name', type: 'text', label: 'Full Name' },
            { name: 'terms', type: 'checkbox', label: 'I agree to Terms', required: true }
        ]
    },
    login: {
        endpoint: 'https://yoursite.com/api/login',
        forgotEndpoint: 'https://yoursite.com/api/forgot-password'
    },
    onConnect: function (result) { }
});
```

Or with attributes:

```html
<div id="kaspero-connect-button"
     data-wallets="email"
     data-signup-endpoint="https://yoursite.com/api/signup"
     data-signup-fields="email,password,password_confirm,name,terms"
     data-login-endpoint="https://yoursite.com/api/login">
</div>
```

**What the widget sends.** A JSON `POST` from the browser (so your endpoint needs CORS for your own site, and https):

```json
{
    "email": "user@example.com",
    "password": "...",
    "name": "Ada",
    "_merchant_id": "kpm_abc123xy",
    "_mode": "signup"
}
```

`_mode` is `signup` or `login`. The forgot-password endpoint receives `{ "email": "...", "_merchant_id": "..." }`.

**What your endpoint returns.**

```json
{ "success": true, "token": "your-session-or-jwt", "user": { "id": 1, "email": "user@example.com" } }
```

```json
{ "success": false, "error": "Email already registered" }
```

- With a `token`, the widget stores the session and fires `onConnect`.
- Return a `user` object. If you leave it out, the widget uses the submitted fields without the password.
- `error` (or `message`) is shown to the user in the form.
- The forgot-password endpoint returns `{ "success": true, "message": "Check your email" }`.

### Field Definitions

| Property | Description |
|----------|-------------|
| `name` | Field name, used as the JSON key |
| `type` | `text`, `email`, `password`, `tel`, `url`, `date`, `checkbox`, `select`, `textarea` |
| `label` | Label shown above the field |
| `required` | `true` to require it |
| `placeholder` | Placeholder text |
| `minLength`, `maxLength`, `pattern` | Browser validation |
| `options` | For `select`: array of strings or `{ value, label }` |

### Field Presets

For `data-signup-fields`, or as ready-made objects in `KasperoConnect.FIELDS`:

`email`, `password`, `password_confirm`, `name`, `first_name`, `last_name`, `phone`, `company`, `city`, `state`, `country`, `zip`, `address`, `birthday`, `username`, `website`, `bio`, `terms`, `newsletter`

Including `password_confirm` makes the widget check that the two passwords match before submitting.

```javascript
signup: {
    fields: [KasperoConnect.FIELDS.email, KasperoConnect.FIELDS.password, KasperoConnect.FIELDS.phone]
}
```

---

## Troubleshooting

### "Connect" button does nothing

**Cause:** Script not loaded or widget not initialized.

**Fix:** Check the browser console for errors. Make sure the script URL is correct and the div has the id `kaspero-connect-button`.

### Kasware / Kastle / Kaspire is not in the list

**Cause:** Extension wallets are shown only on desktop and only when the extension is installed. Kaspire also has to be enabled in your dashboard or listed in `data-wallets`.

**Fix:** Offer `kasla`, `google` or `email` alongside the extensions so every visitor has an option.

### Nothing happens after returning from Kasla or Google

**Cause:** Your `onConnect` was passed to `connect()` before the redirect. The page reloaded and the callback is gone.

**Fix:** Register a `kaspero-connect` listener or set `KasperoConnect.onConnect` on page load. See [Redirect Sign-Ins](#redirect-sign-ins-kasla-google).

### "Sign-in could not be verified. Please try again."

**Cause:** The return did not match a sign-in started in this browser tab. Common reasons: the user started in one tab and finished in another, took longer than 15 minutes, opened an old or shared link, or your own code changed the URL before the widget loaded.

**Fix:** Start the sign-in again from the button. If it happens every time, check that nothing on your page rewrites or strips the URL fragment (`#...`) before the widget script runs.

### "Sign-in needs session storage..."

**Cause:** The browser blocks `sessionStorage` for your site (some privacy modes, some embedded iframes).

**Fix:** Test on your deployed URL in a normal window, not inside an IDE preview iframe.

### My `data-theme` or `data-style` is ignored

**Cause:** With `data-merchant` set, the theme and button style saved in your dashboard take over.

**Fix:** Change them in the dashboard's Connect settings, or pass `theme` to `connect()`.

### My own localStorage `token` disappears

**Cause:** The widget clears keys named `token` and `walletType` on disconnect and on a new redirect sign-in.

**Fix:** Use a different key name, e.g. `session_token`.

### Content Security Policy

If your site sends a CSP header, allow `https://kasperopay.com` in `script-src`, `connect-src` and `img-src`. The widget injects its own `<style>` element, so `style-src` needs `'unsafe-inline'` or a matching hash.

### Token expired

**Cause:** KasperoConnect tokens have an expiration time.

**Fix:** Exchange the token for your own session at sign-in. If you keep using the KasperoConnect token, check it and prompt re-authentication:
```javascript
function isTokenExpired(token) {
    const decoded = JSON.parse(atob(token.split('.')[1]));
    return decoded.exp * 1000 < Date.now();
}
```

---

## FAQ

### What's the difference between KasperoConnect and KasperoPay?

- **KasperoConnect** = Authentication (sign in with wallet)
- **KasperoPay** = Payments (accept Kaspa)

Use Connect for user identity. Use Pay for transactions. On the same site they share wallet sessions: a user who connected with Kasware, Kastle, Kaspire or Kasla can pay without signing in again.

### Can users connect without a Kaspa wallet?

Yes! Google and Email authentication don't require a Kaspa wallet. Users get an identity without blockchain interaction. They cannot pay with that sign-in; KasperoPay asks for a wallet at checkout.

### Is the token secure?

The JWT is signed by KasperoConnect servers. You cannot forge or modify a valid one, but your server cannot check the signature locally either, so verify it with `GET https://kasperopay.com/api/auth/verify` and check its `site` before trusting it (see [Verifying the Token](#verifying-the-token)).

### How do I associate wallet users with email users?

If the same person connects via wallet and later via Google, they'll be separate identities. To link them, implement account linking in your own backend after the user is authenticated via both methods.

### What data do you store?

Wallet addresses, and email addresses for Kasla and Google users. For the hosted email option, also the email, a salted password hash, and the signup fields you asked for. We never see or store private keys.

---

## Changelog

**v1.3** (November 2026)
- **SECURITY:** Kasla and Google sign-ins now return in the URL fragment with a one-time state check, and the token is confirmed with the server before the session is saved. Tokens in the query string are refused
- **BREAKING:** Reading `?kc_connected=true&token=...` yourself no longer works. Use the `kaspero-connect` event or `KasperoConnect.onConnect`
- **NEW:** `kaspero-connect` window event, fired after every verified sign-in
- **NEW:** Kaspire wallet (`kaspire`)
- **FIX:** Email sign-in could save the typed password in `localStorage` when the login endpoint returned no user object. The widget also removes any password left there by earlier versions
- **FIX:** Google sessions are now restored after a page reload
- **DOCS:** Corrected to match the widget: the connect result is `{ token, walletType, user }`; email sign-in is email and password, not a magic link; `forceNew` (not `forceSelect`); added `data-style`, `data-modal-title`, the signup and login endpoint contract, `getToken()`, `getWalletType()`, `configure()`, `onSignup`, `onLogin`
- **DOCS:** Removed the "wallet switch detection" section; the widget does not watch for account changes

**Documentation update** (September 2026)
- All URLs now use kasperopay.com; Keystone is now Kasla (`kasla`)
- Token is returned for every auth method, including Kasware and Kastle
- Replaced "decode without verification" with server-side verification via `/api/auth/verify` and a your-own-session pattern

**v1.2** (February 2026)
- **NEW:** Automatic wallet switch detection - switching wallets in Kasware/Kastle triggers re-authentication (not present in the current widget, see v1.3)
- **IMPROVED:** Seamless account switching for power users with multiple wallets
- **FIX:** Session now properly tracks active wallet address

**v1.1** (January 2026)
- **NEW:** Dedicated Connect widget (separate from Pay widget)
- **NEW:** Google OAuth authentication
- **NEW:** Email magic link authentication (now email and password, see v1.3)
- **NEW:** `data-button-text` attribute for custom button text
- **NEW:** `data-theme` attribute for light/dark mode
- **NEW:** Custom signup fields support
- **IMPROVED:** Mobile-friendly auth flow

**v1.0** (January 2026)
- Initial release (as part of KasperoPay)
- Kasware, Kastle, Kasla wallet support
- Basic connect/disconnect API

---

*Built with 💚 for the Kaspa ecosystem*
