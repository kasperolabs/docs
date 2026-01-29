# KasperoPay Documentation v1.3

Accept Kaspa payments on your website in minutes.

> **Using AI to build your site?** See our [No-Code Integration Guide](kasperopay-nocode-guide.md) with copy-paste prompts for Replit, Cursor, and other AI coding tools.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Button Configuration](#button-configuration)
3. [Wallet Selection](#wallet-selection)
4. [Button Themes](#button-themes)
5. [Security Model](#security-model)
6. [JavaScript API](#javascript-api)
7. [Payment Options](#payment-options)
8. [Advanced: Cart Integration](#advanced-cart-integration)
9. [Public API Endpoints](#public-api-endpoints)
10. [Verifying Payments](#verifying-payments)
11. [Webhooks (Coming Soon)](#webhooks)
12. [Troubleshooting](#troubleshooting)
13. [FAQ](#faq)
14. [Changelog](#changelog)

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
| `data-amount` | No | Amount in KAS (optional for dynamic amounts) |
| `data-item` | No | Item description shown to customer |
| `data-style` | No | Button theme (default: `institutional`) |
| `data-wallets` | No | Comma-separated wallet list (default: all) |
| `data-image` | No | Product image URL |

### Example: Full Configuration

```html
<div id="kaspero-pay-button"
     data-merchant="kpm_abc123xy"
     data-amount="25.5"
     data-item="Premium Subscription"
     data-style="dark"
     data-wallets="kasware,kastle,keystone"
     data-image="https://yoursite.com/product.jpg">
</div>
<script src="https://kaspa-store.com/pay/widget.js"></script>
```

---

## Wallet Selection

**New in v1.3:** Control which payment methods appear in the wallet selector.

### Available Wallets

| Wallet | Value | Description |
|--------|-------|-------------|
| Kasware | `kasware` | Browser extension (desktop) |
| Kastle | `kastle` | Browser extension (desktop) |
| Keystone | `keystone` | OAuth-based (all browsers, mobile) |
| Mobile Wallet | `mobile` | Any wallet with kaspa: URI support |
| Kasanova | `kasanova` | Mobile wallet app |
| QR Code | `qrcode` | Manual payment via QR scan |

### Usage

```html
<!-- Show only specific wallets -->
<div id="kaspero-pay-button"
     data-merchant="kpm_abc123xy"
     data-amount="10"
     data-wallets="kasware,kastle,keystone">
</div>

<!-- Desktop-only (browser extensions) -->
<div id="kaspero-pay-button"
     data-merchant="kpm_abc123xy"
     data-amount="10"
     data-wallets="kasware,kastle">
</div>

<!-- Mobile-friendly options -->
<div id="kaspero-pay-button"
     data-merchant="kpm_abc123xy"
     data-amount="10"
     data-wallets="keystone,mobile,kasanova,qrcode">
</div>
```

### Default Behavior

- If `data-wallets` is not specified: all wallets shown
- If `data-wallets` is empty or invalid: defaults to all wallets

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

**Fix:** Update to v1.2+ of the widget. Already fixed.

### Widget Doesn't Load in Dev Preview

**Cause:** Some IDE preview modes (Replit, CodeSandbox) run in iframes that block certain features.

**Fix:** Test on your deployed URL, not in IDE preview modes.

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

### No Wallets Showing on Mobile

**Cause:** Browser extension wallets (Kasware, Kastle) don't work on mobile.

**Fix:** Include mobile-friendly options in your wallet selection:

```html
<div id="kaspero-pay-button"
     data-merchant="kpm_xxx"
     data-wallets="kasware,kastle,keystone,mobile,qrcode">
</div>
```

Keystone, Mobile Wallet, and QR Code all work on mobile devices.

---

## FAQ

### What wallets are supported?

- **Kasware** - Browser extension (desktop)
- **Kastle** - Browser extension (desktop)
- **Keystone** - OAuth-based wallet (all browsers, including mobile)
- **Kasanova** - Mobile wallet app
- **Mobile Wallet** - Any wallet supporting kaspa: URI scheme
- **QR Code** - Manual payment via any wallet

### What fees does KasperoPay charge?

Platform fee is 1-3.5% per transaction (you choose). You only pay when you get paid.

### How fast are payments confirmed?

Kaspa confirms transactions in about 1 second. The widget waits for blockchain confirmation before showing success.

### Can I customize which wallets are shown?

Yes! Use the `data-wallets` attribute to specify exactly which payment methods to display. See [Wallet Selection](#wallet-selection).

### What data do you store?

Payment records (amount, transaction ID, merchant). Wallet private keys never leave the user's wallet. See [Privacy & How Auth Works](privacy.md) for details.

### How do I get support?

- Email: kasperolabs@gmail.com
- Twitter: [@KasperoLabs](https://x.com/KasperoLabs)
- GitHub: [Report bugs](https://github.com/kasperolabs)

---

## Changelog

**v1.3** (January 2025)
- **NEW:** `data-wallets` attribute to select which payment methods to show
- **NEW:** Widget Builder in merchant dashboard with live preview
- **NEW:** Visual theme preview in Widget Builder
- **NEW:** Configurable item name and amount in Widget Builder
- **FIX:** Empty or invalid `data-wallets` now defaults to all wallets (instead of showing none)
- **IMPROVED:** Mobile wallet detection and display

**v1.2** (January 2025)
- **NEW:** `showWalletSelector` option to force show/hide wallet selection
- **NEW:** `showConfirmation` option to show/hide confirmation screen
- **NEW:** `showNotifications` option to suppress toast messages
- **NEW:** `onCancel` callback for cancelled payments
- **NEW:** Kasanova mobile wallet support
- **FIX:** Keystone redirect now uses full URL (was using pathname only)

**v1.1** (January 2025)
- `connect()` API for wallet-based authentication
- `isConnected()` helper method
- `showReceipt` option to suppress widget receipt modal
- Auto-detect connected wallets

**v1.0** (January 2025)
- Initial release
- 5 button themes
- Secure session tokens
- Multi-wallet support (Kasware, Kastle, Keystone, QR)
- Payment verification API

---

*Built with 💚 for the Kaspa ecosystem*

