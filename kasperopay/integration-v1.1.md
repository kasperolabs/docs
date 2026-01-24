# KasperoPay Documentation v1.2

Accept Kaspa payments on your website in minutes.

> **Using AI to build your site?** See our [No-Code Integration Guide](kasperopay-nocode-guide.md) with copy-paste prompts for Replit, Cursor, and other AI coding tools.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Button Configuration](#button-configuration)
3. [Button Themes](#button-themes)
4. [Security Model](#security-model)
5. [JavaScript API](#javascript-api)
6. [Payment Options](#payment-options)
7. [Wallet Connection (Authentication)](#wallet-connection-authentication)
8. [Keystone OAuth Integration](#keystone-oauth-integration)
9. [Advanced: Cart Integration](#advanced-cart-integration)
10. [Public API Endpoints](#public-api-endpoints)
11. [Verifying Payments](#verifying-payments)
12. [Webhooks (Coming Soon)](#webhooks)
13. [Troubleshooting](#troubleshooting)
14. [FAQ](#faq)
15. [Changelog](#changelog)

---

## Quick Start

### 1. Get Your Merchant ID

Sign up at [kaspa-store.com/merchant](https://kaspa-store.com/merchant) to get your merchant ID (e.g., `kpm_abc123xy`).

### 2. Add the Widget

Paste this code in your HTML. **Important:** Place the div in your root layout, outside any conditionals or dynamically loaded components.

```html
<!-- Place in root layout, NOT inside conditional components -->
<div id="kaspero-pay-button"
     data-merchant="kpm_YOUR_MERCHANT_ID"
     data-amount="10"
     data-item="Product Name">
</div>
<script src="https://kaspa-store.com/pay/widget.js"></script>
```

That's it! You now have a working Kaspa payment button.

### 3. Hidden Mode (For Programmatic Use)

If you want to trigger payments via JavaScript without showing a button:

```html
<!-- Hidden container - still required for initialization -->
<div id="kaspero-pay-button" 
     data-merchant="kpm_YOUR_MERCHANT_ID" 
     style="display:none">
</div>
<script src="https://kaspa-store.com/pay/widget.js"></script>

<script>
// Trigger payment from your own button/logic
document.getElementById('my-checkout-btn').onclick = function() {
    window.KasperoPay.pay({
        amount: 25.5,
        item: 'My Product'
    });
};
</script>
```

> ⚠️ **Common Issue:** "Invalid merchant ID" error usually means the `#kaspero-pay-button` div doesn't exist or loaded after the script. The div must be in the DOM before the widget initializes.

---

## Button Configuration

### Data Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-merchant` | Yes | Your merchant ID (starts with `kpm_`) |
| `data-amount` | Yes | Amount in KAS |
| `data-item` | No | Item description shown to customer |
| `data-style` | No | Button theme (default: `institutional`) |
| `data-image` | No | Product image URL |

### Example: Full Configuration

```html
<div id="kaspero-pay-button"
     data-merchant="kpm_abc123xy"
     data-amount="25.5"
     data-item="Premium Subscription"
     data-style="dark"
     data-image="https://yoursite.com/product.jpg">
</div>
<script src="https://kaspa-store.com/pay/widget.js"></script>
```

---

## Button Themes

KasperoPay offers 5 built-in themes to match your site design:

| Theme | Description | Best For |
|-------|-------------|----------|
| `institutional` | Navy blue, professional | Business sites, default |
| `ghost` | Outline style, transparent | Minimal designs |
| `dark` | Dark background, teal accents | Dark mode sites |
| `soft` | Light gray, subtle | Light backgrounds |
| `pill` | Rounded corners | Inline buttons |

### Usage

```html
<div id="kaspero-pay-button"
     data-merchant="kpm_abc123xy"
     data-amount="10"
     data-style="dark">
</div>
```

### Theme Preview

See all themes in action: [kaspa-store.com/demo](https://kaspa-store.com/demo)

---

## Security Model

KasperoPay uses a **secure session token system** to prevent payment spoofing.

### How It Works

1. **Session Initialization**: When the Pay button is clicked, the widget calls `/pay/init` with merchant ID and amount. The server validates the merchant and generates a one-time session token.

2. **HMAC Signature**: The token is an HMAC-SHA256 signature of `session_id:merchant_id:amount`. This binds the payment amount to the session cryptographically.

3. **Token Verification**: When creating the payment, the server verifies the token matches and the session hasn't expired (15-minute window).

4. **One-Time Use**: Each session token can only be used once. Replay attacks are prevented.

### What This Prevents

- ✅ Amount manipulation (changing $10 to $0.01)
- ✅ Merchant ID spoofing
- ✅ Replay attacks
- ✅ Session hijacking (tokens bound to merchant + amount)

### Domain Restrictions (Optional)

You can restrict which domains can use your merchant ID:

1. Go to your merchant dashboard
2. Add allowed domains (e.g., `yourstore.com`, `shop.yourstore.com`)
3. Payments from unauthorized domains will be rejected

---

## JavaScript API

### Basic Methods

```javascript
// Check if widget is ready
if (window.KasperoPay.isReady()) {
    console.log('Widget loaded');
}

// Check if wallet is connected
if (window.KasperoPay.isConnected()) {
    console.log('Wallet connected');
}

// Set amount dynamically
window.KasperoPay.setAmount(25.5, 'Premium Plan');

// Trigger payment programmatically
window.KasperoPay.pay({
    amount: 25.5,
    item: 'Premium Plan'
});

// Change theme dynamically
window.KasperoPay.setStyle('dark');

// Disconnect wallet
window.KasperoPay.disconnect();

// Get connected user info
const user = window.KasperoPay.getUser();
```

### Payment Callback

Listen for completed payments:

```javascript
window.KasperoPay.onPayment(function(payment) {
    console.log('Payment completed!', payment);
    // payment.payment_id - Unique payment ID
    // payment.txid - Kaspa transaction ID
    // payment.amount_kas - Amount paid
    // payment.status - 'completed'
    
    // Redirect to thank you page, unlock content, etc.
    window.location.href = '/thank-you?payment=' + payment.payment_id;
});
```

### Cancel Callback

Listen for cancelled/closed payments:

```javascript
window.KasperoPay.onCancel(function() {
    console.log('Payment cancelled by user');
    // User closed the modal without completing payment
});
```

---

## Payment Options

The `pay()` method accepts several options to control the payment flow:

```javascript
window.KasperoPay.pay({
    // Required
    amount: 25.5,
    
    // Optional
    item: 'Product Name',
    style: 'dark',
    
    // UI Control
    showWalletSelector: true,   // Show/hide wallet selection screen
    showConfirmation: true,     // Show/hide confirmation screen before payment
    showReceipt: true,          // Show/hide receipt after payment
    showNotifications: true,    // Show/hide toast notifications
    
    // Callbacks
    onPayment: function(result) { },
    onCancel: function() { }
});
```

### Payment Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `amount` | number | required | Amount in KAS |
| `item` | string | 'Payment' | Item description |
| `style` | string | 'institutional' | Modal theme |
| `showWalletSelector` | boolean | auto | Force show/hide wallet selector. Auto = show if not connected |
| `showConfirmation` | boolean | true | Show confirmation screen before sending |
| `showReceipt` | boolean | true | Show receipt after payment completes |
| `showNotifications` | boolean | true | Show toast notifications (success, error, etc.) |

### Custom Error Handling

If you want to handle all UI feedback yourself, disable notifications and use callbacks:

```javascript
window.KasperoPay.pay({
    amount: 25.5,
    item: 'Product',
    showNotifications: false,  // No toasts
    showReceipt: false,        // No receipt modal
    onPayment: function(result) {
        if (result.success) {
            // Show your own success UI
            showMySuccessMessage(result.txid);
        } else {
            // Show your own error UI
            showMyErrorMessage(result.error);
        }
    }
});
```

### Skip Wallet Selector (Connected Users)

For returning users who are already connected:

```javascript
// Check if connected, skip straight to payment
if (window.KasperoPay.isConnected()) {
    window.KasperoPay.pay({
        amount: 25.5,
        showWalletSelector: false  // Skip wallet selection
    });
} else {
    window.KasperoPay.pay({
        amount: 25.5
        // Will show wallet selector
    });
}
```

---

## Wallet Connection (Authentication)

Use KasperoPay for wallet-based login, separate from payments. This is useful for sites that need user authentication before checkout.

### Connect Method

```javascript
window.KasperoPay.connect({
    merchant: 'kpm_abc123xy',  // Optional: associate with merchant
    onConnect: function(user) {
        console.log('Connected!', user);
        // user.address - Kaspa address
        // user.walletType - 'kasware', 'kastle', 'keystone', or 'kasanova'
        // user.publicKey - Public key (if available)
        // user.email - Email (Keystone only)
    },
    onCancel: function() {
        console.log('User cancelled');
    }
});
```

### User Object

| Property | Type | Description |
|----------|------|-------------|
| `address` | string | Kaspa address (e.g., `kaspa:qz...`) |
| `walletType` | string | `'kasware'`, `'kastle'`, `'keystone'`, or `'kasanova'` |
| `publicKey` | string | Public key (Kasware/Kastle only) |
| `email` | string | User's email (Keystone only) |

### Check Connection Status

```javascript
// Check if user is connected
if (window.KasperoPay.isConnected()) {
    const user = window.KasperoPay.getUser();
    console.log('Connected as:', user.address);
}

// Disconnect
window.KasperoPay.disconnect();
```

### Auto-Detection

The widget automatically detects if a wallet is already connected:

1. Checks stored session (Keystone returning users)
2. Checks Kastle extension
3. Checks Kasware extension
4. Checks Kasanova mobile wallet (if available)

If already connected, `connect()` returns immediately with user data via the callback.

### Force Wallet Selection

To show the wallet selector even if already connected (useful for "Switch Wallet" functionality):

```javascript
window.KasperoPay.connect({
    forceSelect: true,
    onConnect: function(user) {
        console.log('Switched to:', user.address);
    }
});
```

### Example: Login Button

```html
<button id="login-btn">Connect Wallet</button>
<div id="user-info" style="display: none;">
    <span id="user-address"></span>
    <button id="logout-btn">Disconnect</button>
</div>

<script src="https://kaspa-store.com/pay/widget.js"></script>
<script>
document.getElementById('login-btn').onclick = function() {
    window.KasperoPay.connect({
        onConnect: function(user) {
            document.getElementById('login-btn').style.display = 'none';
            document.getElementById('user-info').style.display = 'block';
            document.getElementById('user-address').textContent = 
                user.address.substring(0, 15) + '...';
        }
    });
};

document.getElementById('logout-btn').onclick = function() {
    window.KasperoPay.disconnect();
    document.getElementById('login-btn').style.display = 'block';
    document.getElementById('user-info').style.display = 'none';
};
</script>
```

---

## Keystone OAuth Integration

Keystone is an OAuth-based wallet that works on any browser, including mobile. When users log in via Keystone, they get redirected back to your site with authentication parameters.

### How It Works

1. User clicks Keystone in the wallet selector
2. User logs in on Keystone's secure site
3. User is redirected back to your site with `?keystone_connected=true&token=xxx`
4. Your app catches those params and completes the login

### Handling the Keystone Callback

Add this to your app to catch returning Keystone users:

**React/Next.js:**

```tsx
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
      setUser(userData);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    });
  }
}, []);
```

**Backend endpoint to decode the token:**

```javascript
const jwt = require('jsonwebtoken');

app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Decode without verification - token comes from trusted KasperoPay OAuth
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
```

> **Note:** Use `jwt.decode()`, not `jwt.verify()`. The token is already validated by KasperoPay's OAuth flow. You don't need the JWT secret.

### Token Contents

The Keystone JWT contains:

```javascript
{
  userId: 123,              // KasperoPay user ID
  email: "user@example.com",
  isKeystone: true,
  isAdmin: false
}
```

---

## Advanced: Cart Integration

### Dynamic Cart Checkout

```javascript
let cartTotal = 0;
let cartItems = [];

function updateCart() {
    cartTotal = cartItems.reduce((sum, item) => sum + item.price, 0);
    window.KasperoPay.setAmount(cartTotal, `Cart (${cartItems.length} items)`);
}

function addToCart(item) {
    cartItems.push(item);
    updateCart();
}

window.KasperoPay.onPayment(function(payment) {
    fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            payment_id: payment.payment_id,
            items: cartItems,
            txid: payment.txid
        })
    })
    .then(() => {
        cartItems = [];
        window.location.href = '/order-complete/' + payment.payment_id;
    });
});
```

### Subscription Tiers

```html
<div class="pricing-tiers">
    <div class="tier" onclick="selectTier('basic', 10)">
        <h3>Basic</h3>
        <p>10 KAS/month</p>
    </div>
    <div class="tier" onclick="selectTier('pro', 25)">
        <h3>Pro</h3>
        <p>25 KAS/month</p>
    </div>
</div>

<div id="kaspero-pay-button"
     data-merchant="kpm_abc123xy"
     data-amount="10"
     data-item="Basic Plan">
</div>
<script src="https://kaspa-store.com/pay/widget.js"></script>

<script>
let selectedTier = 'basic';

function selectTier(tier, amount) {
    selectedTier = tier;
    document.querySelectorAll('.tier').forEach(el => el.classList.remove('selected'));
    event.target.closest('.tier').classList.add('selected');
    window.KasperoPay.setAmount(amount, tier.charAt(0).toUpperCase() + tier.slice(1) + ' Plan');
}

window.KasperoPay.onPayment(function(payment) {
    fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            payment_id: payment.payment_id,
            tier: selectedTier,
            txid: payment.txid
        })
    })
    .then(() => {
        window.location.href = '/dashboard?subscribed=' + selectedTier;
    });
});
</script>
```

---

## Public API Endpoints

All endpoints are CORS-enabled and can be called from browser JavaScript.

### Get Payment Status

```
GET https://kaspa-store.com/pay/status/{payment_id}
```

**Response:**
```json
{
    "payment_id": "pay_abc123...",
    "status": "completed",
    "amount_kas": 25.5,
    "amount_usd": 2.55,
    "txid": "abc123...",
    "store_name": "Your Store",
    "confirmed_at": "2025-01-19T12:00:00Z",
    "expires_at": "2025-01-19T12:15:00Z"
}
```

**Status Values:**
- `pending` - Awaiting payment
- `confirming` - Transaction submitted, awaiting confirmation
- `completed` - Payment confirmed
- `expired` - Payment window expired

### Get Payment Receipt

```
GET https://kaspa-store.com/pay/receipt/{payment_id}
```

Only available for completed payments.

### Verify Payment (Server-Side)

```
POST https://kaspa-store.com/pay/verify
Content-Type: application/json

{
    "payment_id": "pay_abc123...",
    "txid": "blockchain_transaction_id"
}
```

---

## Verifying Payments

### Client-Side (JavaScript)

```javascript
window.KasperoPay.onPayment(function(payment) {
    // This fires when payment is confirmed
    unlockContent(payment.payment_id);
});
```

### Server-Side (Recommended for High-Value)

```javascript
app.post('/verify-payment', async (req, res) => {
    const { payment_id } = req.body;
    
    const response = await fetch(
        `https://kaspa-store.com/pay/status/${payment_id}`
    );
    const data = await response.json();
    
    if (data.status === 'completed' && data.amount_kas >= expectedAmount) {
        await fulfillOrder(payment_id, data);
        res.json({ success: true });
    } else {
        res.json({ error: 'Payment not verified' });
    }
});
```

### Direct Blockchain Verification

```javascript
const response = await fetch(`https://api.kaspa.org/transactions/${txid}`);
const tx = await response.json();

if (tx.is_accepted) {
    const output = tx.outputs.find(o => 
        o.script_public_key_address === expectedAddress
    );
    
    if (output) {
        const receivedKAS = output.amount / 1e8;
        if (receivedKAS >= expectedAmount * 0.99) {
            console.log('Payment verified on blockchain!');
        }
    }
}
```

---

## Webhooks

> **Coming Soon**: Server-to-server webhooks for real-time payment notifications.

Currently, payment notifications are available via:
1. JavaScript callback (`onPayment`)
2. Email notifications (configurable in dashboard)
3. Polling the `/pay/status/{payment_id}` endpoint

---

## Troubleshooting

### "Invalid merchant ID" Error

**Cause:** The `#kaspero-pay-button` div doesn't exist when the widget script loads.

**Fix:** 
- Place the div in your root HTML layout, not inside conditional components
- Make sure it's not dynamically rendered after page load
- For React/Vue: use a hidden div outside your main component tree

```html
<!-- In your root index.html or layout -->
<div id="kaspero-pay-button" data-merchant="kpm_xxx" style="display:none"></div>
```

### Keystone Redirects to Wrong Site

**Cause:** Widget was sending pathname only, not full URL.

**Fix:** Update to v1.2 of the widget. Already fixed.

### Widget Doesn't Load in Dev Preview

**Cause:** Some IDE preview modes (Replit, CodeSandbox) run in iframes that block certain features.

**Fix:** Test on your deployed URL, not in IDE preview modes.

### Wallet Connection Lost After Redirect

**Cause:** Keystone OAuth returns to your site but your app doesn't catch the callback params.

**Fix:** Implement the Keystone callback handler. See [Keystone OAuth Integration](#keystone-oauth-integration).

### Payment Succeeds But Callback Doesn't Fire

**Cause:** `onPayment` callback was registered after the payment completed.

**Fix:** Register your callback before calling `pay()`:

```javascript
// CORRECT ORDER
window.KasperoPay.onPayment(function(result) {
    // Handle payment
});

window.KasperoPay.pay({ amount: 25 });
```

---

## FAQ

### What wallets are supported?

- **Kasware** - Browser extension (desktop)
- **Kastle** - Browser extension (desktop)
- **Keystone** - OAuth-based wallet (all browsers, including mobile)
- **Kasanova** - Mobile wallet app
- **Any wallet** - Via QR code (manual payment)

### What fees does KasperoPay charge?

Default fee is 1.5% per transaction. You can adjust this (0-10%) in your merchant settings.

### How fast are payments confirmed?

Kaspa confirms transactions in about 1 second. The widget waits for blockchain confirmation before showing success.

### Can I customize the wallet options shown?

Coming in v1.3. You'll be able to enable/disable specific wallets.

### How do I get support?

- Email: kasperolabs@gmail.com
- Twitter: [@KasperoLabs](https://x.com/KasperoLabs)
- GitHub: [Report bugs](https://github.com/kasperolabs)

---

## Changelog

**v1.2** (January 2025)
- **NEW:** `showWalletSelector` option to force show/hide wallet selection
- **NEW:** `showConfirmation` option to show/hide confirmation screen
- **NEW:** `showNotifications` option to suppress toast messages
- **NEW:** `onCancel` callback for cancelled payments
- **NEW:** Kasanova mobile wallet support
- **NEW:** Troubleshooting section
- **NEW:** No-Code Integration Guide for AI-assisted developers
- **FIX:** Keystone redirect now uses full URL (was using pathname only)
- **FIX:** Race condition when div loads after script
- **DOCS:** Added Keystone OAuth integration guide
- **DOCS:** Added JWT decode example (not verify)

**v1.1** (January 2025)
- `connect()` API for wallet-based authentication
- `isConnected()` helper method
- `showReceipt` option to suppress widget receipt modal
- Auto-detect connected wallets
- `forceSelect` option to override auto-detection

**v1.0** (January 2025)
- Initial release
- 5 button themes
- Secure session tokens
- Multi-wallet support (Kasware, Kastle, Keystone, QR)
- Payment verification API

---

*Built with 💚 for the Kaspa ecosystem*
