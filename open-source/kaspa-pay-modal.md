# Kaspa Pay Modal - Open Source Edition

A simple, no-backend payment modal for accepting Kaspa payments on any website.

## Features

- 🔌 **No backend required** - payments go directly to your address
- 🦊 **Wallet support** - Kasware, Kastle browser extensions
- 📱 **Mobile friendly** - QR codes and kaspa: URI links
- 🎨 **Themeable** - Light and dark themes
- ⚡ **Lightweight** - Single JS file, no dependencies
- 🔍 **Auto-detection** - Polls blockchain for QR/manual payments

## Quick Start

### 1. Include the script

```html
<script src="kaspa-pay-modal.js"></script>
```

### 2. Add a payment button (HTML method)

```html
<div id="kaspa-pay" 
     data-address="kaspa:qr..."
     data-amount="10"
     data-item="Coffee"
     data-theme="dark">
</div>
```

That's it! A "Pay 10 KAS" button will appear automatically.

## Configuration Options

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-address` | Yes | Your Kaspa receiving address |
| `data-amount` | No | Amount in KAS (shows "Pay with Kaspa" if omitted) |
| `data-item` | No | Item/product name (default: "Payment") |
| `data-theme` | No | `light` or `dark` (default: `light`) |

## JavaScript API

For more control, use the JavaScript API:

### Open modal programmatically

```javascript
KaspaPay.open({
    address: 'kaspa:qr...',
    amount: 5,
    item: 'Donation',
    theme: 'dark',
    onSuccess: function(result) {
        console.log('Payment received!', result.txid);
        // Handle successful payment
    }
});
```

### Close modal

```javascript
KaspaPay.close();
```

### API Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `address` | string | Yes | Kaspa address (must start with `kaspa:`) |
| `amount` | number | Yes | Amount in KAS |
| `item` | string | No | Item description |
| `theme` | string | No | `light` or `dark` |
| `onSuccess` | function | No | Callback when payment confirmed |

## Payment Flow

1. User clicks payment button
2. Modal opens showing:
   - Amount and item name
   - Wallet buttons (if extensions detected)
   - QR code for mobile/manual payment
   - Copy address button
3. User pays via:
   - **Browser wallet** - Kasware or Kastle extension
   - **Mobile wallet** - Scan QR or tap to open wallet app
   - **Manual** - Copy address and send from any wallet
4. Script polls blockchain for confirmation
5. Success screen with transaction link

## Supported Wallets

### Browser Extensions (Desktop)
- **Kasware** - Auto-detected if installed
- **Kastle** - Auto-detected if installed

### Mobile
- Any wallet supporting `kaspa:` URI scheme
- QR code scanning

## Blockchain Polling

For QR code and manual payments, the modal automatically polls the Kaspa blockchain API every 5 seconds to detect incoming payments. Polling times out after 30 minutes.

The script looks for UTXOs matching the expected amount (with small tolerance for network fees).

## Examples

### Simple donation button

```html
<div id="kaspa-pay" 
     data-address="kaspa:qz58h3dartglypzmgfkhwcnke5a5v8sa0avg7fh9jzqftgtk3ud7ccztkk47m"
     data-amount="5"
     data-item="Buy me a coffee"
     data-theme="dark">
</div>
<script src="kaspa-pay-modal.js"></script>
```

### Dynamic payment (e-commerce)

```javascript
// When user clicks "Buy Now" on a product
function buyProduct(product) {
    KaspaPay.open({
        address: 'kaspa:qr...',
        amount: product.priceKas,
        item: product.name,
        theme: 'dark',
        onSuccess: function(result) {
            // Mark order as paid
            submitOrder(product.id, result.txid);
        }
    });
}
```

### Per-page addresses (like Kas.coffee)

```html
<!-- Author 1's page -->
<div id="kaspa-pay" 
     data-address="kaspa:author1address..."
     data-amount="5"
     data-item="Coffee for Alice"
     data-theme="dark">
</div>

<!-- Author 2's page -->
<div id="kaspa-pay" 
     data-address="kaspa:author2address..."
     data-amount="5"
     data-item="Coffee for Bob"
     data-theme="dark">
</div>
```

Each page can have a different receiving address.

## Customization

### Styling

The modal uses CSS custom properties. You can override these:

```css
.ksp-modal.dark {
    --ksp-bg: #1a1a2e;
    --ksp-text: #ffffff;
    --ksp-border: #2d2d44;
    --ksp-muted: #94a3b8;
    --ksp-accent: #49eacb;
    --ksp-btn-bg: #49eacb;
    --ksp-btn-text: #1a1a2e;
}
```

### Fork and modify

This is open source - feel free to fork and modify for your needs:
- Add more wallet integrations
- Change styling
- Add payment verification logic
- Integrate with your backend

## Security Notes

- Payments go directly to the address you specify
- No funds pass through any intermediary
- The script only reads blockchain data (no write access)
- Always verify the address in your embed code is correct

## API Dependencies

- QR Code generation: `api.qrserver.com`
- Blockchain data: `api.kaspa.org`

## License

MIT - Use freely, modify freely, no attribution required.

## Credits

Built by [Kaspero Labs](https://kasperolabs.com) for the Kaspa community.
