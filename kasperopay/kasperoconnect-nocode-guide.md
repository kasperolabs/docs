# KasperoConnect No-Code Integration Guide

**For developers using Replit AI, Cursor, ChatGPT, Claude, or other AI coding tools.**

Copy-paste prompts to add wallet sign-in to your site.

---

## Before You Start

1. Optionally get a merchant ID at [kasperopay.com/merchant](https://kasperopay.com/merchant) (associates sign-ins with your account)
2. The widget needs a `#kaspero-connect-button` div in your HTML
3. Test on your deployed URL, not in IDE preview mode
4. Do not write code that reads a token from the page URL. The widget handles the return from Kasla by itself (see Prompt 2)
5. A sign-in gives your site the user's wallet address, the wallet type and a token. It does not give an email, a name or an account number. If you need an email, ask for it on your own form (see Prompt 8)

---

## Prompt 1: Add Connect Button

```
Add KasperoConnect wallet sign-in.

1. Add this HTML where you want the connect button:

<div id="kaspero-connect-button"
     data-wallets="kasware,kastle,kaspire,kasla"
     data-theme="light"
     data-button-text="Connect Wallet">
</div>
<script src="https://kasperopay.com/connect/widget.js"></script>

2. Handle successful sign-ins. Register this once, when the page loads. It fires for
every sign-in method, including Kasla, which leaves the site and comes back:

window.addEventListener('kaspero-connect', function (e) {
    var result = e.detail;
    // result.address    = the user's Kaspa wallet address (this is the user's identity)
    // result.walletType = 'kasware', 'kastle', 'kaspire' or 'kasla'
    // result.token      = JWT to send to my backend for verification

    localStorage.setItem('kaspero_user', JSON.stringify({
        token: result.token,
        walletType: result.walletType,
        address: result.address
    }));
    showLoggedInUI(result);
});

3. Add a logout function:

function logout() {
    localStorage.removeItem('kaspero_user');
    window.KasperoConnect.disconnect();
    showLoggedOutUI();
}

The result contains the wallet address, the wallet type and the token, and nothing
else. Do NOT expect an email, a user id or a profile from KasperoConnect, and do not
write code that reads result.user.email, result.user.id or result.user.profile.

Do NOT read "token", "kc_token" or "kc_connected" from window.location. Do NOT use
localStorage keys named "token" or "walletType" (the widget clears those names).
```

---

## Prompt 2: Kasla Sign-In (Redirect)

```
Kasla sign-in sends the user to another site and back to the same page.
The KasperoConnect widget handles the return by itself: it checks the sign-in belongs
to this browser, verifies the token, and then fires the "kaspero-connect" window event.

Requirements:

1. The widget script must be loaded on the page the user returns to (the page they
   started from).

2. The "kaspero-connect" listener from Prompt 1 must be registered on page load, not
   inside a click handler. A callback passed to KasperoConnect.connect() is lost when
   the page reloads after the redirect.

3. Do not add any code that parses the URL for a token or for kc_connected or
   kasla_connected. If such code exists, remove it.

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
        wallets: ['kasware', 'kastle', 'kaspire', 'kasla'],
        onCancel: function () { console.log('User cancelled'); }
    });
};

3. To start one method directly from its own button (for example "Sign in with Kasla"):

document.getElementById('my-kasla-button').onclick = function () {
    window.KasperoConnect.connectWith('kasla');   // or 'kasware', 'kastle', 'kaspire'
};

4. Handle the result with the "kaspero-connect" listener from Prompt 1.

The only sign-in methods are kasware, kastle, kaspire and kasla. Do not add Google or
email buttons that call KasperoConnect: those methods do not exist.

Never link a button directly to https://kasperopay.com/api/auth/kasla/connect.
Always go through KasperoConnect.connect() or connectWith().
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

    // The answer is { valid, user: { address, walletType, merchantId, site } }
    const { valid, user } = await kpRes.json();
    if (!valid || !user || !user.address) return res.status(401).json({ error: 'Invalid token' });

    // The token must have been issued for MY site. On http://localhost during
    // development, user.site can be null; allow that outside production only.
    const siteOk = user.site === MY_ORIGIN ||
        (process.env.NODE_ENV !== 'production' && user.site === null);
    if (!siteOk) return res.status(401).json({ error: 'Token issued for another site' });

    // The wallet address is the user's identity. There is no user id and no email.
    const localUser = await findOrCreateUser({ address: user.address });

    const session = jwt.sign({ userId: localUser.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token: session, user: localUser });
});

My users table needs a unique "address" column. Do not add a KasperoConnect user id
column, and do not expect an email from KasperoConnect.

Frontend: in the "kaspero-connect" listener, POST result.token to /api/auth/kaspero and
store the session token it returns under the key "session_token". Use that session
token for my own API calls. Do not send the KasperoConnect token to any other
kasperopay.com endpoint: it is only accepted for this verification and for payments.
```

---

## Prompt 6: Mobile-Friendly Sign-In Only

```
Set up sign-in that works on mobile (no browser extensions).

<div id="kaspero-connect-button"
     data-wallets="kasla"
     data-theme="light">
</div>
<script src="https://kasperopay.com/connect/widget.js"></script>

Kasware, Kastle and Kaspire are desktop browser extensions and are not shown on mobile.
Kasla works everywhere.
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

## Prompt 8: Ask for an Email Myself

```
KasperoConnect gives my site the user's wallet address and nothing else. I also want
the user's email, so I will ask for it myself.

1. After a successful sign-in (my backend has created the session from Prompt 5),
   check whether my user record has an email.

2. If it does not, show my own small form with one email field and a Save button.
   Make it skippable unless my site cannot work without an email.

3. POST the email to my own backend endpoint, authenticated with my own session token,
   and store it on my user record next to the wallet address.

Do not send the email to kasperopay.com, and do not try to read an email from the
KasperoConnect result or from /api/auth/verify. It is not there.
```

---

## Prompt 9: Update a Site Built With an Older Guide

```
My site uses KasperoConnect and was built before 21 November 2026. KasperoConnect
changed: a site now receives the wallet address, the wallet type and a token, and
nothing else. Update my code:

1. Find every place that reads user.email, user.id, user.profile, user.isAdmin or
   user.isNewUser from the KasperoConnect result or from the /api/auth/verify answer.
   Those fields are gone. Use the wallet address (result.address, or user.address
   from /api/auth/verify) as the user's identity instead.

2. If my database finds users by a KasperoConnect user id, change the lookup to the
   wallet address. Keep the old column for now, but stop writing to it.

3. Remove "google" and "email" from every data-wallets attribute and every wallets
   list. Remove data-signup-endpoint, data-signup-fields, data-login-endpoint, and the
   signup, login, onSignup and onLogin options. Remove any call to
   kasperopay.com/connect/auth/ (those endpoints are closed).

4. In my backend verification endpoint, reject the token unless user.site is exactly
   my site's origin (see Prompt 5).

5. Delete any code that reads "token", "kc_token", "kc_connected", "google_connected"
   or "kasla_connected" from window.location, and use the "kaspero-connect" listener
   from Prompt 1.

List every file you changed and what you changed in it.
```

---

## Common Issues

### Button does nothing

Make sure the script loaded. Check the browser console for errors.

### Nothing happens after returning from Kasla

Your handler was passed to `connect()` before the redirect and was lost when the page reloaded. Register the `kaspero-connect` listener on page load (Prompt 1).

### "Sign-in could not be verified. Please try again."

The return did not match a sign-in started in this browser tab. Open the browser console: a line starting with `[KasperoConnect] Sign-in rejected:` gives the reason. The usual ones:

- A button links straight to `/api/auth/kasla/connect` instead of using `connectWith()` (Prompt 3)
- Your own code or router changes the URL before the widget runs
- The sign-in was finished in a different tab

### `user.email` or `user.id` is undefined

KasperoConnect passes on the wallet address only. Use `result.address` as the user's identity, and ask for an email on your own form if you need one (Prompt 8).

### Google or Email is not in the list

Those sign-in methods are no longer offered. Remove them from `data-wallets` and keep `kasla` for visitors without an extension.

### Everyone was signed out

All KasperoConnect tokens issued before 21 November 2026 were cancelled. Users sign in once more. If your site keeps its own session (Prompt 5), your users stayed signed in to your site.

### My site was built with an older version of this guide

Run Prompt 9. It removes the code that reads a token from the URL and the code that expects an email or a user id.

### Extensions not shown

Kasware, Kastle and Kaspire appear only on desktop and only when the extension is installed. Add `kasla` so every visitor has an option.

---

## Sign-In Methods Reference

| Method | Value | Works On |
|--------|-------|----------|
| Kasware | `kasware` | Desktop (browser extension) |
| Kastle | `kastle` | Desktop (browser extension) |
| Kaspire | `kaspire` | Desktop (browser extension) |
| Kasla | `kasla` | All devices |

---

## Need Help?

- Full Docs: [KasperoConnect Documentation](https://github.com/kasperolabs/docs/blob/main/kasperopay/kasperoconnect-v1.1.md)
- Email: kasperolabs@gmail.com
- Twitter: [@KasperoLabs](https://x.com/KasperoLabs)
