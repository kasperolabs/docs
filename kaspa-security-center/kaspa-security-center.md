# Kaspa Security Center Documentation

Community-driven security incident reporting for the Kaspa ecosystem.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Configuration](#configuration)
4. [API Reference](#api-reference)
5. [Report Categories](#report-categories)
6. [Admin Panel](#admin-panel)
7. [Email Notifications](#email-notifications)
8. [Security Features](#security-features)
9. [Database Schema](#database-schema)
10. [Deployment](#deployment)
11. [FAQ](#faq)
12. [Changelog](#changelog)

---

## Overview

The Kaspa Security Center is an open-source platform for reporting and tracking security incidents in the Kaspa ecosystem. It provides:

- **Anonymous Reporting**: Submit reports without creating an account
- **Transparent Tracking**: Check report status with a unique Report ID
- **Admin Dashboard**: Full case management for investigators
- **Authority Coordination**: Track escalations to exchanges and law enforcement
- **Public Reports**: Publish resolved cases to warn the community

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/kaspero-labs/kaspa-security-center.git
cd kaspa-security-center
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Database
DB_HOST=localhost
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=kaspa_security

# Server
PORT=3000
NODE_ENV=development
APP_URL=http://localhost:3000

# Security
JWT_SECRET=your-secure-random-string
DEFAULT_ADMIN_PASSWORD=change-this-immediately

# Email (optional)
SMTP_ENABLED=false
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@your-domain.com
ADMIN_EMAIL=admin@your-domain.com
```

### 3. Start the Server

```bash
# Development
npm run dev

# Production
npm start
```

Your Security Center is now running at `http://localhost:3000`

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DB_HOST` | Yes | MySQL host |
| `DB_USER` | Yes | MySQL username |
| `DB_PASSWORD` | Yes | MySQL password |
| `DB_NAME` | Yes | Database name |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | `development` or `production` |
| `JWT_SECRET` | Yes | Secret for JWT tokens |
| `APP_URL` | Yes | Public URL of your instance |
| `SMTP_ENABLED` | No | Enable email notifications |
| `ADMIN_EMAIL` | No | Email for admin notifications |

### Security Headers

In production (`NODE_ENV=production`), Helmet.js applies strict CSP headers. In development, headers are relaxed for easier debugging.

---

## API Reference

### Public Endpoints

#### Submit a Report

```
POST /api/reports
Content-Type: multipart/form-data
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | string | Yes | Report category |
| `description` | string | Yes | Detailed description (20-5000 chars) |
| `is_anonymous` | boolean | No | Submit anonymously |
| `name` | string | No* | Reporter name (*required if not anonymous) |
| `email` | string | No* | Reporter email (*required if not anonymous) |
| `amount` | number | No | Amount lost in KAS |
| `txids` | string | No | Transaction IDs (newline-separated) |
| `walletAddresses` | string | No | Wallet addresses involved |
| `files` | file[] | No | Evidence files (max 10MB each) |

**Response:**
```json
{
    "success": true,
    "message": "Report submitted successfully",
    "reportId": "THEFT-A3B7C9D2",
    "isAnonymous": false
}
```

#### Check Report Status

```
GET /api/reports/{reportId}/status
```

**Response:**
```json
{
    "reportId": "THEFT-A3B7C9D2",
    "category": "theft",
    "status": "investigating",
    "priority": "high",
    "submittedAt": "2025-01-20T10:30:00Z",
    "authoritiesContacted": ["FBI", "Binance"],
    "statusMessage": "Our team is actively investigating your report."
}
```

#### Get Public Reports

```
GET /api/reports/public
```

Returns published cases for community awareness.

#### Get Public Statistics

```
GET /api/reports/stats/public
```

**Response:**
```json
{
    "totalReportsThisMonth": 12,
    "resolutionRate": "45.5%",
    "authorityInvolvementRate": "30.0%"
}
```

### Admin Endpoints

All admin endpoints require authentication via Bearer token.

```
Authorization: Bearer <token>
```

#### Login

```
POST /api/user/login
```

#### Get Dashboard Stats

```
GET /api/admin/stats
```

#### List Reports

```
GET /api/admin/reports?status=pending&category=theft&page=1
```

#### Update Report

```
PUT /api/admin/reports/{reportId}
```

#### Add Authority Contact

```
POST /api/admin/reports/{reportId}/authority
```

---

## Report Categories

| Category | Use Case |
|----------|----------|
| `theft` | Wallet compromised, funds stolen |
| `scam` | Investment scams, fake giveaways |
| `phishing` | Fake websites, impersonation |
| `rug_pull` | Project abandonment with funds |
| `bug` | Security vulnerabilities |
| `abuse` | Network abuse, spam |
| `other` | Uncategorized incidents |

Each category collects specific additional fields:

- **Theft**: Attack method, wallet used, attacker addresses
- **Phishing**: Malicious URLs, impersonated entity, attack vector
- **Bug**: Severity, steps to reproduce, environment
- **Scam**: Scam type, platform, scammer info
- **Rug Pull**: Project name, website, team members

---

## Admin Panel

Access the admin panel at `/admin`

### Features

- **Dashboard**: Real-time statistics and charts
- **Case Management**: Filter, search, and update reports
- **Assignment**: Assign cases to team members
- **Notes**: Internal notes and public updates
- **Authority Tracking**: Log contacts with exchanges and law enforcement
- **Publishing**: Make resolved cases public for community awareness

### User Roles

| Role | Permissions |
|------|-------------|
| `user` | View own reports only |
| `admin` | Full case management |
| `super_admin` | User management + all admin features |

---

## Email Notifications

When `SMTP_ENABLED=true`, the system sends:

1. **Report Confirmation**: Sent to reporter with Report ID and status link
2. **Status Updates**: When report status changes
3. **Authority Escalation**: When case is escalated to authorities
4. **Admin Alerts**: New high-priority reports to admin email

Email templates are customizable in `utils/emailService.js`.

---

## Security Features

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| General API | 100 requests | 15 min |
| Login | 5 attempts | 15 min |
| Registration | 3 attempts | 1 hour |
| Report submission | 5 reports | 15 min |

### Authentication

- JWT tokens with configurable expiration
- Password hashing with bcrypt (10 rounds)
- Account lockout tracking

### File Upload Security

- 10MB max file size
- Allowed types: jpeg, jpg, png, gif, pdf, doc, docx, txt, csv, json, zip
- Files stored outside web root

### Logging (Production)

- `security.log`: Admin access, file downloads, auth attempts (90-day retention)
- `alerts.log`: Failed auth, access denied, errors (365-day retention)
- `file-access.log`: All evidence file downloads

---

## Database Schema

### Core Tables

```
Users          - Admin accounts
Reports        - Incident reports
ReportFiles    - Evidence attachments
ReportNotes    - Internal/public notes
AuthorityContact - Law enforcement tracking
PublicReportUpdate - Public status updates
ActivityLog    - Audit trail
AdminSetting   - Configuration
```

### Key Fields (Reports)

| Field | Type | Description |
|-------|------|-------------|
| `reportId` | string | Unique public ID (e.g., THEFT-A3B7C9D2) |
| `category` | enum | Report type |
| `status` | enum | pending/investigating/resolved/rejected |
| `priority` | enum | low/medium/high/critical |
| `categorySpecificData` | JSON | Category-specific fields |
| `authoritiesContacted` | JSON | Array of contacted authorities |
| `isPublished` | boolean | Published for public viewing |

---

## Deployment

### Production Checklist

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET` (32+ random characters)
3. Change default admin password immediately
4. Configure reverse proxy (nginx) with SSL
5. Set `ALLOWED_ORIGINS` for CORS
6. Enable and configure SMTP
7. Set up database backups
8. Monitor log files

### Nginx Example

```nginx
server {
    listen 443 ssl;
    server_name security.your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
    }
}
```

### PM2 Process Manager

```bash
npm install -g pm2
pm2 start server.js --name "kaspa-security"
pm2 save
pm2 startup
```

---

## FAQ

### How do reports work without user accounts?

Each report receives a unique Report ID (e.g., `THEFT-A3B7C9D2`). Reporters use this ID to check status. If they provide an email, they receive updates automatically.

### Can reporters add information after submitting?

Yes. They can reply to any email notification with their Report ID, or contact admins directly.

### How is reporter privacy protected?

- Anonymous submissions store no identifying info
- Email addresses are only visible to admins
- IP addresses are logged but not displayed
- Published reports never include reporter details

### What happens when a report is escalated?

Admins can log contacts with authorities (FBI, exchanges, etc.). The reporter is notified of escalation and receives any case numbers for their records.

### How are reports published?

Resolved cases can be published with sanitized information to warn the community. Admins write a public summary, prevention tips, and track any recovered funds.

---

## Changelog

**v2.0.0** (January 2025)
- Complete rewrite with modular architecture
- Category-specific data collection
- Authority contact tracking
- Public report publishing
- Enhanced email templates
- Production security logging
- Admin assignment system

**v1.0.0** (2024)
- Initial release
- Basic report submission
- Simple admin panel

---

*Built with 💚 for the Kaspa ecosystem by [Kaspero Labs](https://github.com/kaspero-labs)*
