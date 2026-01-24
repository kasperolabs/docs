# Kaspa Security Center - Admin Panel User Guide

A step-by-step guide to using the Admin Panel for security incident management.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [The Dashboard](#the-dashboard)
3. [Working with Reports](#working-with-reports)
4. [The Report Modal](#the-report-modal)
5. [Managing Your Cases](#managing-your-cases)
6. [Coordinating with Authorities](#coordinating-with-authorities)
7. [Communicating with Reporters](#communicating-with-reporters)
8. [Publishing Public Reports](#publishing-public-reports)
9. [Activity Logs](#activity-logs)
10. [User Management](#user-management)
11. [Settings](#settings)

---

## Getting Started

### Logging In

Navigate to `/admin` on your Security Center instance. Enter your username and password and click Login. If your credentials are valid and you have admin privileges, you'll be taken to the dashboard.

Your session persists until you log out or the token expires. If you need to end all sessions (for example, if you logged in on a shared computer), use the "Logout All Devices" option in Settings.

### The Sidebar

The left sidebar is your main navigation. It contains:

- **Overview** — Dashboard with statistics and recent reports
- **Reports** — Full report list with filtering
- **My Investigations** — Cases assigned to you
- **Public Reports** — Manage which reports are published
- **Users** — User management (Super Admin only)
- **Activity Logs** — Audit trail of all admin actions
- **Settings** — Your account and system settings

Click any item to switch sections. The Logout button is at the bottom.

---

## The Dashboard

The Overview section gives you an at-a-glance summary.

### Status Cards

Four cards at the top show counts for Pending reports (awaiting initial review), Investigating reports (active cases), Resolved reports (completed), and High Priority reports (need urgent attention). These update in real-time as you work.

### Recent Reports Table

Below the cards is a table of the most recent submissions. Each row shows the Report ID (like THEFT-A3B7C9D2), Category, Status, Priority, Date submitted, who it's Assigned to, whether it's Published, and an Actions column with a View button.

Click View on any row to open the full report details.

---

## Working with Reports

### The Reports Section

Click "Reports" in the sidebar to see all reports with filtering options.

### Filtering

At the top of the Reports section, you'll find dropdown filters:

**Category** — Filter by theft, scam, phishing, bug, rug pull, or abuse

**Status** — Filter by pending, investigating, resolved, or rejected

**Priority** — Filter by critical, high, medium, or low

**Assignment** — Show only assigned reports, only unassigned, or all

**Search** — Type a Report ID, keyword from the description, transaction ID, or reporter email

After setting your filters, click "Apply Filters" to update the list.

### The Reports Table

The filtered results appear in a table with the same columns as the dashboard. Pagination controls at the bottom let you navigate through large result sets.

---

## The Report Modal

Clicking "View" on any report opens a detailed modal with five tabs.

### Details Tab

This is the main view showing everything about the report.

**Report Information** shows the Report ID, title (if provided), submission date, and last update time. Three dropdowns let you change Category, Status, and Priority directly—just select a new value and it saves automatically. The dropdowns change color to match the selected value (yellow for pending, blue for investigating, green for resolved, etc.).

**Financial Impact** appears if the reporter indicated any amounts. It shows the reported amount, confirmed amount lost, and any amount recovered.

**Reporter Information** shows the name, email, and phone for non-anonymous reports. For anonymous reports, it simply says "This report was submitted anonymously." Below that, you'll see the IP address and browser information (user agent) for all reports.

**Incident Description** displays the full text the reporter wrote, plus any transaction IDs and wallet addresses they provided.

**Category-Specific Details** appears for reports that include extra information. For phishing reports this might show the malicious URLs and who was impersonated. For bug reports it shows severity and steps to reproduce. For theft reports it shows the attack method and attacker wallet addresses.

**Attached Evidence** lists all uploaded files. Images display as thumbnails you can click to view full-size. All files have View and Download buttons.

**Authorities Contacted** appears if any authorities have been logged for this case, showing which ones.

At the bottom is **Report Management** with an assignment dropdown. Select an admin from the list and click "Assign" to assign the case to them.

### Authorities Tab

This tab manages communication with law enforcement, exchanges, and other external parties.

The top section lists all authorities already contacted for this case, showing the authority name, contact method, case number (if any), status (pending/acknowledged/investigating/closed), notes, and who logged the contact.

Below that is the "Add New Authority Contact" form. Select an authority from the dropdown (FBI, local police, Kaspa Team, major exchanges, regulatory bodies, or "Custom" for others). Choose the contact method (Email, Portal, Phone, API, or Direct). Enter any case or reference number they gave you. Add notes about what you communicated or any response received. Click "Add Authority Contact" to save it.

When you add an authority contact, the system automatically emails the reporter (if not anonymous) letting them know their case has been escalated.

### Publishing Tab

This tab controls whether the report appears publicly on the site.

At the top, a status box shows whether the report is currently published or not. If published, it shows the public ID and publication date.

Below is the publishing form. Fill in:

**Public Title** — A clear, descriptive title safe for public viewing

**Public Summary** — A brief summary of what happened (required for publishing)

**Detailed Description** — Optional longer explanation

**Prevention Tips** — How others can avoid similar incidents

**Amount Lost** and **Amount Recovered** — The confirmed financial figures

Click "Publish Report" to make it public. The button changes to "Update Published Report" if already published. An "Unpublish Report" button appears to remove it from public view.

Never include reporter details, IP addresses, or internal investigation notes in the public fields.

### Updates Tab

This tab lets you send messages to the reporter and track update history.

The top section shows all previous updates, each displaying the date, whether it was public or private, who sent it, and the message content. Each update has a delete button (trash icon) if you need to remove it.

Below is the "Add New Update" form. Write your message in the text area. Two checkboxes control behavior:

**Email this update to reporter** — When checked, the reporter receives an email with your message

**Show in public report (if published)** — When checked, the update appears when the reporter checks their status

Click "Send Update" to save and send.

### Notes Tab

This tab is for internal team communication. Notes are visible to all admins but never to reporters or the public.

Existing notes appear at the top, showing the author, timestamp, and content. Each note has a delete button.

At the bottom, type in the text area and click "Add Note" to add a new note. Use notes to document investigation steps, blockchain analysis findings, coordination with team members, or anything else relevant to the case.

---

## Managing Your Cases

### My Investigations

Click "My Investigations" in the sidebar to see only reports assigned to you. This view automatically sorts by status—active investigations appear first, resolved cases at the bottom.

This is your personal work queue. When you start your day, check this section to see what needs attention.

### Assigning Reports

To assign a report to yourself or someone else, open the report modal, scroll to the bottom of the Details tab, select a name from the "Assign to" dropdown, and click "Assign."

Unassigned reports can be claimed by any admin. To unassign, select the blank option at the top of the dropdown.

### Typical Workflow

A typical case moves through these stages:

1. **Triage** — Open a pending report, review the details, adjust priority if needed, change status to "Investigating," and assign it to yourself

2. **Investigation** — Analyze the evidence, use external blockchain tools to trace transactions, document findings in Notes

3. **Escalation** — If warranted, log authority contacts in the Authorities tab

4. **Communication** — Send updates to keep the reporter informed

5. **Resolution** — When complete, change status to "Resolved," update the financial amounts if you have confirmed figures, and optionally publish a sanitized version

---

## Coordinating with Authorities

### When to Escalate

Consider contacting authorities when significant funds are involved (establish your own threshold), when evidence suggests organized criminal activity, when you've traced funds to an exchange deposit, or when the reporter requests it.

### Logging a Contact

Open the report, go to the Authorities tab, select the authority from the dropdown, choose the contact method, enter any case number they provide, add notes about the communication, and click "Add Authority Contact."

### Tracking Status

Each authority contact has a status: pending (waiting for response), acknowledged (they confirmed receipt), investigating (they're actively working it), or closed (no further action). Update these as you receive information back.

### Exchange Coordination

For exchanges (Binance, KuCoin, etc.), you'll typically submit a support ticket with the transaction details showing funds deposited to their platform. Log the ticket number in the case number field. Update the status when they respond.

---

## Communicating with Reporters

### Automatic Notifications

The system automatically emails reporters (non-anonymous only) when their report is submitted (with Report ID and status link), when you add an authority contact, and when status changes.

### Manual Updates

For anything else, use the Updates tab. Write your message, check the notification options, and send. Common reasons to send updates include letting them know investigation is progressing, requesting additional information, informing them of findings, and providing final resolution summary.

### What Reporters See

When reporters check their status using their Report ID, they see current status and priority, submission date, any public updates you've sent, which authorities have been contacted (names only), and amounts lost/recovered. They never see internal notes, admin usernames, investigation details, or their own IP address.

---

## Publishing Public Reports

### Purpose

Published reports warn the community about scams, phishing sites, and attack patterns. They should be educational without exposing reporter information.

### Publishing Process

Resolve the case first (status should be "resolved"). Open the report, go to the Publishing tab, fill in the public title (something like "Phishing Attack Impersonating KaspaWallet" rather than the original report title), write a summary describing what happened, add prevention tips, confirm the financial figures, and click "Publish Report."

### Writing Public Content

Keep it factual and educational. Include what type of attack it was, how the attacker operated, red flags that could have indicated the scam, and how to verify legitimate sources. Never include reporter name, email, IP address, or any identifying information. Transaction IDs and attacker wallet addresses can be included if useful for the community.

### Managing Published Reports

The Public Reports section shows all reports with their publication status. Use the filters to show only published or only unpublished. Click "Manage" to open any report and edit or unpublish it.

---

## Activity Logs

The Activity Logs section shows an audit trail of all admin actions. Each entry shows the timestamp, which admin performed the action, what action was taken (view_report, update_report, add_note, contact_authority, publish_report, etc.), details of what changed, and the IP address.

Use this to review team activity, investigate any concerns, or track the history of a specific case.

---

## User Management

This section is only visible to Super Admins.

### Viewing Users

The Users section shows all admin accounts with username, email, role (Admin or Super Admin), status (Active or Inactive), last login date, and account creation date.

### Creating Users

Click "Add User" to create a new admin account. Enter username, email, password (minimum 8 characters), and role. Click "Create User." The new account is immediately active with no email verification required.

### Editing Users

Click "Edit" on any user row. You can change their role (promote to Super Admin or demote to Admin), change their status (Active or Inactive—inactive users cannot log in), or reset their password. Click "Update User" to save.

You cannot deactivate your own account.

---

## Settings

### Account Information

Shows your username, email, role, and last login time.

### Change Password

Enter your current password, then your new password twice. The new password must be at least 8 characters with uppercase, lowercase, and a number. Click "Change Password" to update.

### System Settings (Super Admin Only)

Configure system-wide options like email notifications and auto-archive timing.

### Danger Zone

The "Logout All Devices" button invalidates your current session and any other sessions. Use this if you suspect your account was accessed from another device or if you logged in somewhere you shouldn't have.

---

## Tips for Effective Use

**Check the dashboard daily.** The pending count tells you how many reports need initial triage.

**Use the assignment system.** Assign reports to yourself when you start working them. This prevents duplicate effort and makes it clear who owns each case.

**Document everything in notes.** Even if it seems obvious, write it down. Future you (or a teammate) will appreciate it.

**Keep reporters informed.** A quick update saying "We're still investigating" is better than silence. Use the Updates tab regularly.

**Publish resolved cases.** Public reports help the community. Even a brief "avoid this phishing site" post has value.

**Use external tools for blockchain analysis.** The Security Center captures the report data—actual transaction tracing and fund tracking happens in specialized tools. Copy wallet addresses and transaction IDs from the report and analyze them externally, then document your findings in the Notes tab.

---

*For technical documentation including installation, API reference, and deployment, see the main documentation.*
