# Kaspa Store Documentation

A complete e-commerce platform for buying and selling with Kaspa (KAS).

---

## Table of Contents

1. [Overview](#overview)
2. [Customer Experience](#customer-experience)
   - [Connecting a Wallet](#connecting-a-wallet)
   - [Browsing Products](#browsing-products)
   - [Product Cards](#product-cards)
   - [Shopping Cart](#shopping-cart)
   - [Checkout Flow](#checkout-flow)
   - [Payment](#payment)
   - [Order Tracking](#order-tracking)
3. [Admin Panel](#admin-panel)
   - [Dashboard](#dashboard)
   - [Managing Departments](#managing-departments)
   - [Managing Products](#managing-products)
   - [Order Management](#order-management)
   - [Support Tickets](#support-tickets)
   - [Announcements](#announcements)
4. [Pricing System](#pricing-system)
5. [Shipping](#shipping)
6. [Refunds](#refunds)
7. [Technical Architecture](#technical-architecture)
8. [API Quick Reference](#api-quick-reference)
9. [Configuration](#configuration)

---

## Overview

Kaspa Store is a full-featured e-commerce platform that accepts Kaspa (KAS) as payment. It supports:

- **Multi-wallet authentication** (Keystone, Kasware, Kastle)
- **Dual-currency pricing** (USD-first with real-time KAS conversion)
- **Physical & digital products** (with automatic shipping detection)
- **Real-time shipping rates** via EasyPost
- **Built-in support messaging** between customers and admins
- **Refund request system** with 30-day window

The store integrates with **KasperoPay** for payment processing, using the same secure payment flow documented separately.

---

## Customer Experience

### Connecting a Wallet

Users can connect using three wallet types:

| Wallet | Type | Best For |
|--------|------|----------|
| **Keystone** | OAuth (recommended) | Mobile users, any browser |
| **Kasware** | Browser extension | Desktop Chrome users |
| **Kastle** | Browser extension | Desktop users |

**Flow:**
1. User clicks "Connect Wallet"
2. Wallet selector modal appears
3. User selects their wallet
4. For browser wallets: sign a nonce message to prove ownership
5. For Keystone: OAuth redirect flow
6. JWT token issued, stored in `localStorage`

The store auto-detects connected wallets on page load and verifies the session is still valid.

### Browsing Products

Products are organized by **departments** (categories). The store supports:

- **Top navigation bar** - First 6 departments + "More" dropdown
- **Sidebar filters** - All departments listed alphabetically with product counts
- **Search** - Full-text search across product names and descriptions
- **Price filters** - Min/max KAS price range
- **Pagination** - 20 products per page

**Departments are dynamic** - admins create them from the admin panel. Examples:
- Electronics
- Virtual Assets (no shipping required)
- Donations (no shipping required)
- Books
- Clothing

### Product Cards

Each product card displays:

```
┌─────────────────────────────┐
│  [Product Image]            │
├─────────────────────────────┤
│  Product Name               │
│  by Manufacturer            │
│  Short description...       │
├─────────────────────────────┤
│  125.50 KAS                 │
│  ($12.55)                   │
│                  Stock: 10  │
├─────────────────────────────┤
│  [View Details] [Add to Cart]│
└─────────────────────────────┘
```

**Card data includes:**
- `name` - Product title
- `manufacturer` - Brand/author (optional)
- `description` - Truncated on card, full in modal
- `price` - KAS amount (calculated from USD)
- `price_usd` - USD amount (source of truth)
- `stock_quantity` - `null` for digital items, number for physical
- `image_url` - Product image
- `has_options` - If true, "Add to Cart" opens product modal for size/color selection

### Shopping Cart

The cart persists in `localStorage` and syncs across tabs.

**Cart item structure:**
```javascript
{
  id: 123,              // Product ID
  name: "T-Shirt",
  price: 125.50,        // KAS
  price_usd: 12.55,     // USD
  image: "/images/...",
  quantity: 2,
  options: {            // Selected variants
    "Size": "Large",
    "Color": "Blue"
  },
  stock: 10,            // Max available
  department: "clothing"
}
```

Cart validates stock on checkout - if someone bought the last item while you were browsing, you'll be notified.

### Checkout Flow

```
┌──────────────────────────────────────────────────────┐
│                    CHECKOUT FLOW                      │
└──────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Cart has items?     │
              └───────────────────────┘
                    │           │
                   No          Yes
                    │           │
                    ▼           ▼
              [Show Warning]   ┌───────────────────────┐
                               │ Physical items exist? │
                               └───────────────────────┘
                                     │           │
                                    No          Yes
                                     │           │
                    ┌────────────────┘           │
                    ▼                            ▼
          ┌─────────────────┐      ┌─────────────────────┐
          │ Skip shipping   │      │ Show shipping form  │
          │ "Digital only"  │      │ Require address     │
          └─────────────────┘      └─────────────────────┘
                    │                            │
                    │                            ▼
                    │              ┌─────────────────────┐
                    │              │ Calculate shipping  │
                    │              │ rates via EasyPost  │
                    │              └─────────────────────┘
                    │                            │
                    │                            ▼
                    │              ┌─────────────────────┐
                    │              │ User selects rate   │
                    └──────────────┤                     │
                                   └─────────────────────┘
                                             │
                                             ▼
                               ┌─────────────────────────┐
                               │   CREATE ORDER          │
                               │   Status: "pending"     │
                               └─────────────────────────┘
                                             │
                                             ▼
                               ┌─────────────────────────┐
                               │   KasperoPay Widget     │
                               │   opens for payment     │
                               └─────────────────────────┘
```

### Payment

Payment is handled by the **KasperoPay widget** (documented separately).

1. Order created with status `pending`
2. KasperoPay widget opens with exact KAS amount
3. User pays via connected wallet or QR code
4. Widget detects blockchain confirmation
5. Order status updates: `pending` → `paid` → `processing`

**Payment verification:**
- Transaction ID stored in `payment_txid`
- Amount verified against order total
- Exchange rate at time of order is locked in

### Order Tracking

Orders progress through these statuses:

| Status | Description |
|--------|-------------|
| `pending` | Order created, awaiting payment |
| `paid` | Payment confirmed on blockchain |
| `processing` | Admin is preparing order |
| `shipped` | Physical items sent (tracking available) |
| `completed` | Order fulfilled |
| `cancelled` | Order cancelled (unpaid only) |
| `refund_requested` | Customer requested refund |

Users can view order history from their profile, including:
- Order number
- Items purchased
- Transaction ID (links to Kaspa explorer)
- Status timeline
- Shipping tracking (if applicable)

---

## Admin Panel

Access: `/admin` (requires admin wallet connection)

### Dashboard

The dashboard shows key metrics:

- **Total Orders** - All time
- **Pending Orders** - Needs attention
- **Revenue (KAS)** - Total from completed orders
- **Revenue (USD)** - USD equivalent at time of each sale
- **Active Products** - Currently listed
- **Registered Users** - Total accounts

Plus:
- Recent orders table
- Quick actions (add product, view orders)
- Unread support messages badge

### Managing Departments

Departments are product categories.

**Department properties:**
| Field | Description |
|-------|-------------|
| `name` | Internal identifier (slug) |
| `display_name` | Shown to customers |
| `icon` | FontAwesome class (e.g., `fas fa-laptop`) |
| `description` | Category description |
| `active` | Enable/disable visibility |
| `sort_order` | Display order in navigation |

**Special departments:**
- `virtual_assets` - No shipping required
- `donations` - No shipping required

### Managing Products

**Product properties:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Product title |
| `sku` | Yes | Unique identifier |
| `price_usd` | Yes | Price in USD (source of truth) |
| `department_id` | Yes | Category |
| `description` | Yes | Full description (supports line breaks) |
| `image_url` | No | Main product image |
| `manufacturer` | No | Brand/author |
| `stock_quantity` | No | `null` = unlimited (digital) |
| `weight` | No | For shipping calculation (lbs) |
| `active` | Yes | Show/hide from store |

**Product Attributes:**

Products can have additional attributes:

| Type | Purpose | Example |
|------|---------|---------|
| `option` | Customer selects (variants) | Size: S, M, L, XL |
| `specification` | Display in specs tab | Weight: 2.5 lbs |
| `feature` | Bullet points | "Waterproof" |
| `warning` | Safety notices | "Contains small parts" |
| `instruction` | Usage info | "Hand wash only" |

**Bulk Import:**
Products can be imported via CSV with columns:
- name, sku, price_usd, department, description, image_url, stock_quantity

### Order Management

Orders table shows:
- Order number
- Customer wallet (truncated)
- Items summary
- Total (KAS + USD)
- Status (color-coded)
- Date

**Admin actions:**
- View full order details
- Update status (processing → shipped → completed)
- Add tracking number
- View transaction on Kaspa explorer
- Send message to customer

### Support Tickets

Integrated messaging system for customer support.

**Features:**
- Thread-based conversations
- Context linking (can reference order ID)
- Unread badge on admin nav
- Real-time updates (30-second polling)

**Message flow:**
1. Customer opens chat widget on store
2. Sends message to support
3. Admin sees notification in admin panel
4. Admin replies from Messages section
5. Customer sees notification on store

### Announcements

Broadcast messages to all users.

**Announcement properties:**
- Title
- Message body
- Target audience (all users)
- Created timestamp
- Read count tracking

Users see announcements in their notifications dropdown.

---

## Pricing System

The store uses **USD-first pricing** with dynamic KAS conversion.

### How It Works

1. Admin sets product price in USD (e.g., $12.55)
2. System fetches KAS/USD rate every 5 minutes
3. KAS price = USD ÷ rate (e.g., $12.55 ÷ $0.10 = 125.5 KAS)
4. Both prices displayed to customer

### Price Sources

Exchange rate fetched from (with fallback):
1. CoinGecko API
2. CoinCap API

Rate cached for 5 minutes to prevent API overload.

### At Checkout

The exchange rate is **locked** when the order is created:
- `total_amount` - KAS amount to pay
- `total_amount_usd` - USD equivalent
- `kas_usd_rate` - Rate used for this order

This protects both merchant and customer from rate fluctuations during payment.

---

## Shipping

Physical products require shipping. Digital products (`virtual_assets`, `donations`) skip shipping entirely.

### Rate Calculation

Uses **EasyPost API** for real-time USPS rates.

**Input:**
- Ship-from address (configured in `.env`)
- Ship-to address (customer provided)
- Package dimensions (calculated from products)
- Total weight

**Output:**
- Multiple USPS options (First-Class, Priority, Express)
- Estimated delivery days
- Price in both USD and KAS

### Fallback Rates

If EasyPost fails, flat-rate fallbacks:
- First-Class: $5.00 (3 days)
- Priority: $10.00 (2 days)
- Express: $25.00 (1 day)

---

## Refunds

Customers can request refunds within 30 days of purchase.

### Refund Flow

```
Customer requests → Admin reviews → Admin approves/denies → KAS returned
```

**Refund request includes:**
- Order reference
- Reason (min 10 characters)
- Full or partial refund
- Specific items (for partial)

**Statuses:**
- `pending` - Awaiting admin review
- `approved` - Will be processed
- `completed` - KAS returned to customer
- `denied` - Request rejected
- `cancelled` - Customer withdrew request

The refund uses the exchange rate from the **original order**, not current rate.

---

## Technical Architecture

### Backend Stack

- **Runtime:** Node.js + Express
- **Database:** MySQL with connection pooling
- **Auth:** JWT tokens (7-day expiry)
- **File uploads:** Multer
- **Rate limiting:** express-rate-limit

### Frontend Stack

- **Vanilla JavaScript** (no framework)
- **CSS** (custom, no preprocessor)
- **FontAwesome** icons
- **Modular architecture** (store.js, admin.js)

### Route Structure

| Route | Purpose |
|-------|---------|
| `/api/auth/*` | Authentication (connect, verify, OAuth) |
| `/api/store/*` | Store operations (products, orders) |
| `/api/user/*` | User profile, settings |
| `/api/admin/*` | Admin operations (requires admin role) |
| `/api/shipping/*` | Shipping rate calculation |
| `/api/refund/*` | Refund requests |
| `/api/messages/*` | Support messaging |
| `/api/notifications/*` | User notifications |
| `/pay/*` | KasperoPay widget endpoints |

### Key Services

**priceService** - Exchange rate caching and fetching
```javascript
priceService.getKasPrice()     // Get cached or fresh rate
priceService.storePriceInDb()  // Persist to database
```

**currencyService** - Price conversion utilities
```javascript
currencyService.convertPrice(amount, 'USD', 'KAS')
currencyService.formatPrice(amount, 'KAS')
```

**orderStatus** - Automated order progression
```javascript
// Orders auto-progress: paid → processing (after 1 min)
startOrderAutomation()
```

---

## API Quick Reference

### Authentication

```
POST /api/auth/nonce
POST /api/auth/connect
GET  /api/auth/verify
GET  /api/auth/keystone/connect
```

### Store

```
GET  /api/store/departments
GET  /api/store/products
GET  /api/store/products/:id/full
POST /api/store/order
POST /api/store/payment
GET  /api/store/price/kas
```

### User

```
GET  /api/user/profile
PUT  /api/user/profile
GET  /api/user/orders
```

### Admin

```
GET  /api/admin/dashboard
GET  /api/admin/products
POST /api/admin/products
PUT  /api/admin/products/:id
GET  /api/admin/orders
PUT  /api/admin/orders/:id/status
```

---

## Configuration

### Required Environment Variables

```env
# Server
PORT=3000
NODE_ENV=production
STORE_URL=https://kaspa-store.com

# Database
DB_HOST=localhost
DB_USER=store
DB_PASSWORD=secret
DB_NAME=kaspa_store

# Authentication
JWT_SECRET=your-secret-key

# Wallet
STORE_WALLET_ADDR=kaspa:qr...

# Keystone OAuth
KEYSTONE_CLIENT_ID=...
KEYSTONE_CLIENT_SECRET=...
KEYSTONE_BASE_URL=https://keystone.kasperolabs.com

# Shipping (EasyPost)
EASYPOST_API_KEY=...
STORE_SHIP_FROM_STREET=123 Store St
STORE_SHIP_FROM_CITY=New York
STORE_SHIP_FROM_STATE=NY
STORE_SHIP_FROM_ZIP=10001

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Support

- **Email:** kasperolabs@gmail.com
- **Twitter:** [@KasperoLabs](https://x.com/KasperoLabs)
- **GitHub:** [github.com/kasperolabs](https://github.com/kasperolabs)

---

*Built with 💚 for the Kaspa ecosystem*
