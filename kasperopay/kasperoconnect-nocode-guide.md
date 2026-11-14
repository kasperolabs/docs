# KasperoConnect No-Code Integration Guide

**For developers using Replit AI, Cursor, ChatGPT, Claude, or other AI coding tools.**

Copy-paste prompts to add wallet authentication to your site.

---

## Before You Start

1. Optionally get a merchant ID at [kasperopay.com/merchant](https://kasperopay.com/merchant) (associates users with your account)
2. The widget needs a `#kaspero-connect-button` div in your HTML
3. Test on your deployed URL, not in IDE preview mode
4. Do not write code that reads a token from the page URL. The widget handles the return from Kasla and Google by itself (see Prompt 2)

---

## Prompt 1: Add Connect Button

```
Add KasperoConnect authentication.

1. Add this HTML where you want the connect button:

<div id="kaspero-connect-button"
     data-wallets="kasware,kastle,kaspire,kasla,google,email"
     data-theme="light"
     data-button-text="Connect Wallet">
</div>
<script src="https://kasperopay.com/connect/widget.js"></script>

2. Handle successful sign-ins. Register this once, when the page loads. It fires for
every sign-in method, including Kasla and Google, which leave the site and come back:

window.addEventListener('kaspero-connect', function (e) {
    var result = e.detail;
    // result.token        = JWT to send to my backend for verification
    // result.walletType   = 'kasware', 'kastle', 'kaspire', 'kasla', 'email', or null for Google
    // result.user.address = Kaspa wallet address (wallet sign-ins and Kasla)
    // result.user.id      = KasperoConnect user id

    localStorage.setItem('kaspero_user', JSON.stringify({
        token: result.token,
        walletType: result.walletType,
        address: result.user && result.user.address
    }));
    showLoggedInUI(result);
});

3. Add a logout function:

function logout() {
    localStorage.removeItem('kaspero_user');
    window.KasperoConnect.disconnect();
    showLoggedOutUI();
}

Do NOT read "token", "kc_token" or "kc_connected" from window.location. Do NOT use
localStorage keys named "token" or "walletType" (the widget clears those names).
```

---

## Prompt 2: Kasla and Google Sign-In (Redirects)

```
Kasla and Google sign-in send the user to another site and back to the same page.
The KasperoConnect widget handles the return by itself: it checks the sign-in belongs
to this browser, verifies the token, and then fires the "kaspero-connect" window event.

Requirements:

1. The widget script must be loaded on the page the user returns to (the page they
   started from).

2. The "kaspero-connect" listener from Prompt 1 must be registered on page load, not
   inside a click handler. A callback passed to KasperoConnect.connect() is lost when
   the page reloads after the redirect.

3. Do not add any code that parses the URL for a token or for kc_connected,
   google_connected or kasla_connected. If such code exists, remove it.

4. Do not change or clean the URL (history.replaceState, router redirects) before the
   widget script has run.

Optional error handling:

window.KasperoConnect.connect({
    onError: function (message) { console.error('Sign-in failed:', message); }
});
```

---

## Prompt 3: Custom Buttons

```
Use my own buttons instead of the default widget button.

1. Add the widget container (hidden) and the script:

<div id="kaspero-connect-button" style="display:none"></div>
<script src="https://kasperopay.com/connect/widget.js"></script>

2. To open the sign-in chooser from my own button:

document.getElementById('my-login-button').onclick = function () {
    window.KasperoConnect.connect({
        wallets: ['kasware', 'kastle', 'kaspire', 'kasla', 'google'],
        onCancel: function () { console.log('User cancelled'); }
    });
};

3. To start one method directly from its own button (for example "Sign in with Kasla"):

document.getElementById('my-kasla-button').onclick = function () {
    window.KasperoConnect.connectWith('kasla');   // or 'google', 'kasware', 'kastle', 'kaspire', 'email'
};

4. Handle the result with the "kaspero-connect" listener from Prompt 1.

Never link a button directly to https://kasperopay.com/api/auth/kasla/connect or
/api/auth/google/connect. Always go through KasperoConnect.connect() or connectWith().
```

---

## Prompt 4: Check If Already Connected

```
Check connection status on page load and restore the session.

document.addEventListener('DOMContentLoaded', function () {
    var saved = localStorage.getItem('kaspero_user');

    if (saved) {
        showLoggedInUI(JSON.parse(saved));
    } else {
        showLoggedOutUI();
    }
});

function showLoggedInUI(info) {
    var address = info.address || (info.user && info.user.address);
    document.getElementById('login-button').style.display = 'none';
    document.getElementById('user-info').style.display = 'block';
    document.getElementById('user-address').textContent =
        address ? address.substring(0, 15) + '...' : 'Signed in';
}

function showLoggedOutUI() {
    document.getElementById('login-button').style.display = 'block';
    document.getElementById('user-info').style.display = 'none';
}
```

---

## Prompt 5: Verify the Token on My Backend

```
Add a backend endpoint that turns a KasperoConnect token into my own session.
The KasperoConnect token must be verified by asking KasperoConnect. Never use
jwt.decode() on it and trust the result: anyone can forge an unsigned token.

Backend (Node.js / Express):

const jwt = require('jsonwebtoken');
const MY_ORIGIN = 'https://MY-SITE.com';   // replace with my site's origin

app.post('/api/auth/kaspero', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'No token' });

    const kpRes = await fetch('https://kasperopay.com/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!kpRes.ok) return res.status(401).json({ error: 'Invalid token' });

    const { valid, user } = await kpRes.json();
    if (!valid || !user) return res.status(401).json({ error: 'Invalid token' });

    // The token must have been issued for MY site
    if (user.site && user.site !== MY_ORIGIN) {
        return res.status(401).json({ error: 'Token issued for another site' });
    }

    // user.id = KasperoConnect user id, user.address = Kaspa address (null for Google)
    const localUser = await findOrCreateUser({ kasperoId: user.id, address: user.address });

    const session = jwt.sign({ userId: localUser.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token: session, user: localUser });
});

Frontend: in the "kaspero-connect" listener, POST result.token to /api/auth/kaspero and
store the session token it returns under the key "session_token". Use that session
token for my own API calls.

This applies to wallet, Kasla and Google sign-ins. Email sign-in tokens from the hosted
option are verified with GET https://kasperopay.com/connect/auth/verify instead.
```

---

## Prompt 6: Mobile-Friendly Auth Only

```
Set up authentication that works on mobile (no browser extensions).

<div id="kaspero-connect-button"
     data-wallets="kasla,google,email"
     data-theme="light">
</div>
<script src="https://kasperopay.com/connect/widget.js"></script>

Kasware, Kastle and Kaspire are desktop browser extensions and are not shown on mobile.
Kasla, Google and Email work everywhere.
```

---

## Prompt 7: Fix Logout

```
Fix logout so it clears everything.

function logout() {
    // My own keys
    localStorage.removeItem('kaspero_user');
    localStorage.removeItem('session_token');

    // The widget's session (also clears a KasperoPay wallet session on this site)
    if (window.KasperoConnect) {
        window.KasperoConnect.disconnect();
    }

    showLoggedOutUI();
}
```

---

## Common Issues

### Button does nothing

Make sure the script loaded. Check the browser console for errors.

### Nothing happens after returning from Kasla or Google

Your handler was passed to `connect()` before the redirect and was lost when the page reloaded. Register the `kaspero-connect` listener on page load (Prompt 1).

### "Sign-in could not be verified. Please try again."

The return did not match a sign-in started in this browser tab. Open the browser console: a line starting with `[KasperoConnect] Sign-in rejected:` gives the reason. The usual ones:

- A button links straight to `/api/auth/.../connect` instead of using `connectWith()` (Prompt 3)
- Your own code or router changes the URL before the widget runs
- The sign-in was finished in a different tab, or took longer than 15 minutes

### My site was built with an older version of this guide

Older versions told you to read `?kc_connected=true&token=...` from the URL. That no longer arrives. Delete that code and use the `kaspero-connect` listener.

### Extensions not shown

Kasware, Kastle and Kaspire appear only on desktop and only when the extension is installed. Add `kasla`, `google` or `email` so every visitor has an option.

---

## Auth Methods Reference

| Method | Value | Works On |
|--------|-------|----------|
| Kasware | `kasware` | Desktop (browser extension) |
| Kastle | `kastle` | Desktop (browser extension) |
| Kaspire | `kaspire` | Desktop (browser extension) |
| Kasla | `kasla` | All devices |
| Google | `google` | All devices |
| Email | `email` | All devices (email and password) |

---

## Need Help?

- Full Docs: [KasperoConnect Documentation](https://github.com/kasperolabs/docs/blob/main/kasperopay/kasperoconnect-v1.1.md)
- Email: kasperolabs@gmail.com
- Twitter: [@KasperoLabs](https://x.com/KasperoLabs)

