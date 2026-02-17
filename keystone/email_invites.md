# Email Invite System Integration Guide for Kaspa Wallets

> **For:** KaspaCom (or any Kaspa wallet platform)
> **From:** Keystone / Kaspero Labs
> **Purpose:** Let users send KAS to anyone via email — even people who don't have an account yet

---

## Table of Contents

1. [Concept Overview](#1-concept-overview)
2. [System Architecture & Flow](#2-system-architecture--flow)
3. [Database Schema](#3-database-schema)
4. [Backend: Invite Creation](#4-backend-invite-creation)
5. [Backend: Invite Validation & Claim](#5-backend-invite-validation--claim)
6. [Backend: Invite Lifecycle Management](#6-backend-invite-lifecycle-management)
7. [Email Templates](#7-email-templates)
8. [Frontend: Send Invite UI](#8-frontend-send-invite-ui)
9. [Frontend: Claim Flow (Recipient)](#9-frontend-claim-flow-recipient)
10. [Balance Locking Mechanics](#10-balance-locking-mechanics)
11. [Security Considerations](#11-security-considerations)
12. [Environment Configuration](#12-environment-configuration)

---

## 1. Concept Overview

### What This Does

A user can send KAS to any email address. If the recipient doesn't have a wallet account, the funds are **locked** (reserved) in the sender's wallet until the recipient signs up. When they do, the actual Kaspa transaction executes automatically and both parties get notified.

### The User Experience

**Sender (existing user):**
1. Opens "Invite" / "Send to Email"
2. Enters email, amount, optional note
3. Confirms → funds are locked, invite email sent

**Recipient (new user):**
1. Gets email: "Alice sent you 50 KAS"
2. Clicks "Claim Payment" button
3. Lands on your wallet → registration form pre-filled with their email
4. Creates account → on-chain transaction executes automatically
5. Sees funds in their new wallet immediately

**If invite expires (configurable, default 7 days):**
- Lock is released
- Sender's available balance restores
- No funds moved on-chain

### Key Design Principle: Lock, Don't Move

The critical insight is that you **don't move funds on-chain** when the invite is created. You only track a "locked" amount in your database. The actual Kaspa transaction only happens when the recipient signs up. This means:

- No wasted fees if invite is never claimed
- Sender can cancel anytime before claim
- No funds at risk in an escrow address

---

## 2. System Architecture & Flow

### Full Lifecycle

```
SENDER                          YOUR SERVER                      RECIPIENT
──────                          ───────────                      ─────────
1. POST /api/wallet/invite
   { email, amount, note }
        │
        ├──► Validate:
        │    - Recipient not already a user
        │    - No duplicate pending invite
        │    - Sufficient available balance
        │      (actual balance - already locked invites)
        │    - Optional: verify sender's password
        │
        ├──► Create pending_invite record
        │    (status: 'pending', with invite_token)
        │
        ├──► Pre-verify email for registration
        │    (so recipient skips email verification step)
        │
        ├──► Send invite email ──────────────────────────────────► Receives email:
        │                                                          "Alice sent you 50 KAS"
        │                                                          [Claim Payment] button
◄── { success: true }                                              │
                                                                    │
Sender sees: "50 KAS locked                                        │
in pending invite"                                                 │
                                                                    │
                                                                    ▼
                                                          2. Clicks "Claim Payment"
                                                             URL: /your-wallet?action=register
                                                                  &email=bob@email.com
                                                                  &token=abc123...
                                                                    │
                                GET /api/auth/validate-invite/:token │
                                ├──► Check token is valid & pending  │
                                ├──► Return { valid: true, email }   │
                                │                                    │
                                │                          3. Registration form opens
                                │                             (email pre-filled, verification skipped)
                                │                             User sets password, creates account
                                │                                    │
                                POST /api/auth/signup ◄──────────────┤
                                ├──► Create user account
                                ├──► Create wallet
                                ├──► processPendingInvites()
                                │    ├──► Find all pending invites for this email
                                │    ├──► For each invite:
                                │    │    ├──► Decrypt sender's mnemonic
                                │    │    ├──► Execute on-chain Kaspa tx
                                │    │    ├──► Record transactions for both parties
                                │    │    ├──► Mark invite as 'completed'
                                │    │    └──► Email sender: "Your invite was accepted!"
                                │    └──► Sync recipient balance
                                │
                                └──► Return auth token
                                                                    │
                                                          4. Recipient lands in wallet
                                                             with funds visible!
```

### Expiration & Cancellation

```
CRON JOB (daily):                    SENDER:
─────────────────                    ───────
expire-invites.js                    DELETE /api/wallet/invite/:id
    │                                    │
    ├──► UPDATE pending_invites          ├──► Check ownership & status
    │    SET status = 'expired'          ├──► SET status = 'cancelled'
    │    WHERE status = 'pending'        │
    │    AND expires_at < NOW()          └──► Available balance restored
    │                                         (lock released)
    └──► Available balance restored
          (lock released)
```

---

## 3. Database Schema

### pending_invites

This is the core table. One row per invite.

```sql
CREATE TABLE pending_invites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inviter_user_id INT NOT NULL,
    inviter_wallet_id INT NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    amount_kas DECIMAL(20,8) NOT NULL,
    note VARCHAR(255) DEFAULT NULL,
    invite_token VARCHAR(64) DEFAULT NULL,   -- unique token for claim link
    status ENUM('pending','completed','expired','cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    recipient_user_id INT DEFAULT NULL,      -- set when claimed

    UNIQUE KEY invite_token (invite_token),
    INDEX idx_inviter (inviter_user_id),
    INDEX idx_recipient_email (recipient_email),
    INDEX idx_status_expires (status, expires_at),
    INDEX idx_recipient_user (recipient_user_id),

    FOREIGN KEY (inviter_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (inviter_wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL
);
```

### Supporting table: email_verifications

Used to pre-verify the recipient's email so they skip the verification code step during registration.

```sql
-- You likely already have this table. The invite system inserts a pre-verified record:
CREATE TABLE IF NOT EXISTS email_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Backend: Invite Creation

### Dependencies

```bash
npm install express crypto bcrypt nodemailer node-cron
```

### Environment Variables

```env
ALLOW_USER_INVITES=true
INVITE_EXPIRY_DAYS=7
SESSION_ENCRYPTION_KEY=your-wallet-encryption-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Your Wallet <noreply@your-wallet.com>"
APP_URL=https://your-wallet.com
```

### Create Invite Endpoint

```javascript
// routes/wallet.js (or wherever your wallet routes live)
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { sendInviteEmail } = require('../utils/email');

// ============================================================
// Helper: Get total KAS locked in pending invites for a wallet
// ============================================================
async function getPendingInvitesTotal(db, userId, walletId) {
    const [result] = await db.query(
        `SELECT COALESCE(SUM(amount_kas), 0) as locked_total
         FROM pending_invites
         WHERE inviter_user_id = ?
           AND inviter_wallet_id = ?
           AND status = 'pending'
           AND expires_at > NOW()`,
        [userId, walletId]
    );
    return parseFloat(result[0].locked_total) || 0;
}

// ============================================================
// Helper: Get available balance (actual - locked in invites)
// ============================================================
async function getAvailableBalance(db, userId, walletId, actualBalance) {
    const locked = await getPendingInvitesTotal(db, userId, walletId);
    return {
        actual: actualBalance,
        locked: locked,
        available: Math.max(0, actualBalance - locked)
    };
}

// ============================================================
// POST /api/wallet/invite - Create a new invite
// ============================================================
// Auth middleware assumed: req.user.id is the authenticated user
// ============================================================
router.post('/invite', async (req, res) => {
    // Feature flag check
    if (process.env.ALLOW_USER_INVITES !== 'true') {
        return res.status(403).json({ error: 'Invites are disabled' });
    }

    const { email, amount, note, walletId, password } = req.body;

    // ── Validate input ──
    if (!email || !amount || !walletId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    if (note && note.length > 255) {
        return res.status(400).json({ error: 'Note too long (max 255 characters)' });
    }

    try {
        const db = req.app.locals.db;

        // ── Check: recipient is NOT already a user ──
        const [existingUser] = await db.query(
            'SELECT id FROM users WHERE email = ? AND is_active = TRUE',
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({
                error: 'User already exists',
                code: 'USER_EXISTS',
                message: 'This email is already registered. Use normal send instead.'
            });
        }

        // ── Check: no duplicate pending invite to same email ──
        const [existingInvite] = await db.query(
            `SELECT id FROM pending_invites
             WHERE inviter_user_id = ? AND recipient_email = ?
               AND status = 'pending' AND expires_at > NOW()`,
            [req.user.id, email]
        );

        if (existingInvite.length > 0) {
            return res.status(400).json({
                error: 'Pending invite exists',
                code: 'INVITE_EXISTS',
                message: 'You already have a pending invite to this email.'
            });
        }

        // ── Verify wallet ownership ──
        const [wallets] = await db.query(
            `SELECT * FROM wallets WHERE id = ? AND user_id = ? AND is_active = TRUE`,
            [walletId, req.user.id]
        );

        if (wallets.length === 0) return res.status(404).json({ error: 'Wallet not found' });

        const wallet = wallets[0];

        // Only allow from checking/primary account
        if (wallet.wallet_category !== 'checking') {
            return res.status(400).json({ error: 'Invites only allowed from checking account' });
        }

        // ── Optional: require password for high-value invites ──
        // (Implement your own password verification logic here)
        // if (shouldRequirePassword && !verifyPassword(req.user.id, password)) {
        //     return res.status(403).json({ error: 'Invalid password' });
        // }

        // ── Check available balance (actual - locked) ──
        let actualBalance = parseFloat(wallet.balance_kas || 0);

        // Optional: fetch fresh balance from blockchain
        try {
            const freshBalance = await getBalanceFromBlockchain(wallet.wallet_address);
            if (freshBalance !== null) actualBalance = freshBalance;
        } catch (e) {
            // Use cached balance
        }

        const balanceInfo = await getAvailableBalance(db, req.user.id, wallet.id, actualBalance);

        if (parsedAmount > balanceInfo.available) {
            return res.status(400).json({
                error: 'Insufficient available balance',
                code: 'INSUFFICIENT_BALANCE',
                actual: balanceInfo.actual,
                locked: balanceInfo.locked,
                available: balanceInfo.available,
                requested: parsedAmount
            });
        }

        // ── Create the invite ──
        const expiryDays = parseInt(process.env.INVITE_EXPIRY_DAYS) || 7;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiryDays);

        const inviteToken = crypto.randomBytes(32).toString('hex');

        const [result] = await db.query(
            `INSERT INTO pending_invites
             (inviter_user_id, inviter_wallet_id, recipient_email,
              amount_kas, note, invite_token, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, wallet.id, email.toLowerCase(),
             parsedAmount, note || null, inviteToken, expiresAt]
        );

        // ── Pre-verify the email for registration ──
        // This lets the recipient skip the "enter verification code" step
        await db.query(
            `INSERT INTO email_verifications (email, code, expires_at, verified)
             VALUES (?, 'INVITE', ?, 1)
             ON DUPLICATE KEY UPDATE verified = 1, expires_at = ?`,
            [email.toLowerCase(), expiresAt, expiresAt]
        );

        // ── Send the invite email ──
        try {
            const [profile] = await db.query(
                'SELECT full_name FROM user_profiles WHERE user_id = ?',
                [req.user.id]
            );
            const inviterName = profile[0]?.full_name || 'A wallet user';

            await sendInviteEmail({
                to: email,
                inviterName,
                amount: parsedAmount,
                note: note || null,
                expiresAt,
                inviteToken
            });
        } catch (emailError) {
            console.error('Failed to send invite email:', emailError);
            // Don't fail the invite — recipient can still register manually
        }

        res.json({
            success: true,
            inviteId: result.insertId,
            message: `Invite sent to ${email}`,
            expiresAt
        });

    } catch (error) {
        console.error('Create invite error:', error);
        res.status(500).json({ error: 'Failed to create invite' });
    }
});

// ============================================================
// GET /api/wallet/invites - List sender's invites
// ============================================================
router.get('/invites', async (req, res) => {
    if (process.env.ALLOW_USER_INVITES !== 'true') {
        return res.status(403).json({ error: 'Invites are disabled' });
    }

    try {
        const [invites] = await req.app.locals.db.query(
            `SELECT id, recipient_email, amount_kas, note, status, created_at, expires_at
             FROM pending_invites
             WHERE inviter_user_id = ?
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        // Get locked total
        const [wallets] = await req.app.locals.db.query(
            `SELECT id FROM wallets
             WHERE user_id = ? AND wallet_category = 'checking' AND is_active = TRUE`,
            [req.user.id]
        );

        let lockedTotal = 0;
        if (wallets.length > 0) {
            lockedTotal = await getPendingInvitesTotal(
                req.app.locals.db, req.user.id, wallets[0].id
            );
        }

        res.json({
            success: true,
            invites,
            lockedTotal,
            pendingCount: invites.filter(i => i.status === 'pending').length
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get invites' });
    }
});

// ============================================================
// GET /api/wallet/invites/enabled - Check if invites feature is on
// ============================================================
router.get('/invites/enabled', (req, res) => {
    res.json({
        enabled: process.env.ALLOW_USER_INVITES === 'true',
        expiryDays: parseInt(process.env.INVITE_EXPIRY_DAYS) || 7
    });
});

// ============================================================
// DELETE /api/wallet/invite/:id - Cancel an invite
// ============================================================
router.delete('/invite/:id', async (req, res) => {
    if (process.env.ALLOW_USER_INVITES !== 'true') {
        return res.status(403).json({ error: 'Invites are disabled' });
    }

    try {
        const [invite] = await req.app.locals.db.query(
            `SELECT * FROM pending_invites WHERE id = ? AND inviter_user_id = ?`,
            [req.params.id, req.user.id]
        );

        if (invite.length === 0) return res.status(404).json({ error: 'Invite not found' });
        if (invite[0].status !== 'pending') {
            return res.status(400).json({ error: 'Can only cancel pending invites' });
        }

        await req.app.locals.db.query(
            `UPDATE pending_invites SET status = 'cancelled' WHERE id = ?`,
            [req.params.id]
        );

        res.json({ success: true, message: 'Invite cancelled' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to cancel invite' });
    }
});

module.exports = router;
```

---

## 5. Backend: Invite Validation & Claim

### Validate Invite Token (Public Endpoint)

This is called when the recipient clicks the email link, before they see the registration form.

```javascript
// routes/auth.js - Add this PUBLIC endpoint (no auth required)

// ============================================================
// GET /api/auth/validate-invite/:token
// ============================================================
// Called when recipient clicks email link.
// Returns whether the token is valid and the associated email.
// ============================================================
router.get('/validate-invite/:token', async (req, res) => {
    try {
        const [invites] = await req.app.locals.db.query(
            `SELECT recipient_email as email
             FROM pending_invites
             WHERE invite_token = ? AND status = 'pending' AND expires_at > NOW()`,
            [req.params.token]
        );

        if (invites.length === 0) {
            return res.json({ valid: false });
        }

        return res.json({ valid: true, email: invites[0].email });
    } catch (error) {
        console.error('Validate invite error:', error);
        return res.json({ valid: false });
    }
});
```

### Process Pending Invites (Called During Registration)

This is the heart of the system. Call this **after** a new user successfully registers and their wallet is created.

```javascript
// Called from your signup handler after wallet creation

// ============================================================
// processPendingInvites()
// ============================================================
// Finds all pending invites for the new user's email,
// executes the actual Kaspa transactions, records everything,
// and notifies the senders.
// ============================================================
async function processPendingInvites(db, newUserId, email, checkingWalletId) {
    if (process.env.ALLOW_USER_INVITES !== 'true') {
        return { processed: 0 };
    }

    try {
        // Find all pending invites for this email
        const [invites] = await db.query(
            `SELECT pi.*, w.encrypted_mnemonic, w.wallet_address as inviter_address
             FROM pending_invites pi
             JOIN wallets w ON pi.inviter_wallet_id = w.id
             WHERE pi.recipient_email = ?
               AND pi.status = 'pending'
               AND pi.expires_at > NOW()`,
            [email.toLowerCase()]
        );

        if (invites.length === 0) return { processed: 0 };

        // Get new user's wallet address
        const [newWallet] = await db.query(
            'SELECT wallet_address FROM wallets WHERE id = ?',
            [checkingWalletId]
        );

        if (newWallet.length === 0) {
            console.error('New user wallet not found for invite processing');
            return { processed: 0, error: 'Wallet not found' };
        }

        const recipientAddress = newWallet[0].wallet_address;
        let processed = 0;
        let totalReceived = 0;

        for (const invite of invites) {
            try {
                // ── Execute actual on-chain transaction ──
                // Replace with YOUR wallet SDK / signing logic
                const mnemonic = decryptMnemonic(
                    invite.encrypted_mnemonic,
                    process.env.SESSION_ENCRYPTION_KEY
                );

                const sendResult = await sendKaspaTransaction(
                    mnemonic,
                    recipientAddress,
                    parseFloat(invite.amount_kas),
                    invite.inviter_address  // change address
                );

                if (sendResult.success) {
                    // ── Mark invite as completed ──
                    await db.query(
                        `UPDATE pending_invites
                         SET status = 'completed', completed_at = NOW(), recipient_user_id = ?
                         WHERE id = ?`,
                        [newUserId, invite.id]
                    );

                    const metadata = JSON.stringify({
                        type: 'invite_completed',
                        inviteId: invite.id,
                        note: invite.note
                    });

                    // ── Record sender's outgoing transaction ──
                    await db.query(
                        `INSERT INTO transactions
                         (user_id, wallet_id, transaction_type, amount_kas,
                          fee_kas, to_address, kaspa_tx_id, status, metadata)
                         VALUES (?, ?, 'send', ?, ?, ?, ?, 'confirmed', ?)`,
                        [invite.inviter_user_id, invite.inviter_wallet_id,
                         invite.amount_kas, sendResult.fee || 0,
                         recipientAddress, sendResult.txId, metadata]
                    );

                    // ── Record recipient's incoming transaction ──
                    await db.query(
                        `INSERT INTO transactions
                         (user_id, wallet_id, transaction_type, amount_kas,
                          fee_kas, from_address, kaspa_tx_id, status, metadata)
                         VALUES (?, ?, 'receive', ?, 0, ?, ?, 'confirmed', ?)`,
                        [newUserId, checkingWalletId,
                         invite.amount_kas, invite.inviter_address,
                         sendResult.txId, metadata]
                    );

                    processed++;
                    totalReceived += parseFloat(invite.amount_kas);

                    // ── Sync recipient balance after a delay ──
                    // (give blockchain time to confirm)
                    setTimeout(async () => {
                        try {
                            const balance = await getBalanceFromBlockchain(recipientAddress);
                            if (balance !== null) {
                                await db.query(
                                    'UPDATE wallets SET balance_kas = ?, updated_at = NOW() WHERE id = ?',
                                    [balance, checkingWalletId]
                                );
                            }
                        } catch (err) {
                            console.error('Failed to sync new user balance:', err);
                        }
                    }, 3000);

                    // ── Notify the sender ──
                    try {
                        const [inviterData] = await db.query(
                            `SELECT u.email, up.full_name
                             FROM users u
                             LEFT JOIN user_profiles up ON u.id = up.user_id
                             WHERE u.id = ?`,
                            [invite.inviter_user_id]
                        );

                        if (inviterData.length > 0) {
                            await sendInviteCompletedEmail({
                                to: inviterData[0].email,
                                inviterName: inviterData[0].full_name || 'there',
                                recipientEmail: email,
                                amount: invite.amount_kas,
                                txId: sendResult.txId
                            });
                        }
                    } catch (emailError) {
                        console.error('Failed to send completion email:', emailError);
                        // Don't fail for email errors
                    }

                } else {
                    console.error(`Failed to process invite ${invite.id}:`, sendResult.error);
                }
            } catch (inviteError) {
                console.error(`Error processing invite ${invite.id}:`, inviteError);
            }
        }

        return { processed, totalReceived };

    } catch (error) {
        console.error('Process pending invites error:', error);
        return { processed: 0, error: error.message };
    }
}
```

### Integration in Your Signup Handler

```javascript
// In your POST /api/auth/signup handler, after creating the user and wallet:

router.post('/signup', async (req, res) => {
    // ... your existing signup logic ...
    // ... create user, hash password, create wallet ...

    const newUserId = /* newly created user ID */;
    const email = req.body.email;
    const checkingWalletId = /* newly created wallet ID */;

    // ── Process any pending invites for this email ──
    const inviteResult = await processPendingInvites(
        req.app.locals.db, newUserId, email, checkingWalletId
    );

    if (inviteResult.processed > 0) {
        console.log(`Processed ${inviteResult.processed} invites, ` +
                     `total received: ${inviteResult.totalReceived} KAS`);
    }

    // Flag new user for frontend polling (optional)
    // The frontend can poll for balance updates if funds are incoming
    res.json({
        success: true,
        accessToken: token,
        isNewUser: true,
        pendingInvites: inviteResult.processed
    });
});
```

---

## 6. Backend: Invite Lifecycle Management

### Expire Old Invites (Cron Job)

```javascript
// jobs/expire-invites.js
const cron = require('node-cron');

let db = null;

function initializeExpireInvites(database) {
    db = database;

    if (process.env.ALLOW_USER_INVITES !== 'true') {
        console.log('Invite expiry job skipped (invites disabled)');
        return;
    }

    // Run daily at midnight
    cron.schedule('0 0 * * *', async () => {
        console.log('Running invite expiry check...');
        await expireOldInvites();
    });

    // Also run once on startup
    expireOldInvites();

    console.log('Invite expiry job initialized (runs daily at midnight)');
}

async function expireOldInvites() {
    if (!db) return { expired: 0 };

    try {
        const [result] = await db.query(
            `UPDATE pending_invites
             SET status = 'expired'
             WHERE status = 'pending'
               AND expires_at < NOW()`
        );

        if (result.affectedRows > 0) {
            console.log(`Expired ${result.affectedRows} pending invites`);
        }

        return { expired: result.affectedRows };
    } catch (error) {
        console.error('Expire invites error:', error);
        return { expired: 0, error: error.message };
    }
}

module.exports = { initializeExpireInvites, expireOldInvites };
```

**Initialize in your server startup:**

```javascript
// server.js
const { initializeExpireInvites } = require('./jobs/expire-invites');

// After DB connection is established:
initializeExpireInvites(db);
```

---

## 7. Email Templates

### Invite Email (sent to recipient)

```javascript
// utils/email.js

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Helper to prevent XSS in email templates
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
              .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendInviteEmail({ to, inviterName, amount, note, expiresAt, inviteToken }) {
    try {
        const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric'
        });

        const formattedAmount = amount.toLocaleString(undefined, {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });

        const safeInviterName = escapeHtml(inviterName);
        const safeNote = escapeHtml(note);

        // The claim URL - adjust to your domain and routing
        const claimUrl = `${process.env.APP_URL}/?action=register&email=${encodeURIComponent(to)}&token=${inviteToken}`;

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f5f5;
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="background: white; border-radius: 8px; overflow: hidden;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.08);">

                    <!-- Header with your branding -->
                    <div style="background: #1a365d; padding: 24px; text-align: center;">
                        <h1 style="color: white; margin: 0; font-size: 20px;">
                            You've received Kaspa!
                        </h1>
                    </div>

                    <!-- Body -->
                    <div style="padding: 32px 24px;">

                        <!-- Amount -->
                        <div style="text-align: center; margin-bottom: 24px;">
                            <p style="margin: 0; font-size: 14px; color: #64748b;">Amount</p>
                            <p style="margin: 8px 0 0; font-size: 32px; font-weight: 600; color: #1a365d;">
                                ${formattedAmount} KAS
                            </p>
                        </div>

                        <!-- From -->
                        <div style="border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;
                                    padding: 16px 0; margin-bottom: 24px;">
                            <p style="margin: 0; font-size: 14px; color: #64748b;">
                                From: <span style="color: #1e293b; font-weight: 500;">${safeInviterName}</span>
                            </p>
                        </div>

                        ${note ? `
                        <!-- Note -->
                        <div style="background: #f8fafc; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
                            <p style="margin: 0; font-size: 14px; color: #64748b;">Message:</p>
                            <p style="margin: 8px 0 0; font-size: 15px; color: #1e293b;">"${safeNote}"</p>
                        </div>
                        ` : ''}

                        <!-- CTA Button -->
                        <div style="text-align: center; margin-bottom: 24px;">
                            <a href="${claimUrl}"
                               style="display: inline-block; background: #1a365d; color: white;
                                      padding: 14px 32px; border-radius: 4px; text-decoration: none;
                                      font-weight: 500; font-size: 15px;">
                                Claim Payment
                            </a>
                        </div>

                        <!-- Expiry -->
                        <p style="margin: 0; font-size: 13px; color: #64748b; text-align: center;">
                            Expires ${expiryDate}
                        </p>
                    </div>

                    <!-- Footer -->
                    <div style="background: #f8fafc; padding: 20px 24px; border-top: 1px solid #e2e8f0;">
                        <p style="margin: 0; font-size: 12px; color: #94a3b8; text-align: center;">
                            Your Wallet · Questions? Reply to this email.
                        </p>
                    </div>
                </div>
            </div>
        </body>
        </html>`;

        await transporter.sendMail({
            from: process.env.SMTP_FROM || 'Your Wallet <noreply@your-wallet.com>',
            to,
            subject: `${safeInviterName} sent you ${formattedAmount} KAS`,
            html
        });

        return true;
    } catch (error) {
        console.error('Failed to send invite email:', error);
        throw error;
    }
}
```

### Invite Completed Email (sent to sender)

```javascript
async function sendInviteCompletedEmail({ to, inviterName, recipientEmail, amount, txId }) {
    try {
        const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="margin: 0; padding: 0; background: #f7fafc;
                      font-family: -apple-system, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="background: white; border-radius: 16px; padding: 40px;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.08);">

                    <h1 style="color: #1a365d; font-size: 24px; text-align: center; margin: 0 0 16px;">
                        Your friend joined! 🎉
                    </h1>

                    <p style="color: #4a5568; font-size: 16px; text-align: center; margin: 0 0 24px;">
                        ${recipientEmail} accepted your invite and signed up.
                    </p>

                    <div style="background: #f0fdf4; border: 1px solid #bbf7d0;
                                border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                        <p style="color: #166534; font-size: 14px; margin: 0 0 8px; font-weight: 500;">
                            Transfer completed
                        </p>
                        <p style="color: #15803d; font-size: 24px; font-weight: 600; margin: 0;">
                            ${parseFloat(amount).toFixed(2)} KAS
                        </p>
                        <p style="color: #166534; font-size: 12px; margin: 8px 0 0;">
                            has been sent to their account
                        </p>
                    </div>

                    ${txId ? `
                    <p style="text-align: center;">
                        <a href="https://explorer.kaspa.org/txs/${txId}"
                           style="color: #1a365d; font-size: 14px;" target="_blank">
                            View transaction on explorer →
                        </a>
                    </p>
                    ` : ''}

                    <p style="color: #718096; font-size: 14px; text-align: center; margin: 0;">
                        The locked funds have been transferred. Your balance has been updated.
                    </p>
                </div>
            </div>
        </body>
        </html>`;

        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to,
            subject: `Great news! Your invite to ${recipientEmail} was accepted`,
            html
        });

        return true;
    } catch (error) {
        console.error('Failed to send invite completion email:', error);
        throw error;
    }
}

module.exports = { sendInviteEmail, sendInviteCompletedEmail };
```

---

## 8. Frontend: Send Invite UI

### State Management

```javascript
// Track invite input state
let inviteInputMode = 'kas';  // 'kas' or 'local'
let inviteAmountString = '';
```

### Invite Modal HTML

```html
<!-- Add to your wallet UI -->
<div id="new-invite-modal" class="modal hidden">
    <div class="modal-content">
        <div class="modal-header">
            <h3>Send to Email</h3>
            <button onclick="closeNewInviteModal()" class="close-btn">✕</button>
        </div>

        <div class="modal-body">
            <!-- Email -->
            <div class="form-group">
                <label>Recipient Email</label>
                <input type="email" id="invite-email-input"
                       placeholder="friend@email.com">
            </div>

            <!-- Amount -->
            <div class="form-group">
                <label>Amount</label>
                <div class="amount-input-wrapper">
                    <span id="invite-currency-symbol">KAS</span>
                    <input type="text" id="invite-amount-input"
                           placeholder="0.00" inputmode="decimal">
                    <button id="invite-currency-toggle" onclick="toggleInviteCurrency()">
                        <span id="invite-toggle-text">KAS ⇄ USD</span>
                    </button>
                </div>
                <div id="invite-conversion" class="conversion-text">≈ $0.00</div>
                <div id="invite-available-balance" class="available-text">
                    Available: $0.00 (0.00 KAS)
                </div>
            </div>

            <!-- Note (optional) -->
            <div class="form-group">
                <label>Note (optional)</label>
                <input type="text" id="invite-note-input"
                       placeholder="Happy birthday!" maxlength="255">
            </div>

            <!-- Info -->
            <div class="info-box">
                Funds will be locked for <span id="invite-expiry-days">7</span> days.
                If unclaimed, they'll be returned to your available balance.
            </div>

            <!-- Send Button -->
            <button id="invite-send-btn" onclick="sendInviteFromModal()"
                    class="btn-primary">
                Send Invite
            </button>
        </div>
    </div>
</div>
```

### Invite Modal JavaScript

```javascript
async function showNewInviteModal() {
    const modal = document.getElementById('new-invite-modal');
    if (!modal) return;

    // Reset form
    inviteInputMode = 'kas';
    inviteAmountString = '';
    document.getElementById('invite-email-input').value = '';
    document.getElementById('invite-amount-input').value = '';
    document.getElementById('invite-note-input').value = '';

    // Set expiry info
    const expiryEl = document.getElementById('invite-expiry-days');
    if (expiryEl) expiryEl.textContent = AppState.inviteExpiryDays || 7;

    updateInviteAmountDisplay();
    modal.classList.remove('hidden');
}

function closeNewInviteModal() {
    document.getElementById('new-invite-modal')?.classList.add('hidden');
}

function toggleInviteCurrency() {
    const kasPrice = AppState.kasPrice || 0;
    const currentAmount = parseFloat(inviteAmountString) || 0;

    if (inviteInputMode === 'local') {
        inviteInputMode = 'kas';
        inviteAmountString = kasPrice > 0
            ? (currentAmount / kasPrice).toFixed(4).replace(/\.?0+$/, '')
            : '';
    } else {
        inviteInputMode = 'local';
        inviteAmountString = kasPrice > 0
            ? (currentAmount * kasPrice).toFixed(2)
            : '';
    }

    document.getElementById('invite-amount-input').value = inviteAmountString;
    updateInviteAmountDisplay();
}

function updateInviteAmountDisplay() {
    const kasPrice = AppState.kasPrice || 0;
    const amount = parseFloat(inviteAmountString) || 0;

    const conversionEl = document.getElementById('invite-conversion');
    if (conversionEl) {
        if (inviteInputMode === 'kas') {
            conversionEl.textContent = `≈ $${(amount * kasPrice).toFixed(2)}`;
        } else {
            conversionEl.textContent = `≈ ${(kasPrice > 0 ? amount / kasPrice : 0).toFixed(2)} KAS`;
        }
    }
}

async function sendInviteFromModal() {
    const email = document.getElementById('invite-email-input')?.value?.trim();
    const amountStr = document.getElementById('invite-amount-input')?.value?.trim();
    const note = document.getElementById('invite-note-input')?.value?.trim() || null;

    if (!email) return showToast('Please enter an email', 'error');
    if (!amountStr || parseFloat(amountStr) <= 0) return showToast('Please enter an amount', 'error');

    // Convert to KAS if in local mode
    const kasPrice = AppState.kasPrice || 0;
    let kasAmount;
    if (inviteInputMode === 'local') {
        kasAmount = kasPrice > 0 ? parseFloat(amountStr) / kasPrice : 0;
    } else {
        kasAmount = parseFloat(amountStr);
    }

    if (kasAmount <= 0) return showToast('Invalid amount', 'error');

    await sendInvite(email, kasAmount, note);
}

async function sendInvite(email, kasAmount, note) {
    // Optional: prompt for password first
    // const password = await promptForPassword('Confirm Invite', ...);

    const sendBtn = document.getElementById('invite-send-btn');
    try {
        if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = 'Sending...'; }

        const response = await authenticatedFetch('/api/wallet/invite', {
            method: 'POST',
            body: JSON.stringify({
                email,
                amount: kasAmount,
                note,
                walletId: AppState.checkingWalletId
                // password: password  // if required
            })
        });

        const data = await response.json();

        if (data.success) {
            showToast(`Invite sent! ${email} will receive ${kasAmount.toFixed(2)} KAS when they join.`, 'success');
            closeNewInviteModal();
            await refreshBalance();  // Update UI to show locked amount
        } else {
            if (data.code === 'USER_EXISTS') {
                showToast('This user already has an account. Use normal send.', 'error');
            } else if (data.code === 'INVITE_EXISTS') {
                showToast('You already have a pending invite to this email.', 'error');
            } else if (data.code === 'INSUFFICIENT_BALANCE') {
                showToast(`Insufficient balance. ${data.locked.toFixed(2)} KAS locked in pending invites.`, 'error');
            } else {
                showToast(data.error || 'Failed to send invite', 'error');
            }
        }
    } catch (error) {
        showToast('Failed to send invite', 'error');
    } finally {
        if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = 'Send Invite'; }
    }
}
```

---

## 9. Frontend: Claim Flow (Recipient)

When a recipient clicks the email link, they land on your wallet with URL parameters. Handle it on page load:

```javascript
// Called early in your app initialization (DOMContentLoaded)

async function handleUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const email = params.get('email');
    const token = params.get('token');

    // Clean URL immediately (don't expose token in address bar)
    if (action || email || token) {
        window.history.replaceState({}, '', window.location.pathname);
    }

    // Invite claim flow
    if (action === 'register' && email && token) {
        try {
            // Validate the invite token
            const response = await fetch(`/api/auth/validate-invite/${token}`);
            const data = await response.json();

            if (data.valid && data.email.toLowerCase() === decodeURIComponent(email).toLowerCase()) {
                // Token is valid → store in session and skip to password step
                sessionStorage.setItem('invite_email', decodeURIComponent(email));
                sessionStorage.setItem('invite_token_valid', 'true');
                return true;  // signals: show registration, not welcome screen
            }
        } catch (error) {
            console.error('Failed to validate invite token:', error);
        }
    }

    return false;
}

// Then in your main init:
document.addEventListener('DOMContentLoaded', async () => {
    const hasInviteFlow = await handleUrlParameters();

    const token = localStorage.getItem('access_token');

    if (!token) {
        // Not logged in
        if (hasInviteFlow) {
            const inviteEmail = sessionStorage.getItem('invite_email');
            const tokenValid = sessionStorage.getItem('invite_token_valid');

            if (inviteEmail && tokenValid) {
                // Show registration form with email pre-filled
                // Skip email verification step (already verified by clicking link)
                showRegistrationForm({
                    email: inviteEmail,
                    skipEmailVerification: true
                });

                sessionStorage.removeItem('invite_email');
                sessionStorage.removeItem('invite_token_valid');
                return;
            }
        }

        showWelcomeScreen();
        return;
    }

    // Already logged in — ignore invite params
    sessionStorage.removeItem('invite_email');
    await loadApp();
});
```

### New User Polling

After registration, poll for incoming funds (the invite transaction might take a few seconds):

```javascript
// After successful registration, if invites were processed:
if (data.isNewUser) {
    localStorage.setItem('wallet_new_user', 'true');
}

// In your app initialization for logged-in users:
const isNewUser = localStorage.getItem('wallet_new_user') === 'true';
if (isNewUser) {
    let attempts = 0;
    const pollForFunds = setInterval(async () => {
        attempts++;
        await refreshBalance();

        if (AppState.balance > 0 || attempts >= 10) {
            clearInterval(pollForFunds);
            localStorage.removeItem('wallet_new_user');
        }
    }, 3000);  // Poll every 3 seconds
}
```

---

## 10. Balance Locking Mechanics

### How Locking Works

Locking is purely a **database calculation**, not an on-chain mechanism. When displaying a user's balance:

```
Available Balance = Actual On-chain Balance - Sum of Pending Invite Amounts
```

### Where to Apply the Lock

Everywhere you show or check balances:

```javascript
// When showing balance in the UI:
const actualBalance = walletData.balance_kas;
const lockedInInvites = await getPendingInvitesTotal(db, userId, walletId);
const availableBalance = actualBalance - lockedInInvites;

// Display:
// "Balance: 500 KAS"
// "Available: 450 KAS (50 KAS locked in pending invites)"
```

### When to Lock

- Creating an invite → amount is locked
- Cancelling an invite → lock is released
- Invite expires → lock is released (cron job)
- Invite claimed → actual transaction executes, lock becomes real spend

### Where to Enforce

- Send transaction: check available balance (actual - locked), not just actual
- Create invite: check available balance
- Display balance: show both actual and available

---

## 11. Security Considerations

| Concern | Solution |
|---------|----------|
| Email enumeration | Don't reveal if email exists; return generic "invite sent" |
| Invite token brute force | 32 random bytes (256-bit) tokens |
| XSS in emails | `escapeHtml()` on all user-provided content in templates |
| Double-spend invites | Check available balance (minus locked) before creating |
| Duplicate invites | Prevent multiple pending invites to same email from same user |
| Balance manipulation | Always check real on-chain balance, not just cached |
| Note injection | Max 255 chars, HTML-escaped |
| Token in URL | Clear URL parameters immediately via `replaceState` |
| Email spoofing | Use proper SMTP auth, SPF, DKIM records |
| Race condition | Use transactions for balance checks where possible |

---

## 12. Environment Configuration

```env
# Feature flag
ALLOW_USER_INVITES=true
INVITE_EXPIRY_DAYS=7

# Your wallet
APP_URL=https://your-wallet.com
SESSION_ENCRYPTION_KEY=your-mnemonic-encryption-key

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
SMTP_FROM="Your Wallet <noreply@your-wallet.com>"

# Database (MySQL)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=your_wallet_db
```

---

## Quick Start Checklist

1. Create the `pending_invites` table
2. Add `ALLOW_USER_INVITES=true` to your .env
3. Set up SMTP credentials
4. Add the invite creation endpoint (`POST /invite`)
5. Add the invite validation endpoint (`GET /validate-invite/:token`)
6. Call `processPendingInvites()` in your signup handler
7. Set up the expire-invites cron job
8. Add the invite modal to your frontend
9. Handle URL parameters on app load for claim flow
10. Subtract locked amounts from displayed balance everywhere

---

*Built with love by Kaspero Labs. Questions? Reach out to Oz.*
