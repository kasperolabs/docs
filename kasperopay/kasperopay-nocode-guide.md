# KasperoPay No-Code Integration Guide

**For developers using Replit AI, Cursor, ChatGPT, Claude, or other AI coding tools.**

Copy-paste prompts to integrate KasperoPay into your site.

---

## Before You Start

1. Get your merchant ID at [kasperopay.com/merchant](https://kasperopay.com/merchant) (looks like `kpm_abc123xy`)
2. The widget needs a `#kaspero-pay-button` div in your root HTML layout
3. Test on your deployed URL, not in IDE preview mode

---

## Prompt 1: Add Payment Button

```
Add KasperoPay payment integration.

1. Add this to the root layout (index.html or App.tsx), OUTSIDE any conditional components:

<div id="kaspero-pay-button"
     data-merchant="kpm_YOUR_MERCHANT_ID"
     data-style="dark"
     style="display:none"></div>
<script src="https://kasperopay.com/pay/widget.js"></script>

data-style is the theme of the payment windows: institutional, ghost, dark, soft or pill.

2. Register the payment handler once, when the page loads:

window.KasperoPay.onPayment(function (payment) {
    // Called only when a payment succeeded and KasperoPay verified it.
    // payment.payment_id = unique payment id
    // payment.txid       = transaction id
    // payment.amount_kas = amount paid
    console.log('Payment complete:', payment.payment_id);
    // Update the page, then tell my server the payment_id (see Prompt 3).
});

There is no failure callback and no payment.success field. Failed or cancelled payments
are shown to the customer by the widget. Make the handler safe to run twice for the
same payment_id.

3. To trigger a payment, call this directly from a click handler:

window.KasperoPay.pay({
    amount: ORDER_AMOUNT_IN_KAS,
    item: 'ORDER_DESCRIPTION'
});

Replace kpm_YOUR_MERCHANT_ID with my actual merchant ID.
```

---

## Prompt 2: Price in Dollars (or Another Currency)

```
Charge a fiat price with KasperoPay. The customer pays the equivalent in KAS at the
current rate (Kasla users may be offered a stablecoin of that currency).

window.KasperoPay.pay({
    amount: 19.99,
    currency: 'USD',
    item: 'ORDER_DESCRIPTION'
});

The currency stays set for later pay() calls on the same page. To charge in KAS again,
pass currency: 'KAS'.
```

---

## Prompt 3: Confirm the Payment on My Server

```
Before my server marks an order as paid, it must confirm the payment with KasperoPay.
Never trust the browser alone: anyone can send my server a payment_id.

Frontend, inside the onPayment handler:

fetch('/api/orders/paid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: MY_ORDER_ID, payment_id: payment.payment_id })
});

Backend (Node.js / Express):

app.post('/api/orders/paid', async (req, res) => {
    const { order_id, payment_id } = req.body;
    const order = await getOrder(order_id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // A payment can pay for one order only
    if (await paymentAlreadyUsed(payment_id)) {
        return res.status(409).json({ error: 'Payment already used' });
    }

    const r = await fetch('https://kasperopay.com/pay/status/' + encodeURIComponent(payment_id));
    const data = await r.json();

    if (data.status === 'completed' && data.amount_kas >= order.amount_kas) {
        await markOrderPaid(order_id, payment_id, data.txid);
        return res.json({ success: true });
    }
    res.status(400).json({ error: 'Payment not verified', status: data.status });
});

Store every payment_id that has paid for an order, and refuse to use it again.
```

---

## Prompt 4: Webhook (Recommended for Fulfilment)

```
Add a KasperoPay webhook endpoint. KasperoPay calls it when a payment completes, even
if the customer closed the page. I will set the Webhook URL and Webhook Secret in my
KasperoPay merchant dashboard.

Backend (Node.js / Express). The route must receive the RAW body:

const crypto = require('crypto');

app.post('/kasperopay/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const expected = crypto
        .createHmac('sha256', process.env.KASPEROPAY_WEBHOOK_SECRET)
        .update(req.body)
        .digest('hex');
    const received = req.get('X-KasperoPay-Signature') || '';
    if (received.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
        return res.status(401).end();
    }

    const event = JSON.parse(req.body);
    // event.event = 'payment.completed'
    // event.payment_id, event.transaction_id, event.amount_kas, event.item, event.merchant_id
    await markOrderPaidByPaymentId(event.payment_id, event.transaction_id);   // must be safe to run twice
    res.json({ ok: true });
});

My frontend must save which payment_id belongs to which order (Prompt 3), so the webhook
can find the order. Webhooks are sent once; orders still unpaid can be checked with
GET https://kasperopay.com/pay/status/{payment_id}.
```

---

## Prompt 5: Choose Which Wallets Appear

```
Limit the payment methods KasperoPay shows.

<div id="kaspero-pay-button"
     data-merchant="kpm_YOUR_MERCHANT_ID"
     data-wallets="kasware,kastle,kaspire,kasla,mobile,qrcode"
     style="display:none"></div>

Values: kasware, kastle, kaspire (desktop browser extensions, shown only if installed),
kasla (works everywhere), mobile and kasanova (phones only), qrcode (works everywhere).
Always include kasla or qrcode so every customer has a way to pay.
```

---

## Prompt 6: Connect Wallet Button

```
Add a "Connect Wallet" button for Kaspa wallet login using the KasperoPay widget.

1. Make sure the KasperoPay widget div exists in the root layout.

2. When the connect button is clicked, call:

window.KasperoPay.connect({
    onConnect: function (user) {
        // user.address    = Kaspa wallet address
        // user.walletType = 'kasware', 'kastle', 'kaspire' or 'kasla'
        // user.email      = email (Kasla only)
        // Save user to state and show logged-in UI
    },
    onCancel: function () {
        console.log('User cancelled');
    }
});

3. Kasla sign-in leaves the site and comes back, so onConnect does not run for it.
On page load, check window.KasperoPay.isConnected() and window.KasperoPay.getUser()
to restore the logged-in UI.

4. Add a "Disconnect" button that calls window.KasperoPay.disconnect();

5. Show the user's truncated wallet address when connected.

Do NOT read a token from the page URL, and do not write code that handles
?kasla_connected or ?keystone_connected. The widget handles the Kasla return itself.

For login with Google or email, or to verify the user on my backend, use the
KasperoConnect widget instead (see the KasperoConnect No-Code Guide).
```

---

## Prompt 7: Fix Logout / Disconnect

```
Fix logout and disconnect. When a user logs out or disconnects:

1. Call window.KasperoPay.disconnect(); (this clears the widget's own session)
2. Remove my own keys from localStorage (for example: user, session_token)
3. Clear user state in React context
4. Show the logged-out UI immediately, without a refresh
```

---

## Common Issues

### The button does not appear, or pay() does nothing

The `#kaspero-pay-button` div must exist before the script loads. Move it to your root layout, outside conditional components. The console shows `Container #kaspero-pay-button not found` when it is missing.

### "Invalid merchant"

The merchant ID is wrong or inactive, or this site's domain is not in the allowed domains in your merchant dashboard.

### onPayment never runs

Register `onPayment` on page load, before calling `pay()`. It also does not run if the customer closes the page, or if the network is slow to confirm; use the webhook (Prompt 4) for fulfilment.

### The Kasla window does not open

A popup blocker stopped it. Call `pay()` directly inside the click handler, not after a timer or a network request.

### "Kasla sign-in could not be verified"

Open the browser console: a line starting with `[KasperoPay] Kasla sign-in rejected:` gives the reason. Usually your own code or router changed the URL before the widget ran, or the sign-in finished in a different tab.

### My site was built with an older version of this guide

Older versions told you to handle `?keystone_connected=true&token=...` yourself and to `jwt.decode()` the token on your server. Delete both. The widget handles the return, and a decoded-but-unverified token can be forged by anyone.

---

## Need Help?

- Full Docs: [kasperopay.com/docs](https://kasperopay.com/docs)
- Email: kasperolabs@gmail.com
- Twitter: [@KasperoLabs](https://x.com/KasperoLabs)

