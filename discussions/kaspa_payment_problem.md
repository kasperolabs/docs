# The Kaspa Payment Problem

### How do you pay with Kaspa on the web?

*A discussion paper for the Kaspa developer community*

---

## The Setup

Kaspa is fast. A transaction confirms in about one second. That's faster than tapping a credit card. The technology is there for Kaspa to function as everyday money.

But there's a gap. A big one.

If you're a merchant and you want to accept Kaspa on your website, what do you do? If you're a wallet builder and your users want to pay for something online, how do you make that happen? If you're a user and you see "Pay with Kaspa" on a checkout page, what actually happens when you click it?

Today, the honest answer is: it's complicated, and nobody has agreed on how it should work.

This document isn't proposing a solution. It's trying to articulate the problem clearly enough that we can have a real conversation about it.

---

## The Problem in One Sentence

There is no standard way for a merchant to request a Kaspa payment and for a wallet to fulfill it.

That's it. Everything else flows from this.

---

## What "Pay with Kaspa" Looks Like Today

### The Copy-Paste Method

The merchant displays a Kaspa address. The user copies it, opens their wallet (wherever it lives), pastes the address, types the amount, and sends.

This works the way writing a check works. It's technically functional. But the merchant has no confirmation callback. There's no reference ID linking the payment to an order. The user can fat-finger the amount. And the merchant is left watching the blockchain trying to match incoming transactions to open orders.

For a $5 purchase, nobody is going to do this.

### The Extension Wallet Method

Kasware and Kastle inject a provider into the browser. A merchant site can call something like `kasware.sendTransaction({ to, amount })` and the extension pops up, the user confirms, done.

This works well for people who have the extension installed. But it requires installation, it's browser-specific, it doesn't exist on mobile, and it ties the merchant to a specific wallet's API. If you build your checkout for Kasware and the user has Kastle, it doesn't work without the merchant integrating both. And the next wallet that comes along? They need another integration.

### The Embedded Wallet Method (iframe)

A wallet provider embeds their wallet inside the merchant's site via iframe. The user interacts with the wallet directly on the merchant's page.

This feels seamless until you hit the wall: modern browsers block third-party cookies and localStorage in iframes. The wallet can't remember who the user is between sessions. Every visit, every payment, the user starts from scratch. Safari already blocks this completely. Firefox too. Chrome is following.

This isn't a bug that will be fixed. It's a deliberate privacy protection that's getting stricter over time.

### The OAuth/Redirect Method

The merchant redirects the user to the wallet's website, the user authenticates and approves the payment on the wallet's domain (where storage works fine), and then gets redirected back to the merchant.

This is how "Pay with PayPal" works. It solves the persistence problem because the user is on the wallet's actual domain. But it requires each wallet to implement an OAuth server, each merchant to register with each wallet, and the integration complexity scales with the number of wallets a merchant wants to support.

It works great when there's one dominant wallet (like PayPal). It works less great in an ecosystem with multiple competing wallets.

### The Payment Processor Method

A middleman sits between the merchant and the wallet. The merchant integrates once with the processor. The processor integrates with each wallet. The processor handles authentication, payment execution, confirmation, and callbacks.

This is how Stripe works for credit cards. It solves the N×M integration problem (N merchants × M wallets) by reducing it to N+M (each merchant and each wallet integrates once with the processor).

But it introduces centralization. All payments flow through someone's server. That someone charges fees. And if that someone goes down, the payment infrastructure goes down. For a cryptocurrency that values decentralization, this feels like a step backward.

---

## The Tensions

Every approach involves a tradeoff. Here are the tensions that make this hard:

### Convenience vs. Installation

Browser extensions are the smoothest payment experience today, but they require the user to install something. Web wallets require nothing, but they can't persist state when embedded on other sites. You either ask the user to install something or you deal with the iframe problem.

### Decentralization vs. Coordination

Without a middleman, every merchant needs to integrate with every wallet. With a middleman, you have a single point of failure and a gatekeeper. The crypto ethos says decentralize everything, but the practical reality is that some coordination layer is needed for payments to work at scale.

### Security vs. Simplicity

Any payment request that travels from a merchant to a wallet can be tampered with. The amount can be changed, the recipient address can be swapped. Securing this requires either signed requests (which means shared secrets, which means registration, which means complexity) or an intermediary that both sides trust.

A completely open, unsigned payment request is trivially exploitable. A fully secured one requires infrastructure that looks a lot like the traditional payment systems crypto was supposed to replace.

### Wallet Sovereignty vs. Standardization

Each wallet builder wants to offer unique features and user experiences. But if every wallet handles payments differently, merchants won't integrate with any of them. Standardization enables adoption but constrains innovation. No wallet wants to be told how to handle payments, but without agreement, none of them can handle payments outside their own domain.

### User Experience vs. Self-Custody

The smoothest payment experience is fully custodial - the processor holds the keys, the user just clicks "pay," done. The most sovereign experience has the user signing every transaction manually with their hardware wallet. Every point on this spectrum is a valid choice, and a payment standard needs to work for all of them.

---

## What Other Ecosystems Did

### Bitcoin: BIP-70 (Payment Protocol)

Bitcoin tried to solve this in 2013 with BIP-70. It defined a payment request format: the merchant creates a signed request specifying the amount, address, and metadata. The wallet parses it, shows the user the details, and sends the payment.

It was elegant in theory. In practice, it was barely adopted. Wallets didn't want to implement it. The signing requirements were complex. And the rise of the Lightning Network shifted attention away from on-chain payment flows entirely.

BIP-70 was deprecated in 2020. But the problem it tried to solve never went away.

### Ethereum: WalletConnect and EIP-681

Ethereum has WalletConnect, which creates an encrypted tunnel between a wallet and a dApp. The dApp proposes a transaction, the wallet signs it. It works across mobile and desktop, doesn't require browser extensions, and is wallet-agnostic.

The tradeoff: WalletConnect relies on relay servers. It's not truly peer-to-peer. And the UX involves scanning QR codes or clicking deep links, which works but isn't as smooth as a native browser integration.

EIP-681 defines a URI format for payment requests: `ethereum:0xAddress?value=1000000000000000000`. Any wallet that understands the URI can handle it. Simple, but no callback mechanism - the merchant doesn't know when payment is complete without watching the chain.

### Traditional Web: Payment Request API

The W3C defined a browser-native payment flow - the Payment Request API. A merchant calls `new PaymentRequest(...)` and the browser handles the rest, including showing available payment methods, authenticating the user, and returning the result.

Google Pay and Apple Pay work through this API. It's the cleanest UX possible because the browser itself is the intermediary.

But it's designed for traditional payment methods. Adding cryptocurrency support would require wallets to register as payment handlers through service workers, which is still experimental and only works in Chromium browsers.

---

## What Does Kaspa Specifically Need?

Setting aside what other ecosystems did, what are the minimum requirements for "Pay with Kaspa" to work on the open web?

**1. A merchant needs to express a payment request.**
"I need X KAS sent to address Y, for order Z."

**2. A wallet needs to receive that request.**
Regardless of whether it's a web wallet, mobile wallet, extension, or desktop app.

**3. The user needs to confirm it.**
They need to see what they're paying, to whom, and for what, and they need to approve it explicitly.

**4. The wallet needs to execute the transaction.**
Sign it, broadcast it, whatever the wallet's architecture requires.

**5. The merchant needs to know it happened.**
A callback, a webhook, something. The merchant can't just watch the blockchain and hope.

**6. All of this needs to be secure.**
The payment request can't be tampered with. The callback can't be spoofed. The user can't be tricked into paying the wrong address or the wrong amount.

That's six requirements. Any solution that covers all six works. Any solution that misses one of them is incomplete.

---

## The Questions Worth Discussing

This is where it gets interesting, and where the Kaspa community needs to weigh in.

**Should wallets talk to merchants directly, or through intermediaries?**
Direct communication is more decentralized. Intermediaries are more practical. Is there a hybrid?

**Should we standardize a payment request format?**
A URI scheme? A JSON payload? Something on-chain? If yes, who defines it and who adopts it first?

**How should the callback work?**
The merchant needs confirmation. Does the wallet POST to a callback URL? Does the merchant poll the blockchain? Does a shared indexer provide the confirmation? Each option has reliability and trust implications.

**What secures the payment request?**
Signed by the merchant? Verified by an intermediary? Protected by TLS alone? How do we prevent address and amount manipulation without requiring complex registration between every merchant and every wallet?

**Can Kaspa's upcoming features change the equation?**
Covenant++ (KIP-17) could enable on-chain payment requests - smart contracts that define the terms and auto-execute when conditions are met. Does that make the off-chain discussion moot, or do we need something that works now while we wait?

**Is a transitional architecture acceptable?**
Maybe the answer today involves intermediaries, and the answer in two years is fully on-chain. Is the community comfortable with a pragmatic short-term solution that evolves?

---

## A Starting Point, Not an Answer

The fact that multiple teams in the Kaspa ecosystem are independently hitting this same wall - web wallets that can't pay outside their domain, merchants with no standard to integrate against, mobile wallets with no callback mechanism - suggests this is a foundational gap, not an edge case.

Kaspa's speed makes it technically capable of being used as everyday money. But "technically capable" and "practically usable" are separated by exactly the kind of infrastructure discussed here.

This document doesn't have the answer. But maybe by naming the problem clearly, we can stop solving it individually and start solving it together.

---

*Written by Kaspero Labs for the Kaspa builder community. Contributions and perspectives welcome.*
