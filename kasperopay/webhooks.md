# KasperoPay Webhooks

Webhooks let your server receive automatic notifications when payments complete. Instead of polling for payment status, KasperoPay will POST to your URL when a transaction is confirmed.

## Setup

1. Go to your [Merchant Dashboard](https://kaspa-store.com/merchant)
2. Navigate to **Settings**
3. Enter your **Webhook URL**
4. Save changes

## Payload

When a payment completes, we'll POST JSON to your URL:
```json
{
  "event": "payment.completed",
  "timestamp": "2026-01-30T15:30:00.000Z",
  "merchant_id": "kpm_abc123",
  "payment_id": "pay_xyz789",
  "order_id": "ord_456",
  "amount_kas": "150.5",
  "amount_usd": "15.05",
  "transaction_id": "abc123def456...",
  "customer_address": "kaspa:qr...",
  "items": [
    {
      "name": "T-Shirt",
      "quantity": 1,
      "price": "15.05"
    }
  ],
  "metadata": {}
}
```

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | Always `payment.completed` |
| `timestamp` | string | ISO 8601 timestamp |
| `merchant_id` | string | Your merchant ID |
| `payment_id` | string | Unique payment identifier |
| `order_id` | string | Order ID (if applicable) |
| `amount_kas` | string | Amount paid in KAS |
| `amount_usd` | string | USD value at time of payment |
| `transaction_id` | string | Kaspa blockchain transaction ID |
| `customer_address` | string | Customer's wallet address |
| `items` | array | Line items (if applicable) |
| `metadata` | object | Any custom metadata passed during payment |

## Example Handler

### Node.js / Express
```javascript
app.post('/api/kaspa-webhook', express.json(), (req, res) => {
  const { event, payment_id, amount_kas, transaction_id } = req.body;
  
  if (event === 'payment.completed') {
    console.log(`Payment ${payment_id} completed: ${amount_kas} KAS`);
    console.log(`Transaction: https://explorer.kaspa.org/txs/${transaction_id}`);
    
    // Update your database, fulfill order, etc.
  }
  
  res.status(200).send('OK');
});
```

### PHP
```php
<?php
$payload = json_decode(file_get_contents('php://input'), true);

if ($payload['event'] === 'payment.completed') {
    $payment_id = $payload['payment_id'];
    $amount_kas = $payload['amount_kas'];
    
    // Update your database, fulfill order, etc.
    error_log("Payment $payment_id completed: $amount_kas KAS");
}

http_response_code(200);
echo 'OK';
?>
```

### Python / Flask
```python
from flask import Flask, request

app = Flask(__name__)

@app.route('/api/kaspa-webhook', methods=['POST'])
def webhook():
    data = request.json
    
    if data.get('event') == 'payment.completed':
        print(f"Payment {data['payment_id']} completed: {data['amount_kas']} KAS")
        
        # Update your database, fulfill order, etc.
    
    return 'OK', 200
```

## Best Practices

1. **Respond quickly** - Return a 200 status immediately, then process async
2. **Verify the source** - Check that requests come from KasperoPay (see below)
3. **Handle duplicates** - Use `payment_id` to dedupe in case of retries
4. **Log everything** - Store the raw payload for debugging

## Verifying Requests

To confirm a webhook came from KasperoPay, verify the request originates from our servers or check the payment exists:
```javascript
// Option: Verify payment exists via API
const verify = await fetch(`https://kaspa-store.com/api/pay/status/${payment_id}`);
const data = await verify.json();

if (data.status === 'completed') {
  // Legitimate payment
}
```

## Testing

Use a tool like [webhook.site](https://webhook.site) to get a test URL and see the payloads we send.

## Troubleshooting

**Not receiving webhooks?**
- Check your URL is publicly accessible (not localhost)
- Ensure your server returns a 2xx status code
- Check your server logs for incoming requests

**Receiving duplicates?**
- Always check `payment_id` before processing
- Store processed payment IDs to prevent double-fulfillment

## Need Help?

Contact support through your merchant dashboard or open an issue on [GitHub](https://github.com/kasperolabs/docs/issues).
