# KasperoPay Documentation v1.5

Accept Kaspa payments on your website in minutes.

> **Using AI to build your site?** See our [No-Code Integration Guide](kasperopay-nocode-guide.md) with copy-paste prompts for Replit, Cursor, and other AI coding tools.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Button Configuration](#button-configuration)
3. [Wallet Selection](#wallet-selection)
4. [Button Themes](#button-themes)
5. [What the Customer Sees](#what-the-customer-sees)
6. [Security Model](#security-model)
7. [JavaScript API](#javascript-api)
8. [Payment Options](#payment-options)
9. [The Payment Object](#the-payment-object)
10. [Advanced: Cart Integration](#advanced-cart-integration)
11. [Public API Endpoints](#public-api-endpoints)
12. [Verifying Payments](#verifying-payments)
13. [Webhooks](#webhooks)
14. [Troubleshooting](#troubleshooting)
15. [FAQ](#faq)
16. [Changelog](#changelog)

---

## Quick Start

### 1. Get Your Merchant ID

Sign up at [kasperopay.com/merchant](https://kasperopay.com/merchant) to get your merchant ID (e.g., `kpm_abc123xy`).

### 2. Add the Widget

Paste this code in your HTML. **Important:** Place the div in your root layout, outside any conditionals or dynamically loaded components.

```html
<!-- Place in root layout, NOT inside conditional components -->
<div id="kaspero-pay-button"
     data-merchant="kpm_YOUR_MERCHANT_ID"
     data-amount="10"
     data-item="Product Name">
</div>
<script src="https://kasperopay.com/pay/widget.js"></script>
```

That's it! You now have a working "Pay with Kaspa" button.

### 3. Hidden Mode (For Programmatic Use)

If you want to trigger payments via JavaScript without showing a button:

```html
<!-- Hidden container - still required for initialization -->
<div id="kaspero-pay-button" 
     data-merchant="kpm_YOUR_MERCHANT_ID" 
     style="display:none">
</div>
<script src="https://kasperopay.com/pay/widget.js"></script>

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

> ⚠️ **The `#kaspero-pay-button` div must exist before the widget script runs**, even in hidden mode. Without it the widget does not initialise (the console shows `Container #kaspero-pay-button not found`) and `pay()` will not work.

### 4. Know When You Got Paid

```javascript
window.KasperoPay.onPayment(function (payment) {
    // Fires in the customer's browser once KasperoPay has verified the payment
    showThankYou(payment.payment_id);
});
```

Use this to update the page. Use a [webhook](#webhooks) or a server-side status check to fulfil the order: the browser callback cannot fire if the customer closes the tab.

---

## Button Configuration

### Data Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-merchant` | Yes | Your merchant ID (starts with `kpm_`) |
| `data-amount` | No | Amount in KAS (optional if you set it from JavaScript) |
| `data-item` | No | Item description shown to customer |
| `data-style` | No | Button and modal theme (default: `institutional`) |
| `data-wallets` | No | Comma-separated wallet list (default: all) |
| `data-image` | No | Product image URL, shown on the receipt |
| `data-skip-receipt` | No | `"true"` = do not show the receipt modal after payment |
| `data-notifications` | No | `"false"` = no toast notifications (messages go to the console) |

`data-amount` is always in KAS. To charge a fiat price, use `pay({ amount, currency })` from JavaScript.

### Example: Full Configuration

```html
<div id="kaspero-pay-button"
     data-merchant="kpm_abc123xy"
     data-amount="25.5"
     data-item="Premium Subscription"
     data-style="dark"
     data-wallets="kasware,kastle,kaspire,kasla"
     data-image="https://yoursite.com/product.jpg">
</div>
<script src="https://kasperopay.com/pay/widget.js"></script>
```

---

## Wallet Selection

Control which payment methods appear in the wallet selector.

### Available Wallets

| Wallet | Value | Shown | Description |
|--------|-------|-------|-------------|
| Kasware | `kasware` | Desktop, if installed | Browser extension |
| Kastle | `kastle` | Desktop, if installed | Browser extension |
| Kaspire | `kaspire` | Desktop, if installed | Browser extension |
| Kasla | `kasla` | Everywhere | Kasla wallet account |
| Mobile Wallet | `mobile` | Mobile only | Any wallet with `kaspa:` URI support |
| Kasanova | `kasanova` | Mobile only | Mobile wallet app |
| QR Code | `qrcode` | Everywhere | Scan a QR code or copy the address, pay from any wallet |

### Usage

```html
<!-- Show only specific wallets -->
<div id="kaspero-pay-button"
     data-merchant="kpm_abc123xy"
     data-amount="10"
     data-wallets="kasware,kastle,kaspire,kasla">
</div>

<!-- Mobile-friendly options -->
<div id="kaspero-pay-button"
     data-merchant="kpm_abc123xy"
     data-amount="10"
     data-wallets="kasla,mobile,kasanova,qrcode">
</div>
```

### Default Behavior

- If `data-wallets` is not specified, empty or invalid: all wallets
- Extension wallets are listed only when the extension is installed in the customer's browser
- If nothing is available (for example, extensions only, on a phone), the selector says "No payment methods available". Include `kasla` or `qrcode` so every customer can pay

---

## Button Themes

KasperoPay offers 5 built-in themes. The theme styles the button and the payment modals.

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

See all themes in action: [kasperopay.com/demo](https://kasperopay.com/demo)

---

## What the Customer Sees

1. **Choose how to pay.** Skipped when the customer is already connected with a wallet on your site (through KasperoPay or KasperoConnect).
2. **Confirm.** Store name, item, amount, and the wallet being used.
3. **Approve in the wallet.**
   - *Kasware, Kastle, Kaspire:* the extension's own approval popup.
   - *Kasla:* a Kasla window opens and the customer approves the payment there. Nothing is sent until they do. The very first time, the customer is sent to Kasla to sign in and comes back to your page; they then click Pay again.
   - *QR Code, Mobile Wallet, Kasanova:* the customer pays from their own wallet app, taps "I've Sent the Payment", and the widget watches the address for up to 10 minutes.
4. **Receipt.** The receipt opens as "Payment Sent" as soon as the wallet returns a transaction, and switches to "Payment Complete" once KasperoPay has verified it on the Kaspa network. This usually takes a few seconds. The customer can download a PDF receipt.

Your `onPayment` callback fires at the "Payment Complete" moment, not before.

If the network has not confirmed the transaction after about three minutes, the customer sees "Payment Sent, still confirming" and the browser callback does **not** fire. KasperoPay keeps checking and notifies you by [webhook](#webhooks) when it confirms. The same applies when a Kasla payment is held for review.

---

## Security Model

KasperoPay uses a **secure session token system** to prevent payment spoofing.

### How It Works

1. **Session Initialization**: When the Pay button is clicked, the widget calls `/pay/init` with merchant ID and amount. The server validates the merchant and generates a one-time session token.

2. **HMAC Signature**: The token is an HMAC-SHA256 signature bound to the session, the merchant and the amount.

3. **Token Verification**: When creating the payment, the server verifies the token matches and the session hasn't expired.

4. **One-Time Use**: Each session token can only be used once. Replay attacks are prevented.

5. **On-Chain Verification**: A payment is marked completed only after KasperoPay has found the transaction on the Kaspa network, paying the right address at least the right amount, and not already used for another payment. The browser reporting a transaction ID is never enough.

### What This Prevents

- ✅ Amount manipulation (changing $10 to $0.01)
- ✅ Merchant ID spoofing
- ✅ Replay attacks
- ✅ Fake or reused transaction IDs

### Domain Restrictions (Optional)

You can restrict which domains can use your merchant ID:

1. Go to your merchant dashboard
2. Add allowed domains (e.g., `yourstore.com`, `shop.yourstore.com`)
3. Payments from unauthorized domains will be rejected, and the button shows "Invalid merchant" there

---

## JavaScript API

### Methods

```javascript
// Check if widget is ready
if (window.KasperoPay.isReady()) {
    console.log('Widget loaded');
}

// Check if a wallet is connected
if (window.KasperoPay.isConnected()) {
    console.log('Wallet connected');
}

// Set amount (KAS) and item dynamically
window.KasperoPay.setAmount(25.5, 'Premium Plan');

// Trigger payment programmatically
window.KasperoPay.pay({
    amount: 25.5,
    item: 'Premium Plan'
});

// Change theme dynamically
window.KasperoPay.setStyle('dark');

// Switch merchant ID (returns a Promise<boolean>)
window.KasperoPay.setMerchant('kpm_abc123xy');

// Disconnect wallet (also clears a KasperoConnect session on this site)
window.KasperoPay.disconnect();

// Connected user info, current settings
const user = window.KasperoPay.getUser();
const config = window.KasperoPay.getConfig();
```

### Payment Callback

```javascript
window.KasperoPay.onPayment(function (payment) {
    console.log('Payment completed!', payment);
    // payment.payment_id - Unique payment ID
    // payment.txid       - Kaspa transaction ID
    // payment.amount_kas - Amount paid
    // payment.status     - 'completed'

    window.location.href = '/thank-you?payment=' + payment.payment_id;
});
```

`onPayment` only ever fires for a successful, verified payment. There is no failure callback: when a payment fails or is cancelled, the widget shows the reason to the customer and nothing is called.

Make your handler safe to run twice for the same `payment_id`.

### Payment Event

The same moment is also announced as a window event, which is handy when the code that reacts lives far from the code that set up the widget:

```javascript
window.addEventListener('kaspero-payment-complete', function (e) {
    // e.detail: { payment_id, txid, amount_kas, price_amount, price_currency, paid }
    markOrderPaidInUI(e.detail.payment_id);
});
```

### Global Settings

```javascript
window.KasperoPay.configure({
    wallets: ['kasware', 'kastle', 'kasla', 'qrcode'],   // same as data-wallets
    showReceipt: false,          // no receipt modal
    showNotifications: false,    // no toasts
    onPayment: function (payment) { }
});
```

### Connect Without Paying

`connect()` opens the wallet selector for sign-in only (extension wallets and Kasla). For sign-in with Google or email, or anything beyond a wallet address, use [KasperoConnect](kasperoconnect-v1.3.md).

```javascript
window.KasperoPay.connect({
    wallets: ['kasware', 'kastle', 'kasla'],
    forceSelect: false,          // true = show the selector even if already connected
    onConnect: function (user) {
        // user.address, user.walletType
        // Kasla also: user.email, user.kaslaUserId
    },
    onCancel: function () { }
});
```

A Kasla sign-in redirects away and back, so `onConnect` does not fire for it on the first connect; check `KasperoPay.isConnected()` after the page reloads.

---

## Payment Options

```javascript
window.KasperoPay.pay({
    amount: 25.5,                 // required; KAS unless currency is set
    currency: 'USD',              // optional; price in a fiat currency, converted for the customer
    item: 'Product Name',         // optional
    items: [                      // optional; itemized receipt
        { name: 'T-shirt', quantity: 2, price_kas: 10 },
        { name: 'Sticker', quantity: 1, price_kas: 5.5 }
    ],
    showReceipt: true,            // false = no receipt modal
    skipConfirmation: false,      // true = go straight to the wallet's approval popup
    onPayment: function (payment) { }
});
```

### Payment Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `amount` | number | required | Amount to charge. In KAS, or in `currency` if set |
| `currency` | string | KAS | ISO currency code such as `USD` or `EUR`. KasperoPay converts to KAS at the current rate when the payment starts |
| `item` | string | 'Payment' | Item description |
| `items` | array | none | Line items for the receipt: `name`, `quantity`, `price_kas`, optional `price_usd`, `image_url` |
| `showReceipt` | boolean | true | Show the receipt modal after payment |
| `skipConfirmation` | boolean | false | Skip KasperoPay's confirmation screen. Applies to Kasware, Kastle and Kaspire, whose own popup already asks the customer to approve. Kasla and QR payments always show it |
| `onPayment` | function | none | Called when the payment is verified |

Notes:

- `pay()` does not return a value. Use `onPayment` or the `kaspero-payment-complete` event.
- Options stay in effect for later `pay()` calls on the same page until you set them again. To go back to KAS after a fiat payment, pass `currency: 'KAS'`.
- Toasts and wallet list are page-wide settings: use `data-notifications`, `data-wallets`, or `configure()`.

### Handling the UI Yourself

```javascript
window.KasperoPay.configure({ showNotifications: false, showReceipt: false });

window.KasperoPay.onPayment(function (payment) {
    showMySuccessMessage(payment.txid);
});

window.KasperoPay.pay({ amount: 25.5, item: 'Product' });
```

The wallet selector, confirmation, and error screens are still shown by the widget; they are the customer's safeguard and cannot be replaced.

### Fiat Prices and Stablecoins

With `currency` set, the customer is charged the KAS equivalent of your price. Customers paying with Kasla may be offered to pay the price itself in a stablecoin of that currency from their Kasla account. In that case the receipt shows the coin instead of a KAS amount, and the payment carries `price_amount`, `price_currency` and `paid` (see [The Payment Object](#the-payment-object)).

---

## The Payment Object

What `onPayment` receives:

| Property | Description |
|----------|-------------|
| `payment_id` | Unique payment ID (`pay_...`) |
| `status` | `completed` |
| `txid` | Transaction ID |
| `amount_kas` | Amount in KAS |
| `amount_usd` | USD value at the time of payment, if known |
| `to_address` | Address that was paid |
| `store_name` | Your store name |
| `item_description` | The `item` you passed |
| `items` | The line items you passed, or `null` |
| `item_image_url` | Product image, if set |
| `payment_method` | `kasware`, `kastle`, `kaspire`, `kasla`, `manual` (QR), `mobile` |
| `confirmed_at`, `created_at` | Timestamps |
| `price_amount`, `price_currency` | Your fiat price, when the payment was priced in a currency |
| `paid` | For stablecoin payments through Kasla: `{ symbol, amount }` of the coin that was paid |

---

## Advanced: Cart Integration

### Dynamic Cart Checkout

```javascript
let cartItems = [];

function checkout() {
    window.KasperoPay.pay({
        amount: cartItems.reduce((sum, i) => sum + i.price_kas * i.quantity, 0),
        item: `Cart (${cartItems.length} items)`,
        items: cartItems          // [{ name, quantity, price_kas }]
    });
}

window.KasperoPay.onPayment(function (payment) {
    // Tell your server which payment belongs to this cart.
    // Your server confirms it with GET /pay/status/{payment_id} before fulfilling.
    fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: payment.payment_id, items: cartItems })
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
    <div class="tier" onclick="selectTier(this, 'basic', 10)">
        <h3>Basic</h3>
        <p>10 KAS/month</p>
    </div>
    <div class="tier" onclick="selectTier(this, 'pro', 25)">
        <h3>Pro</h3>
        <p>25 KAS/month</p>
    </div>
</div>

<div id="kaspero-pay-button"
     data-merchant="kpm_abc123xy"
     data-amount="10"
     data-item="Basic Plan">
</div>
<script src="https://kasperopay.com/pay/widget.js"></script>

<script>
let selectedTier = 'basic';

function selectTier(el, tier, amount) {
    selectedTier = tier;
    document.querySelectorAll('.tier').forEach(t => t.classList.remove('selected'));
    el.classList.add('selected');
    window.KasperoPay.setAmount(amount, tier.charAt(0).toUpperCase() + tier.slice(1) + ' Plan');
}

window.KasperoPay.onPayment(function (payment) {
    fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: payment.payment_id, tier: selectedTier })
    })
    .then(() => {
        window.location.href = '/dashboard?subscribed=' + selectedTier;
    });
});
</script>
```

In both examples the server must check the payment's status **and amount** itself before granting anything. A browser can send any `payment_id` and any `tier`.

---

## Public API Endpoints

All endpoints are CORS-enabled and can be called from browser JavaScript or from your server.

### Get Payment Status

```
GET https://kasperopay.com/pay/status/{payment_id}
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
    "item_description": "Premium Plan",
    "items": null,
    "item_image_url": null,
    "payment_method": "kasware",
    "confirmed_at": "2026-01-19T12:00:00Z",
    "expires_at": "2026-01-19T12:15:00Z"
}
```

**Status Values:**
- `pending` - Awaiting payment
- `confirming` - Transaction submitted, awaiting confirmation on the network
- `completed` - Payment verified
- `expired` - Payment window expired
- `failed` - Payment failed

### Get Payment Receipt

```
GET https://kasperopay.com/pay/receipt/{payment_id}
```

Only available for completed payments. Returns `{ "receipt": { ... } }` with the payment details plus `to_address`, `from_address`, `kas_usd_rate` and `store_logo`.

### Verify a Transaction for a Payment

```
POST https://kasperopay.com/pay/verify
Content-Type: application/json

{
    "payment_id": "pay_abc123...",
    "txid": "blockchain_transaction_id"
}
```

Checks the transaction on the Kaspa network against the payment (right address, at least the right amount, not used elsewhere) and completes the payment if it matches.

```json
{ "success": true, "verified": true, "status": "completed", "received_amount": 25.5, "expected_amount": 25.5 }
```

```json
{ "success": false, "verified": false, "message": "Transaction not yet confirmed" }
```

You rarely need this: the widget and KasperoPay's background confirmer already do it. It is useful when a customer paid manually and you hold the transaction ID.

---

## Verifying Payments

### Client-Side (JavaScript)

```javascript
window.KasperoPay.onPayment(function(payment) {
    // Fires when the payment is verified. Good for updating the page.
    showPaidState(payment.payment_id);
});
```

Anything in the browser can be faked by the person using it. Do not unlock paid content or ship goods on the strength of a browser callback alone.

### Server-Side (Recommended)

```javascript
app.post('/verify-payment', async (req, res) => {
    const { payment_id } = req.body;

    const response = await fetch(
        `https://kasperopay.com/pay/status/${encodeURIComponent(payment_id)}`
    );
    const data = await response.json();

    // 1. It is completed, 2. for at least the amount you expect,
    // 3. the store name is yours (this response has no merchant ID; the signed webhook does),
    // 4. and you have not already fulfilled this payment_id
    if (data.status === 'completed' &&
        data.amount_kas >= expectedAmount &&
        data.store_name === MY_STORE_NAME &&
        !(await alreadyFulfilled(payment_id))) {
        await fulfillOrder(payment_id, data);
        res.json({ success: true });
    } else {
        res.json({ error: 'Payment not verified' });
    }
});
```

Record every `payment_id` you fulfil and refuse to fulfil it twice. A real, completed payment ID is still real the second time someone sends it to you. The webhook, which carries your `merchant_id` and is signed with your secret, is the stronger check.

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

KasperoPay can notify your server directly when a payment completes. Set a **Webhook URL** and, optionally, a **Webhook Secret** in your merchant dashboard.

### Payload

`POST` to your webhook URL with `Content-Type: application/json`:

```json
{
    "event": "payment.completed",
    "timestamp": "2026-02-01T12:00:00.000Z",
    "merchant_id": "kpm_abc123xy",
    "payment_id": "pay_abc123...",
    "order_id": "your-order-ref-or-null",
    "amount_kas": "25.5",
    "amount_usd": "2.55",
    "transaction_id": "kaspa txid",
    "customer_address": "kaspa:qz...",
    "item": "Premium Plan",
    "metadata": { }
}
```

`order_id` and `metadata` are filled in when the payment was created with them. The widget's `pay()` does not send either today, so for widget payments expect `order_id: null` and `metadata: {}`, and match the webhook to your order by `payment_id` (your page learns it in `onPayment` and passes it to your server), or by `item`.

### Signature

If you set a Webhook Secret, every request carries an `X-KasperoPay-Signature` header: the hex HMAC-SHA256 of the raw request body, keyed with your secret. Verify it before trusting the payload:

```javascript
const crypto = require('crypto');

app.post('/kasperopay/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    const expected = crypto
        .createHmac('sha256', process.env.KASPEROPAY_WEBHOOK_SECRET)
        .update(req.body)              // raw bytes, not a re-serialized object
        .digest('hex');

    const received = req.get('X-KasperoPay-Signature') || '';
    if (received.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
        return res.status(401).end();
    }

    const payload = JSON.parse(req.body);
    // fulfil payload.payment_id ...
    res.json({ ok: true });
});
```

### Recommended pattern

Use the webhook as the source of truth for fulfilment and the `onPayment` callback only to update the page the customer is looking at. The webhook also covers the cases the browser cannot: the customer closed the tab, or the network took longer than the widget waits. If your server ever receives a callback-driven request before the webhook, confirm it with `GET /pay/status/{payment_id}` rather than trusting the browser.

Webhooks are sent once, immediately after confirmation. If your endpoint is down, poll `/pay/status/{payment_id}` for any orders left pending.

---

## Troubleshooting

### The button does not appear, or `pay()` does nothing

**Cause:** The `#kaspero-pay-button` div doesn't exist when the widget script loads. The console shows `Kaspero Pay: Container #kaspero-pay-button not found`.

**Fix:** 
- Place the div in your root HTML layout, not inside conditional components
- Make sure it's not dynamically rendered after page load
- For React/Vue: use a hidden div outside your main component tree

```html
<!-- In your root index.html or layout -->
<div id="kaspero-pay-button" data-merchant="kpm_xxx" style="display:none"></div>
```

### "Invalid merchant" where the button should be

**Cause:** The merchant ID is wrong or inactive, or the page's domain is not in your allowed domains.

**Fix:** Check `data-merchant`, and the allowed domains in your dashboard.

### "Configuration error" where the button should be

**Cause:** The div has no `data-merchant` attribute.

### "Please set a payment amount"

**Cause:** No amount was given: no `data-amount`, no `setAmount()`, no `amount` in `pay()`.

### Kasla: the approval window does not open

**Cause:** A popup blocker. The widget then shows an "Open Kasla" button.

**Fix:** The customer clicks "Open Kasla", or allows popups for your site. If you call `pay()` yourself, call it directly from a click handler, not after a timer or a network request, so the browser treats the window as user-initiated.

### "Kasla sign-in could not be verified. Please try again."

**Cause:** The return from Kasla did not match a sign-in started in this browser tab (finished in a different tab, took longer than 15 minutes, or an old link was opened).

**Fix:** Click Pay and choose Kasla again.

### Widget Doesn't Load in Dev Preview

**Cause:** Some IDE preview modes (Replit, CodeSandbox) run in iframes that block popups, storage or wallet extensions.

**Fix:** Test on your deployed URL, not in IDE preview modes.

### Payment Succeeds But Callback Doesn't Fire

**Cause:** One of:
- `onPayment` was registered after the payment completed
- The network had not confirmed the transaction by the time the widget stopped waiting (the customer saw "Payment Sent, still confirming")
- The customer closed the page

**Fix:** Register your callback when the page loads, before calling `pay()`, and rely on the webhook for fulfilment.

```javascript
// CORRECT ORDER
window.KasperoPay.onPayment(function(payment) {
    // Handle payment
});

window.KasperoPay.pay({ amount: 25 });
```

### No Wallets Showing on Mobile

**Cause:** Browser extension wallets (Kasware, Kastle, Kaspire) don't exist on mobile.

**Fix:** Include mobile-friendly options in your wallet selection:

```html
<div id="kaspero-pay-button"
     data-merchant="kpm_xxx"
     data-wallets="kasware,kastle,kaspire,kasla,mobile,qrcode">
</div>
```

Kasla, Mobile Wallet, and QR Code all work on mobile devices.

### Content Security Policy

If your site sends a CSP header, the widget needs:

| Directive | Allow | For |
|-----------|-------|-----|
| `script-src` | `https://kasperopay.com`, `https://cdnjs.cloudflare.com` | The widget; the PDF receipt library (loaded only when a customer downloads a receipt) |
| `connect-src` | `https://kasperopay.com` | Payment API |
| `img-src` | `https://kasperopay.com`, `https://api.qrserver.com` | Wallet logos; QR code images |
| `style-src` | `'unsafe-inline'` | The widget injects its own styles |

---

## FAQ

### What wallets are supported?

- **Kasware** - Browser extension (desktop)
- **Kastle** - Browser extension (desktop)
- **Kaspire** - Browser extension (desktop)
- **Kasla** - Wallet account (all browsers, including mobile)
- **Kasanova** - Mobile wallet app
- **Mobile Wallet** - Any wallet supporting kaspa: URI scheme
- **QR Code** - Manual payment via any wallet

### What fees does KasperoPay charge?

Platform fee is 1-3.5% per transaction (you choose). You only pay when you get paid.

### How fast are payments confirmed?

Kaspa confirms transactions in about a second. The customer sees "Payment Sent" immediately, and "Payment Complete" a few seconds later, once KasperoPay has verified the transaction on the network. Your callback and webhook fire at that point.

### Can I price in dollars?

Yes. `pay({ amount: 10, currency: 'USD' })` charges the KAS equivalent of 10 USD at the current rate. See [Fiat Prices and Stablecoins](#fiat-prices-and-stablecoins).

### Can I customize which wallets are shown?

Yes! Use the `data-wallets` attribute to specify exactly which payment methods to display. See [Wallet Selection](#wallet-selection).

### Does a customer who signed in with KasperoConnect have to connect again?

Not if they signed in with a wallet (Kasware, Kastle, Kaspire, Kasla). The two widgets share that session on your site. Google and email sign-ins are identity only, so the customer picks a wallet at checkout.

### How do I get support?

- Email: kasperolabs@gmail.com
- Twitter: [@KasperoLabs](https://x.com/KasperoLabs)
- GitHub: [Report bugs](https://github.com/kasperolabs)

---

## Changelog

**v1.5** (November 2026)
- **SECURITY:** Kasla sign-in now returns in the URL fragment with a one-time state check and is confirmed with the server before the session is saved
- **SECURITY:** Messages taken from the URL are shown as plain text; a "payment successful" link is checked against the server before a receipt or `onPayment` is triggered
- **NEW:** Kaspire wallet (`kaspire`)
- **NEW:** Kasla payments are approved per payment in a Kasla window (no redirect at checkout)
- **NEW:** Fiat pricing with `pay({ currency })`; stablecoin payments through Kasla
- **NEW:** Itemized receipts with `pay({ items })`
- **NEW:** Progress steps and an optimistic "Payment Sent" receipt; `onPayment` fires after on-chain verification
- **NEW:** `kaspero-payment-complete` window event, `configure()`, `setMerchant()`, `getConfig()`, `data-skip-receipt`, `data-notifications`
- **FIX:** Paying no longer signs out a KasperoConnect email session
- **DOCS:** Corrected to match the widget: `pay()` accepts `amount`, `currency`, `item`, `items`, `showReceipt`, `skipConfirmation`, `onPayment`. Removed `KasperoPay.onCancel()` and the `pay()` options `style`, `showWalletSelector`, `showConfirmation`, `showNotifications`, `onCancel`, which the widget does not implement. `onPayment` fires on success only (there is no `result.success` / `result.error`)

**Documentation update** (September 2026)
- All URLs now use kasperopay.com (kaspa-store.com is a separate store again; old widget URLs redirect)
- Keystone is now Kasla (kasla.io); the `data-wallets` value is `kasla`
- Webhooks documented (payload, `X-KasperoPay-Signature`, recommended verification pattern)

**v1.4** (February 2026)
- **IMPROVED:** Locked wallet handling - prompts unlock instead of showing error
- **IMPROVED:** Balance check now auto-reconnects if wallet locked mid-payment
- **FIX:** "Wallet connection lost" error replaced with automatic unlock prompt

**v1.3** (January 2026)
- **NEW:** `data-wallets` attribute to select which payment methods to show
- **NEW:** Widget Builder in merchant dashboard with live preview
- **NEW:** Visual theme preview in Widget Builder
- **NEW:** Configurable item name and amount in Widget Builder
- **FIX:** Empty or invalid `data-wallets` now defaults to all wallets (instead of showing none)
- **IMPROVED:** Mobile wallet detection and display

**v1.2** (January 2026)
- **NEW:** `showWalletSelector` option to force show/hide wallet selection (not present in the current widget, see v1.5)
- **NEW:** `showConfirmation` option to show/hide confirmation screen (now `skipConfirmation`)
- **NEW:** `showNotifications` option to suppress toast messages (now `data-notifications` / `configure()`)
- **NEW:** `onCancel` callback for cancelled payments (not present in the current widget, see v1.5)
- **NEW:** Kasanova mobile wallet support
- **FIX:** Kasla redirect now uses full URL (was using pathname only)

**v1.1** (January 2026)
- `connect()` API for wallet-based authentication
- `isConnected()` helper method
- `showReceipt` option to suppress widget receipt modal
- Auto-detect connected wallets

**v1.0** (January 2026)
- Initial release
- 5 button themes
- Secure session tokens
- Multi-wallet support (Kasware, Kastle, Kasla, QR)
- Payment verification API

