# KasperoConnect Documentation v1.2

Add wallet-based authentication to your website. Let users sign in with their Kaspa wallet or social accounts.
> **Using AI to build your site?** See our [No-Code Integration Guide](kasperoconnect-nocode-guide.md) with copy-paste prompts for Replit, Cursor, and other AI coding tools.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Configuration](#configuration)
3. [Authentication Methods](#authentication-methods)
4. [Themes](#themes)
5. [JavaScript API](#javascript-api)
6. [Handling the Auth Callback](#handling-the-auth-callback) and [Verifying the Token](#verifying-the-token)
7. [User Object](#user-object)
8. [Session Management](#session-management)
9. [Advanced: Custom Signup Fields](#advanced-custom-signup-fields)
10. [Troubleshooting](#troubleshooting)
11. [FAQ](#faq)
12. [Changelog](#changelog)

---

## Quick Start

### 1. Get Your Merchant ID

Sign up at [kasperopay.com/merchant](https://kasperopay.com/merchant) to get your merchant ID (e.g., `kpm_abc123xy`).

### 2. Add the Widget

```html
<div id="kaspero-connect-button"
     data-merchant="kpm_YOUR_MERCHANT_ID"
     data-wallets="kasware,kastle,kasla,google,email">
</div>
<script src="https://kasperopay.com/connect/widget.js"></script>
```

That's it! You now have a "Connect Wallet" button.

### 3. Handle the Connection

```javascript
// The widget will call this when a user connects
window.KasperoConnect.onConnect = function(user) {
    console.log('User connected!', user);
    // user.address - Kaspa address (if wallet)
    // user.email - Email (if social/email login)
    // user.token - JWT token for your backend
    // user.walletType - 'kasware', 'kastle', 'kasla', 'google', or 'email'
    
    // Save to your app state, redirect, etc.
    localStorage.setItem('user', JSON.stringify(user));
    window.location.href = '/dashboard';
};
```

---

## Configuration

### Data Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-merchant` | No | Your merchant ID (associates users with your account) |
| `data-wallets` | No | Comma-separated auth methods (default: all) |
| `data-theme` | No | `light` or `dark` (default: `light`) |
| `data-button-text` | No | Custom button text (default: "Connect Wallet") |

### Example: Full Configuration

```html
<div id="kaspero-connect-button"
     data-merchant="kpm_abc123xy"
     data-wallets="kasware,kastle,kasla,google"
     data-theme="dark"
     data-button-text="Sign In">
</div>
<script src="https://kasperopay.com/connect/widget.js"></script>
```

---

## Authentication Methods

### Available Methods

| Method | Value | Description | Works On |
|--------|-------|-------------|----------|
| Kasware | `kasware` | Browser extension | Desktop |
| Kastle | `kastle` | Browser extension | Desktop |
| Kasla | `kasla` | OAuth-based wallet | All devices |
| Google | `google` | Google account | All devices |
| Email | `email` | Email magic link | All devices |

### Usage

```html
<!-- Wallet-only authentication -->
<div id="kaspero-connect-button"
     data-wallets="kasware,kastle,kasla">
</div>

<!-- Social login only -->
<div id="kaspero-connect-button"
     data-wallets="google,email">
</div>

<!-- Mobile-friendly (no browser extensions) -->
<div id="kaspero-connect-button"
     data-wallets="kasla,google,email">
</div>

<!-- All options -->
<div id="kaspero-connect-button"
     data-wallets="kasware,kastle,kasla,google,email">
</div>
```

### Method Details

**Kasware & Kastle** (Browser Extensions)
- User must have the extension installed
- Instant connection via extension API
- Returns Kaspa address and public key

**Kasla** (OAuth Wallet)
- Works on any browser, including mobile
- Redirects to Kasla for authentication
- Returns to your site with token in URL params

**Google**
- Standard Google OAuth flow
- Returns email and profile info
- No Kaspa address (use for identity only)

**Email**
- Magic link sent to user's email
- User clicks link to authenticate
- No password required

---

## Themes

| Theme | Description |
|-------|-------------|
| `light` | Light background, dark text (default) |
| `dark` | Dark background, light text |

```html
<!-- Light theme (default) -->
<div id="kaspero-connect-button"
     data-theme="light">
</div>

<!-- Dark theme -->
<div id="kaspero-connect-button"
     data-theme="dark">
</div>
```

---

## JavaScript API

### Programmatic Connection

Instead of using the button, trigger the connect modal programmatically:

```javascript
// Basic usage
window.KasperoConnect.connect({
    wallets: ['kasware', 'kastle', 'kasla', 'google'],
    onConnect: function(user) {
        console.log('Connected!', user);
    },
    onCancel: function() {
        console.log('User cancelled');
    }
});
```

### Full Options

```javascript
window.KasperoConnect.connect({
    // Optional: Associate with merchant
    merchant: 'kpm_abc123xy',
    
    // Which auth methods to show
    wallets: ['kasware', 'kastle', 'kasla', 'google', 'email'],
    
    // Force show selector even if already connected
    forceSelect: false,
    
    // Callbacks
    onConnect: function(user) {
        // Handle successful connection
    },
    onCancel: function() {
        // Handle user cancellation
    },
    onError: function(error) {
        // Handle errors
    }
});
```

### Check Connection Status

```javascript
// Check if user is connected
if (window.KasperoConnect.isConnected()) {
    const user = window.KasperoConnect.getUser();
    console.log('Already connected as:', user.address || user.email);
}

// Disconnect
window.KasperoConnect.disconnect();
```

### Global Callback

Set a global callback that fires on any connection:

```javascript
window.KasperoConnect.onConnect = function(user) {
    // This fires for both button clicks and programmatic connect()
    console.log('User connected:', user);
};
```

---

## Handling the Auth Callback

Some authentication methods (Kasla, Google) redirect users away from your site and back. You need to catch the return.

### URL Parameters

After redirect, your URL will contain:

```
https://yoursite.com/page?kc_connected=true&token=xxx&wallet=kasla
```

### Handling the Callback

**Vanilla JavaScript:**

```javascript
document.addEventListener('DOMContentLoaded', function() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.get('kc_connected') === 'true') {
        const token = params.get('token');
        const wallet = params.get('wallet');
        
        // Store the token
        localStorage.setItem('auth_token', token);
        localStorage.setItem('wallet_type', wallet);
        
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
        
        // Fetch user profile or redirect
        loadUserProfile(token);
    }
});
```

**React/Next.js:**

```tsx
useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    if (params.get('kc_connected') === 'true') {
        const token = params.get('token');
        
        if (token) {
            localStorage.setItem('auth_token', token);
            
            // Fetch user data
            fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(user => {
                setUser(user);
                // Clean URL
                window.history.replaceState({}, '', window.location.pathname);
            });
        }
    }
}, []);
```

### Verifying the Token

The token is a JWT signed by KasperoConnect. Your server cannot check the signature itself (it does not hold the key), so **do not** `jwt.decode()` it and trust the contents: anyone can forge an unsigned payload. Ask KasperoConnect instead, then issue your own session token for your own app.

**Server-side (Node.js):**

```javascript
const jwt = require('jsonwebtoken');

// POST /api/auth/kaspero  { token }
app.post('/api/auth/kaspero', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'No token' });

    // 1. Ask KasperoConnect whether this token is real
    const kpRes = await fetch('https://kasperopay.com/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!kpRes.ok) return res.status(401).json({ error: 'Invalid token' });
    const { user } = await kpRes.json();

    // user.address (wallet methods), user.email (Kasla, Google, Email), user.profile

    // 2. Find or create the user in YOUR database
    const localUser = await findOrCreateUser({ address: user.address, email: user.email });

    // 3. Issue YOUR session token, with YOUR expiry
    const session = jwt.sign({ userId: localUser.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token: session, user: localUser });
});
```

The frontend then stores *your* session token and forgets the KasperoConnect one. This keeps your users signed in for as long as you decide, independent of their wallet extension.

**Client-side decode (display only):**

```javascript
function decodeJWT(token) {
    return JSON.parse(atob(token.split('.')[1]));
}
// Fine for showing an email in the UI. Never for authorization.
```

---

## User Object

The user object returned on connection contains:

| Property | Type | Description | Available For |
|----------|------|-------------|---------------|
| `address` | string | Kaspa address | Wallet methods |
| `walletType` | string | Auth method used | All |
| `publicKey` | string | Public key | Kasware, Kastle |
| `email` | string | User's email | Kasla, Google, Email |
| `token` | string | JWT auth token, signed by KasperoConnect | All |

### Examples

**Kasware/Kastle connection:**
```javascript
{
    address: "kaspa:qz...",
    walletType: "kasware",
    publicKey: "abc123...",
    token: "eyJ..."
}
```

**Kasla connection:**
```javascript
{
    address: "kaspa:qz...",
    walletType: "kasla",
    email: "user@example.com",
    token: "eyJ..."
}
```

**Google connection:**
```javascript
{
    walletType: "google",
    email: "user@gmail.com",
    token: "eyJ..."
}
```

---

## Session Management

### Persisting Sessions

The widget keeps its own connection state in `localStorage` (`kc_token`, `kc_wallet`) so it can skip the selector for returning users. That is the widget's memory, not your app's session. Store your own token, obtained from the exchange in [Verifying the Token](#verifying-the-token), and drive your UI from that:

```javascript
window.KasperoConnect.onConnect = async function(user) {
    const res = await fetch('/api/auth/kaspero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: user.token })
    });
    const data = await res.json();
    localStorage.setItem('session_token', data.token);   // YOUR token
};

// On page load, restore session
const token = localStorage.getItem('session_token');
if (token) {
    // User is logged in
    showDashboard();
} else {
    // Show login button
    showLoginButton();
}
```

### Logout

```javascript
function logout() {
    // Clear your session
    localStorage.removeItem('session_token');
    
    // Disconnect widget
    window.KasperoConnect.disconnect();
    
    // Redirect or update UI
    window.location.href = '/';
}
```

### Wallet Switch Handling

If a user switches accounts in their browser extension (Kasware/Kastle), KasperoConnect detects it and prompts re-authentication with the new wallet, so the widget's own connection state always matches the active account.

This affects the widget's state only. Whether it should also end the user's session in your app is your call: a wallet-gated dApp probably wants that; a shop, where the wallet only matters at checkout, usually does not. If you issue your own session token as described above, your session survives wallet switches and extension auto-locks, and the wallet is asked for again only when a payment needs it.

---

## Advanced: Custom Signup Fields

For sites that need additional user information during signup:

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
    onConnect: function(user) {
        // User signed up with custom fields
    }
});
```

### Available Field Types

- `text` - Single line text
- `email` - Email with validation
- `password` - Password field
- `tel` - Phone number
- `checkbox` - Checkbox (for terms, newsletter, etc.)
- `select` - Dropdown
- `textarea` - Multi-line text

---

## Troubleshooting

### "Connect" button does nothing

**Cause:** Script not loaded or widget not initialized.

**Fix:** Check browser console for errors. Ensure the script URL is correct and the div has the correct ID.

### OAuth redirects to wrong URL

**Cause:** The widget detects the current page URL for redirect.

**Fix:** Make sure you're testing on your deployed URL, not localhost (unless you've configured localhost in your settings).

### User data not persisting after redirect

**Cause:** You're not catching the callback params.

**Fix:** Implement the callback handler. See [Handling the Auth Callback](#handling-the-auth-callback).

### Extensions not detected on mobile

**Cause:** Browser extensions don't exist on mobile.

**Fix:** Use mobile-friendly auth methods:
```html
<div id="kaspero-connect-button"
     data-wallets="kasla,google,email">
</div>
```

### Token expired

**Cause:** JWT tokens have an expiration time.

**Fix:** Check the token expiration and prompt re-authentication when needed:
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

Use Connect for user identity. Use Pay for transactions.

### Can users connect without a Kaspa wallet?

Yes! Google and Email authentication don't require a Kaspa wallet. Users get an identity without blockchain interaction.

### Is the token secure?

The JWT token is signed by KasperoConnect servers. You cannot forge or modify a valid one, but your server cannot check the signature locally either, so verify it with `GET https://kasperopay.com/api/auth/verify` before trusting it (see [Verifying the Token](#verifying-the-token)).

### How do I associate wallet users with email users?

If the same person connects via wallet and later via Google, they'll be separate identities. To link them, implement account linking in your own backend after the user is authenticated via both methods.

### What data do you store?

KasperoConnect stores minimal data: wallet addresses and email (for OAuth users). We don't store private keys or passwords.

---

## Changelog

**Documentation update** (September 2026)
- All URLs now use kasperopay.com; Keystone is now Kasla (`kasla`)
- Token is returned for every auth method, including Kasware and Kastle
- Replaced "decode without verification" with server-side verification via `/api/auth/verify` and a your-own-session pattern
- Clarified that wallet-switch detection affects widget state, not your app's session

**v1.2** (February 2026)
- **NEW:** Automatic wallet switch detection - switching wallets in Kasware/Kastle triggers re-authentication
- **IMPROVED:** Seamless account switching for power users with multiple wallets
- **FIX:** Session now properly tracks active wallet address

**v1.1** (January 2026)
- **NEW:** Dedicated Connect widget (separate from Pay widget)
- **NEW:** Google OAuth authentication
- **NEW:** Email magic link authentication
- **NEW:** `data-button-text` attribute for custom button text
- **NEW:** `data-theme` attribute for light/dark mode
- **NEW:** Custom signup fields support
- **IMPROVED:** Mobile-friendly auth flow
- **IMPROVED:** Session management helpers

**v1.0** (January 2026)
- Initial release (as part of KasperoPay)
- Kasware, Kastle, Kasla wallet support
- Basic connect/disconnect API

---

*Built with 💚 for the Kaspa ecosystem*
