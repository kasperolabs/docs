# @kaspafy/wallet-core — API Reference

---

## How to think about this package

You already have `@kaspa/wallet` for basic wallet ops. You don't need us for that.

This package is the **composite operations** — the stuff that requires stitching 2-5 different APIs together, handling edge cases you'll only discover in production, and protocols that don't exist elsewhere.

```
npm install @kaspafy/wallet-core
```

```javascript
const {
  SmartSend,        // Send KAS to .kas domains, auto-compound, fee retry
  ActivityStream,   // Unified timeline: KAS + KRC-20 + payloads in one call
  Decoder,          // "What is this payload?" — auto-detect and parse
  UtxoDoctor,       // "Why did my send fail?" — diagnose and fix UTXO fragmentation
  Portfolio,        // "What do I own?" — KAS + tokens + domains + fiat value
  Subscriptions,    // Real-time push: watch(address, callback)
  payloads,         // Embed files on-chain (kaspanotary protocol)
  providers,        // Unified browser wallet: KasWare/Kastle/Keystone
} = require('@kaspafy/wallet-core');
```

---

## SmartSend

**What it replaces:** manually calling KNS resolve → validate address → check UTXOs → compound → build TX → handle fee error → retry → verify confirmation.

### Constructor

```javascript
const sender = new SmartSend({
  wallet,             // required — synced @kaspa/wallet instance
  rpc,                // required — @kaspa/grpc-node connection
  mnemonic,           // required — wallet mnemonic (for signing)
  kns,                // optional — KNS instance (auto-created if omitted)
  apiUrl,             // optional — default: 'https://api.kaspa.org'
  network,            // optional — 'kaspa' | 'kaspatest', default: 'kaspa'
});
```

### .send(recipient, amountKas, opts?) → Promise\<SmartSendResult\>

```javascript
const result = await sender.send('alice.kas', 10.5);
const result = await sender.send('kaspa:qz...abc', 0);  // 0 = send all
const result = await sender.send('bob.kas', 5, {
  memo: 'Coffee payment',          // plain text, embedded as payload
  payload: { invoice: 1234 },      // or structured JSON, embedded as payload
  changeAddress: 'kaspa:qr...',    // override change address
  autoCompound: true,              // default: true — fix fragmented UTXOs first
  verify: true,                    // default: false — poll until TX confirmed
  verifyTimeoutMs: 30000,          // default: 30000
});
```

**Returns:**

```javascript
{
  success: true,
  txId: 'abc123...',
  resolvedAddress: 'kaspa:qz...',      // actual address that received funds
  resolvedDomain: 'alice.kas',          // null if recipient was already an address
  amountSent: 10.5,                     // actual KAS sent (may differ for send-all)
  fee: 0.00025,                         // actual fee in KAS
  confirmed: true,                      // only if verify: true
  compounded: false,                    // true if UTXOs were auto-compacted first
  error: null,                          // string if success: false
}
```

**Edge cases it handles for you:**
- `amountKas = 0` → sends entire balance (sweep)
- Change < 0.05 KAS → automatically converts to sweep (avoids dust)
- Fee error → parses the required fee from the error message, retries with 1.1x
- Mass error → returns clear error message instead of cryptic SDK exception
- Storage mass error → tells user minimum ~1 KAS required for new addresses

---

## ActivityStream

**What it replaces:** querying Kaspa REST API for KAS txs + Kasplex API for KRC-20 ops + manually decoding payloads + merging + sorting + deduplicating.

### Constructor

```javascript
const stream = new ActivityStream({
  kaspaApi: 'https://api.kaspa.org',         // optional
  kasplexApi: 'https://api.kasplex.org/v1',  // optional
  timeout: 15000,                            // optional
});
```

### .fetch(address, opts?) → Promise\<ActivityItem[]\>

```javascript
const items = await stream.fetch('kaspa:qz...abc', {
  limit: 50,              // default: 50 — max KAS txs to fetch
  includeKRC20: true,     // default: true
  decodePayloads: true,   // default: true — auto-decode TX payloads
});
```

**Returns:** array sorted newest-first, deduplicated by txId:

```javascript
[
  {
    txId: 'abc123...',
    type: 'kas-receive',         // see types below
    timestamp: 1709123456000,    // unix ms
    amountKas: 50.0,             // signed: positive = receive, negative = send
    from: 'kaspa:qp...',        // sender (if resolvable)
    to: 'kaspa:qz...',          // recipient
    confirmations: 142,
    source: 'kaspa-api',         // or 'kasplex'
    payload: null,               // decoded payload object (if present)
    token: null,                 // KRC-20 ticker (if applicable)
    tokenAmount: null,           // KRC-20 amount string (if applicable)
  },
]
```

**Possible `type` values:**

| type | meaning |
|---|---|
| `kas-receive` | incoming KAS |
| `kas-send` | outgoing KAS |
| `kas-self` | self-transfer (compound, change) |
| `krc20-transfer` | KRC-20 token transfer |
| `krc20-mint` | KRC-20 mint |
| `krc20-deploy` | KRC-20 deploy |
| `payload-document` | kaspanotary chunk or manifest |
| `payload-structured` | structured payload (pipe-delimited) |
| `payload-hash` | SHA-256 hash embedded |
| `unknown` | couldn't classify |

---

## Decoder

**What it replaces:** staring at raw hex and guessing what it is.

### Constructor

```javascript
const decoder = new Decoder();  // no config needed
```

### .decode(payloadHex) → DecodedPayload | null

Synchronous. Give it hex, get back structured data.

```javascript
decoder.decode('496e766f696365202331323334');
// → { type: 'text', data: { text: 'Invoice #1234' }, raw: '496e...', byteSize: 13 }

decoder.decode(Buffer.from(JSON.stringify({ p: 'krc-20', op: 'transfer', tick: 'bunny', amt: '100' })).toString('hex'));
// → { type: 'krc20-inscription', data: { p: 'krc-20', op: 'transfer', ... }, ... }

decoder.decode('aa'.repeat(32));
// → { type: 'hash', data: { hash: 'aaa...' }, byteSize: 32 }
```

**Possible `type` values:**

| type | detected when |
|---|---|
| `kaspanotary-manifest` | kaspanotary header + type 0x02 |
| `kaspanotary-chunk` | kaspanotary header + type 0x01 |
| `krc20-inscription` | JSON with `{ p: 'krc-20' }` |
| `structured` | matches `PROTOCOL:VERSION\|field\|field` pattern |
| `hash` | exactly 32 bytes |
| `json` | valid JSON object or array |
| `text` | >80% printable ASCII |
| `binary` | everything else |

### .fetchAndDecode(txId, apiUrl?) → Promise\<{ tx, decoded }\>

Fetch a TX from the API and decode its payload in one call.

```javascript
const { tx, decoded } = await decoder.fetchAndDecode('abc123...txid');
// tx:      { txId, blockTime, isAccepted, senders: [], receivers: [], mass }
// decoded: { type: 'text', data: { text: '...' }, ... } or null
```

---

## UtxoDoctor

**What it replaces:** the "exceeds max mass" error that hits your users with zero warning.

### Constructor

```javascript
const doctor = new UtxoDoctor({
  wallet,       // required — synced @kaspa/wallet
  rpc,          // required — RPC connection
  mnemonic,     // required
  apiUrl,       // optional
});
```

### .diagnose() → Promise\<UTXODiagnosis\>

```javascript
const health = await doctor.diagnose();
```

**Returns:**

```javascript
{
  utxoCount: 147,
  balanceKas: 1250.5,
  largestUtxoKas: 500.0,
  smallestUtxoKas: 0.001,
  medianUtxoKas: 8.5,
  dustCount: 23,                 // UTXOs below 0.1 KAS
  needsCompound: true,
  health: 'fragmented',          // 'healthy' | 'fragmented' | 'critical'
  recommendation: '147 UTXOs — moderately fragmented...',
  maxSendableKas: 890.3,         // max you can send in a single TX right now
  compoundRounds: 2,             // estimated rounds to fix
}
```

**Health thresholds:**
- `healthy`: ≤84 UTXOs — full balance sendable in one TX
- `fragmented`: 85-168 UTXOs — large sends may fail
- `critical`: >168 UTXOs — sends will fail

### .compact(targetAddress, opts?) → Promise\<CompactResult\>

```javascript
const result = await doctor.compact('kaspa:qz...my-receive-address', {
  maxRounds: 5,                                    // default: 5
  onRound: (roundNum, txId) => console.log(roundNum, txId),  // optional progress callback
});
```

**Returns:**

```javascript
{
  success: true,
  rounds: 2,                     // how many compound TXs were sent
  txIds: ['abc...', 'def...'],   // compound TX IDs
  error: null,                   // string if success: false
}
```

**How compaction works:**
1. Tries SDK's built-in `wallet.compound()` first
2. Falls back to send-to-self at 80% of balance
3. If that fails (too many inputs), tries 60%, then 40%
4. Repeats until `diagnose()` says `needsCompound: false`

---

## Portfolio

**What it replaces:** 3 API calls (Kaspa REST + Kasplex + KNS) with manual unit math per token (each KRC-20 has different decimals) plus a CoinGecko call for pricing.

### Constructor

```javascript
const portfolio = new Portfolio({
  kaspaApi: 'https://api.kaspa.org',                      // optional
  kasplexApi: 'https://api.kasplex.org/v1',               // optional
  knsApi: 'https://api.knsdomains.org/mainnet/api/v1',    // optional
  fiatCurrency: 'usd',                                    // optional — any CoinGecko-supported currency
  timeout: 10000,                                         // optional
});
```

### .get(address) → Promise\<PortfolioResult\>

```javascript
const holdings = await portfolio.get('kaspa:qz...abc');
```

**Returns:**

```javascript
{
  kas: {
    balance: 1250.5,              // human-readable KAS
    balanceSompi: 125050000000,   // raw sompi
    fiatValue: 162.57,            // in requested fiat currency
    fiatCurrency: 'USD',
  },
  tokens: [
    {
      tick: 'BUNNY',
      balance: '5000000000000',   // raw units (from Kasplex)
      decimals: 8,
      balanceHuman: 50000,        // converted using token's decimals
      locked: '0',
      fiatValue: null,            // no per-token price oracle yet
    },
  ],
  domains: [
    {
      domain: 'alice.kas',
      isVerified: true,
      isActive: true,
      createdAt: 1708000000,
    },
  ],
  totals: {
    fiatValue: 162.57,
    assetCount: 3,                // 1 KAS + 1 token + 1 domain
    tokenCount: 1,
    domainCount: 1,
  },
  kasPrice: 0.13,                 // current KAS price
  fiatCurrency: 'USD',
  fetchedAt: 1709123456000,
}
```

**Price sources (in order):** CoinGecko → CoinCap fallback. Cached for 60 seconds.

---

## Subscriptions

**What it replaces:** raw `RpcClient.subscribeUtxosChanged()` with nested address objects, no reconnection, no debouncing, no batch subscribe.

### Constructor

```javascript
const subs = new Subscriptions({
  borshUrl: 'ws://127.0.0.1:17110',  // required — Borsh wRPC endpoint
  networkId: 'mainnet',               // optional — 'mainnet' | 'testnet-10'
  debouncMs: 2000,                    // optional — debounce rapid UTXO events
  maxReconnects: 50,                  // optional
  // Quick-wire callbacks (alternative to .on() events):
  onBalance: (addr, event) => {},     // optional
  onConfirmation: (txIds) => {},      // optional
  onDaaScore: (score) => {},          // optional
});
```

### .connect() → Promise\<void\>

```javascript
await subs.connect();
// Downloads WASM SDK, connects to Borsh endpoint, subscribes to chain events.
// Auto-reconnects with exponential backoff (2s → 4s → 8s → ... → 30s cap).
```

### .watch(address, callback, tag?) → Promise\<void\>

```javascript
await subs.watch('kaspa:qz...abc', (address, event) => {
  // event.added   = array of new UTXOs
  // event.removed = array of spent UTXOs
  console.log('Balance changed on', address);
}, { userId: 42 });  // tag is optional metadata, stored but not used
```

**Debouncing:** a single payment can fire 2-5 UTXO events in rapid succession. The callback only fires once, after `debouncMs` of silence. Default 2 seconds.

### .unwatch(address, callback?) → Promise\<void\>

```javascript
await subs.unwatch('kaspa:qz...abc');           // remove all callbacks for this address
await subs.unwatch('kaspa:qz...abc', myHandler); // remove specific callback
```

### .watchBatch(entries) → Promise\<void\>

```javascript
await subs.watchBatch([
  { address: 'kaspa:qz...', callback: handleUser1, tag: { userId: 1 } },
  { address: 'kaspa:qp...', callback: handleUser2, tag: { userId: 2 } },
]);
// Subscribes in batches of 100 to avoid overwhelming the node.
```

### Events (EventEmitter)

```javascript
subs.on('connected', () => {});
subs.on('disconnected', () => {});
subs.on('error', (err) => {});
subs.on('balance', (address, { added, removed }) => {});
subs.on('confirmations', (txIds) => {});     // TX IDs accepted into virtual chain
subs.on('daa-score', (score) => {});
```

### .getStatus() → object

```javascript
subs.getStatus();
// → { connected: true, watchedAddresses: 47, daaScore: 358492260,
//     blueScore: 358400000, stats: { eventsReceived: 1234, ... } }
```

### .disconnect() → Promise\<void\>

```javascript
await subs.disconnect();
```

---

## payloads

**What it replaces:** nothing — this protocol doesn't exist elsewhere.

All functions are standalone (not a class). Import them directly:

```javascript
const { embedDocument, reconstructDocument, estimateCost, Decoder } = require('@kaspafy/wallet-core');
// or
const payloads = require('@kaspafy/wallet-core/payloads');
```

### payloads.submitPayloadTransaction(wallet, rpc, data, opts?) → Promise

The building block. Sends one TX with arbitrary payload.

```javascript
const result = await payloads.submitPayloadTransaction(wallet, rpc, Buffer.from('hello'), {
  fixedAddress: 'kaspa:qz...',       // optional — defaults to wallet.receiveAddress
  previousOutput: null,               // optional — UTXO chain from previous TX
  transferAmountSompi: 20_000_000,    // optional — default: 0.2 KAS (returned to sender)
});
// → { txId: 'abc...', payloadSize: 5, outputUtxo: { ... } }
```

### payloads.embedHash(wallet, rpc, fileBuffer) → Promise

SHA-256 hash a file and embed just the hash (32 bytes, one TX).

```javascript
const result = await payloads.embedHash(wallet, rpc, pdfBuffer);
// → { txId: 'abc...', hash: 'a1b2c3...', payloadSize: 32 }
```

### payloads.embedStructured(wallet, rpc, data, protocol?) → Promise

Embed a pipe-delimited structured payload.

```javascript
const result = await payloads.embedStructured(wallet, rpc,
  ['field1', 'field2', 'field3'],
  'MYPROTO:1'  // optional — default: 'NOTARY:1'
);
// Embeds: "MYPROTO:1|field1|field2|field3"
```

### payloads.embedDocument(wallet, rpc, fileBuffer, metadata, callbacks?) → Promise

The big one. Embeds an entire file using chunked kaspanotary protocol.

```javascript
const result = await payloads.embedDocument(wallet, rpc, pdfBuffer, {
  fileName: 'contract.pdf',                  // required
  fileType: 'application/pdf',               // optional
  title: 'Service Agreement v2',             // optional
  creatorAddress: 'kaspa:qz...',             // optional
  creatorSignature: 'schnorr-sig-hex',       // optional
  counterpartyAddress: 'kaspa:qr...',        // optional
  counterpartySignature: null,               // optional
  note: 'Signed by both parties',            // optional
}, {
  onChunkSubmitted: (index, total, txId) => {
    console.log(`Chunk ${index + 1}/${total}: ${txId}`);
  },
});
```

**Returns:**

```javascript
{
  manifestTxId: 'xyz789...',         // THE ID — this is what you store/share
  chunkTxIds: ['abc...', 'def...'],
  fileHash: 'a1b2c3...',
  totalChunks: 3,
  totalTxs: 4,                       // chunks + manifest
  fileSize: 65000,
}
```

**Protocol details:**
- Each chunk: 22KB max (22,477 usable bytes after 51-byte binary header)
- UTXO chaining: each TX reuses the output from the previous TX (no wallet sync between chunks)
- Retry: 5 attempts per chunk, exponential backoff, orphan detection clears the chain
- Cost: ~0.00025 KAS per TX (the 0.2 KAS transfer amount is returned to sender)

### payloads.reconstructDocument(manifestTxId, apiUrl?) → Promise

Read-only. No wallet needed. Given a manifest TX ID, reconstructs the entire file.

```javascript
const doc = await payloads.reconstructDocument('xyz789...');
```

**Returns:**

```javascript
{
  file: Buffer,             // the reconstructed file
  verified: true,           // SHA-256 matches manifest hash
  manifest: {
    protocol: 'kaspanotary',
    version: 1,
    fileHash: 'a1b2c3...',
    fileName: 'contract.pdf',
    fileSize: 65000,
    chunkCount: 3,
    chunkTxIds: ['abc...', 'def...', 'ghi...'],
    // ... all other manifest fields
  },
}
```

### payloads.estimateCost(fileSize) → object

Synchronous. No network call.

```javascript
payloads.estimateCost(65000);
// → { chunkCount: 3, totalTxs: 4, feeKas: 0.001, transferKas: 0.8 }
// feeKas = estimated network fees
// transferKas = 0.2 KAS × totalTxs (returned to sender, just needs to be in wallet)
```

### payloads.verifyPayloadHash(txId, expectedHash, apiUrl?) → Promise\<boolean\>

```javascript
const valid = await payloads.verifyPayloadHash('abc...txid', 'a1b2c3...sha256');
// → true or false
```

### payloads.verifySender(txId, expectedAddress, apiUrl?) → Promise\<boolean\>

```javascript
const fromThem = await payloads.verifySender('abc...txid', 'kaspa:qz...');
// → true if that address is in the TX inputs
```

### payloads.sha256(buffer) → string

```javascript
payloads.sha256(fileBuffer);
// → 'a1b2c3d4...' (64 char hex string)
```

### payloads.chunkFile(fileBuffer, fileHash) → Buffer[]

```javascript
const chunks = payloads.chunkFile(fileBuffer, payloads.sha256(fileBuffer));
// → array of Buffers, each with 51-byte kaspanotary header + data
```

### payloads.PROTOCOL → object

```javascript
payloads.PROTOCOL;
// → { tag: 'kaspanotary', version: 1, chunkSize: 22528, transferAmountSompi: 20000000, ... }
```

### payloads.DATA_PER_CHUNK → number

```javascript
payloads.DATA_PER_CHUNK;
// → 22477 (usable bytes per chunk after header)
```

---

## providers

**What it replaces:** writing separate code for KasWare, Kastle, and Keystone, each with different method names.

```javascript
const { autoConnect, detectAll, PROVIDERS } = require('@kaspafy/wallet-core').providers;
```

### autoConnect() → Promise\<Connection | null\>

Tries each detected wallet extension in order. Returns the first one that connects.

```javascript
const conn = await autoConnect();
// → { address: 'kaspa:qz...', provider: 'kasware', balanceSompi: '125050000000' }
// → null if nothing installed
```

### detectAll() → string[]

```javascript
detectAll();
// → ['kasware', 'kastle']   (whatever's installed, no connection attempt)
```

### PROVIDERS object

Direct access to individual wallet adapters:

```javascript
PROVIDERS.kasware.detect()           // → true/false
PROVIDERS.kasware.connect()          // → { address, provider, balanceSompi }
PROVIDERS.kasware.sign(message)      // → signature
PROVIDERS.kasware.sendKas(to, sompi) // → txId
PROVIDERS.kasware.sendKRC20(payload, to)  // → commit-reveal result

PROVIDERS.kastle.detect()
PROVIDERS.kastle.connect()           // → { address, provider, publicKey }
PROVIDERS.kastle.sign(message)
PROVIDERS.kastle.sendKas(to, sompi)
PROVIDERS.kastle.sendKRC20           // → null (not supported yet)

PROVIDERS.keystone.detect()
PROVIDERS.keystone.connect()
PROVIDERS.keystone.sign(message)
PROVIDERS.keystone.sendKas           // → null
PROVIDERS.keystone.sendKRC20         // → null
```

---

## What needs what

Not every module requires the full Kaspa SDK. Use only what you need:

| Module | Needs `@kaspa/wallet`? | Needs `kaspa` WASM? | Needs network? |
|---|---|---|---|
| **Decoder** | No | No | No (or yes for fetchAndDecode) |
| **Portfolio** | No | No | Yes (REST APIs) |
| **ActivityStream** | No | No | Yes (REST APIs) |
| **SmartSend** | Yes | No | Yes |
| **UtxoDoctor** | Yes | No | Yes |
| **Subscriptions** | No | Yes (WASM + Borsh) | Yes (WebSocket) |
| **payloads** | Yes | Yes | Yes |
| **providers** | No | No | No (browser only) |

```bash
# Minimum install (Decoder, Portfolio, ActivityStream only):
npm install @kaspafy/wallet-core

# Full install (everything including WASM):
npm install @kaspafy/wallet-core @kaspa/wallet @kaspa/grpc-node kaspa isomorphic-ws
```
