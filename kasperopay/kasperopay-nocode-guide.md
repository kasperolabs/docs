# KasperoPay No-Code Integration Guide

**For developers using Replit AI, Cursor, ChatGPT, Claude, or other AI coding tools.**

This guide provides copy-paste prompts to integrate KasperoPay into your site without writing code manually.

---

## Table of Contents

1. [Before You Start](#before-you-start)
2. [Basic Integration](#basic-integration)
3. [Add Wallet Login](#add-wallet-login)
4. [Handle Keystone OAuth](#handle-keystone-oauth)
5. [Cleanup Prompts](#cleanup-prompts)
6. [Common Issues](#common-issues)

---

## Before You Start

### Get Your Merchant ID

1. Go to [kaspa-store.com/merchant](https://kaspa-store.com/merchant)
2. Sign up / log in
3. Copy your merchant ID (looks like `kpm_abc123xy`)

### Important Rules

- The widget needs a `#kaspero-pay-button` div to exist in your HTML
- This div must be in your root layout, NOT inside conditional components
- Test on your deployed URL, not in IDE preview mode

---

## Basic Integration

### Prompt 1: Add KasperoPay Payment Button

Copy this prompt to your AI assistant:

```
Add KasperoPay payment integration to the site. 

1. Add this div to the root layout (index.html or App.tsx), OUTSIDE any conditional components:

<div id="kaspero-pay-button" data-merchant="kpm_YOUR_MERCHANT_ID" style="display:none"></div>

2. Add this script tag right after it:

<script src="https://kaspa-store.com/pay/widget.js"></script>

3. Where I want to trigger a payment (e.g., checkout button), call:

window.KasperoPay.pay({
    amount: ORDER_AMOUNT_IN_KAS,
    item: 'ORDER_DESCRIPTION',
    style: 'dark'
});

4. Add a callback to handle successful payments:

window.KasperoPay.onPayment(function(result) {
    if (result.success) {
        console.log('Payment complete:', result.txid);
        // Update order status, show confirmation, etc.
    }
});

Replace kpm_YOUR_MERCHANT_ID with my actual merchant ID.
```

---

## Add Wallet Login

### Prompt 2: Add Connect Wallet Button

```
Add a "Connect Wallet" button that lets users log in with their Kaspa wallet.

1. Make sure the KasperoPay widget div exists (see previous integration).

2. Add a "Connect Wallet" button to the header/navbar.

3. When clicked, call:

window.KasperoPay.connect({
    onConnect: function(user) {
        console.log('Connected:', user);
        // user.address = Kaspa wallet address
        // user.walletType = 'kasware', 'kastle', 'keystone', or 'kasanova'
        // user.email = email (Keystone only)
        
        // Save user to state and show logged-in UI
    },
    onCancel: function() {
        console.log('User cancelled');
    }
});

4. Add a "Disconnect" button that calls:

window.KasperoPay.disconnect();

5. Show the user's truncated wallet address when connected (first 10 chars + '...' + last 6 chars).
```

---

## Handle Keystone OAuth

When users log in with Keystone, they get redirected back to your site with URL parameters. You need to catch these.

### Prompt 3: Handle Keystone Login Callback

```
Handle Keystone wallet login callback. When users log in via Keystone through the KasperoPay widget, they get redirected back with URL parameters.

1. Add this useEffect (React) or equivalent to catch the callback on page load:

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const keystoneConnected = params.get('keystone_connected');
  const token = params.get('token');

  if (keystoneConnected === 'true' && token) {
    // Store the token
    localStorage.setItem('auth_token', token);
    
    // Fetch user profile
    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(userData => {
      // Update user state
      setUser(userData);
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    })
    .catch(err => console.error('Auth error:', err));
  }
}, []);

2. Add this backend endpoint to decode the token:

const jwt = require('jsonwebtoken');

app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // IMPORTANT: Use jwt.decode(), NOT jwt.verify()
  // The token is already validated by KasperoPay
  const decoded = jwt.decode(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // decoded contains: { userId, email, isKeystone, isAdmin }
  res.json({
    id: decoded.userId,
    email: decoded.email,
    authType: 'keystone'
  });
});

The token is from a trusted OAuth flow, so we decode without verification.
```

---

## Cleanup Prompts

After your basic integration is working, use these prompts to fix common issues in AI-generated code.

### Prompt 4: Fix Logout / Disconnect

```
Review the logout and disconnect wallet functionality. Make sure when a user logs out or disconnects, you clear ALL of these from localStorage:
- auth_token
- token
- kp_token
- kp_wallet
- walletType
- user
- Any other keys used to persist login state

Also clear any user state in React context/state. After logout, the user should see the logged-out UI immediately without needing to refresh.
```

### Prompt 5: Audit Buttons

```
List all buttons in the app and their current onClick handlers. For each button, tell me:
1. Button text/label
2. What file it's in
3. Whether it has an onClick handler
4. If it has a handler, what does it do

Don't change anything yet - just give me the report. I'll tell you which ones to fix or remove.
```

### Prompt 6: Add Dark/Light Mode

```
Add a dark mode / light mode toggle to the site. 
- Store the preference in localStorage so it persists
- Default to dark mode
- Add a toggle button in the header/navbar (sun/moon icon)
- Make sure all components respect the theme choice
```

### Prompt 7: Form Validation

```
Review and fix form validation issues:

1. Add required field validation to all forms. Don't let users submit with empty fields.

2. If an item is marked as "digital", don't ask for shipping address. Check itemType and hide shipping fields for digital products.

3. Add loading spinners/disabled states to buttons while API calls are in progress. Prevent double-clicks.

4. When something fails, show a clear error message to the user. Don't fail silently.

5. If a search or filter returns no results, show "No items found" instead of a blank screen.
```

### Prompt 8: Save User Shipping Info

```
Save user shipping/contact info and streamline checkout:

1. After a user completes a purchase with shipping info, save their details (name, contact, address, city, zip, country) to their user profile in the database.

2. Add a "Shipping Info" section in the user's profile page where they can view and edit their saved info.

3. On checkout: if the user is logged in AND has saved shipping info, skip the shipping info modal entirely and go straight to payment.

4. For digital items, skip the shipping modal completely regardless of saved info.

5. Add a small "Edit shipping info" link on the payment screen in case they want to change it for this order.
```

---

## Common Issues

### "Invalid merchant ID" Error

**Cause:** The `#kaspero-pay-button` div doesn't exist when the widget loads.

**Fix prompt:**
```
The KasperoPay widget is showing "Invalid merchant ID" error. This happens when the #kaspero-pay-button div loads after the script. 

Move this div to the root layout file (index.html or the top of App.tsx), OUTSIDE any conditional rendering:

<div id="kaspero-pay-button" data-merchant="kpm_YOUR_ID" style="display:none"></div>
<script src="https://kaspa-store.com/pay/widget.js"></script>

The div must exist in the DOM before the script runs.
```

### Keystone Redirects to Wrong Site

**Cause:** Old widget version bug (fixed in v1.2).

**Fix:** Make sure you're loading the latest widget:
```html
<script src="https://kaspa-store.com/pay/widget.js"></script>
```

### User State Lost After Redirect

**Fix prompt:**
```
Users are losing their login state after Keystone redirect. Make sure the app:

1. Checks for ?keystone_connected=true&token=xxx in the URL on page load
2. Stores the token in localStorage
3. Fetches user profile from /api/auth/me with the token
4. Updates React/Vue state with the user data
5. Cleans the URL params after processing

See the "Handle Keystone Login Callback" section for the full code.
```

### Wallet Connected But UI Doesn't Update

**Fix prompt:**
```
The wallet connects successfully but the UI doesn't update. Make sure:

1. The onConnect callback updates your React/Vue state
2. Your components re-render when user state changes
3. You're not storing user in a plain variable - use useState or your state management

Example:
const [user, setUser] = useState(null);

window.KasperoPay.connect({
    onConnect: function(u) {
        setUser(u);  // This triggers re-render
    }
});
```

---

## Testing Checklist

Before going live, test these flows:

- [ ] Payment button appears
- [ ] Clicking pay opens the wallet selector
- [ ] Kasware connection works (if installed)
- [ ] Kastle connection works (if installed)
- [ ] Keystone login redirects and returns correctly
- [ ] Payment completes and callback fires
- [ ] Disconnect clears all state
- [ ] Page refresh maintains login state
- [ ] Mobile: Keystone and QR options work

---

## Need Help?

- Full Documentation: [KasperoPay Docs](https://kaspa-store.com/docs)
- Email: kasperolabs@gmail.com
- Twitter: [@KasperoLabs](https://x.com/KasperoLabs)

---

*Built with 💚 for the Kaspa ecosystem*
