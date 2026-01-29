# How KasperoPay Actually Works

This explains what happens under the hood. No legal speak, just how it is.

---

## Payments

When someone pays through KasperoPay:

1. They click your payment button
2. Our widget shows them wallet options
3. They send KAS from their wallet to your wallet address
4. We watch the blockchain and confirm when it arrives
5. We tell your site "payment complete"

**We never touch the money.** It goes straight from customer to you. We're just the UI that makes it easy and the verification that confirms it happened.

### What We Store

For each payment:
- Payment ID
- Your merchant ID
- Amount in KAS (and USD conversion at that moment)
- Transaction ID from the blockchain
- Which wallet type they used
- Timestamp
- Status (pending, completed, expired)

We need this to show you payment history and to verify transactions actually happened.

---

## Authentication (KasperoConnect)

When someone "connects" via KasperoConnect, we're giving them an identity they can use on your site.

### Wallet Auth (Kasware, Kastle, Keystone)

We store:
- Their full Kaspa address
- Public key (if the wallet provides it)
- Which wallet they used
- Which merchant (you) they connected to

The private key never leaves their wallet. We can't spend their money. We just know their address.

### Google/Email Auth

Here's where it gets interesting.

When you add "Sign in with Google" to your site using our widget:
- The user clicks the button on your site
- They go to Google's login
- Google's screen says they're authorizing **kaspa-store.com** (that's us, not you)
- Google sends us their email
- We create a token and send them back to your site
- Your site uses that token to know who they are

**Why it works this way:** Setting up Google OAuth is a pain. You need to verify your domain, manage credentials, handle security. We did that once, and now every merchant can use it.

**The tradeoff:** Users see our name in the Google consent, not yours. Some might find that confusing. If that's a problem, use wallet-only auth.

We store:
- Their email address
- Which auth provider (Google, email magic link)
- When they signed up
- Which merchant they came from

That last part matters - we track which users belong to which merchant. You can see who signed up through your site.

---

## Fees

We charge 1-3.5% on each payment. You pick your rate.

Here's how it actually works:
- Customer pays you 100 KAS
- You get 100 KAS directly in your wallet
- We note that you owe us 1-3.5 KAS
- You pay us when you want from the dashboard

We don't skim from each transaction. We trust you to pay. The balance builds up, you pay it down. If you never pay, eventually we'd cut off the account - but we'd talk to you first.

This only works with honest people. That's fine with us.

---

## What We Don't Have

- Private keys (never leave the user's device)
- Passwords (Google handles theirs, we don't do password auth)
- Customer names or personal info beyond email
- Access to anyone's wallet balance or history
- Any way to move funds that aren't ours

---

## The OAuth Transparency Thing

I want to be clear about this because it could feel weird to merchants or users.

When your customer signs in with Google on your site, the consent screen says "kaspa-store.com wants to access your Google account" - not your site name.

This happens because:
1. Google OAuth requires a verified domain
2. We verified kaspa-store.com
3. All merchants share our OAuth credentials
4. So Google shows our name

The user is trusting us to pass their info to you honestly. We do. But they're technically giving permission to us, and we're vouching for you.

If this feels wrong for your use case:
- Use wallet-only auth (no OAuth involved)
- Set up your own Google OAuth (we can still handle the wallet connections)
- Use Keystone (it's OAuth but through their system, not Google)

---

## Who's Running This

One developer. Me (Oz). I built this because Kaspa needed payment infrastructure and nobody else was making it.

What this means:
- I fix bugs fast because I care
- Support happens when I'm not at my day job
- If I get hit by a bus, the service goes down until someone else picks it up
- No investors, no board, no quarterly targets pushing me to do shady things
- Also no 24/7 ops team or SLAs

I'm building this to be useful. If it makes money, great. If it helps Kaspa adoption, even better.

---

## Your Data

**Merchants:** 
- You can see all your payments and users in the dashboard
- Email me if you want to export everything or delete your account

**Users (customers of merchants):**
- Your data is tied to the merchant you used
- We can tell you what we have if you email us

Email: kasperolabs@gmail.com

---

## Changes

This doc gets updated when things change. Check commit history if you want to see what changed when.

January 2026: First version.


---

*I'd rather explain how everything works upfront than have someone find out later and feel deceived. If something here concerns you, ask me about it.*
