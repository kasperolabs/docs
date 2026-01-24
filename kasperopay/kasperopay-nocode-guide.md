# KasperoPay No-Code Integration Guide

**For developers using Replit AI, Cursor, ChatGPT, Claude, or other AI coding tools.**

Copy-paste prompts to integrate KasperoPay into your site.

---

## Before You Start

1. Get your merchant ID at [kaspa-store.com/merchant](https://kaspa-store.com/merchant) (looks like `kpm_abc123xy`)
2. The widget needs a `#kaspero-pay-button` div in your root HTML layout
3. Test on your deployed URL, not in IDE preview mode

---

## Prompt 1: Add Payment Button

```
Add KasperoPay payment integration. 

1. Add this to the root layout (index.html or App.tsx), OUTSIDE any conditional components:

<div id="kaspero-pay-button" data-merchant="kpm_YOUR_MERCHANT_ID" style="display:none"></div>
<script src="https://kaspa-store.com/pay/widget.js"></script>

2. To trigger a payment, call:

window.KasperoPay.pay({
    amount: ORDER_AMOUNT_IN_KAS,
    item: 'ORDER_DESCRIPTION',
    style: 'dark'
});

3. Handle successful payments:

window.KasperoPay.onPayment(function(result) {
    if (result.success) {
        console.log('Payment complete:', result.txid);
        // Update order status, redirect to confirmation, etc.
    }
});

Replace kpm_YOUR_MERCHANT_ID with my actual merchant ID.
```

---

## Prompt 2: Add Connect Wallet Button

```
Add a "Connect Wallet" button for Kaspa wallet login.

1. Make sure the KasperoPay widget div exists in the root layout.

2. When the connect button is clicked, call:

window.KasperoPay.connect({
    onConnect: function(user) {
        // user.address = Kaspa wallet address
        // user.walletType = 'kasware', 'kastle', 'keystone', or 'kasanova'
        // user.email = email (Keystone only)
        // Save user to state and show logged-in UI
    },
    onCancel: function() {
        console.log('User cancelled');
    }
});

3. Add a "Disconnect" button that calls window.KasperoPay.disconnect();

4. Show the user's truncated wallet address when connected.
```

---

## Prompt 3: Handle Keystone Login Callback

```
Handle Keystone wallet login. When users log in via Keystone, they redirect back with URL parameters.

1. On page load, check for the callback:

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const keystoneConnected = params.get('keystone_connected');
  const token = params.get('token');

  if (keystoneConnected === 'true' && token) {
    localStorage.setItem('auth_token', token);
    
    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(userData => {
      setUser(userData);
      window.history.replaceState({}, '', window.location.pathname);
    });
  }
}, []);

2. Add this backend endpoint:

const jwt = require('jsonwebtoken');

app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Use jwt.decode(), NOT jwt.verify() - token is already validated by KasperoPay
  const decoded = jwt.decode(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  res.json({
    id: decoded.userId,
    email: decoded.email,
    authType: 'keystone'
  });
});
```

---

## Prompt 4: Fix Logout / Disconnect

```
Fix logout and disconnect. When a user logs out or disconnects, clear ALL of these from localStorage:
- auth_token
- token  
- kp_token
- kp_wallet
- walletType
- user

Also clear user state in React context. After logout, show the logged-out UI immediately without refresh.
```

---

## Common Issues

### "Invalid merchant ID"

The `#kaspero-pay-button` div must exist before the script loads. Move it to your root layout, outside conditional components.

### Keystone redirects to wrong site

Update to latest widget. Already fixed in v1.2.

### User state lost after redirect

Make sure you handle the `?keystone_connected=true&token=xxx` URL params on page load (see Prompt 3).

---

## Need Help?

- Full Docs: [kaspa-store.com/docs](https://kaspa-store.com/docs)
- Email: kasperolabs@gmail.com
- Twitter: [@KasperoLabs](https://x.com/KasperoLabs)

---

*Built with 💚 for the Kaspa ecosystem*
