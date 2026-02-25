# Embedding Arbitrary Payloads on Kaspa L1

**A Technical Reference for Developers**

*Author: Kaspero Labs LLC*
*Protocol: kaspanotary v1*
*Last updated: February 2026*

---

## 1. Overview

Kaspa transactions support an arbitrary `payload` field — a hex-encoded byte array that is included in the transaction body, committed to the sighash (as of kaspad 1.1.0+), and permanently stored on the blockDAG. This means any data you embed in a transaction payload is immutable, publicly readable, and cryptographically bound to the transaction's signature.

This guide covers everything needed to:

- Submit a single transaction with arbitrary payload data (a hash, a message, a JSON blob)
- Chunk and embed entire files across multiple transactions with a manifest for reassembly
- Sign messages with Schnorr signatures via browser wallet extensions (KasWare, Kastle, Keystone)
- Retrieve and verify payloads from the public Kaspa REST API
- Reconstruct files from on-chain chunks without any centralized infrastructure

The code in this document is production-tested. It powers KaspaNotary (kaspanotary.com), which has notarized real legal documents on mainnet.

---

## 2. Prerequisites

### 2.1 Node.js Dependencies

```json
{
  "dependencies": {
    "@aspect-build/kaspa-wasm": "file:./kaspa-wasm-v1/kaspa",
    "@kaspa/wallet": "^1.x",
    "@kaspa/grpc-node": "^1.x",
    "node-fetch": "^2.x"
  }
}
```

The `kaspa-wasm` module is the Kaspa WASM SDK compiled for Node.js. It provides `createTransaction`, `signTransaction`, and `PrivateKey` — the three primitives needed for building and signing payload transactions.

For browser-side operations, wallet extensions (KasWare, Kastle, Keystone) handle signing. Your frontend never touches private keys.

### 2.2 Infrastructure

- **Kaspa node** accessible via gRPC (for submitting transactions)
- **Public REST API** at `https://api.kaspa.org` (for reading transactions — no auth required)
- **A funded Kaspa wallet** with enough KAS to cover fees (miner fees only — your transfer amount returns to you via self-send)

---

## 3. Core Concept: The Self-Send Payload Transaction

The fundamental pattern for embedding data on Kaspa is a **self-send transaction with a payload**:

1. You select a UTXO you own
2. You create a transaction that sends the funds back to yourself, minus the miner fee
3. You attach your data as the transaction payload (hex-encoded)
4. You sign and broadcast

The payload is included in the sighash, so it cannot be tampered with after signing. The cost is the miner fee only — typically ~0.00003 KAS for a small payload, scaling up for larger payloads.

---

## 4. Payload Recipe 1: Embedding a Hash (32 bytes)

The simplest use case. Embed a SHA-256 hash as proof that a document existed at a specific time.

### 4.1 Constructing the Payload

```javascript
const crypto = require('crypto');

// Your document
const fileBuffer = fs.readFileSync('contract.pdf');

// SHA-256 → 64 hex characters → 32 bytes on-chain
const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
// e.g. "a3f2b8c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1"
```

That 64-character hex string *is* your payload. At 32 bytes, it fits trivially in a single transaction.

### 4.2 Structured Payload Format

For applications that need to identify the payload type, use a structured format:

```javascript
// KaspaNotary seal payload format:
// NOTARY:1|partyA_wallet|partyB_wallet|sha256_hash
function buildSealPayload(partyAWallet, partyBWallet, pdfHash) {
    return ['NOTARY:1', partyAWallet, partyBWallet || 'SELF', pdfHash].join('|');
}

// Example output:
// "NOTARY:1|kaspa:qz...|kaspa:qr...|a3f2b8c9d4e5..."
```

Convert to hex for the transaction:

```javascript
const payloadHex = Buffer.from(payloadString, 'utf8').toString('hex');
```

---

## 5. The Transaction Builder: `submitPayloadTransaction()`

This is the core function. It selects a UTXO, builds a transaction with your payload, signs it with the WASM SDK, and submits it via gRPC.

### 5.1 Complete Implementation

```javascript
const crypto = require('crypto');

// Protocol constants
const PROTOCOL = {
    chunkSize: 22 * 1024,           // 22KB per transaction payload
    transferAmountSompi: 20000000,   // 0.2 KAS (returns to sender)
    subnetworkId: '0000000000000000000000000000000000000000',
    maxRetries: 5,
    retryDelayMs: 5000,
};

/**
 * Submit a single transaction with payload data to the Kaspa network.
 *
 * @param {Object} wallet   - A synced @kaspa/wallet instance
 * @param {Object} rpc      - A connected @kaspa/grpc-node RPC instance
 * @param {Buffer|string} data - Raw data (Buffer) or hex string to embed
 * @param {Object} [opts]   - Options
 * @param {string} [opts.fixedAddress]    - Pin to this address (for UTXO chaining)
 * @param {Object} [opts.previousOutput]  - Chain from a previous TX output
 * @returns {Promise<{txId: string, payloadSize: number, outputUtxo: Object}>}
 */
async function submitPayloadTransaction(wallet, rpc, data, opts = {}) {
    const kaspa = require('./kaspa-wasm-v1/kaspa');
    const payloadHex = Buffer.isBuffer(data) ? data.toString('hex') : data;

    // Dynamic fee calculation: base overhead + payload bytes
    const payloadBytes = payloadHex.length / 2;
    const estimatedMass = 300 + payloadBytes;
    const fee = Math.max(3000, Math.ceil(estimatedMass * 1.5));

    const addr = opts.fixedAddress || wallet.receiveAddress;

    let utxoTxId, utxoOutputIndex, utxoAmount, daaScore, privKeyHex, fullScript;

    if (opts.previousOutput) {
        // ── UTXO chaining: use the output from the previous TX ──
        utxoTxId       = opts.previousOutput.txId;
        utxoOutputIndex = opts.previousOutput.outputIndex;
        utxoAmount     = opts.previousOutput.amount;
        daaScore       = opts.previousOutput.daaScore;
        fullScript     = opts.previousOutput.scriptPubKey;

        const keypair = wallet.addressManager.receiveAddress.keypairs[addr];
        if (!keypair) {
            throw new Error(`No private key found for address ${addr}`);
        }
        privKeyHex = keypair.toBuffer().toString('hex');
    } else {
        // ── First TX: use wallet's composeTx for UTXO selection ──
        const txInfo = wallet.composeTx({
            toAddr: addr,
            amount: opts.transferAmountSompi || PROTOCOL.transferAmountSompi,
            fee: fee,
            changeAddrOverride: addr,
            privKeysInfo: true
        });

        const utxo      = txInfo.utxos[0];
        utxoTxId        = utxo.txId;
        utxoOutputIndex = utxo.outputIndex;
        utxoAmount      = utxo.satoshis;
        daaScore        = Number(utxo.blockDaaScore);
        privKeyHex      = txInfo.privKeys[0].toBuffer().toString('hex');
        fullScript      = utxo.scriptPubKey;
    }

    const outputAmount = utxoAmount - fee;

    // ── Build UTXO entries in WASM SDK format ──
    const utxoEntries = [{
        entry: {
            address: {
                version: 'PubKey',
                prefix: 'kaspa',
                payload: addr.replace('kaspa:', '')
            },
            outpoint: {
                transactionId: utxoTxId,
                index: utxoOutputIndex
            },
            amount: utxoAmount,
            scriptPublicKey: { version: 0, script: fullScript },
            blockDaaScore: daaScore,
            isCoinbase: false
        },
        outpoint: {
            transactionId: utxoTxId,
            index: utxoOutputIndex
        },
        address: {
            version: 'PubKey',
            prefix: 'kaspa',
            payload: addr.replace('kaspa:', '')
        },
        amount: utxoAmount,
        isCoinbase: false,
        blockDaaScore: daaScore,
        scriptPublicKey: { version: 0, script: fullScript }
    }];

    const outputs = [{ address: addr, amount: BigInt(outputAmount) }];

    // ── Create transaction WITH payload ──
    // The payload is included in the sighash on kaspad 1.1.0+
    const tx = kaspa.createTransaction(utxoEntries, outputs, BigInt(fee), payloadHex, 1);

    // ── Sign with WASM SDK ──
    const pk = new kaspa.PrivateKey(privKeyHex);
    kaspa.signTransaction(tx, [pk], true);

    // ── Serialize for RPC submission ──
    const signed = JSON.parse(tx.serializeToSafeJSON());

    const rpcTX = {
        transaction: {
            version: signed.version,
            inputs: signed.inputs.map(inp => ({
                previousOutpoint: {
                    transactionId: inp.transactionId,
                    index: inp.index
                },
                signatureScript: inp.signatureScript,
                sequence: Number(inp.sequence),
                sigOpCount: inp.sigOpCount
            })),
            outputs: signed.outputs.map(out => ({
                amount: Number(out.value),
                scriptPublicKey: {
                    version: 0,
                    scriptPublicKey: out.scriptPublicKey.substring(4)
                }
            })),
            lockTime: Number(signed.lockTime),
            subnetworkId: signed.subnetworkId,
            gas: Number(signed.gas),
            payload: signed.payload
        },
        allowOrphan: true
    };

    // ── Submit ──
    const result = await rpc.submitTransaction(rpcTX);

    // Handle response variants
    let txId;
    if (typeof result === 'string') {
        txId = result;
    } else if (result.transactionId) {
        txId = result.transactionId;
    } else {
        const resultStr = JSON.stringify(result);
        const mempoolMatch = resultStr.match(
            /transaction ([a-f0-9]{64}) is already in the mempool/
        );
        if (mempoolMatch) {
            txId = mempoolMatch[1]; // Already accepted — success
        } else if (resultStr.includes('is an orphan')) {
            throw new Error(`Orphan transaction (UTXO not yet available): ${resultStr}`);
        } else if (resultStr.includes('error') || resultStr.includes('Rejected')) {
            throw new Error(`Transaction rejected: ${resultStr}`);
        } else {
            txId = resultStr;
        }
    }

    return {
        txId,
        payloadSize: payloadHex.length / 2,
        outputUtxo: {
            txId,
            outputIndex: 0,
            amount: outputAmount,
            daaScore: daaScore,
            scriptPubKey: fullScript,
        },
    };
}
```

### 5.2 Usage: Embed a Simple Hash

```javascript
const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

const result = await submitPayloadTransaction(wallet, rpc, hash);
console.log(`Embedded on-chain: ${result.txId}`);
// Verify at: https://explorer.kaspa.org/txs/{txId}
```

### 5.3 Fee Calculation

Fees are dynamic and based on payload size:

```
estimatedMass = 300 (base tx overhead) + payloadBytes
fee = max(3000 sompi, ceil(estimatedMass × 1.5))
```

At minimum, a transaction costs 3000 sompi (0.00003 KAS). A full 22KB chunk costs approximately 33,750 sompi (~0.00034 KAS).

---

## 6. Payload Recipe 2: Embedding Entire Files (Multi-TX Chunking)

For payloads larger than ~22KB, you need to split the data across multiple transactions, then submit a manifest transaction that lists all the chunk TX IDs for reassembly.

### 6.1 Protocol Header Format

Every chunk and manifest transaction is prefixed with a binary header:

```
Offset  Size     Field
──────  ───────  ──────────────────────────────────
0       1 byte   Tag length (N)
1       N bytes  Tag string ("kaspanotary" = 12 bytes)
N+1     1 byte   Protocol version (0x01)
N+2     1 byte   Type: 0x01 = data chunk, 0x02 = manifest
N+3     2 bytes  Chunk index (uint16 LE)
N+5     2 bytes  Total chunks (uint16 LE)
N+7     32 bytes File SHA-256 hash
N+39    ...      Payload data (chunk bytes or manifest JSON)
```

Total header size for "kaspanotary" tag: **1 + 12 + 1 + 1 + 2 + 2 + 32 = 51 bytes**

This leaves **22,477 bytes** of usable data per 22KB chunk.

### 6.2 File Chunking

```javascript
function chunkFile(fileBuffer, fileHash) {
    const tag = Buffer.from('kaspanotary', 'utf8');
    const hashBytes = Buffer.from(fileHash, 'hex');

    const headerSize = 1 + tag.length + 1 + 1 + 2 + 2 + 32; // 51 bytes
    const dataPerChunk = (22 * 1024) - headerSize;            // 22,477 bytes

    const totalChunks = Math.ceil(fileBuffer.length / dataPerChunk);
    const chunks = [];

    for (let i = 0; i < totalChunks; i++) {
        const start = i * dataPerChunk;
        const end = Math.min(start + dataPerChunk, fileBuffer.length);
        const chunkData = fileBuffer.slice(start, end);

        const header = Buffer.alloc(headerSize);
        let offset = 0;

        header.writeUInt8(tag.length, offset);       offset += 1;
        tag.copy(header, offset);                    offset += tag.length;
        header.writeUInt8(1, offset);                offset += 1;  // version
        header.writeUInt8(0x01, offset);             offset += 1;  // type: data chunk
        header.writeUInt16LE(i, offset);             offset += 2;  // chunk index
        header.writeUInt16LE(totalChunks, offset);   offset += 2;  // total chunks
        hashBytes.copy(header, offset);              offset += 32; // file hash

        chunks.push(Buffer.concat([header, chunkData]));
    }

    return chunks;
}
```

### 6.3 Building the Manifest

After all chunks are submitted, you build and submit a manifest — a JSON payload wrapped in the same header format but with type `0x02`:

```javascript
function buildManifest(params) {
    const manifest = {
        protocol: 'kaspanotary',
        version: 1,
        type: 'manifest',
        fileHash: params.fileHash,
        fileName: params.fileName,
        fileSize: params.fileSize,
        fileType: params.fileType || 'application/octet-stream',
        title: params.title,
        chunkCount: params.chunkTxIds.length,
        chunkTxIds: params.chunkTxIds,
        creatorAddress: params.creatorAddress,
        creatorSignature: params.creatorSignature || null,
        counterpartyAddress: params.counterpartyAddress || null,
        counterpartySignature: params.counterpartySignature || null,
        note: params.note || null,
        timestamp: Date.now(),
    };

    const jsonBuf = Buffer.from(JSON.stringify(manifest), 'utf8');

    // Wrap in protocol header with type 0x02 (manifest)
    const tag = Buffer.from('kaspanotary', 'utf8');
    const hashBytes = Buffer.from(params.fileHash, 'hex');
    const headerSize = 1 + tag.length + 1 + 1 + 2 + 2 + 32;

    const header = Buffer.alloc(headerSize);
    let offset = 0;

    header.writeUInt8(tag.length, offset);       offset += 1;
    tag.copy(header, offset);                    offset += tag.length;
    header.writeUInt8(1, offset);                offset += 1;  // version
    header.writeUInt8(0x02, offset);             offset += 1;  // type: manifest
    header.writeUInt16LE(0, offset);             offset += 2;  // index 0
    header.writeUInt16LE(1, offset);             offset += 2;  // total 1
    hashBytes.copy(header, offset);              offset += 32;

    return Buffer.concat([header, jsonBuf]);
}
```

### 6.4 End-to-End: `embedDocument()`

This orchestrates the full flow — chunk, submit each chunk, build manifest, submit manifest:

```javascript
async function embedDocument(wallet, rpc, fileBuffer, metadata, callbacks = {}) {
    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
        throw new Error('fileBuffer must be a non-empty Buffer');
    }

    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const fixedAddress = metadata.walletAddress || wallet.receiveAddress;
    const chunks = chunkFile(fileBuffer, fileHash);

    console.log(`Embedding: ${metadata.fileName}`);
    console.log(`Size: ${fileBuffer.length} bytes | Chunks: ${chunks.length}`);
    console.log(`Estimated fees: ~${(chunks.length * 0.0003).toFixed(4)} KAS`);

    const chunkTxIds = [];
    let lastOutput = null;

    // ── Submit each chunk, chaining UTXOs ──
    for (let i = 0; i < chunks.length; i++) {
        let submitted = false;

        for (let attempt = 0; attempt < PROTOCOL.maxRetries; attempt++) {
            try {
                const txOpts = { fixedAddress };
                if (lastOutput) {
                    txOpts.previousOutput = lastOutput;
                }

                const result = await submitPayloadTransaction(
                    wallet, rpc, chunks[i], txOpts
                );

                chunkTxIds.push(result.txId);
                lastOutput = result.outputUtxo;
                submitted = true;

                console.log(`Chunk ${i + 1}/${chunks.length}: ${result.txId}`);

                if (callbacks.onChunkSubmitted) {
                    callbacks.onChunkSubmitted(i, chunks.length, result.txId);
                }

                // Small delay between chunks (500ms — UTXOs are chained, no sync needed)
                if (i < chunks.length - 1) await sleep(500);
                break;

            } catch (err) {
                const willRetry = attempt < PROTOCOL.maxRetries - 1;
                console.error(`Chunk ${i + 1} attempt ${attempt + 1} failed: ${err.message}`);

                if (callbacks.onError) callbacks.onError(i, err, willRetry);

                if (willRetry) {
                    await sleep(PROTOCOL.retryDelayMs * (attempt + 1));
                    try { await wallet.sync(true); } catch (_) {}
                    // Orphan errors mean the previous TX isn't confirmed yet
                    if (err.message.includes('Orphan') || err.message.includes('orphan')) {
                        lastOutput = null; // Force composeTx on retry
                    }
                }
            }
        }

        if (!submitted) {
            throw new Error(`Failed to submit chunk ${i + 1}/${chunks.length}`);
        }
    }

    // ── Submit manifest ──
    const manifestPayload = buildManifest({
        fileHash,
        fileName: metadata.fileName,
        fileSize: fileBuffer.length,
        fileType: metadata.fileType,
        title: metadata.title,
        chunkTxIds,
        creatorAddress: metadata.creatorAddress || fixedAddress,
        creatorSignature: metadata.creatorSignature,
        counterpartyAddress: metadata.counterpartyAddress,
        counterpartySignature: metadata.counterpartySignature,
        note: metadata.note,
    });

    await sleep(500);

    const manifestResult = await submitPayloadTransaction(
        wallet, rpc, manifestPayload, {
            fixedAddress,
            previousOutput: lastOutput
        }
    );

    console.log(`Manifest: ${manifestResult.txId}`);

    if (callbacks.onManifestSubmitted) {
        callbacks.onManifestSubmitted(manifestResult.txId);
    }

    return {
        manifestTxId: manifestResult.txId,
        chunkTxIds,
        fileHash,
        totalTransactions: chunkTxIds.length + 1,
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 6.5 Cost Estimation

```javascript
function estimateCost(fileSize) {
    const headerSize = 51; // kaspanotary header
    const dataPerChunk = (22 * 1024) - headerSize;
    const chunkCount = Math.ceil(fileSize / dataPerChunk);
    const totalTransactions = chunkCount + 1; // chunks + manifest

    const chunkMass = 300 + (22 * 1024);
    const feePerChunkSompi = Math.max(3000, Math.ceil(chunkMass * 1.5));
    const manifestFee = 3000;
    const totalFeeSompi = (chunkCount * feePerChunkSompi) + manifestFee;

    return {
        chunkCount,
        totalTransactions,
        estimatedFeeSompi: totalFeeSompi,
        estimatedFeeKas: totalFeeSompi / 1e8,
        dataPerChunk,
    };
}

// Examples:
// 50 KB file  →  3 chunks + 1 manifest = 4 TXs, ~0.0014 KAS
// 1 MB file   → 46 chunks + 1 manifest = 47 TXs, ~0.016 KAS
// 10 MB file  → 456 chunks + 1 manifest = 457 TXs, ~0.155 KAS
```

---

## 7. Payload Recipe 3: Schnorr Message Signing (Browser Wallet)

This approach doesn't embed data in a transaction payload. Instead, the user signs a message with their wallet's private key, producing a Schnorr signature that proves they endorsed a specific piece of data. The signature is stored off-chain (in your database) but is independently verifiable by anyone who has the message, signature, and public key.

### 7.1 The Signed Message Format

```javascript
// Format: KASPA_NOTARY|documentHash|unixTimestamp
function buildSignMessage(docHash) {
    const ts = Math.floor(Date.now() / 1000);
    return {
        message: 'KASPA_NOTARY|' + docHash + '|' + ts,
        timestamp: ts
    };
}

// Example output:
// "KASPA_NOTARY|a3f2b8c9d4e5f6a7b8c9d0e1...|1708900000"
```

The message binds the signature to a specific document hash at a specific time. Anyone can verify the signature against the signer's public key.

### 7.2 Browser Wallet Detection

```javascript
function detectWallet() {
    if (window.kasware) {
        return window.kasware.requestAccounts()
            .then(accounts => ({ address: accounts[0], provider: 'kasware' }));
    }
    if (window.kastle) {
        return window.kastle.connect('mainnet')
            .then(() => window.kastle.getAccount())
            .then(account => ({ address: account.address, provider: 'kastle' }));
    }
    if (window.keystone) {
        return window.keystone.requestAccounts()
            .then(accounts => ({
                address: Array.isArray(accounts) ? accounts[0] : accounts,
                provider: 'keystone'
            }));
    }
    return Promise.resolve(null);
}
```

### 7.3 Requesting a Schnorr Signature

```javascript
/**
 * Request the connected wallet to sign a message.
 * Returns { signature: hexString, publicKey: hexString|null }
 */
function walletSignMessage(message, provider) {
    if (provider === 'kasware' && window.kasware && window.kasware.signMessage) {
        return Promise.all([
            window.kasware.signMessage(message),
            window.kasware.getPublicKey()
        ]).then(([signature, publicKey]) => ({ signature, publicKey }));
    }

    if (provider === 'kastle' && window.kastle) {
        return window.kastle.signMessage(message)
            .then(sig => ({ signature: sig, publicKey: null }));
        // Kastle doesn't expose getPublicKey — derive server-side if needed
    }

    if (provider === 'keystone' && window.keystone && window.keystone.signMessage) {
        return window.keystone.signMessage(message)
            .then(sig => ({ signature: sig, publicKey: null }));
    }

    return Promise.reject(new Error('Connected wallet does not support message signing'));
}
```

### 7.4 Complete Signing Flow (Frontend)

```javascript
async function signDocument(docHash) {
    // 1. Detect and connect wallet
    const wallet = await detectWallet();
    if (!wallet) throw new Error('No Kaspa wallet detected');

    // 2. Build the message
    const { message, timestamp } = buildSignMessage(docHash);

    // 3. Request signature from wallet extension
    const { signature, publicKey } = await walletSignMessage(message, wallet.provider);

    // 4. Submit to your backend
    const response = await fetch(`/api/documents/${docUuid}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            signature: {
                type: 'schnorr',
                schnorr_signature: signature,
                public_key: publicKey,
                signed_message: message,
                sign_timestamp: timestamp,
                wallet_provider: wallet.provider,
                typed_name: userName // optional human-readable name
            },
            agreed: true
        })
    });

    return response.json();
}
```

### 7.5 What Gets Stored

The backend stores the signature data as JSON:

```json
{
    "type": "schnorr",
    "schnorr_signature": "3045022100...",
    "public_key": "02ab3c...",
    "signed_message": "KASPA_NOTARY|a3f2b8...|1708900000",
    "sign_timestamp": 1708900000,
    "wallet_address": "kaspa:qz...",
    "wallet_provider": "kasware",
    "typed_name": "John Doe",
    "agreed": true,
    "timestamp": "2026-02-25T12:00:00.000Z"
}
```

This is independently verifiable: given the `signed_message`, `schnorr_signature`, and `public_key`, anyone can confirm the signature is valid using Kaspa's Schnorr verification without trusting your server.

---

## 8. Reading Payloads Back: The Public REST API

All payload data is publicly readable through the Kaspa REST API. No authentication, no wallet, no RPC connection needed.

### 8.1 Fetching a Transaction

```javascript
const KASPA_API = 'https://api.kaspa.org';

async function fetchTransaction(txId) {
    const url = `${KASPA_API}/transactions/${txId}` +
                `?inputs=true&outputs=true&resolve_previous_outpoints=no`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Kaspa API error: ${response.status} for TX ${txId}`);
    }
    return response.json();
}
```

The response includes a `payload` field — the hex-encoded payload data. For a hash-only transaction, decode it directly:

```javascript
const tx = await fetchTransaction('abc123...');

if (tx.payload) {
    const payloadBuffer = Buffer.from(tx.payload, 'hex');
    const payloadText = payloadBuffer.toString('utf8');
    console.log('Payload:', payloadText);
    // "NOTARY:1|kaspa:qz...|kaspa:qr...|a3f2b8c9d4e5..."
}
```

### 8.2 Parsing Protocol Headers

For kaspanotary-formatted payloads (chunked files and manifests):

```javascript
function parsePayload(buf) {
    let offset = 0;

    const tagLen = buf.readUInt8(offset);              offset += 1;
    const tag = buf.slice(offset, offset + tagLen)
                   .toString('utf8');                   offset += tagLen;
    const version = buf.readUInt8(offset);             offset += 1;
    const type = buf.readUInt8(offset);                offset += 1;
    const chunkIndex = buf.readUInt16LE(offset);       offset += 2;
    const totalChunks = buf.readUInt16LE(offset);      offset += 2;
    const fileHash = buf.slice(offset, offset + 32)
                        .toString('hex');               offset += 32;
    const data = buf.slice(offset);

    return { tag, version, type, chunkIndex, totalChunks, fileHash, data };
}

// Usage:
const tx = await fetchTransaction(manifestTxId);
const buf = Buffer.from(tx.payload, 'hex');
const parsed = parsePayload(buf);

if (parsed.tag === 'kaspanotary' && parsed.type === 0x02) {
    const manifest = JSON.parse(parsed.data.toString('utf8'));
    console.log('Document:', manifest.title);
    console.log('Chunks:', manifest.chunkCount);
    console.log('File hash:', manifest.fileHash);
}
```

---

## 9. Reconstructing Files from the Blockchain

Given a manifest TX ID, you can reconstruct the entire original file using only the public API:

```javascript
async function reconstructDocument(manifestTxId) {
    // 1. Fetch manifest
    const manifestTx = await fetchTransaction(manifestTxId);
    if (!manifestTx.payload) {
        throw new Error('Transaction has no payload');
    }

    const manifestBuf = Buffer.from(manifestTx.payload, 'hex');
    const parsed = parsePayload(manifestBuf);

    if (parsed.tag !== 'kaspanotary' || parsed.type !== 0x02) {
        throw new Error('Not a kaspanotary manifest');
    }

    const manifest = JSON.parse(parsed.data.toString('utf8'));

    console.log(`Retrieving "${manifest.title}" — ${manifest.chunkCount} chunks`);

    // 2. Fetch each chunk and extract data
    const chunkBuffers = [];

    for (let i = 0; i < manifest.chunkTxIds.length; i++) {
        const chunkTx = await fetchTransaction(manifest.chunkTxIds[i]);
        if (!chunkTx.payload) {
            throw new Error(`Chunk ${i} has no payload`);
        }

        const chunkBuf = Buffer.from(chunkTx.payload, 'hex');
        const chunkParsed = parsePayload(chunkBuf);

        if (chunkParsed.type !== 0x01) {
            throw new Error(`Expected data chunk at index ${i}`);
        }

        chunkBuffers.push(chunkParsed.data);
    }

    // 3. Reassemble
    const file = Buffer.concat(chunkBuffers);

    // 4. Verify hash
    const computedHash = crypto.createHash('sha256').update(file).digest('hex');
    const verified = computedHash === manifest.fileHash;

    if (verified) {
        console.log(`Verified. Hash: ${manifest.fileHash}`);
    } else {
        console.warn(`HASH MISMATCH. Expected: ${manifest.fileHash}, Got: ${computedHash}`);
    }

    return {
        file,        // Buffer — write to disk or serve to client
        manifest,    // Full manifest metadata
        verified,    // boolean
        fileHash: manifest.fileHash,
    };
}

// Usage:
const result = await reconstructDocument('abc123...');
if (result.verified) {
    fs.writeFileSync(result.manifest.fileName, result.file);
    console.log(`Saved: ${result.manifest.fileName}`);
}
```

### 9.1 SSE Streaming Reconstruction (For UIs)

For frontend applications that want to show live progress as chunks are fetched:

```javascript
// Express route: GET /api/reconstruct/:manifestTxId/stream
async function streamReconstruction(req, res, manifestTxId) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });

    const send = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
        // 1. Fetch manifest
        send('status', { message: 'Fetching manifest...' });
        const manifestTx = await fetchTransaction(manifestTxId);
        const buf = Buffer.from(manifestTx.payload, 'hex');
        const parsed = parsePayload(buf);
        const manifest = JSON.parse(parsed.data.toString('utf8'));

        send('manifest', {
            title: manifest.title,
            fileName: manifest.fileName,
            fileSize: manifest.fileSize,
            chunkCount: manifest.chunkCount,
            fileHash: manifest.fileHash
        });

        // 2. Fetch chunks with live progress
        const chunkBuffers = [];
        for (let i = 0; i < manifest.chunkTxIds.length; i++) {
            const chunkTx = await fetchTransaction(manifest.chunkTxIds[i]);
            const chunkBuf = Buffer.from(chunkTx.payload, 'hex');
            const chunkParsed = parsePayload(chunkBuf);
            chunkBuffers.push(chunkParsed.data);

            send('chunk', {
                index: i + 1,
                total: manifest.chunkTxIds.length,
                txId: manifest.chunkTxIds[i],
                percent: Math.round(((i + 1) / manifest.chunkTxIds.length) * 100)
            });

            // Pacing delay
            if (i < manifest.chunkTxIds.length - 1) await sleep(75);
        }

        // 3. Verify and send
        const file = Buffer.concat(chunkBuffers);
        const computedHash = crypto.createHash('sha256').update(file).digest('hex');
        const verified = computedHash === manifest.fileHash;

        send('complete', {
            verified,
            fileHash: manifest.fileHash,
            fileBase64: file.toString('base64'),
            fileName: manifest.fileName,
            fileType: manifest.fileType || 'application/pdf'
        });

        res.end();
    } catch (err) {
        send('error', { message: err.message });
        res.end();
    }
}
```

---

## 10. Verification: Proving a Payload Is On-Chain

### 10.1 Hash Verification

Given a file and a TX ID, verify the hash matches:

```javascript
async function verifyDocumentHash(txId, fileBuffer) {
    const tx = await fetchTransaction(txId);
    if (!tx.payload) return { verified: false, reason: 'No payload in transaction' };

    // For simple hash payloads:
    const onChainHash = Buffer.from(tx.payload, 'hex').toString('utf8');

    // For structured NOTARY:1 payloads:
    // "NOTARY:1|kaspa:qz...|kaspa:qr...|<hash>"
    const parts = onChainHash.split('|');
    const embeddedHash = parts[parts.length - 1];

    const computedHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    return {
        verified: embeddedHash === computedHash,
        onChainHash: embeddedHash,
        computedHash,
        txId,
    };
}
```

### 10.2 Verifying Sender Address

Check that a transaction was sent from a specific wallet:

```javascript
async function verifySender(txId, expectedAddress) {
    const url = `${KASPA_API}/transactions/${txId}` +
                `?inputs=true&outputs=true&resolve_previous_outpoints=light`;
    const response = await fetch(url);
    const tx = await response.json();

    // Check input addresses
    const senderAddresses = tx.inputs
        .map(inp => inp.previous_outpoint_address)
        .filter(Boolean);

    return {
        verified: senderAddresses.includes(expectedAddress),
        senderAddresses,
        expectedAddress,
    };
}
```

### 10.3 Backend Verification Endpoint

When a user signs via browser extension and submits a TX ID, the backend must independently verify before trusting it:

```javascript
// Express route: POST /api/documents/:docUuid/verify-tx
router.post('/documents/:docUuid/verify-tx', async (req, res) => {
    const { txId, walletAddress, expectedHash } = req.body;

    // 1. TX exists on-chain
    let tx;
    try {
        tx = await fetchTransaction(txId);
    } catch {
        return res.status(400).json({ error: 'Transaction not found on-chain' });
    }

    // 2. Payload contains the expected hash
    if (!tx.payload) {
        return res.status(400).json({ error: 'Transaction has no payload' });
    }
    const payloadStr = Buffer.from(tx.payload, 'hex').toString('utf8');
    if (!payloadStr.includes(expectedHash)) {
        return res.status(400).json({ error: 'Payload does not contain the expected document hash' });
    }

    // 3. Sent from the claimed wallet
    const senderCheck = await verifySender(txId, walletAddress);
    if (!senderCheck.verified) {
        return res.status(400).json({ error: 'Transaction was not sent from the claimed address' });
    }

    res.json({ verified: true, txId, payloadHash: expectedHash });
});
```

---

## 11. UTXO Chaining: Submitting Multiple Transactions Rapidly

When embedding files, you need to submit many transactions in sequence. The naive approach — submit TX, wait for it to confirm, then submit the next — is slow. UTXO chaining eliminates this bottleneck.

### 11.1 The Problem

After you submit TX #1, the output UTXO exists in the mempool but isn't confirmed yet. If you call `wallet.sync()` and `wallet.composeTx()` immediately, the wallet may not see the new UTXO, causing TX #2 to fail.

### 11.2 The Solution

`submitPayloadTransaction` returns an `outputUtxo` object. Feed this directly into the next call as `opts.previousOutput`:

```javascript
// TX #1: Let the wallet pick a UTXO
const result1 = await submitPayloadTransaction(wallet, rpc, chunk1, { fixedAddress: addr });

// TX #2: Chain from TX #1's output (no wallet.sync() needed)
const result2 = await submitPayloadTransaction(wallet, rpc, chunk2, {
    fixedAddress: addr,
    previousOutput: result1.outputUtxo
});

// TX #3: Chain from TX #2
const result3 = await submitPayloadTransaction(wallet, rpc, chunk3, {
    fixedAddress: addr,
    previousOutput: result2.outputUtxo
});
```

Key requirements for UTXO chaining:

- **Pin the address**: All transactions in the chain must use the same address (`fixedAddress`). Otherwise the wallet may derive a new address and break the chain.
- **Sequential submission**: Don't parallelize. Each TX depends on the previous one's output.
- **Handle orphans**: If a transaction is rejected as an orphan (previous TX not yet visible to the node), reset `lastOutput = null` and retry with `wallet.composeTx()`.

---

## 12. Express.js API Endpoints Reference

### 12.1 Embed a File

```javascript
const multer = require('multer');
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

router.post('/embed', upload.single('file'), async (req, res) => {
    try {
        const fileBuffer = req.file.buffer;
        const title = req.body.title || req.file.originalname;

        const result = await embedDocument(wallet, rpc, fileBuffer, {
            title,
            fileName: req.file.originalname,
            fileType: req.file.mimetype,
            creatorAddress: wallet.receiveAddress,
        }, {
            onChunkSubmitted: (i, total, txId) => {
                console.log(`Chunk ${i + 1}/${total}: ${txId}`);
            },
            onManifestSubmitted: (txId) => {
                console.log(`Manifest: ${txId}`);
            }
        });

        res.json({
            success: true,
            manifestTxId: result.manifestTxId,
            chunkTxIds: result.chunkTxIds,
            fileHash: result.fileHash,
            totalTransactions: result.totalTransactions,
            explorerUrl: `https://explorer.kaspa.org/txs/${result.manifestTxId}`
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

### 12.2 Retrieve a File

```javascript
router.get('/retrieve/:manifestTxId', async (req, res) => {
    try {
        const { manifestTxId } = req.params;

        if (!/^[a-f0-9]{64}$/i.test(manifestTxId)) {
            return res.status(400).json({ error: 'Invalid transaction ID format' });
        }

        const result = await reconstructDocument(manifestTxId);

        const fileName = result.manifest.fileName || 'document.pdf';
        const fileType = result.manifest.fileType || 'application/pdf';

        res.set({
            'Content-Type': fileType,
            'Content-Disposition': `inline; filename="${fileName}"`,
            'Content-Length': result.file.length,
            'X-KaspaNotary-Verified': result.verified ? 'true' : 'false',
            'X-KaspaNotary-Hash': result.fileHash,
            'X-KaspaNotary-Chunks': result.manifest.chunkCount,
        });

        res.send(result.file);

    } catch (err) {
        if (err.message.includes('not a kaspanotary') || err.message.includes('no payload')) {
            return res.status(400).json({ error: 'Not a valid kaspanotary manifest' });
        }
        if (err.message.includes('Kaspa API error')) {
            return res.status(502).json({ error: 'Could not reach the Kaspa network' });
        }
        res.status(500).json({ error: 'Failed to reconstruct document' });
    }
});
```

### 12.3 Get Manifest Info (No File Download)

```javascript
router.get('/retrieve/:manifestTxId/info', async (req, res) => {
    try {
        const tx = await fetchTransaction(req.params.manifestTxId);
        if (!tx.payload) throw new Error('No payload');

        const buf = Buffer.from(tx.payload, 'hex');
        const parsed = parsePayload(buf);

        if (parsed.tag !== 'kaspanotary' || parsed.type !== 0x02) {
            throw new Error('Not a kaspanotary manifest');
        }

        const manifest = JSON.parse(parsed.data.toString('utf8'));

        res.json({
            title: manifest.title,
            fileName: manifest.fileName,
            fileSize: manifest.fileSize,
            fileType: manifest.fileType,
            fileHash: manifest.fileHash,
            chunkCount: manifest.chunkCount,
            creatorAddress: manifest.creatorAddress,
            timestamp: manifest.timestamp,
            chunkTxIds: manifest.chunkTxIds,
        });

    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});
```

### 12.4 Cost Estimate

```javascript
router.get('/estimate/:fileSize', (req, res) => {
    const fileSize = parseInt(req.params.fileSize, 10);
    if (isNaN(fileSize) || fileSize <= 0) {
        return res.status(400).json({ error: 'Invalid file size' });
    }

    res.json(estimateCost(fileSize));
});
```

---

## 13. Quick Reference

### Transaction Payload Limits

| Item | Value |
|---|---|
| Max payload per TX | ~22 KB (proven stable on mainnet) |
| Protocol header overhead | 51 bytes |
| Usable data per chunk | 22,477 bytes |
| Min fee (empty/small payload) | 3,000 sompi (0.00003 KAS) |
| Fee per 22 KB chunk | ~33,750 sompi (~0.00034 KAS) |
| Self-transfer amount | 20,000,000 sompi (0.2 KAS, returned to sender) |

### Protocol Type Bytes

| Byte | Meaning |
|---|---|
| `0x01` | Data chunk (file fragment) |
| `0x02` | Manifest (JSON metadata + chunk TX IDs) |

### Kaspa REST API Endpoints

| Endpoint | Description |
|---|---|
| `GET /transactions/{txId}?inputs=true&outputs=true` | Fetch full transaction with payload |
| `GET /transactions/{txId}?resolve_previous_outpoints=light` | Includes sender addresses |

Base URL: `https://api.kaspa.org`

### Wallet Extension APIs

| Wallet | Detect | Connect | Sign Message | Get Public Key |
|---|---|---|---|---|
| KasWare | `window.kasware` | `kasware.requestAccounts()` | `kasware.signMessage(msg)` | `kasware.getPublicKey()` |
| Kastle | `window.kastle` | `kastle.connect('mainnet')` | `kastle.signMessage(msg)` | N/A (derive server-side) |
| Keystone | `window.keystone` | `keystone.requestAccounts()` | `keystone.signMessage(msg)` | N/A |

---

## 14. Troubleshooting

**"Orphan transaction" errors**: The node hasn't seen the parent TX yet. Wait and retry. If using UTXO chaining, reset `lastOutput = null` to force `composeTx()` on retry.

**"Already in mempool" responses**: This is actually success. The TX was accepted. Extract the TX ID from the error message and continue.

**"Transaction rejected" errors**: Usually means the fee is too low or the UTXO is already spent. Sync the wallet (`wallet.sync(true)`) and retry.

**Payload not visible in explorer**: Some explorers don't display the payload field. Use the REST API directly: `https://api.kaspa.org/transactions/{txId}?inputs=true&outputs=true`.

**Hash mismatch on reconstruction**: The file was modified between embedding and verification, or a chunk was corrupted. Re-fetch and compare chunk-by-chunk.

---

## 15. Security Considerations

- **Payloads are public.** Anything you embed is permanently visible to anyone who queries the transaction. Never embed private data without encrypting it first.
- **Self-send doesn't mean free.** You pay miner fees on every transaction. The 0.2 KAS transfer amount returns to you, but fees are consumed.
- **Verify TX IDs server-side.** If a user submits a TX ID claiming they signed something, always verify independently via the REST API before trusting it. Check: (1) TX exists, (2) payload matches, (3) sender address matches.
- **Schnorr signatures are wallet-bound.** A Schnorr signature proves the holder of a specific private key endorsed a message. It does not prove anything about the person behind the wallet. Combine with identity verification if needed.
- **Payloads are included in the sighash** (kaspad 1.1.0+). This means the payload cannot be modified after signing — it's cryptographically bound to the transaction. Older kaspad versions did not include payload in the sighash.

---

*This document is maintained by Kaspero Labs LLC. The kaspanotary protocol is Apache-2.0 licensed. The Kaspa WASM SDK and associated libraries are maintained by the Kaspa project.*
