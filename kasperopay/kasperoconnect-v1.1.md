# KasperoConnect Documentation v1.4

Add wallet sign-in to your website. Users sign in with a Kaspa wallet extension or a Kasla account, and your site receives their wallet address.
> **Using AI to build your site?** See our [No-Code Integration Guide](kasperoconnect-nocode-guide.md) with copy-paste prompts for Replit, Cursor, and other AI coding tools.

---

## Table of Contents

1. [What Your Site Receives](#what-your-site-receives)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [Sign-In Methods](#sign-in-methods)
5. [Button Styles and Themes](#button-styles-and-themes)
6. [JavaScript API](#javascript-api)
7. [Kasla Sign-In (Redirect)](#kasla-sign-in-redirect)
8. [Verifying the Token](#verifying-the-token)
9. [The Connect Result](#the-connect-result)
10. [Session Management](#session-management)
11. [Upgrading from v1.3](#upgrading-from-v13)
12. [Troubleshooting](#troubleshooting)
13. [FAQ](#faq)
14. [Changelog](#changelog)

---

## What Your Site Receives

A sign-in gives your site three things:

| Item | Description |
|------|-------------|
| Wallet address | The user's Kaspa address. This is their identity on your site |
| Wallet type | `kasware`, `kastle`, `kaspire` or `kasla` |
| Token | Proof of the sign-in, which your server confirms with KasperoConnect |

That is all. KasperoConnect does not pass on an email, a name, a profile or an account number, and the token cannot be used to look any of those up. If your site needs an email or a shipping address, ask the user for it on your own form after they sign in.

The token is limited. It works for two things: confirming the sign-in from your server, and paying with KasperoPay. Every other KasperoPay endpoint refuses it. It also names the site it was issued for, so your server can reject a token that was issued somewhere else.

---

## Quick Start

### 1. Get Your Merchant ID

Sign up at [kasperopay.com/merchant](https://kasperopay.com/merchant) to get your merchant ID (e.g., `kpm_abc123xy`).

### 2. Add the Widget

```html
<div id="kaspero-connect-button"
     data-merchant="kpm_YOUR_MERCHANT_ID"
     data-wallets="kasware,kastle,kaspire,kasla">
</div>
<script src="https://kasperopay.com/connect/widget.js"></script>
```

That's it! You now have a "Connect" button.

### 3. Handle the Connection

Register one listener when the page loads. It fires for every sign-in method, including Kasla, which leaves your site and comes back.

```javascript
window.addEventListener('kaspero-connect', function (e) {
    var result = e.detail;
    // result.address    - the user's Kaspa address
    // result.walletType - 'kasware', 'kastle', 'kaspire' or 'kasla'
    // result.token      - JWT for your backend (verify it server-side, see below)

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

### Example: Full Configuration

```html
<div id="kaspero-connect-button"
     data-merchant="kpm_abc123xy"
     data-wallets="kasware,kastle,kaspire,kasla"
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

Options passed to `KasperoConnect.connect({...})` apply to that call and override both.

---

## Sign-In Methods

### Available Methods

| Method | Value | Description | Works On |
|--------|-------|-------------|----------|
| Kasware | `kasware` | Browser extension | Desktop |
| Kastle | `kastle` | Browser extension | Desktop |
| Kaspire | `kaspire` | Browser extension | Desktop |
| Kasla | `kasla` | Kasla wallet account (redirect) | All devices |

Any other value in `data-wallets` or `wallets` is ignored. Google and email sign-in are no longer offered to sites, see [Upgrading from v1.3](#upgrading-from-v13).

### Usage

```html
<!-- All wallets -->
<div id="kaspero-connect-button"
     data-wallets="kasware,kastle,kaspire,kasla">
</div>

<!-- Mobile-friendly (no browser extension needed) -->
<div id="kaspero-connect-button"
     data-wallets="kasla">
</div>
```

### Default Behavior

- Without `data-wallets` and without `data-merchant`: Kasware, Kastle, Kaspire, Kasla.
- With `data-merchant` and no `data-wallets`: the methods enabled in your dashboard (Kaspire has to be enabled there, or listed in `data-wallets`).
- Extension wallets appear only on desktop, and only when the extension is installed in the visitor's browser. A visitor without any of them simply does not see those options. Keep `kasla` in the list so every visitor has a way in.

### Method Details

**Kasware, Kastle, Kaspire** (Browser Extensions)
- The wallet asks the user to sign a short message: `Sign in to yoursite.com with KasperoConnect. This does not move any money.`
- No redirect; `onConnect` fires on the same page
- Kaspire must be on Kaspa Mainnet

**Kasla** (Wallet Account)
- Works on any browser, including mobile
- Redirects to Kasla and back to the page the user started on
- Gives you a Kaspa address, and the session can be used by KasperoPay on the same site

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
    wallets: ['kasware', 'kastle', 'kasla'],
    onConnect: function (result) {
        console.log('Connected!', result.address, result.walletType);
    },
    onCancel: function () {
        console.log('User closed the modal');
    }
});
```

`connect()` returns a Promise that resolves to `true` when the user signed in on this page, and `false` when they closed the modal or were redirected to Kasla.

### Full Options

```javascript
window.KasperoConnect.connect({
    merchant: 'kpm_abc123xy',                 // associate sign-ins with your account
    wallets: ['kasware', 'kastle', 'kaspire', 'kasla'],
    forceNew: false,                          // true = show the modal even if already connected
    theme: 'dark',                            // modal theme
    modalTitle: 'Sign in',

    onConnect: function (result) { },         // any successful sign-in
    onCancel:  function () { },               // modal closed
    onError:   function (message) { }         // message is a string
});
```

Two things to know:

- If the user is already connected and `forceNew` is not set, `connect()` skips the modal and calls `onConnect` immediately with the existing session.
- The callbacks you pass to `connect()` replace the global `KasperoConnect.onConnect` for as long as the page lives, and they do not survive the Kasla redirect (the page reloads). The `kaspero-connect` window event is not affected by either, which is why Quick Start uses it.

### Your Own Login Buttons

If your page has its own "Sign in with Kasla" button, start that method directly instead of opening the selector:

```javascript
document.getElementById('my-kasla-button').onclick = function () {
    KasperoConnect.connectWith('kasla');     // or 'kasware', 'kastle', 'kaspire'
};
```

The result arrives the same way as any other sign-in: the `kaspero-connect` event and `KasperoConnect.onConnect`. Do not link your button straight to `/api/auth/kasla/connect`: a sign-in started that way comes back in the query string, and the widget refuses it.

### Other Methods

```javascript
KasperoConnect.isReady();        // widget initialised
KasperoConnect.isConnected();    // true when a session token is held
KasperoConnect.getToken();       // the JWT, or null
KasperoConnect.getUser();        // { address: 'kaspa:qz...' }, or null
KasperoConnect.getWalletType();  // 'kasware' | 'kastle' | 'kaspire' | 'kasla' | null
KasperoConnect.disconnect();     // clear the session

// Set defaults without opening the modal
KasperoConnect.configure({
    merchant: 'kpm_abc123xy',
    wallets: ['kasla', 'kasware'],
    theme: 'dark',
    style: 'kaspa'
});

KasperoConnect.WALLETS;  // { KASWARE: 'kasware', KASTLE: 'kastle', KASPIRE: 'kaspire', KASLA: 'kasla' }
```

---

## Kasla Sign-In (Redirect)

Kasla sends the user away from your site and back. **The widget handles the return itself.** You do not read anything from the URL.

What happens:

1. The user picks Kasla. The widget remembers a one-time code in the browser tab and redirects.
2. After sign-in, the user lands back on the same page (same path and query string).
3. The widget checks the one-time code, confirms the token with KasperoConnect, saves the session, and only then fires `kaspero-connect` and `onConnect`.

What you need to do:

- Load the widget on the page the user returns to (it is the page they started from).
- Register your `kaspero-connect` listener, or set `KasperoConnect.onConnect`, when the page loads. A callback passed to `connect()` before the redirect is gone after the reload.

```javascript
// Runs on every page load. Fires right after a Kasla return,
// and for extension sign-ins as well.
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

The token never appears in the query string, so it stays out of your server logs, and a sign-in link made by someone else is refused. If your site has old code that reads `kc_connected`, `token`, `kc_token` or `kasla_connected` from `window.location.search`, delete it and use the listener above.

---

## Verifying the Token

The token is a JWT signed by KasperoConnect. Your server cannot check the signature itself (it does not hold the key), so **do not** `jwt.decode()` it and trust the contents: anyone can forge an unsigned payload. Ask KasperoConnect instead, then issue your own session token for your own app.

**Server-side (Node.js):**

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
    if (!valid || !user || !user.address) return res.status(401).json({ error: 'Invalid token' });

    // 2. Make sure the token was issued for YOUR site, not for another site
    //    the same person signed in to
    if (user.site !== MY_ORIGIN) {
        return res.status(401).json({ error: 'Token issued for another site' });
    }

    // 3. Find or create the user in YOUR database, keyed by wallet address
    const localUser = await findOrCreateUser({ address: user.address });

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
        "address": "kaspa:qz...",
        "walletType": "kasla",
        "merchantId": "kpm_abc123xy",
        "site": "https://yoursite.com"
    }
}
```

| Field | Description |
|-------|-------------|
| `address` | The Kaspa address that signed in. Use it as the user's key in your database |
| `walletType` | `kasware`, `kastle`, `kaspire` or `kasla` |
| `merchantId` | The `data-merchant` value the sign-in was started with, or `null` |
| `site` | The origin the token was issued for |

`site` is `null` when the page is not served over https, which in practice means local development. Keep the exact comparison in production and relax it only in your development build.

The frontend then stores *your* session token and forgets the KasperoConnect one. This keeps your users signed in for as long as you decide, independent of their wallet extension.

**What the token can do.** It is accepted by `GET /api/auth/verify` and by KasperoPay's payment endpoints, where every payment still needs the user's approval in their wallet. Every other KasperoPay endpoint answers `403`. There is nothing more to fetch with it.

**Client-side decode (display only):**

```javascript
function decodeJWT(token) {
    return JSON.parse(atob(token.split('.')[1]));
}
// Fine for showing an address in the UI. Never for authorization.
```

---

## The Connect Result

`onConnect` and the `kaspero-connect` event receive the same object:

| Property | Type | Description |
|----------|------|-------------|
| `address` | string | The user's Kaspa address |
| `walletType` | string | `kasware`, `kastle`, `kaspire` or `kasla` |
| `token` | string | JWT signed by KasperoConnect |
| `user` | object | `{ address }`. Kept so code written for earlier versions that reads `result.user.address` keeps working |

### Example

```javascript
{
    address: "kaspa:qz...",
    walletType: "kasla",
    token: "eyJ...",
    user: { address: "kaspa:qz..." }
}
```

The shape is the same for every method. For anything that matters, use the server-side verification above rather than the object in the browser.

---

## Session Management

### What the Widget Stores

The widget keeps its own connection state in the browser so returning users are recognised:

| Storage | Keys | Purpose |
|---------|------|---------|
| `localStorage` | `kc_token`, `kc_wallet`, `kc_user` | The Connect session. `kc_user` holds the address and nothing else |
| `localStorage` | `kp_token`, `kp_wallet` | Shared with the KasperoPay widget, so a connected user can pay without signing in again |
| `sessionStorage` | `kc_oauth_state` | The one-time code for a Kasla redirect in progress |

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

> ⚠️ **Do not name your own keys `token` or `walletType`.** `KasperoConnect.disconnect()` and every fresh Kasla sign-in also clear `localStorage` keys with exactly those names (they belonged to an older version of the widget).

### Logout

```javascript
function logout() {
    localStorage.removeItem('session_token');   // your session
    window.KasperoConnect.disconnect();         // the widget's session (Connect and Pay)
    window.location.href = '/';
}
```

### Token Lifetime

KasperoConnect tokens expire. Kasla tokens last 7 days by default. If you exchange the token for your own session right away, as shown above, the expiry only matters at sign-in.

### Wallet Switching

The widget does not watch the extension for account changes. If a user switches accounts in Kasware, Kastle or Kaspire, the widget's session still refers to the wallet they signed in with until they disconnect and connect again. If your app depends on the active wallet, compare the address yourself before sensitive actions, or call `connect({ forceNew: true })`.

---

## Upgrading from v1.3

From 21 November 2026, KasperoConnect gives a site the wallet address and nothing else. This protects the people signing in: one account should not hand its email and profile to every site it visits.

### What changed

| Before | Now |
|--------|-----|
| `result.user` held `id`, `profile`, `isAdmin`, `isNewUser` and sometimes an email | `result.user` is `{ address }` |
| `/api/auth/verify` returned `user.id` and `user.profile` | Returns `address`, `walletType`, `merchantId`, `site` |
| Google and email sign-in | Removed. `google` and `email` in a wallet list are ignored |
| Hosted customer list, `/connect/auth/*` | Closed. These endpoints answer `410` |
| `data-signup-endpoint`, `data-signup-fields`, `data-login-endpoint`, `signup`, `login`, `onSignup`, `onLogin`, `KasperoConnect.FIELDS` | Removed and ignored |
| A token worked across KasperoPay's API | A token works for verification and for payments only |

Every token issued before the change was cancelled, so each user signs in once more.

### What to do

1. **Key your users by wallet address.** If your database stored `user.id` from KasperoConnect, switch the lookup to `user.address`. Records that already hold the address keep matching.
2. **Stop reading `user.email`, `user.id` and `user.profile`.** They are `undefined` now. If you need an email, ask for it on your own form after sign-in.
3. **Remove `google` and `email` from `data-wallets`.** Leaving them in does no harm, but nothing is shown for them. Keep `kasla` so visitors without an extension can sign in.
4. **Compare `user.site` exactly.** The example in [Verifying the Token](#verifying-the-token) now rejects a token unless `site` equals your origin.
5. **If you used the email option,** your visitors can no longer sign in that way through KasperoConnect. Offer wallet sign-in, or run email login on your own backend. Contact us if you need the list of customers who signed up through the hosted option.

---

## Troubleshooting

### "Connect" button does nothing

**Cause:** Script not loaded or widget not initialized.

**Fix:** Check the browser console for errors. Make sure the script URL is correct and the div has the id `kaspero-connect-button`.

### Kasware / Kastle / Kaspire is not in the list

**Cause:** Extension wallets are shown only on desktop and only when the extension is installed. Kaspire also has to be enabled in your dashboard or listed in `data-wallets`.

**Fix:** Offer `kasla` alongside the extensions so every visitor has an option.

### Google or Email is not in the list

**Cause:** KasperoConnect no longer offers them to sites.

**Fix:** None needed. See [Upgrading from v1.3](#upgrading-from-v13).

### `user.email`, `user.id` or `user.profile` is undefined

**Cause:** KasperoConnect passes on the wallet address only.

**Fix:** Use `result.address`, or `user.address` from `/api/auth/verify`, as the user's identity.

### `403` "This sign-in is only valid for payments on the site it was made on."

**Cause:** Your code sent the KasperoConnect token to a KasperoPay endpoint other than `GET /api/auth/verify`.

**Fix:** Verify the token once, then use your own session. The token is not an API key.

### Nothing happens after returning from Kasla

**Cause:** Your `onConnect` was passed to `connect()` before the redirect. The page reloaded and the callback is gone.

**Fix:** Register a `kaspero-connect` listener or set `KasperoConnect.onConnect` on page load. See [Kasla Sign-In](#kasla-sign-in-redirect).

### "Sign-in could not be verified. Please try again."

**Cause:** The return did not match a sign-in started in this browser tab. Common reasons: the user started in one tab and finished in another, opened an old or shared link, or your own code changed the URL before the widget loaded.

**Fix:** Start the sign-in again from the button. If it happens every time, check that nothing on your page rewrites or strips the URL fragment (`#...`) before the widget script runs.

### "Sign-in expired. Please try again."

**Cause:** The Kasla sign-in took longer than 15 minutes, or the same sign-in was submitted twice.

**Fix:** Start the sign-in again from the button.

### "Sign-in needs session storage..."

**Cause:** The browser blocks `sessionStorage` for your site (some privacy modes, some embedded iframes).

**Fix:** Test on your deployed URL in a normal window, not inside an IDE preview iframe.

### My `data-theme` or `data-style` is ignored

**Cause:** With `data-merchant` set, the theme and button style saved in your dashboard take over.

**Fix:** Change them in the dashboard's Connect settings, or pass `theme` to `connect()`.

### My own localStorage `token` disappears

**Cause:** The widget clears keys named `token` and `walletType` on disconnect and on a new Kasla sign-in.

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

Use Connect for user identity. Use Pay for transactions. On the same site they share sessions: a user who connected with Kasware, Kastle, Kaspire or Kasla can pay without signing in again.

### Can users connect without a browser extension?

Yes, with Kasla. A Kasla account works in any browser, including on a phone, and gives the user a Kaspa address. Every KasperoConnect sign-in is a wallet sign-in; there is no Google or email option.

### How do I get the user's email?

Ask for it yourself. KasperoConnect tells you which wallet signed in and nothing about the person behind it. Put an email field on your own page after sign-in and store it against the wallet address.

### Is the token secure?

The JWT is signed by KasperoConnect servers. You cannot forge or modify a valid one, but your server cannot check the signature locally either, so verify it with `GET https://kasperopay.com/api/auth/verify` and check its `site` before trusting it (see [Verifying the Token](#verifying-the-token)). The token cannot read account data: outside verification and payments, KasperoPay refuses it.

### Is the same wallet the same user on every site?

Yes, the address is the same wherever that wallet signs in. Nothing else links the sign-ins: each site gets its own token and no shared account number.

### What data do you store, and what do you share?

KasperoPay stores wallet addresses, and for Kasla users the email on their Kasla account. None of that is shared with sites. A site receives the wallet address, the wallet type and a token. We never see or store private keys.

---

## Changelog

**v1.4** (November 2026)
- **PRIVACY, BREAKING:** A site now receives the wallet address, the wallet type and a token. `user.id`, `user.profile`, `isAdmin`, `isNewUser` and any email are gone from the connect result and from `GET /api/auth/verify`
- **SECURITY, BREAKING:** Tokens are limited. They are accepted for verification and for KasperoPay payments, and refused by every other endpoint. Each token names the site it was issued for. All earlier tokens were cancelled on 21 November 2026
- **BREAKING:** Google and email sign-in are no longer offered to sites. The hosted customer list is closed and `/connect/auth/*` answers `410`. Removed `data-signup-endpoint`, `data-signup-fields`, `data-login-endpoint`, the `signup` and `login` options, `onSignup`, `onLogin` and `KasperoConnect.FIELDS`
- **NEW:** `result.address` at the top level of the connect result
- **DOCS:** Added [What Your Site Receives](#what-your-site-receives) and [Upgrading from v1.3](#upgrading-from-v13). The verification example compares `site` exactly and keys users by address

**v1.3** (November 2026)
- **SECURITY:** Kasla and Google sign-ins now return in the URL fragment with a one-time state check, and the token is confirmed with the server before the session is saved. Tokens in the query string are refused
- **BREAKING:** Reading `?kc_connected=true&token=...` yourself no longer works. Use the `kaspero-connect` event or `KasperoConnect.onConnect`
- **NEW:** `kaspero-connect` window event, fired after every verified sign-in
- **NEW:** `connectWith(method)` starts one sign-in method from your own button
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
- **NEW:** Google OAuth authentication (removed for sites in v1.4)
- **NEW:** Email magic link authentication (removed for sites in v1.4)
- **NEW:** `data-button-text` attribute for custom button text
- **NEW:** `data-theme` attribute for light/dark mode
- **NEW:** Custom signup fields support (removed in v1.4)
- **IMPROVED:** Mobile-friendly auth flow

**v1.0** (January 2026)
- Initial release (as part of KasperoPay)
- Kasware, Kastle, Kasla wallet support
- Basic connect/disconnect API
