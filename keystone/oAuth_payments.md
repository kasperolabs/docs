# OAuth Payments Integration Guide for Kaspa Wallets

> **For:** KaspaCom (or any Kaspa wallet platform)
> **From:** Keystone / Kaspero Labs
> **Purpose:** Implement OAuth 2.0 payment flows so third-party apps can request payments from your wallet users

---

## Table of Contents

1. [Concept Overview](#1-concept-overview)
2. [Architecture & Flow Diagrams](#2-architecture--flow-diagrams)
3. [Database Schema](#3-database-schema)
4. [Backend: OAuth Server](#4-backend-oauth-server)
5. [Backend: Payment API](#5-backend-payment-api)
6. [Frontend: Consent & Approval Pages](#6-frontend-consent--approval-pages)
7. [Webhook System](#7-webhook-system)
8. [Client Registration Script](#8-client-registration-script)
9. [Third-Party Integration Guide](#9-third-party-integration-guide-what-merchants-do)
10. [Security Considerations](#10-security-considerations)
11. [Known Challenges (iframe / localStorage)](#11-known-challenges-iframe--localstorage)

---

## 1. Concept Overview

### What This Does

Your wallet becomes a **payment provider** — like how "Sign in with Google" works, but for payments. A third-party app (online store, marketplace, service) can:

1. Redirect a user to your wallet to log in and grant permission
2. Receive an OAuth token scoped to that user
3. Request payments from that user's wallet via API
4. Get webhook notifications when payments complete

### The Banking Metaphor

Think of it like a debit card authorization:
- The **merchant** (third-party app) says "I need $50 from this customer"
- Your **wallet** (the bank) asks the customer "Do you approve this $50 charge?"
- The customer clicks **Approve** → the wallet executes the on-chain Kaspa transaction
- The merchant gets notified via webhook that payment is done

### Two Payment Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Approval Flow** | Merchant creates payment → user approves in wallet UI → payment executes | Standard e-commerce checkout |
| **Direct Payment** | Merchant sends payment request → executes immediately (pre-authorized) | Trusted/internal services with pre-set spending limits |

---

## 2. Architecture & Flow Diagrams

### OAuth Authorization Flow (Standard OAuth 2.0 + PKCE)

```
Third-Party App                    Your Wallet (OAuth Server)
─────────────────                  ───────────────────────────
1. User clicks "Pay with [Wallet]"
   │
   ├──► GET /api/oauth/authorize
   │    ?client_id=XXX
   │    &redirect_uri=https://store.com/callback
   │    &scope=profile balance:read payments:create
   │    &response_type=code
   │    &state=random_csrf_token
   │    &code_challenge=XXX (PKCE)
   │    &code_challenge_method=S256
   │                                │
   │                                ├──► Show Login Page (if not logged in)
   │                                ├──► Show Consent Page
   │                                │    "Store X wants to:"
   │                                │    ✓ View your profile
   │                                │    ✓ Check your balance
   │                                │    ✓ Request payments
   │                                │
   │                                ├──► User clicks "Approve"
   │                                │
   │    ◄── Redirect to redirect_uri
   │        ?code=AUTH_CODE&state=random_csrf_token
   │
2. Exchange code for tokens
   │
   ├──► POST /api/oauth/token
   │    { grant_type: "authorization_code",
   │      code: AUTH_CODE,
   │      client_id, client_secret,
   │      redirect_uri,
   │      code_verifier }           │
   │                                ├──► Validate code + PKCE
   │                                ├──► Generate access_token + refresh_token
   │    ◄── { access_token, refresh_token, expires_in, scope }
   │
3. Use access token for API calls
   │
   ├──► GET /api/oauth/balance
   │    Authorization: Bearer <access_token>
   │    ◄── { available_balance: "150.00000000", currency: "KAS" }
   │
   ├──► POST /api/oauth/payments
   │    { amount: "25.5", recipient_address: "kaspa:...", description: "Order #123" }
   │    ◄── { payment_id: "abc123", status: "pending_approval", approval_url: "..." }
   │
   │    [User approves in wallet UI]
   │
   │    ◄── Webhook: { event: "payment.updated", status: "completed", transaction_id: "..." }
```

### Payment Approval Flow

```
Merchant Server                  Your Wallet Server              User's Browser
───────────────                  ──────────────────              ──────────────
POST /api/oauth/payments ──────► Create pending payment
  { amount, address }            Return payment_id + approval_url
                                        │
◄── { payment_id, approval_url }        │
                                        │
[Redirect user or show link] ──────────────────────────────────► Open approval_url
                                                                 │
                                 GET /payments/:id/details ◄─────┤
                                 Return payment info ────────────► Show:
                                                                  "Store X wants 25.5 KAS"
                                                                  [Approve] [Deny]
                                                                  │
                                 POST /payments/:id/approve ◄─────┤ User clicks Approve
                                 │
                                 ├─ Decrypt wallet mnemonic
                                 ├─ Check balance
                                 ├─ Execute Kaspa transaction
                                 ├─ Update payment status
                                 ├─ Record transaction
                                 ├─ Send webhook ──────────────► Merchant receives notification
                                 │
                                 ◄── { success: true, transaction_id: "..." }
```

---

## 3. Database Schema

You need ~9 tables to support the full OAuth payment system. Adapt column types and naming to your stack.

### oauth_clients
The registered third-party applications.

```sql
CREATE TABLE oauth_clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL UNIQUE,
    client_secret VARCHAR(255) NOT NULL,       -- bcrypt hashed
    client_name VARCHAR(100) NOT NULL,
    description TEXT,
    redirect_uris TEXT NOT NULL,               -- JSON array of allowed redirect URIs
    allowed_scopes TEXT NOT NULL,              -- JSON array: ["profile","balance:read","payments:create"]
    grant_types TEXT NOT NULL,                 -- JSON array: ["authorization_code","refresh_token"]
    is_active BOOLEAN DEFAULT TRUE,
    is_suspended BOOLEAN DEFAULT FALSE,
    suspension_reason TEXT,
    contact_email VARCHAR(255),
    webhook_url VARCHAR(500),
    webhook_secret VARCHAR(255),              -- for signing webhook payloads
    logo_url VARCHAR(500),
    allow_direct_payments BOOLEAN DEFAULT FALSE,  -- trusted clients only
    wallet_address VARCHAR(100),              -- merchant's Kaspa receive address
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### oauth_scopes
Defines what permissions exist.

```sql
CREATE TABLE oauth_scopes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scope_name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,                 -- shown on consent screen
    risk_level ENUM('low','medium','high') DEFAULT 'low',
    requires_2fa BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed data:
INSERT INTO oauth_scopes (scope_name, display_name, description, risk_level) VALUES
('profile', 'Profile Access', 'View your name and email', 'low'),
('balance:read', 'Balance Access', 'View your account balance', 'medium'),
('payments:create', 'Payment Access', 'Request payments from your account', 'high'),
('transactions:read', 'Transaction History', 'View your transaction history', 'medium');
```

### oauth_authorization_codes
Short-lived codes exchanged for tokens.

```sql
CREATE TABLE oauth_authorization_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(255) NOT NULL UNIQUE,
    client_id VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    redirect_uri VARCHAR(500) NOT NULL,
    scopes TEXT NOT NULL,                     -- JSON array
    code_challenge VARCHAR(255),              -- PKCE
    code_challenge_method VARCHAR(10),        -- "S256" or "plain"
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE
);
```

### oauth_access_tokens

```sql
CREATE TABLE oauth_access_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token_hash VARCHAR(255) NOT NULL UNIQUE,   -- SHA-256 hash of actual token
    client_id VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    scopes TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP NULL,
    last_used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token_hash (token_hash),
    INDEX idx_expiry (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE
);
```

### oauth_refresh_tokens

```sql
CREATE TABLE oauth_refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    access_token_id INT NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    scopes TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP NULL,
    used_count INT DEFAULT 0,
    last_used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (access_token_id) REFERENCES oauth_access_tokens(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE
);
```

### oauth_user_consents
Tracks which users have authorized which apps.

```sql
CREATE TABLE oauth_user_consents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    scopes TEXT NOT NULL,
    consent_given_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    UNIQUE KEY unique_user_client (user_id, client_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE
);
```

### oauth_authorization_states
Temporary storage for OAuth flow state (solves cross-domain cookie issues).

```sql
CREATE TABLE oauth_authorization_states (
    id INT AUTO_INCREMENT PRIMARY KEY,
    state_token VARCHAR(64) NOT NULL UNIQUE,
    client_id VARCHAR(255) NOT NULL,
    redirect_uri VARCHAR(500) NOT NULL,
    original_state VARCHAR(255),             -- the client's CSRF state
    scopes TEXT NOT NULL,                    -- JSON array
    code_challenge VARCHAR(255),
    code_challenge_method VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_state_token (state_token)
);
```

### oauth_payments
The core payment tracking table.

```sql
CREATE TABLE oauth_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_id VARCHAR(64) NOT NULL UNIQUE,   -- public-facing ID
    client_id VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    wallet_id INT NOT NULL,
    amount_kas DECIMAL(18,8) NOT NULL,
    recipient_address VARCHAR(100) NOT NULL,
    description TEXT,
    reference_id VARCHAR(100),                -- merchant's order ID
    callback_url VARCHAR(500),                -- per-payment webhook override
    status ENUM('pending','approved','completed','failed','cancelled') DEFAULT 'pending',
    transaction_id VARCHAR(100),              -- Kaspa tx hash once completed
    error_message TEXT,
    approved_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payment_id (payment_id),
    INDEX idx_user_status (user_id, status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE
);
```

### oauth_audit_log

```sql
CREATE TABLE oauth_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type ENUM(
        'authorization_requested','authorization_granted','authorization_denied',
        'code_issued','code_exchanged','token_issued','token_refreshed',
        'token_revoked','consent_granted','consent_revoked',
        'client_suspended','client_reactivated'
    ) NOT NULL,
    client_id VARCHAR(255),
    user_id INT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_event_type (event_type),
    INDEX idx_client (client_id),
    INDEX idx_created (created_at)
);
```

---

## 4. Backend: OAuth Server

This is the core OAuth 2.0 authorization server. It handles login, consent, code generation, and token exchange.

### Dependencies

```bash
npm install express jsonwebtoken bcrypt crypto node-fetch
```

### Environment Variables

```env
OAUTH_JWT_SECRET=your-oauth-jwt-secret-min-32-chars
JWT_SECRET=your-app-jwt-secret              # your existing user auth secret
BANK_URL=https://your-wallet-domain.com     # public URL of your wallet
```

### Core OAuth Routes (oauth.js)

```javascript
// routes/oauth.js - OAuth 2.0 Server Implementation
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const OAUTH_JWT_SECRET = process.env.OAUTH_JWT_SECRET;
const AUTH_CODE_EXPIRY_MINUTES = 10;
const ACCESS_TOKEN_EXPIRY_HOURS = 1;
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

// ============================================================
// GET /api/oauth/authorize - Authorization Endpoint
// ============================================================
// This is the entry point. Third-party apps redirect users here.
// If user is not logged in → show login form
// If user is logged in → show consent screen
// ============================================================
router.get('/authorize', async (req, res) => {
    const {
        response_type, client_id, redirect_uri,
        scope, state, code_challenge, code_challenge_method
    } = req.query;

    try {
        // 1. Validate required parameters
        if (!response_type || !client_id || !redirect_uri) {
            return res.status(400).json({
                error: 'invalid_request',
                error_description: 'Missing required parameters'
            });
        }

        // 2. Verify client exists and is active
        const [clients] = await req.app.locals.db.query(
            'SELECT * FROM oauth_clients WHERE client_id = ? AND is_active = TRUE',
            [client_id]
        );

        if (clients.length === 0) {
            return res.status(400).json({
                error: 'invalid_client',
                error_description: 'Client not found or inactive'
            });
        }

        const client = clients[0];
        const scopes = scope ? scope.split(' ') : ['profile'];

        // 3. Store OAuth state in database (not session — avoids cookie/iframe issues)
        let stateToken = req.query.state_token;
        if (!stateToken) {
            stateToken = crypto.randomBytes(32).toString('hex');

            await req.app.locals.db.query(
                `INSERT INTO oauth_authorization_states
                 (state_token, client_id, redirect_uri, original_state, scopes,
                  code_challenge, code_challenge_method, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                [stateToken, client_id, redirect_uri, state || null,
                 JSON.stringify(scopes), code_challenge || null,
                 code_challenge_method || null]
            );
        }

        // Cleanup old states (housekeeping)
        await req.app.locals.db.query(
            'DELETE FROM oauth_authorization_states WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)'
        ).catch(() => {});

        // 4. Check if user is already logged in
        const token = req.session?.token || req.cookies?.wallet_token;
        let user = null;

        if (token) {
            try {
                user = jwt.verify(token, process.env.JWT_SECRET);
            } catch (error) {
                // Token invalid, proceed to login
            }
        }

        // 5. NOT logged in → render login form
        if (!user) {
            return res.send(renderLoginPage(client, stateToken));
        }

        // 6. Logged in → render consent screen
        const [scopeDetails] = await req.app.locals.db.query(
            'SELECT * FROM oauth_scopes WHERE scope_name IN (?) AND is_active = TRUE',
            [scopes]
        );

        return res.send(renderConsentPage(client, scopeDetails, stateToken));

    } catch (error) {
        console.error('OAuth authorize error:', error);
        res.status(500).json({ error: 'server_error' });
    }
});

// ============================================================
// POST /api/oauth/store-session-token
// ============================================================
// After login, store the JWT in server-side session so the
// consent page can identify the user.
// ============================================================
router.post('/store-session-token', (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    req.session.token = token;
    req.session.save((err) => {
        if (err) return res.status(500).json({ error: 'Failed to store token' });
        res.json({ success: true });
    });
});

// ============================================================
// POST /api/oauth/authorize/consent - Handle Consent Decision
// ============================================================
// Called when user clicks "Approve" or "Deny" on consent screen.
// Generates an authorization code and redirects back to the
// third-party app.
// ============================================================
router.post('/authorize/consent', async (req, res) => {
    // Get user from session token
    const token = req.session?.token;
    if (!token) {
        return res.status(401).json({
            error: 'unauthorized',
            error_description: 'No session token found. Please login again.'
        });
    }

    let user;
    try {
        user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({
            error: 'invalid_token',
            error_description: 'Session expired. Please login again.'
        });
    }

    const { approve, state_token } = req.body;

    // Retrieve OAuth request from database
    let oauthRequest;
    if (state_token) {
        const [states] = await req.app.locals.db.query(
            `SELECT * FROM oauth_authorization_states
             WHERE state_token = ? AND created_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)`,
            [state_token]
        );

        if (states.length > 0) {
            const s = states[0];
            let parsedScopes;
            try {
                parsedScopes = JSON.parse(s.scopes);
            } catch (e) {
                parsedScopes = ['profile'];
            }

            oauthRequest = {
                client_id: s.client_id,
                redirect_uri: s.redirect_uri,
                state: s.original_state,
                scopes: parsedScopes,
                code_challenge: s.code_challenge,
                code_challenge_method: s.code_challenge_method
            };

            // Delete used state
            await req.app.locals.db.query(
                'DELETE FROM oauth_authorization_states WHERE state_token = ?',
                [state_token]
            );
        }
    }

    if (!oauthRequest) {
        return res.status(400).json({
            error: 'invalid_request',
            error_description: 'No authorization request found'
        });
    }

    const { client_id, redirect_uri, state, scopes,
            code_challenge, code_challenge_method } = oauthRequest;

    try {
        const redirectUrl = new URL(redirect_uri);

        // DENIED
        if (approve !== 'true') {
            redirectUrl.searchParams.set('error', 'access_denied');
            if (state) redirectUrl.searchParams.set('state', state);
            return res.json({ redirectUrl: redirectUrl.toString() });
        }

        // APPROVED → generate authorization code
        const authCode = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + AUTH_CODE_EXPIRY_MINUTES * 60 * 1000);

        await req.app.locals.db.query(
            `INSERT INTO oauth_authorization_codes
             (code, client_id, user_id, redirect_uri, scopes,
              code_challenge, code_challenge_method, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [authCode, client_id, user.id, redirect_uri,
             JSON.stringify(scopes), code_challenge || null,
             code_challenge_method || null, expiresAt]
        );

        // Record consent
        await req.app.locals.db.query(
            `INSERT INTO oauth_user_consents (user_id, client_id, scopes, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                scopes = VALUES(scopes), consent_given_at = NOW(), is_active = TRUE`,
            [user.id, client_id, JSON.stringify(scopes), req.ip, req.headers['user-agent']]
        );

        // Audit log
        await logOAuthAudit('authorization_granted', client_id, user.id, req, { scopes });

        // Redirect back with code
        redirectUrl.searchParams.set('code', authCode);
        if (state) redirectUrl.searchParams.set('state', state);

        res.json({ redirectUrl: redirectUrl.toString() });

    } catch (error) {
        console.error('OAuth consent error:', error);
        res.status(500).json({ error: 'server_error' });
    }
});

// ============================================================
// POST /api/oauth/token - Token Exchange Endpoint
// ============================================================
// Exchanges authorization codes for access/refresh tokens,
// or refreshes expired access tokens.
// ============================================================
router.post('/token', async (req, res) => {
    const { grant_type, code, redirect_uri, client_id,
            client_secret, refresh_token, code_verifier } = req.body;

    try {
        if (!['authorization_code', 'refresh_token'].includes(grant_type)) {
            return res.status(400).json({
                error: 'unsupported_grant_type'
            });
        }

        // Verify client credentials
        const [clients] = await req.app.locals.db.query(
            'SELECT * FROM oauth_clients WHERE client_id = ? AND is_active = TRUE AND is_suspended = FALSE',
            [client_id]
        );

        if (clients.length === 0) {
            return res.status(401).json({ error: 'invalid_client' });
        }

        const client = clients[0];
        const validSecret = await bcrypt.compare(client_secret, client.client_secret);
        if (!validSecret) {
            return res.status(401).json({ error: 'invalid_client' });
        }

        if (grant_type === 'authorization_code') {
            await handleAuthCodeGrant(req, res, client, code, redirect_uri, code_verifier);
        } else {
            await handleRefreshGrant(req, res, client, refresh_token);
        }

    } catch (error) {
        console.error('Token endpoint error:', error);
        res.status(500).json({ error: 'server_error' });
    }
});

// --- Authorization Code → Token ---
async function handleAuthCodeGrant(req, res, client, code, redirect_uri, code_verifier) {
    const db = req.app.locals.db;

    // Retrieve and validate code
    const [authCodes] = await db.query(
        `SELECT * FROM oauth_authorization_codes
         WHERE code = ? AND client_id = ? AND redirect_uri = ?
         AND expires_at > NOW() AND used_at IS NULL`,
        [code, client.client_id, redirect_uri]
    );

    if (authCodes.length === 0) {
        return res.status(400).json({ error: 'invalid_grant' });
    }

    const authCode = authCodes[0];

    // Verify PKCE challenge
    if (authCode.code_challenge) {
        const challenge = authCode.code_challenge_method === 'S256'
            ? crypto.createHash('sha256').update(code_verifier || '').digest('base64url')
            : code_verifier;

        if (challenge !== authCode.code_challenge) {
            return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid code verifier' });
        }
    }

    // Mark code as used (one-time use)
    await db.query('UPDATE oauth_authorization_codes SET used_at = NOW() WHERE id = ?', [authCode.id]);

    // Generate tokens
    const scopes = JSON.parse(authCode.scopes);

    const accessToken = generateOAuthToken({
        type: 'access', user_id: authCode.user_id,
        client_id: client.client_id, scopes
    });

    const refreshTokenValue = generateOAuthToken({
        type: 'refresh', user_id: authCode.user_id,
        client_id: client.client_id, scopes
    });

    // Store token hashes (never store raw tokens)
    const accessHash = crypto.createHash('sha256').update(accessToken).digest('hex');
    const refreshHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');

    const accessExpiry = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_HOURS * 3600 * 1000);
    const refreshExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 86400 * 1000);

    const [accessResult] = await db.query(
        `INSERT INTO oauth_access_tokens (token_hash, client_id, user_id, scopes, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [accessHash, client.client_id, authCode.user_id, authCode.scopes, accessExpiry]
    );

    await db.query(
        `INSERT INTO oauth_refresh_tokens
         (token_hash, access_token_id, client_id, user_id, scopes, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [refreshHash, accessResult.insertId, client.client_id,
         authCode.user_id, authCode.scopes, refreshExpiry]
    );

    await logOAuthAudit('token_issued', client.client_id, authCode.user_id, req);

    res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_EXPIRY_HOURS * 3600,
        refresh_token: refreshTokenValue,
        scope: authCode.scopes
    });
}

// --- Refresh Token → New Access Token ---
async function handleRefreshGrant(req, res, client, refreshToken) {
    const db = req.app.locals.db;
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const [tokens] = await db.query(
        `SELECT * FROM oauth_refresh_tokens
         WHERE token_hash = ? AND client_id = ?
         AND expires_at > NOW() AND is_revoked = FALSE`,
        [tokenHash, client.client_id]
    );

    if (tokens.length === 0) {
        return res.status(400).json({ error: 'invalid_grant' });
    }

    const token = tokens[0];

    const newAccessToken = generateOAuthToken({
        type: 'access', user_id: token.user_id,
        client_id: client.client_id, scopes: JSON.parse(token.scopes)
    });

    const accessHash = crypto.createHash('sha256').update(newAccessToken).digest('hex');
    const accessExpiry = new Date(Date.now() + ACCESS_TOKEN_EXPIRY_HOURS * 3600 * 1000);

    await db.query(
        `INSERT INTO oauth_access_tokens (token_hash, client_id, user_id, scopes, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [accessHash, client.client_id, token.user_id, token.scopes, accessExpiry]
    );

    await db.query(
        `UPDATE oauth_refresh_tokens SET used_count = used_count + 1, last_used_at = NOW() WHERE id = ?`,
        [token.id]
    );

    res.json({
        access_token: newAccessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_EXPIRY_HOURS * 3600,
        scope: token.scopes
    });
}

// ============================================================
// POST /api/oauth/revoke - Token Revocation
// ============================================================
router.post('/revoke', async (req, res) => {
    const { token, client_id, client_secret } = req.body;

    try {
        const [clients] = await req.app.locals.db.query(
            'SELECT * FROM oauth_clients WHERE client_id = ?', [client_id]
        );

        if (clients.length === 0 || !await bcrypt.compare(client_secret, clients[0].client_secret)) {
            return res.status(401).json({ error: 'invalid_client' });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Revoke both access and refresh (we don't know which type)
        await req.app.locals.db.query(
            `UPDATE oauth_access_tokens SET is_revoked = TRUE, revoked_at = NOW()
             WHERE token_hash = ? AND client_id = ?`,
            [tokenHash, client_id]
        );
        await req.app.locals.db.query(
            `UPDATE oauth_refresh_tokens SET is_revoked = TRUE, revoked_at = NOW()
             WHERE token_hash = ? AND client_id = ?`,
            [tokenHash, client_id]
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'server_error' });
    }
});

// ============================================================
// GET /api/oauth/connected-apps - User Dashboard: List Connected Apps
// ============================================================
router.get('/connected-apps', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const [apps] = await req.app.locals.db.query(
            `SELECT c.client_id, c.client_name, c.description, c.logo_url,
                    uc.scopes, uc.consent_given_at
             FROM oauth_user_consents uc
             JOIN oauth_clients c ON uc.client_id = c.client_id
             WHERE uc.user_id = ? AND uc.is_active = TRUE AND c.is_active = TRUE
             ORDER BY uc.consent_given_at DESC`,
            [decoded.id]
        );

        res.json({ apps });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load connected apps' });
    }
});

// ============================================================
// POST /api/oauth/revoke-consent/:clientId - Disconnect App
// ============================================================
router.post('/revoke-consent/:clientId', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { clientId } = req.params;

        // Revoke consent
        await req.app.locals.db.query(
            'DELETE FROM oauth_user_consents WHERE user_id = ? AND client_id = ?',
            [decoded.id, clientId]
        );

        // Revoke all tokens
        await req.app.locals.db.query(
            `UPDATE oauth_access_tokens SET is_revoked = TRUE, revoked_at = NOW()
             WHERE user_id = ? AND client_id = ?`,
            [decoded.id, clientId]
        );
        await req.app.locals.db.query(
            `UPDATE oauth_refresh_tokens SET is_revoked = TRUE, revoked_at = NOW()
             WHERE user_id = ? AND client_id = ?`,
            [decoded.id, clientId]
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to revoke access' });
    }
});

// ============================================================
// Helper Functions
// ============================================================

function generateOAuthToken(payload) {
    return jwt.sign(payload, OAUTH_JWT_SECRET, {
        expiresIn: payload.type === 'access' ? '1h' : '30d',
        issuer: 'your-wallet-name',
        audience: payload.client_id
    });
}

async function logOAuthAudit(eventType, clientId, userId, req, metadata = {}) {
    try {
        await req.app.locals.db.query(
            `INSERT INTO oauth_audit_log
             (event_type, client_id, user_id, ip_address, user_agent, metadata)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [eventType, clientId, userId, req.ip, req.headers['user-agent'],
             JSON.stringify(metadata)]
        );
    } catch (error) {
        console.error('OAuth audit log error:', error);
    }
}

// ============================================================
// Middleware: Verify OAuth Access Token
// ============================================================
// Use this to protect your API endpoints.
// Usage: router.get('/balance', verifyOAuthToken(['balance:read']), handler)
// ============================================================
function verifyOAuthToken(requiredScopes = []) {
    return async (req, res, next) => {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

        if (!token) {
            return res.status(401).json({ error: 'unauthorized', error_description: 'No access token' });
        }

        try {
            const decoded = jwt.verify(token, OAUTH_JWT_SECRET);
            if (decoded.type !== 'access') {
                return res.status(401).json({ error: 'invalid_token' });
            }

            // Verify token exists in database
            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const [tokens] = await req.app.locals.db.query(
                `SELECT t.*, u.email, u.role
                 FROM oauth_access_tokens t
                 JOIN users u ON t.user_id = u.id
                 WHERE t.token_hash = ? AND t.expires_at > NOW() AND t.is_revoked = FALSE`,
                [tokenHash]
            );

            if (tokens.length === 0) {
                return res.status(401).json({ error: 'invalid_token', error_description: 'Token expired or revoked' });
            }

            const tokenData = tokens[0];
            const tokenScopes = JSON.parse(tokenData.scopes);

            // Check scopes
            if (requiredScopes.length > 0) {
                const hasScopes = requiredScopes.every(s => tokenScopes.includes(s));
                if (!hasScopes) {
                    return res.status(403).json({ error: 'insufficient_scope' });
                }
            }

            // Update last used
            await req.app.locals.db.query(
                'UPDATE oauth_access_tokens SET last_used_at = NOW() WHERE id = ?',
                [tokenData.id]
            );

            // Attach to request for downstream handlers
            req.oauthUser = { id: tokenData.user_id, email: tokenData.email, role: tokenData.role };
            req.oauthClient = { id: tokenData.client_id };
            req.oauthScopes = tokenScopes;

            next();

        } catch (error) {
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ error: 'invalid_token' });
            } else if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'invalid_token', error_description: 'Token expired' });
            }
            res.status(500).json({ error: 'server_error' });
        }
    };
}

// Export
router.verifyOAuthToken = verifyOAuthToken;
module.exports = router;
```

### Login & Consent Page Renderers

These return inline HTML strings. In production, use templates.

```javascript
// Render functions (called from the /authorize endpoint)
// These return full HTML pages as strings.

function renderLoginPage(client, stateToken) {
    return `<!DOCTYPE html>
    <html>
    <head>
        <title>Sign in to Your Wallet</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, sans-serif; background: #f5f7fa;
                   min-height: 100vh; display: flex; align-items: center;
                   justify-content: center; padding: 20px; }
            .container { background: white; border-radius: 16px;
                         box-shadow: 0 4px 24px rgba(0,0,0,0.1);
                         width: 100%; max-width: 420px; overflow: hidden; }
            .app-info { background: #f9fafb; padding: 16px 24px;
                        border-bottom: 1px solid #e5e7eb; text-align: center; }
            .body { padding: 32px 24px; }
            h2 { color: #1a365d; text-align: center; margin-bottom: 24px; }
            .form-group { margin-bottom: 20px; }
            .form-group label { display: block; font-weight: 600;
                                margin-bottom: 8px; font-size: 14px; }
            .form-group input { width: 100%; padding: 12px 16px;
                                border: 2px solid #e5e7eb; border-radius: 10px;
                                font-size: 16px; }
            .btn-primary { width: 100%; padding: 14px; background: #1a365d;
                           color: white; border: none; border-radius: 10px;
                           font-size: 16px; font-weight: 600; cursor: pointer; }
            .error { background: #fef2f2; color: #dc2626; padding: 12px;
                     border-radius: 8px; margin-bottom: 20px; display: none; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="app-info">
                <strong>${client.client_name}</strong> wants to access your wallet
            </div>
            <div class="body">
                <h2>Sign In</h2>
                <div id="error" class="error"></div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="email" placeholder="your@email.com">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="password" placeholder="Password">
                </div>
                <button onclick="login()" class="btn-primary">Sign In & Authorize</button>
            </div>
        </div>

        <script>
            const STATE_TOKEN = '${stateToken}';

            document.getElementById('password').addEventListener('keyup', e => {
                if (e.key === 'Enter') login();
            });

            async function login() {
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const errorDiv = document.getElementById('error');

                try {
                    // Call YOUR existing login endpoint
                    const loginRes = await fetch('/api/auth/signin', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ email, password })
                    });

                    const loginData = await loginRes.json();

                    if (loginData.success) {
                        // Store token in server session
                        await fetch('/api/oauth/store-session-token', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({ token: loginData.accessToken })
                        });

                        // Reload the same page — now user is authenticated,
                        // so the consent screen will show instead of login
                        window.location.href = window.location.href + '&state_token=' + STATE_TOKEN;
                    } else {
                        errorDiv.textContent = loginData.error || 'Login failed';
                        errorDiv.style.display = 'block';
                    }
                } catch (error) {
                    errorDiv.textContent = 'Connection error. Please try again.';
                    errorDiv.style.display = 'block';
                }
            }
        </script>
    </body>
    </html>`;
}

function renderConsentPage(client, scopeDetails, stateToken) {
    const scopeItems = scopeDetails.map(s =>
        `<div class="scope-item"><span class="check">✓</span><span>${s.description}</span></div>`
    ).join('');

    return `<!DOCTYPE html>
    <html>
    <head>
        <title>Authorize ${client.client_name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            /* ... similar styling as login page ... */
            .scope-list { background: #f9fafb; border-radius: 12px; padding: 20px; margin: 24px 0; }
            .scope-item { display: flex; gap: 12px; padding: 8px 0; }
            .scope-item .check { color: #1a365d; font-weight: bold; }
            .actions { display: flex; gap: 12px; }
            .btn { flex: 1; padding: 14px; border-radius: 10px; font-size: 16px;
                   font-weight: 600; cursor: pointer; }
            .btn-approve { background: #1a365d; color: white; border: none; }
            .btn-deny { background: white; color: #dc2626; border: 2px solid #fecaca; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Authorize ${client.client_name}?</h2>
            <p>${client.description || client.client_name + ' wants access to your account.'}</p>
            <div class="scope-list">
                <strong>This app will be able to:</strong>
                ${scopeItems}
            </div>
            <div class="actions">
                <button onclick="handleConsent(false)" class="btn btn-deny">Deny</button>
                <button onclick="handleConsent(true)" class="btn btn-approve">Approve</button>
            </div>
        </div>

        <script>
            const STATE_TOKEN = '${stateToken}';
            let submitting = false;

            async function handleConsent(approve) {
                if (submitting) return;
                submitting = true;

                const response = await fetch('/api/oauth/authorize/consent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        approve: approve ? 'true' : 'false',
                        state_token: STATE_TOKEN
                    })
                });

                const data = await response.json();
                if (data.redirectUrl) {
                    window.location.href = data.redirectUrl;
                } else {
                    alert(data.error_description || 'Error');
                    submitting = false;
                }
            }
        </script>
    </body>
    </html>`;
}
```

---

## 5. Backend: Payment API

These are the OAuth-protected endpoints that third-party apps call to manage payments.

```javascript
// routes/oauth-api.js - OAuth-protected payment endpoints
const express = require('express');
const router = express.Router();
const { verifyOAuthToken } = require('./oauth');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');

const FIXED_FEE_KAS = 0.0001;
const FEE_BUFFER_KAS = 0.001;

// ============================================================
// GET /api/oauth/me - Get User Profile
// ============================================================
router.get('/me', verifyOAuthToken(['profile']), async (req, res) => {
    try {
        const [users] = await req.app.locals.db.query(
            `SELECT u.id, u.email, up.full_name, up.country
             FROM users u
             LEFT JOIN user_profiles up ON u.id = up.user_id
             WHERE u.id = ?`,
            [req.oauthUser.id]
        );

        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        res.json({
            id: users[0].id,
            email: users[0].email,
            full_name: users[0].full_name,
            country: users[0].country
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================
// GET /api/oauth/balance - Get User Balance
// ============================================================
router.get('/balance', verifyOAuthToken(['balance:read']), async (req, res) => {
    try {
        const [wallets] = await req.app.locals.db.query(
            `SELECT id, wallet_category, balance_kas, wallet_address
             FROM wallets
             WHERE user_id = ? AND wallet_category = 'checking' AND is_active = TRUE`,
            [req.oauthUser.id]
        );

        if (wallets.length === 0) {
            return res.status(404).json({ error: 'No checking account found' });
        }

        const wallet = wallets[0];

        // Optional: fetch fresh balance from blockchain
        let totalBalance = parseFloat(wallet.balance_kas) || 0;
        try {
            const freshBalance = await getBalanceFromBlockchain(wallet.wallet_address);
            if (freshBalance !== null) {
                totalBalance = freshBalance;
                await req.app.locals.db.query(
                    'UPDATE wallets SET balance_kas = ?, updated_at = NOW() WHERE id = ?',
                    [totalBalance, wallet.id]
                );
            }
        } catch (err) {
            // Fall back to cached balance
        }

        // Calculate held amount from pending payments
        const [pendingPayments] = await req.app.locals.db.query(
            `SELECT COALESCE(SUM(amount_kas), 0) as held_amount
             FROM oauth_payments
             WHERE user_id = ? AND wallet_id = ? AND status = 'pending'
             AND created_at > NOW() - INTERVAL 10 MINUTE`,
            [req.oauthUser.id, wallet.id]
        );

        const heldAmount = parseFloat(pendingPayments[0].held_amount) || 0;
        const availableBalance = Math.max(0, totalBalance - heldAmount);

        res.json({
            user_id: req.oauthUser.id,
            available_balance: availableBalance.toFixed(8),
            held_balance: heldAmount.toFixed(8),
            total_balance: totalBalance.toFixed(8),
            wallet_address: wallet.wallet_address,
            currency: 'KAS'
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================
// POST /api/oauth/payments - Create Payment Request
// ============================================================
// This creates a PENDING payment that requires user approval.
// The merchant gets back a payment_id and an approval_url.
// ============================================================
router.post('/payments', verifyOAuthToken(['payments:create']), async (req, res) => {
    const { amount, recipient_address, description, reference_id, callback_url } = req.body;

    if (!amount || !recipient_address) {
        return res.status(400).json({ error: 'Amount and recipient address required' });
    }

    if (parseFloat(amount) <= 0) {
        return res.status(400).json({ error: 'Amount must be positive' });
    }

    if (!recipient_address.startsWith('kaspa:')) {
        return res.status(400).json({ error: 'Invalid Kaspa address' });
    }

    const connection = await req.app.locals.db.getConnection();

    try {
        await connection.beginTransaction();

        // Check wallet balance
        const [wallets] = await connection.query(
            `SELECT id, balance_kas FROM wallets
             WHERE user_id = ? AND wallet_category = 'checking' AND is_active = TRUE`,
            [req.oauthUser.id]
        );

        if (wallets.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'No checking account found' });
        }

        const wallet = wallets[0];
        const requestedAmount = parseFloat(amount);

        if (requestedAmount > parseFloat(wallet.balance_kas)) {
            await connection.rollback();
            return res.status(400).json({
                error: 'Insufficient funds',
                available_balance: wallet.balance_kas
            });
        }

        // Create pending payment
        const paymentId = crypto.randomBytes(16).toString('hex');

        await connection.query(
            `INSERT INTO oauth_payments
             (payment_id, client_id, user_id, wallet_id, amount_kas,
              recipient_address, description, reference_id, callback_url,
              status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())`,
            [paymentId, req.oauthClient.id, req.oauthUser.id, wallet.id,
             requestedAmount, recipient_address, description || null,
             reference_id || null, callback_url || null]
        );

        await connection.commit();

        res.status(201).json({
            payment_id: paymentId,
            status: 'pending_approval',
            amount: requestedAmount.toFixed(8),
            recipient_address,
            description,
            reference_id,
            // This URL is where the user approves the payment in YOUR wallet UI
            approval_url: `${process.env.BANK_URL}/approve-payment/${paymentId}`,
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
        });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
});

// ============================================================
// GET /api/oauth/payments/:paymentId - Check Payment Status
// ============================================================
router.get('/payments/:paymentId', verifyOAuthToken(['payments:create']), async (req, res) => {
    const [payments] = await req.app.locals.db.query(
        `SELECT * FROM oauth_payments WHERE payment_id = ? AND client_id = ?`,
        [req.params.paymentId, req.oauthClient.id]
    );

    if (payments.length === 0) return res.status(404).json({ error: 'Payment not found' });

    const p = payments[0];
    res.json({
        payment_id: p.payment_id,
        status: p.status,
        amount: p.amount_kas,
        recipient_address: p.recipient_address,
        transaction_id: p.transaction_id,
        reference_id: p.reference_id,
        created_at: p.created_at,
        error_message: p.error_message
    });
});

// ============================================================
// GET /api/oauth/payments/:paymentId/details - Payment Info for Approval Page
// ============================================================
// Called by YOUR wallet's approval UI (user-facing, uses user JWT not OAuth token)
router.get('/payments/:paymentId/details', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { paymentId } = req.params;

        const [payments] = await req.app.locals.db.query(
            `SELECT p.*, c.client_name, c.logo_url
             FROM oauth_payments p
             JOIN oauth_clients c ON p.client_id = c.client_id
             WHERE p.payment_id = ? AND p.user_id = ?`,
            [paymentId, decoded.id]
        );

        if (payments.length === 0) return res.status(404).json({ error: 'Payment not found' });

        const payment = payments[0];

        // Check expiry (10 minutes)
        const expiresAt = new Date(new Date(payment.created_at).getTime() + 10 * 60 * 1000);
        if (new Date() > expiresAt && payment.status === 'pending') {
            await req.app.locals.db.query(
                `UPDATE oauth_payments SET status = 'cancelled', error_message = 'Expired'
                 WHERE payment_id = ?`, [paymentId]
            );
            return res.status(400).json({ error: 'Payment request expired' });
        }

        res.json({
            payment_id: payment.payment_id,
            client_name: payment.client_name,
            logo_url: payment.logo_url,
            amount: payment.amount_kas,
            recipient_address: payment.recipient_address,
            description: payment.description,
            status: payment.status,
            expires_at: expiresAt.toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load payment details' });
    }
});

// ============================================================
// POST /api/oauth/payments/:paymentId/approve - Approve & Execute
// ============================================================
// Accepts EITHER a user JWT (internal approval page) OR an OAuth token
// (third-party app with pre-authorization).
// ============================================================
router.post('/payments/:paymentId/approve', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const db = req.app.locals.db;

    try {
        let userId = null;

        // Try user JWT first, then OAuth token
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.id && !decoded.type) userId = decoded.id;
            else throw new Error('Not a user JWT');
        } catch {
            // Try OAuth token
            const decoded = jwt.verify(token, process.env.OAUTH_JWT_SECRET);
            if (decoded.type !== 'access') return res.status(401).json({ error: 'Invalid token' });

            const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
            const [tokens] = await db.query(
                `SELECT user_id FROM oauth_access_tokens
                 WHERE token_hash = ? AND expires_at > NOW() AND is_revoked = FALSE`,
                [tokenHash]
            );
            if (tokens.length === 0) return res.status(401).json({ error: 'Token expired' });
            userId = tokens[0].user_id;
        }

        const { paymentId } = req.params;

        // Get payment with wallet info
        const [payments] = await db.query(
            `SELECT p.*, w.wallet_address, w.encrypted_mnemonic, w.balance_kas
             FROM oauth_payments p
             JOIN wallets w ON p.wallet_id = w.id
             WHERE p.payment_id = ? AND p.user_id = ? AND p.status = 'pending'`,
            [paymentId, userId]
        );

        if (payments.length === 0) {
            return res.status(404).json({ error: 'Payment not found or already processed' });
        }

        const payment = payments[0];

        // Check expiry
        const expiresAt = new Date(new Date(payment.created_at).getTime() + 10 * 60 * 1000);
        if (new Date() > expiresAt) {
            await db.query(
                `UPDATE oauth_payments SET status = 'cancelled', error_message = 'Expired'
                 WHERE payment_id = ?`, [paymentId]
            );
            await sendPaymentWebhook(db, payment, 'cancelled', null, 'Expired');
            return res.status(400).json({ error: 'Payment expired' });
        }

        // Mark as approved
        await db.query(
            `UPDATE oauth_payments SET status = 'approved', approved_at = NOW()
             WHERE payment_id = ?`, [paymentId]
        );

        try {
            // *** THIS IS WHERE YOU EXECUTE THE ACTUAL KASPA TRANSACTION ***
            // Replace with your own wallet SDK / signing logic
            const result = await executePaymentTransaction(db, payment, userId);

            // Update payment record
            await db.query(
                `UPDATE oauth_payments SET status = 'completed', transaction_id = ?
                 WHERE payment_id = ?`, [result.txId, paymentId]
            );

            // Record in transactions table
            await recordOAuthTransaction(db, payment, userId, result.txId, result.fee);

            // Send webhook
            await sendPaymentWebhook(db, payment, 'completed', result.txId);

            res.json({
                success: true,
                status: 'completed',
                transaction_id: result.txId,
                amount: payment.amount_kas,
                fee: result.fee,
                reference_id: payment.reference_id
            });

        } catch (txError) {
            await db.query(
                `UPDATE oauth_payments SET status = 'failed', error_message = ?
                 WHERE payment_id = ?`, [txError.message, paymentId]
            );
            await sendPaymentWebhook(db, payment, 'failed', null, txError.message);

            return res.status(500).json({
                success: false,
                status: 'failed',
                error: txError.message
            });
        }

    } catch (error) {
        console.error('Payment approval error:', error);
        res.status(500).json({ error: 'Failed to approve payment' });
    }
});

// ============================================================
// POST /api/oauth/payments/:paymentId/deny - Deny Payment
// ============================================================
router.post('/payments/:paymentId/deny', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const [payments] = await req.app.locals.db.query(
            `SELECT * FROM oauth_payments
             WHERE payment_id = ? AND user_id = ? AND status = 'pending'`,
            [req.params.paymentId, decoded.id]
        );

        if (payments.length === 0) return res.status(404).json({ error: 'Not found' });

        await req.app.locals.db.query(
            `UPDATE oauth_payments SET status = 'cancelled', error_message = 'Denied by user'
             WHERE payment_id = ?`, [req.params.paymentId]
        );

        await sendPaymentWebhook(req.app.locals.db, payments[0], 'cancelled', null, 'Denied by user');

        res.json({ success: true, status: 'denied' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to deny payment' });
    }
});

module.exports = router;
```

### Transaction Execution Helper

**You must replace this with your own wallet SDK logic.** This is the pattern Keystone uses with encrypted server-side mnemonics:

```javascript
async function executePaymentTransaction(db, payment, userId) {
    // 1. Get wallet with encrypted mnemonic
    const [wallets] = await db.query(
        `SELECT id, wallet_address, encrypted_mnemonic, balance_kas
         FROM wallets WHERE id = ? AND user_id = ? AND is_active = TRUE`,
        [payment.wallet_id, userId]
    );

    if (wallets.length === 0) throw new Error('Wallet not found');
    const wallet = wallets[0];

    // 2. Decrypt mnemonic (your encryption scheme)
    const mnemonic = decryptMnemonic(wallet.encrypted_mnemonic, process.env.SESSION_ENCRYPTION_KEY);

    // 3. Check balance
    const balance = await getWalletBalance(mnemonic, wallet.wallet_address);
    const amountKas = parseFloat(payment.amount_kas);
    const totalRequired = amountKas + FEE_BUFFER_KAS;

    if (balance < totalRequired) {
        throw new Error(`Insufficient balance. Available: ${balance}, Required: ${totalRequired}`);
    }

    // 4. Execute on-chain transaction via Kaspa SDK
    const sendResult = await sendKaspaTransaction(mnemonic, payment.recipient_address, amountKas, wallet.wallet_address);

    if (!sendResult.success) {
        // Optional: auto-compound UTXOs if needed, then retry
        throw new Error(sendResult.error || 'Transaction failed');
    }

    // 5. Update local balance cache
    const newBalance = balance - amountKas - (sendResult.fee || FIXED_FEE_KAS);
    await db.query(
        'UPDATE wallets SET balance_kas = ?, updated_at = NOW() WHERE id = ?',
        [Math.max(0, newBalance), wallet.id]
    );

    return { txId: sendResult.txId, fee: sendResult.fee || FIXED_FEE_KAS };
}
```

---

## 7. Webhook System

Webhooks notify the merchant when payment status changes.

```javascript
async function sendPaymentWebhook(db, payment, status, txId = null, error = null) {
    if (!payment.callback_url) return;

    try {
        const [clients] = await db.query(
            'SELECT webhook_url, webhook_secret FROM oauth_clients WHERE client_id = ?',
            [payment.client_id]
        );

        const webhookUrl = payment.callback_url || clients[0]?.webhook_url;
        if (!webhookUrl) return;

        const payload = {
            event: 'payment.updated',
            payment_id: payment.payment_id,
            reference_id: payment.reference_id,
            status: status,
            amount: payment.amount_kas,
            recipient_address: payment.recipient_address,
            transaction_id: txId,
            error: error,
            timestamp: new Date().toISOString()
        };

        // HMAC signature for verification
        const signature = crypto
            .createHmac('sha256', clients[0]?.webhook_secret || payment.client_id)
            .update(JSON.stringify(payload))
            .digest('hex');

        await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Wallet-Signature': signature,
                'X-Wallet-Event': 'payment.updated'
            },
            body: JSON.stringify(payload),
            timeout: 10000
        });
    } catch (err) {
        console.error('Webhook delivery failed:', err.message);
        // Don't throw — webhook failure should never fail the payment
    }
}
```

### Merchant-side webhook verification:

```javascript
// On the merchant's server
app.post('/webhooks/wallet', (req, res) => {
    const signature = req.headers['x-wallet-signature'];
    const payload = JSON.stringify(req.body);

    const expected = crypto
        .createHmac('sha256', process.env.WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');

    if (signature !== expected) {
        return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process the event
    const { event, payment_id, status, transaction_id, reference_id } = req.body;

    if (status === 'completed') {
        // Mark order as paid, fulfill, etc.
    } else if (status === 'failed' || status === 'cancelled') {
        // Handle failure
    }

    res.json({ received: true });
});
```

---

## 8. Client Registration Script

Run this to create credentials for a new third-party app:

```javascript
// generate-oauth-client.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');

async function generateOAuthClient() {
    const clientId = 'kc_' + crypto.randomBytes(16).toString('hex');
    const clientSecret = crypto.randomBytes(32).toString('base64url');
    const hashedSecret = await bcrypt.hash(clientSecret, 10);

    console.log('\n========== OAUTH CLIENT CREDENTIALS ==========');
    console.log('Client ID:', clientId);
    console.log('Client Secret:', clientSecret);
    console.log('⚠️  SAVE THE SECRET NOW — it cannot be retrieved later.\n');

    console.log('========== SQL TO RUN IN YOUR DATABASE ==========\n');
    console.log(`INSERT INTO oauth_clients (
    client_id, client_secret, client_name, description,
    redirect_uris, allowed_scopes, grant_types,
    contact_email, is_active
) VALUES (
    '${clientId}',
    '${hashedSecret}',
    'Partner App Name',
    'Description of the app',
    '["https://partner-app.com/auth/callback"]',
    '["profile", "balance:read", "payments:create"]',
    '["authorization_code", "refresh_token"]',
    'partner@email.com',
    TRUE
);`);

    console.log('\n========== PARTNER .env CONFIGURATION ==========\n');
    console.log(`WALLET_CLIENT_ID=${clientId}`);
    console.log(`WALLET_CLIENT_SECRET=${clientSecret}`);
    console.log(`WALLET_BASE_URL=https://your-wallet.com`);
    console.log(`WALLET_REDIRECT_URI=https://partner-app.com/auth/callback`);
}

generateOAuthClient().catch(console.error);
```

---

## 9. Third-Party Integration Guide (What Merchants Do)

### Step 1: Redirect to Authorization

```javascript
// On the merchant's server or frontend
const authUrl = new URL('https://your-wallet.com/api/oauth/authorize');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', process.env.WALLET_CLIENT_ID);
authUrl.searchParams.set('redirect_uri', process.env.WALLET_REDIRECT_URI);
authUrl.searchParams.set('scope', 'profile balance:read payments:create');
authUrl.searchParams.set('state', crypto.randomBytes(16).toString('hex'));

// Optional PKCE
const codeVerifier = crypto.randomBytes(32).toString('base64url');
const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');

res.redirect(authUrl.toString());
```

### Step 2: Handle Callback

```javascript
app.get('/auth/callback', async (req, res) => {
    const { code, state } = req.query;

    // Exchange code for tokens
    const tokenRes = await fetch('https://your-wallet.com/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.WALLET_REDIRECT_URI,
            client_id: process.env.WALLET_CLIENT_ID,
            client_secret: process.env.WALLET_CLIENT_SECRET,
            code_verifier: codeVerifier  // if using PKCE
        })
    });

    const tokens = await tokenRes.json();
    // Store tokens.access_token and tokens.refresh_token for this user
});
```

### Step 3: Request a Payment

```javascript
const paymentRes = await fetch('https://your-wallet.com/api/oauth/payments', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        amount: '25.50000000',
        recipient_address: 'kaspa:qr...your-merchant-address',
        description: 'Order #12345 - Blue Widget',
        reference_id: 'order-12345',
        callback_url: 'https://your-store.com/webhooks/wallet'
    })
});

const payment = await paymentRes.json();
// payment.approval_url → redirect user here to approve
// payment.payment_id → use to poll status
```

### Step 4: Poll for Status (alternative to webhooks)

```javascript
async function checkPaymentStatus(paymentId, accessToken) {
    const res = await fetch(
        `https://your-wallet.com/api/oauth/payments/${paymentId}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    return await res.json();
}
```

---

## 10. Security Considerations

| Concern | Solution |
|---------|----------|
| Token storage | Store only SHA-256 hashes in database, never raw tokens |
| Client authentication | Client secrets are bcrypt-hashed |
| PKCE | Supports S256 code challenges for public clients |
| Token expiry | Access tokens: 1 hour. Refresh tokens: 30 days |
| Payment expiry | Pending payments expire after 10 minutes |
| Webhook verification | HMAC-SHA256 signatures on all webhook payloads |
| Scope enforcement | Every endpoint checks required scopes |
| Audit logging | All OAuth events logged with IP, user agent, metadata |
| One-time auth codes | Codes marked as used immediately after exchange |
| State parameter | Prevents CSRF in the authorization flow |

---

## 11. Known Challenges (iframe / localStorage)

### The iframe Problem

If your wallet is embedded in an iframe on a third-party site, browsers block localStorage and cookies in that context (third-party cookie restrictions). This means:

- Users can't stay logged in inside the iframe
- Session tokens won't persist
- Users would need to re-authenticate every time

### Workarounds

1. **Popup/redirect flow (recommended):** Open the wallet authorization in a new tab/popup, not an iframe. This is how Google, GitHub, and Stripe do OAuth.

2. **postMessage bridge:** The iframe communicates with the parent page via `window.postMessage()`. The parent stores tokens. Complex but works.

3. **Server-to-server flow:** Skip the browser entirely. The merchant's server calls your API directly with the OAuth token. The user approves via redirect to your wallet (not iframe).

4. **Exposed endpoint alternative:** If OAuth is too complex, consider exposing a simple payment request endpoint that the third-party app calls server-to-server:

```
POST /api/payments/request
{
    "api_key": "merchant-api-key",
    "user_email": "buyer@example.com",
    "amount": "25.5",
    "recipient_address": "kaspa:...",
    "callback_url": "https://store.com/webhook"
}
→ Creates a payment link sent to the user's email/notifications
→ User opens it in your wallet directly (no iframe)
```

---

## Route Mounting

```javascript
// In your main server file
const oauthRoutes = require('./routes/oauth');
const oauthApiRoutes = require('./routes/oauth-api');

app.use('/api/oauth', oauthRoutes);    // Authorization & token endpoints
app.use('/api/oauth', oauthApiRoutes); // Protected API endpoints
```

---

*Built with love by Kaspero Labs. Questions? Reach out to Oz.*
