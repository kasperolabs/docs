# KasperoConnect No-Code Integration Guide

**For developers using Replit AI, Cursor, ChatGPT, Claude, or other AI coding tools.**

Copy-paste prompts to add wallet authentication to your site.

---

## Before You Start

1. Optionally get a merchant ID at [kaspa-store.com/merchant](https://kaspa-store.com/merchant) (associates users with your account)
2. The widget needs a `#kaspero-connect-button` div in your HTML
3. Test on your deployed URL, not in IDE preview mode

---

## Prompt 1: Add Connect Wallet Button

```
Add KasperoConnect wallet authentication.

1. Add this HTML where you want the connect button:

<div id="kaspero-connect-button"
     data-wallets="kasware,kastle,keystone,google,email"
     data-theme="light"
     data-button-text="Connect Wallet">
</div>
<script src="https://kaspa-store.com/connect/widget.js"></script>

2. Handle successful connections:

window.KasperoConnect.onConnect = function(user) {
    console.log('Connected!', user);
    // user.address = Kaspa wallet address (if wallet auth)
    // user.email = email (if Google/email auth)
    // user.walletType = 'kasware', 'kastle', 'keystone', 'google', or 'email'
    // user.token = JWT token for backend verification
    
    // Save to localStorage and update UI
    localStorage.setItem('user', JSON.stringify(user));
    showLoggedInUI(user);
};

3. Add a logout function:

function logout() {
    localStorage.removeItem('user');
    window.KasperoConnect.disconnect();
    showLoggedOutUI();
}
```

---

## Prompt 2: Handle OAuth Callback (Google/Keystone)

```
Handle OAuth login callback. When users log in via Google or Keystone, they redirect back with URL parameters.

On page load, check for the callback:

document.addEventListener('DOMContentLoaded', function() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.get('kc_connected') === 'true') {
        const token = params.get('token');
        const wallet = params.get('wallet');
        
        if (token) {
            // Save session
            localStorage.setItem('auth_token', token);
            localStorage.setItem('wallet_type', wallet);
            
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
            
            // Update UI
            showLoggedInUI({ token, walletType: wallet });
        }
    }
    
    // Also check for errors
    const error = params.get('kc_error');
    if (error) {
        console.error('Login failed:', error);
        window.history.replaceState({}, '', window.location.pathname);
    }
});
```

---

## Prompt 3: Programmatic Connect (Custom Button)

```
Add wallet connection with a custom button instead of the default widget button.

1. Add the widget container (hidden):

<div id="kaspero-connect-button" style="display:none"></div>
<script src="https://kaspa-store.com/connect/widget.js"></script>

2. Trigger connect from your own button:

document.getElementById('my-login-button').onclick = function() {
    window.KasperoConnect.connect({
        wallets: ['kasware', 'kastle', 'keystone', 'google'],
        onConnect: function(user) {
            console.log('Connected:', user);
            localStorage.setItem('user', JSON.stringify(user));
            showLoggedInUI(user);
        },
        onCancel: function() {
            console.log('User cancelled');
        }
    });
};
```

---

## Prompt 4: Check If Already Connected

```
Check connection status on page load and restore session.

document.addEventListener('DOMContentLoaded', function() {
    // Check localStorage for existing session
    const savedUser = localStorage.getItem('user');
    
    if (savedUser) {
        const user = JSON.parse(savedUser);
        showLoggedInUI(user);
    } else {
        showLoggedOutUI();
    }
});

function showLoggedInUI(user) {
    document.getElementById('login-button').style.display = 'none';
    document.getElementById('user-info').style.display = 'block';
    document.getElementById('user-address').textContent = 
        user.address ? user.address.substring(0, 15) + '...' : user.email;
}

function showLoggedOutUI() {
    document.getElementById('login-button').style.display = 'block';
    document.getElementById('user-info').style.display = 'none';
}
```

---

## Prompt 5: Mobile-Friendly Auth Only

```
Set up authentication that works on mobile (no browser extensions).

Use only these auth methods for mobile compatibility:

<div id="kaspero-connect-button"
     data-wallets="keystone,google,email"
     data-theme="light">
</div>
<script src="https://kaspa-store.com/connect/widget.js"></script>

Kasware and Kastle are browser extensions and won't work on mobile.
Keystone, Google, and Email work everywhere.
```

---

## Prompt 6: Fix Logout / Clear All Sessions

```
Fix logout to clear all possible session data.

function logout() {
    // Clear all possible token locations
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token');
    localStorage.removeItem('kc_token');
    localStorage.removeItem('kc_user');
    localStorage.removeItem('kc_wallet');
    localStorage.removeItem('wallet_type');
    localStorage.removeItem('walletType');
    
    // Disconnect widget
    if (window.KasperoConnect) {
        window.KasperoConnect.disconnect();
    }
    
    // Update UI
    showLoggedOutUI();
}
```

---

## Common Issues

### Button does nothing

Make sure the script loaded. Check browser console for errors.

### OAuth redirects to wrong URL

The widget uses your current page URL for redirect. Test on deployed URL, not localhost.

### User data lost after redirect

You're not catching the callback params. Add the OAuth callback handler (see Prompt 2).

### Extensions not detected on mobile

Kasware and Kastle are desktop browser extensions. Use `data-wallets="keystone,google,email"` for mobile.

---

## Auth Methods Reference

| Method | Value | Works On |
|--------|-------|----------|
| Kasware | `kasware` | Desktop (Chrome extension) |
| Kastle | `kastle` | Desktop (Chrome extension) |
| Keystone | `keystone` | All devices |
| Google | `google` | All devices |
| Email | `email` | All devices |

---

## Need Help?

- Full Docs: [KasperoConnect Documentation](https://github.com/kasperolabs/docs/blob/main/kasperopay/kasperoconnect-v1.1.md)
- Email: kasperolabs@gmail.com
- Twitter: [@KasperoLabs](https://x.com/KasperoLabs)

---

*Built with 💚 for the Kaspa ecosystem*
