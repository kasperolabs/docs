# KasperoPay Documentation

Accept Kaspa payments on your website in minutes.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Button Configuration](#button-configuration)
3. [Button Themes](#button-themes)
4. [Security Model](#security-model)
5. [JavaScript API](#javascript-api)
6. [Wallet Connection (Authentication)](#wallet-connection-authentication)
7. [Advanced: Cart Integration](#advanced-cart-integration)
8. [Public API Endpoints](#public-api-endpoints)
9. [Verifying Payments](#verifying-payments)
10. [Webhooks (Coming Soon)](#webhooks)
11. [FAQ](#faq)
12. [Changelog](#changelog)

---

## Quick Start

### 1. Get Your Merchant ID

Sign up at [kaspa-store.com/merchant](https://kaspa-store.com/merchant) to get your merchant ID (e.g., `kpm_abc123xy`).

### 2. Add the Widget

Paste this code where you want the payment button to appear:

```html
<div id="kaspero-pay-button"
     data-merchant="kpm_YOUR_MERCHANT_ID"
     data-amount="10"
     data-item="Product Name">
</div>
<script src="https://kaspa-store.com/pay/widget.js"></script>
```

That's it! You now have a working Kaspa payment button.

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
    item: 'Premium Plan',
    showReceipt: true  // Optional: set to false to hide widget receipt
});

// Change theme dynamically
window.KasperoPay.setStyle('dark');

// Disconnect wallet
window.KasperoPay.disconnect();

// Get connected user info
const user = window.KasperoPay.getUser();
```

### Payment Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `amount` | number | required | Amount in KAS |
| `item` | string | 'Payment' | Item description |
| `showReceipt` | boolean | true | Show widget receipt after payment |

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

### Suppressing the Receipt Modal

If your site has its own order confirmation page, you can hide the widget's receipt:

```javascript
window.KasperoPay.pay({
    amount: 25.5,
    item: 'Order #12345',
    showReceipt: false  // Widget closes after payment, your callback handles the rest
});

window.KasperoPay.onPayment(function(payment) {
    // Show your own confirmation page
    window.location.href = '/order-complete/' + payment.payment_id;
});
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
        // user.walletType - 'kasware', 'kastle', or 'keystone'
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
| `walletType` | string | `'kasware'`, `'kastle'`, or `'keystone'` |
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

## Advanced: Cart Integration

For shopping carts with multiple items or dynamic totals:

### Example: E-commerce Cart

```html
<div id="kaspero-pay-button"
     data-merchant="kpm_abc123xy"
     data-amount="0"
     data-item="Cart">
</div>
<script src="https://kaspa-store.com/pay/widget.js"></script>

<script>
// Your cart logic
const cart = {
    items: [
        { name: 'T-Shirt', price: 15, qty: 2 },
        { name: 'Mug', price: 8, qty: 1 }
    ],
    
    getTotal: function() {
        return this.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
    },
    
    getDescription: function() {
        return this.items.map(i => `${i.qty}x ${i.name}`).join(', ');
    }
};

// Update payment button when cart changes
function updatePayButton() {
    const total = cart.getTotal();
    const description = cart.getDescription();
    
    // Convert USD to KAS (you'd fetch current rate)
    const kasRate = 0.10; // $0.10 per KAS
    const kasAmount = total / kasRate;
    
    window.KasperoPay.setAmount(kasAmount.toFixed(2), description);
}

// Handle successful payment
window.KasperoPay.onPayment(function(payment) {
    // Send order to your backend
    fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            payment_id: payment.payment_id,
            txid: payment.txid,
            items: cart.items,
            total_kas: payment.amount_kas
        })
    })
    .then(response => response.json())
    .then(order => {
        window.location.href = '/order-confirmation/' + order.id;
    });
});

// Initialize
updatePayButton();
</script>
```

### Example: Donation with Custom Amount

```html
<input type="number" id="donation-amount" placeholder="Enter KAS amount" min="1">
<button onclick="donate()">Donate</button>

<div id="kaspero-pay-button"
     data-merchant="kpm_abc123xy"
     data-amount="0"
     data-item="Donation"
     style="display: none;">
</div>
<script src="https://kaspa-store.com/pay/widget.js"></script>

<script>
function donate() {
    const amount = document.getElementById('donation-amount').value;
    
    if (!amount || amount < 1) {
        alert('Please enter a valid amount');
        return;
    }
    
    // Trigger payment with custom amount
    window.KasperoPay.pay({
        amount: parseFloat(amount),
        item: 'Donation - Thank you!'
    });
}

window.KasperoPay.onPayment(function(payment) {
    alert('Thank you for your donation of ' + payment.amount_kas + ' KAS!');
});
</script>
```

### Example: Subscription Tiers

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
    <div class="tier" onclick="selectTier('enterprise', 100)">
        <h3>Enterprise</h3>
        <p>100 KAS/month</p>
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
    
    // Highlight selected tier (your CSS)
    document.querySelectorAll('.tier').forEach(el => el.classList.remove('selected'));
    event.target.closest('.tier').classList.add('selected');
    
    // Update payment button
    window.KasperoPay.setAmount(amount, tier.charAt(0).toUpperCase() + tier.slice(1) + ' Plan');
}

window.KasperoPay.onPayment(function(payment) {
    // Create subscription on your backend
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

**Response:**
```json
{
    "receipt": {
        "payment_id": "pay_abc123...",
        "store_name": "Your Store",
        "store_logo": "https://...",
        "item_description": "Premium Plan",
        "amount_kas": 25.5,
        "amount_usd": 2.55,
        "kas_usd_rate": 0.10,
        "txid": "abc123...",
        "to_address": "kaspa:qr...",
        "from_address": "kaspa:qp...",
        "confirmed_at": "2025-01-19T12:00:00Z",
        "created_at": "2025-01-19T11:55:00Z"
    }
}
```

### Verify Payment (Server-Side)

Verify a payment was received on the blockchain:

```
POST https://kaspa-store.com/pay/verify
Content-Type: application/json

{
    "payment_id": "pay_abc123...",
    "txid": "blockchain_transaction_id"
}
```

**Response:**
```json
{
    "success": true,
    "verified": true,
    "message": "Payment verified"
}
```

This endpoint:
1. Fetches the transaction from Kaspa blockchain API
2. Verifies the transaction is confirmed
3. Verifies the correct amount was sent to the merchant address
4. Updates the payment status to `completed`

---

## Verifying Payments

### Client-Side (JavaScript)

Use the callback to get notified immediately:

```javascript
window.KasperoPay.onPayment(function(payment) {
    // This fires when payment is confirmed
    // You can trust this for low-value items
    unlockContent(payment.payment_id);
});
```

### Server-Side (Recommended for High-Value)

For important transactions, verify on your backend:

```javascript
// Node.js example
app.post('/verify-payment', async (req, res) => {
    const { payment_id } = req.body;
    
    // Call KasperoPay API
    const response = await fetch(
        `https://kaspa-store.com/pay/status/${payment_id}`
    );
    const data = await response.json();
    
    if (data.status === 'completed') {
        // Verify amount matches what you expected
        if (data.amount_kas >= expectedAmount) {
            // Payment verified! Fulfill order
            await fulfillOrder(payment_id, data);
            res.json({ success: true });
        } else {
            res.json({ error: 'Amount mismatch' });
        }
    } else {
        res.json({ error: 'Payment not completed', status: data.status });
    }
});
```

### Direct Blockchain Verification

For maximum trust, verify directly on Kaspa blockchain:

```javascript
// Verify transaction exists and has correct output
const txid = payment.txid;
const expectedAddress = 'kaspa:qr...'; // Your receive address
const expectedAmount = 25.5; // KAS

const response = await fetch(`https://api.kaspa.org/transactions/${txid}`);
const tx = await response.json();

if (tx.is_accepted) {
    // Find output to your address
    const output = tx.outputs.find(o => 
        o.script_public_key_address === expectedAddress
    );
    
    if (output) {
        const receivedKAS = output.amount / 1e8; // Convert sompi to KAS
        if (receivedKAS >= expectedAmount * 0.99) { // 1% tolerance
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

If you need webhooks for your integration, please contact us.

---

## FAQ

### What wallets are supported?

- **Kasware** - Browser extension
- **Kastle** - Browser extension
- **Keystone** - Pay from your Keystone account (browser-based, any device)
- **Mobile** - Opens any wallet app that supports the kaspa: URI scheme
- **Any wallet** - Via QR code (manual payment)

### What fees does KasperoPay charge?

Default fee is 1.5% per transaction. You can adjust this (0-10%) in your merchant settings. Fees accumulate and can be paid when they reach the network minimum.

### How fast are payments confirmed?

Kaspa confirms transactions in about 1 second. The widget waits for blockchain confirmation before showing success.

### Can I use this for recurring payments?

Not currently. Each payment is a one-time transaction. For subscriptions, you'd need to prompt the user to pay each period.

### Is there a minimum payment amount?

The Kaspa network has a minimum transaction of ~0.2 KAS due to dust limits. We recommend minimums of at least 1 KAS for practical use.

### Does the widget auto-detect connected wallets?

Yes! As of v1.1, the widget automatically detects if the user has an active wallet session (Kasware, Kastle, or Keystone) and uses it for payments without showing the wallet selector.

### Can users pay with a different wallet than they're logged in with?

Yes. Users can click "Disconnect" in the payment modal to choose a different wallet, while remaining logged in with their original wallet on your site.

### How do I get support?

- Email: kasperolabs@gmail.com
- x.com: [Twitter](https://x.com/KasperoLabs)
- GitHub Issues: [Report bugs](https://github.com/kasperolabs)

---

## Changelog

**v1.1** (January 2025)
- **NEW:** `connect()` API for wallet-based authentication
- **NEW:** `isConnected()` helper method
- **NEW:** `showReceipt` option to suppress widget receipt modal
- **NEW:** Auto-detect connected wallets (skip selector if already connected)
- **NEW:** `forceSelect` option to override auto-detection
- **FIX:** Dark mode QR icon visibility

**v1.0** (January 2025)
- Initial release
- 5 button themes
- Secure session tokens
- Multi-wallet support (Kasware, Kastle, Keystone, QR)
- Payment verification API

---

*Built with 💚 for the Kaspa ecosystem*

