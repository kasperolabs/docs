# Covenant Activation Through Miner Action (CATMA): v0.1 Specification

Nov 25, 2026 · @Oz Steinmetz

CATMA turns a Kaspa coin into a payment that releases itself. You lock KAS under a known template that fixes who gets paid and from which DAA score. The coin also carries a public bounty for whoever's block gets the payment through.

From that score on, anyone may build the spend, but only into the payout fixed at creation. Nobody needs to be online on the creator's side: miners want the bounty, and the beneficiary wants the payout. There is no server and no consensus change.

The same pattern covers a delayed gift, rent or a paycheck, vesting, and an inheritance that waits on a heartbeat. This spec defines the first template family: T1 (the owner can take it back until it fires), T1-N (no take-back) and T1-K (a named keeper fires first and keeps the bounty).

## Overview

CATMA is a standard for Kaspa L1 covenants that anyone may spend once a condition is met, only into an output fixed at creation, with a capped leftover paid as a bounty. A creator locks funds under a registered template. Anyone may build and broadcast the spend, and the block producer that gets it accepted earns the bounty as the fee. No server and no consensus change, and no keeper key unless the creator names one (T1-K).

Goals:

- Time-triggered release that needs nobody online on the creator's side.
- Correctness from L1: a trigger fires only at or after its DAA score, and only into its committed output.
- Liveness from day one: any one broadcaster is enough, and the beneficiary has every reason to be that broadcaster.
- Escalation: a bounty that climbs until it clears at any fee level, up to a cap.
- One audited template family that any scanner recognizes from on-chain data alone.
- Oracle-ready: conditions with deadlines plug in later as new templates under the same record format.

Non-goals for v0.1:

- Oracle conditions. The shape is reserved, not implemented.
- Stateful templates (recurring, heartbeat). v0.1 covers them as recipes on T1.
- Consensus changes. CATMA uses the Toccata opcode set as it is in rusty-kaspa master.
- Randomness-dependent outcomes such as lotteries. The block producer chooses the block and can grind block-derived randomness.

## Roles

Only the creator ever signs anything. Broadcasting and mining are separate roles: anyone can broadcast, and whoever mines the accepting block is paid.

| Role | What it does | Key needed | Paid |
| --- | --- | --- | --- |
| Creator | Funds the covenant, picks a template and params, publishes the record | Funding key; owner key for T1's escape | No |
| Trigger covenant | P2SH UTXO that enforces the time, the committed output and the bounty cap | None | No |
| Broadcaster | Builds the trigger spend from public data and submits it: the beneficiary, the creator's bot, the Studio, Kasla, a pool | None | Only in address mode, and front-runnable |
| Miner or pool | Includes the spend; its block's coinbase collects the fee | Its normal coinbase address | Yes, the bounty |
| Beneficiary | Receives the committed output | None | The payout |
| Keeper (T1-K) | Fires first during the grace window and pays itself from the bounty | Keeper key | Yes, the bounty minus the network fee |

The trigger spend is not someone else's signed transaction being relayed. The trigger branch has no signature check. Anyone rebuilds the spend from the funding outpoint, the template and the params, chooses its lock\_time, and leaves the bounty as the fee.

## Lifecycle

&#91;embedded content: CATMA lifecycle · trigger path, fee loop and owner escape\]

A trigger runs from funding to payout with nobody online on the creator's side. If the bounty doesn't yet cover the fee, broadcasters wait and rebuild with a later lock\_time. T1's owner can step in at any point until a trigger is accepted; T1-N has no escape.

## Template identity and the record

A CATMA redeem script is a param header followed by the template's code. A P2SH output shows only the Blake2b-256 hash of that script, so a record carries the header and names the code by its template ID. Scanners rebuild the script, hash it and compare.

### Template ID

The template ID is the KCC-1 template hash with an empty prefix, the same rule the Studio's kcc1.js and verifier already use:

```latex
\text{template\_id} = \mathrm{BLAKE3}\big(\mathrm{le64}(0) \,\|\, \mathrm{le64}(\mathrm{len}(\text{code})) \,\|\, \text{code}\big)
```

The redeem script is header followed by code. It matches the output when Blake2b-256 of that script equals the hash inside the output's `aa20<hash>87`.

Template IDs are immutable. A bug fix is a new ID, never an edit. The registry (the Studio's covenant registry) lists each audited ID with its code, its header fields, its condition and its audit trail. Scanners act only on IDs they have reviewed.

### Header encoding

Each param is exactly one explicit push, in the order the template lists them:

- Integers: `OP_DATA_8` and 8 bytes little-endian, value from 0 to 2^63 − 1.
- Public keys: `OP_DATA_32` and 32 bytes.
- Script public keys: `OP_DATA_36` or `OP_DATA_37` and the bytes as `OpTxOutputSpk` pushes them: 2-byte version, then the script.

A header that doesn't parse exactly into the template's field list is ignored, even if the hash matches.

### Record

| Field | Size | Meaning |
| --- | --- | --- |
| magic | 5 bytes | ASCII `CATMA` |
| version | 1 byte | `0x00` |
| count | 1 byte | Number of records that follow |
| kind | 1 byte | `0x00` inline: the covenant is an output of this tx. `0x01` detached: the outpoint is given |
| txid | 32 bytes | Detached records only |
| output\_index | 2 bytes, u16 LE | The covenant output |
| template\_id | 32 bytes | As defined above |
| header\_len | 2 bytes, u16 LE | Length of the header |
| header | variable | The exact header bytes |

The last six fields repeat per record, so one funding tx can create a ladder of triggers. v0's `condition_type` is dropped; the registry entry for the template says what the condition is.

### Channels

Records are hints, never trusted on their own, so the channel doesn't matter:

- **Inline:** the funding tx's payload. Best when the Studio builds the funding tx.
- **Detached:** any later tx's payload, sent by anyone, the beneficiary included. This covers wallets that can't attach a payload, such as a Kasware `sendKaspa` funding.
- **Off-chain:** the same record bytes in a `.ksm` file or served by an API.

A T1 inline record is about 150 bytes, which costs about 150 grams of compute mass, or roughly 0.00015 KAS at the relay floor. Spam costs its sender the same.

## Templates T1, T1-N and T1-K: TIME\_AFTER, one-shot

T1 pays the whole coin, minus a bounty that grows with time, to one beneficiary at or after DAA score N. T1 is revocable: the owner can take the coin back until a trigger is accepted, and after N the two race. T1-N is the same template with no owner branch, for payments the beneficiary must be able to count on. T1-K adds a named keeper that may fire first and keep the bounty.

### Params, in header order

| Param | Encoding | Meaning | Creation rule |
| --- | --- | --- | --- |
| OWNER\_PUBKEY | 32 bytes | Schnorr key for the escape | T1 only |
| BENEFICIARY\_SPK | 36 or 37 bytes | The committed output's script, version included | P2PK, P2PK-ECDSA or P2SH, or the trigger won't relay |
| BMAX | 8-byte int, sompi | Bounty cap | At least B0; leave a payout above about 0.2 KAS |
| B0 | 8-byte int, sompi | Bounty at N | At least 3 times the relay fee for the trigger's mass |
| K | 8-byte int, sompi per DAA tick | Escalation rate | 0 or more |
| N | 8-byte int, DAA score | Release score | Above 0 and below 500,000,000,000, so it's a DAA score, not a time |

The script checks none of the creation rules. The creator's UI checks them, and scanners skip covenants that break them.

### Trigger branch rules

Let i be this input's index.

1. `tx.lock_time` is at least N, and this input's sequence is below `u64::MAX`, so CLTV applies.
2. Output i pays BENEFICIARY\_SPK.
3. Output i is at least input i's amount minus the bounty, where bounty = min(B0 + K × (lock\_time − N), BMAX).

There is no input or output count rule. Each CATMA input checks only the output at its own index, the SIGHASH\_SINGLE idiom. Several triggers batch into one transaction, and an extra output can be paid only from the bounties and any inputs the triggerer adds. No covenant can lose more than its own bounty.

### Owner branch (T1 only)

A valid OWNER\_PUBKEY signature; outputs unrestricted. The owner can also use it to re-roll a trigger into a new one (see Recipes).

### Code

The header leaves the stack as OWNER\_PUBKEY, BENEFICIARY\_SPK, BMAX, B0, K, N, with N on top and the selector below all six. To be checked on the engine before audit:

```
6 OpRoll                                   // selector up from under the six params
OpIf                                       // selector 1: trigger
  OpDup OpCheckLockTimeVerify              // lock_time >= N; CLTV pops its copy
  OpTxLockTime OpSwap OpSub                // elapsed = lock_time - N
  OpMul OpAdd OpMin                        // bounty = min(B0 + K * elapsed, BMAX)
  OpTxInputIndex OpTxInputAmount OpSwap OpSub            // floor = input i - bounty
  OpTxInputIndex OpTxOutputAmount OpSwap
  OpGreaterThanOrEqual OpVerify            // output i >= floor
  OpTxInputIndex OpTxOutputSpk OpEqual     // output i pays BENEFICIARY_SPK
  OpNip                                    // drop OWNER_PUBKEY, keep the result
OpElse                                     // selector 0: owner escape
  Op2Drop Op2Drop OpDrop                   // drop N, K, B0, BMAX, BENEFICIARY_SPK
  OpCheckSig                               // signature against OWNER_PUBKEY
OpEndIf
```

T1-N's header has no OWNER\_PUBKEY. Its code is the trigger branch alone, with no `6 OpRoll`, `OpIf`, `OpNip` or escape. Both branches end with exactly one item on the stack, as Kaspa's clean-stack rule requires.

### Signature scripts

| Spend | Signature script | sigOpCount |
| --- | --- | --- |
| T1 trigger | `OP_1`, then the redeem script | 0 |
| T1 owner escape | the 65-byte signature, `OP_0`, then the redeem script | 1 |
| T1-N trigger | the redeem script alone | 0 |
| T1-K keeper trigger | the keeper's signature, OP\_1, OP\_1, then the redeem script | 1 |
| T1-K open trigger, after N + G | OP\_0, OP\_1, then the redeem script | 0 |
| T1-K owner escape | the owner's signature, OP\_0, then the redeem script | 1 |

The selector is `OP_1` or `OP_0`, never another encoding. A trigger input with sigOpCount 0 is lighter in mass.

### T1-K: appointed keeper

T1-K pays the bounty to a party the creator names in advance. From N until N + G only the keeper can fire it, by signing. After N + G it opens to anyone in fee mode, so a missing keeper can delay the payment but never strand it.

The header adds two params to T1's: KEEPER\_PUBKEY and G. The order is OWNER\_PUBKEY, KEEPER\_PUBKEY, BENEFICIARY\_SPK, BMAX, B0, K, G, N.

| Param | Encoding | Meaning | Creation rule |
| --- | --- | --- | --- |
| KEEPER\_PUBKEY | 32 bytes | Schnorr key of the keeper: a pool, Kasla, the Studio, any service | Any key |
| G | 8-byte int, DAA ticks | Grace window after N during which only the keeper can fire | N + G below 500,000,000,000 |

Trigger rules: T1's three rules, plus one of these paths.

- **Keeper path:** a valid KEEPER\_PUBKEY signature and lock\_time at least N.
- **Open path:** lock\_time at least N + G, no signature.

The keeper signs with SIGHASH\_ALL, so nobody can change its outputs, including the one paying itself from the bounty. The script doesn't force the sighash type: the beneficiary is protected by rules 2 and 3 either way, and a keeper that signs another type risks only its own pay.

Inside the window the keeper is the only party that can fire, and the bounty keeps climbing from N. A keeper paid by the bounty will therefore fire near N + G. Expect the payout by about N + G, and the keeper's pay to be about B0 + K × G minus the network fee. Set G to the delay you accept, or set K to 0 for a flat fee.

```
8 OpRoll                                   // selector up from under the eight params
OpIf                                       // selector 1: trigger
  8 OpRoll                                 // keeper flag up
  OpIf                                     // keeper path
    OpNip                                  // drop G
    7 OpRoll 6 OpRoll OpCheckSigVerify     // keeper signature against KEEPER_PUBKEY
    OpDup OpCheckLockTimeVerify            // lock_time >= N
  OpElse                                   // open path
    OpDup 2 OpPick OpAdd
    OpCheckLockTimeVerify                  // lock_time >= N + G
    OpNip                                  // drop G
    5 OpRoll OpDrop                        // drop KEEPER_PUBKEY
  OpEndIf
  OpTxLockTime OpSwap OpSub                // from here on, T1's trigger branch
  OpMul OpAdd OpMin
  OpTxInputIndex OpTxInputAmount OpSwap OpSub
  OpTxInputIndex OpTxOutputAmount OpSwap
  OpGreaterThanOrEqual OpVerify
  OpTxInputIndex OpTxOutputSpk OpEqual
  OpNip                                    // drop OWNER_PUBKEY, keep the result
OpElse                                     // selector 0: owner escape
  Op2Drop Op2Drop Op2Drop OpDrop           // drop N, G, K, B0, BMAX, BENEFICIARY_SPK, KEEPER_PUBKEY
  OpCheckSig                               // signature against OWNER_PUBKEY
OpEndIf
```

The bounty is measured from N on both paths, so the open path after N + G starts at bounty(N + G) and keeps climbing to BMAX. A no-escape keeper variant would follow the same pattern if it's wanted.

## Bounty

The bounty is the fee, and competition, not the creator's generosity, sets what is actually paid. A creator should set B0 near cost and let K and BMAX carry the trigger through congestion.

### Fee mode and address mode

- **Fee mode (default):** output i gets input i minus the bounty, and nothing else is paid. The block producer whose block gets the spend accepted collects the difference as fee. There is nothing to front-run, because no output belongs to the triggerer.
- **Keeper mode (T1-K):** the named keeper signs the spend and adds an output paying itself from the bounty. Its signature fixes every output, so nobody can swap that output. A party declared in advance is the only kind of non-miner that can be paid reliably.
- **Address mode (best effort):** an extra output funded from the bounty, paying an unnamed submitter. Nothing ties it to the submitter: any block producer can drop or swap it, and rival bots can outbid it by replacement, so the bounty drains toward miners. Allowed, never promised.

### Escalation

The mempool accepts a transaction only when its lock\_time is below the virtual DAA score, and a block only when it's below that block's DAA score. So `OpTxLockTime` is a lower bound on "now" that the spender chooses. The spender wants it as high as possible, because the bounty grows with it. That makes the trigger a Dutch auction that finds its own price at any fee level.

Once a trigger is broadcast, every pool's template can include it, and the first block accepted wins, so the bounty lands with miners in proportion to hashrate. A pool's own scanner earns only its hashrate share, unless the pool keeps the spend out of the public mempool, which takes a node change. Either way the trigger fires.

### Sizing

The relay floor is 100 sompi per gram of max(compute, transient) mass. A T1 trigger is estimated at 1,000 to 3,000 grams, so about 0.001 to 0.003 KAS (to be measured on testnet). At about 10 DAA ticks per second, K sompi per tick adds K × 36,000 sompi an hour. BMAX divided by the trigger's mass is the highest fee rate the trigger can ever clear.

| Preset | B0 | K | Climb | BMAX | Cap reached after N | Clears up to, at 2,000 g |
| --- | --- | --- | --- | --- | --- | --- |
| Everyday | 0.01 KAS | 250 sompi/tick | 0.09 KAS/h | 1 KAS | about 11 h | 500 × floor |
| Congestion-proof | 0.01 KAS | 1,000 sompi/tick | 0.36 KAS/h | 5 KAS | about 14 h | 2,500 × floor |

With a broadcaster watching at N and normal fees, the bounty actually paid is close to B0. A creator who wants to tip miners on purpose raises B0 and knows it's a gift.

### Lock\_time cap

Above L\* = N + ceil((BMAX − B0) / K) the bounty stops growing (L\* = N when K is 0). Far above it, K × elapsed can overflow i64 and fail the script. Builders therefore use lock\_time = min(virtual DAA − 1, L\*). The spender picks lock\_time, so overflow can never lock the coin.

## Broadcaster and scanner behavior

A scanner is a small keyless service beside a kaspad node. The beneficiary's wallet, the Studio, Kasla, a creator's backup bot and any pool can all run one. The Studio should run a public one from day one, so CATMA works before any pool adopts it.

1. **Index.** Follow accepted transactions through the node's virtual-chain notifications and parse payloads that start with `CATMA`. Accept off-chain records too. For each record, rebuild header and code from the registry, hash it and compare it with the output's script. Check the creation rules. Store the outpoint, template, params, N and L\*.
2. **Track.** Drop an entry as soon as its outpoint is spent in an accepted transaction, using UTXO-change notifications. Keep the rest in a queue ordered by N.
3. **Wait.** An entry is eligible once the virtual DAA score passes N.
4. **Build.** Set lock\_time L = min(virtual DAA − 1, L\*). Each CATMA input gets sequence 0, sigOpCount 0 and the signature script from the T1 table. Output i is the beneficiary, worth input i minus bounty(L). Eligible triggers can share one transaction, each paired by index.
5. **Check profit.** Submit only if the total bounty minus the relay fee for the transaction's mass clears the scanner's threshold. A beneficiary's threshold is zero. Otherwise wait; the bounty keeps climbing.
6. **Submit.** Send to the scanner's own node. If the mempool already holds a spend of the same outpoint, that is a pending trigger, not a spend. Rebuild with the current L and submit it as a replacement (`submitTransactionReplacement`) when it pays more. Drop the entry only at step 2.
7. **Refresh.** A trigger still pending after fees rose is rebuilt with a fresh L and replaced the same way.

A scanner holds no funds and signs nothing, so nothing on it can be stolen. A compromised scanner can at worst fire triggers that were already eligible, into their committed outputs.

## Recipes on T1

The uses v0 gave to T3 and T4 are built from T1 coins, so v0.1 ships one template family and no state proofs.

| Use | Built from | How |
| --- | --- | --- |
| Delayed payment or gift | One T1 or T1-N | Release at N to the recipient |
| Paycheck, rent, allowance | A ladder of T1 | k records in one funding tx at N, N + P, N + 2P. Each rung is its own coin; the owner cancels the rest with the escape |
| Vesting | A ladder of T1-N | The same ladder, with no take-back |
| Dead man's switch | One T1 to the heir | Before N, the owner re-rolls: spends with the escape into a new T1 at a later N and sends a new record. One signed tx per heartbeat |
| Staged heirs | A ladder of T1 | Different beneficiaries at different N, each re-rolled together |
| Chained release | T1 into a covenant | BENEFICIARY\_SPK is another covenant's P2SH: a vault, an escrow, another CATMA |
| Hired trigger service | One T1-K | Name Kasla, the Studio or a pool as keeper; anyone may fire after the grace window |

Storage mass limits how many small rungs fit in one funding tx. Larger rungs or several funding txs avoid it; the Studio should measure before offering a ladder UI.

### When a new template is worth it

These recipes trust the owner key. A stolen key takes everything through T1's escape, and a heartbeat keeps that key in use. Later templates earn their place by restricting the owner:

- **Restricted escape (T4 style):** the owner branch may only push N forward, or may only pay out after a delay. This needs a next-state proof. Use the KCC-20 pattern, both covenant ID lineage and the KCC-1 template check (`validateOutputState`), not one or the other.
- **CATMA branch inside other templates:** an escrow or HTLC whose timeout refund is a keyless CATMA branch, so the refund fires with nobody online.
- **Stateful recurring:** only if ladders prove too heavy in storage mass.

## Deadlines and oracles

Kaspa script can enforce "not before" but never "not after", so a pure time window is impossible and T2 moves under oracles.

### Why a window can't be enforced by time

CLTV checks that `tx.lock_time` is at least a value, and the spender chooses lock\_time. A spender at any score after M can still pick a lock\_time between N and M, and that spend stays valid forever. A rule like "fire only before M" therefore has no effect. What script can do is open a second path at M, such as a refund, so the trigger and the refund race from then on. T1's owner escape after N is the same race.

### Deadlines through signed timestamps

A real deadline needs a time the spender can't choose: a score inside a message someone else signed. That is what ORACLE\_EVENT provides, so time windows belong there.

**ORACLE\_EVENT (reserved).**

- **Params:** oracle pubkey, feed ID, predicate (comparison and threshold), and optionally a window \[N, M\].
- **Witness:** an oracle-signed message of feed ID, value, event DAA score and expiry, checked with `checkMsgSig` (BIP340 over a 32-byte Blake2b-256 digest, x-only key).
- **Window:** the script checks N ≤ event score ≤ M from the signed message, so "the event happened in time" is enforceable.
- **Freshness:** comes from the message, either event semantics ("crossed X at score d") or a signed expiry. It must never come from lock\_time, or a spender could choose a low lock\_time and replay yesterday's price.

The registry gives each oracle template its own condition entry; the record format doesn't change.

## Threat model and invariants

The trigger branch can do one thing, at one time, into one place, and can lose at most its own bounty. Most of the remaining risk lives in the template's correctness and in T1's owner key.

| Threat | Defense | What remains |
| --- | --- | --- |
| Early trigger | CLTV against N; a tx with lock\_time at or above the current DAA score is not final | Nothing |
| Funds redirected | Output i must match BENEFICIARY\_SPK and the amount floor | Nothing, if the template is correct |
| Over-taking by batching or extra outputs | Each input checks only its own output | Extra outputs can spend only bounties and the triggerer's own inputs |
| Low lock\_time to fire cheaply | A lower lock\_time only lowers the triggerer's own bounty | For oracle types: stale replay, handled by event or expiry semantics |
| Arithmetic overflow | The spender chooses lock\_time; builders cap it at L\* | Nothing |
| Fake or garbage records | Hash check; records are only hints | Scanner CPU, paid for in the spammer's mass fees |
| Front-running | Fee mode leaves nothing to steal | Address mode degrades to fee mode |
| Trigger parked in the mempool | Replace by fee with a later lock\_time | A scanner that drops on conflict misses it |
| Never triggered | The beneficiary can broadcast for free; escalation; BMAX; T1's escape | BMAX below a long fee spike delays T1-N until fees fall. Funds wait, they aren't lost |
| Beneficiary surprised by a revocation | T1 is labeled revocable until paid; T1-N exists | A UI that hides the label |
| Owner key stolen (T1) | None: the escape pays anywhere | Use T1-N, or a restricted-escape template later |
| Template bug | Immutable audited IDs; red-team with kaspa-redteam before the registry | Systemic: every covenant on that ID at once |
| Parallel blocks include the same spend | The DAG accepts one; the other copy is ignored | Nothing |
| DAA score vs wall clock | Release is defined in DAA score | Wall-clock dates are estimates; show them as estimates |
| Expecting a deadline | Script can't say "not after" | Use an oracle template with a signed event score |
| Keeper goes missing (T1-K) | Open path after N + G | The payout is delayed by up to G |
| Keeper's own payout swapped (T1-K) | The keeper signs with SIGHASH\_ALL | A keeper that signs another type risks only its own pay |
| Keeper key stolen (T1-K) | The keeper path still pays only output i, at the committed amount | The thief can fire early inside the window and take the keeper's pay; the beneficiary is unaffected |

### Invariants every audit must prove

1. A CATMA input's value leaves only into output i, matching BENEFICIARY\_SPK, worth at least input i minus the bounty, or through the owner's signature (T1 and T1-K).
2. The trigger branch fails whenever lock\_time is below N, so no trigger is accepted before DAA score N.
3. The value a trigger takes from any one covenant never exceeds BMAX.
4. Validity depends only on on-chain data, never on the record or the scanner.
5. For every DAA score from N on, there is a lock\_time that makes the trigger valid without overflow (from N + G without a signature, in T1-K).
6. In T1-K, a trigger whose lock\_time is below N + G succeeds only with the keeper's signature.

## Checked against rusty-kaspa master

Read at commit 68bd2e9 (Nov 23, 2026). These answer v0's open questions by reading the code; testnet still has to confirm them in practice.

| Question | Finding | Source |
| --- | --- | --- |
| Opcodes available | `OpCheckLockTimeVerify` (0xb0), `OpTxLockTime` (0xb5), `OpTxInputIndex`, `OpTxInputAmount`, `OpTxOutputAmount`, `OpTxOutputSpk`, `OpMin` all present; no fork flag gates them. Toccata is live on mainnet since June 30, 2026 | [opcodes/mod.rs](https://github.com/kaspanet/rusty-kaspa/blob/68bd2e91cddbdcdca5e59357344c7e26f2d6d97b/crypto/txscript/src/opcodes/mod.rs) |
| CLTV semantics | Pops its operand; requires the same lock type, operand ≤ tx lock\_time, and this input's sequence below `u64::MAX` | [opcodes/mod.rs](https://github.com/kaspanet/rusty-kaspa/blob/68bd2e91cddbdcdca5e59357344c7e26f2d6d97b/crypto/txscript/src/opcodes/mod.rs) |
| Arithmetic limits | i64 with checked add, sub and mul; overflow fails the script | [opcodes/mod.rs](https://github.com/kaspanet/rusty-kaspa/blob/68bd2e91cddbdcdca5e59357344c7e26f2d6d97b/crypto/txscript/src/opcodes/mod.rs) |
| Clean stack | Exactly one item must remain | [lib.rs](https://github.com/kaspanet/rusty-kaspa/blob/68bd2e91cddbdcdca5e59357344c7e26f2d6d97b/crypto/txscript/src/lib.rs) |
| Lock\_time margin | Final when lock\_time < the virtual DAA score (mempool) or the block's DAA score (block), so virtual DAA − 1 works | [tx\_validation\_in\_header\_context.rs](https://github.com/kaspanet/rusty-kaspa/blob/68bd2e91cddbdcdca5e59357344c7e26f2d6d97b/consensus/src/processes/transaction_validator/tx_validation_in_header_context.rs) |
| Mempool standardness | No push-only rule, no dust rule, no fee ceiling. Outputs must be a standard class with a known version; a P2SH input may have at most 15 sig ops | [check\_transaction\_standard.rs](https://github.com/kaspanet/rusty-kaspa/blob/68bd2e91cddbdcdca5e59357344c7e26f2d6d97b/mining/src/mempool/check_transaction_standard.rs) |
| Relay floor | 100,000 sompi per kg (100 sompi/gram) of max(compute, transient) mass | [mempool/config.rs](https://github.com/kaspanet/rusty-kaspa/blob/68bd2e91cddbdcdca5e59357344c7e26f2d6d97b/mining/src/mempool/config.rs) |
| Replace by fee | The mempool supports replacement (RbfPolicy) | [replace\_by\_fee.rs](https://github.com/kaspanet/rusty-kaspa/blob/68bd2e91cddbdcdca5e59357344c7e26f2d6d97b/mining/src/mempool/replace_by_fee.rs) |
| Payload cost | Counted in the serialized size behind compute mass | [mass/mod.rs](https://github.com/kaspanet/rusty-kaspa/blob/68bd2e91cddbdcdca5e59357344c7e26f2d6d97b/consensus/core/src/mass/mod.rs) |
| `OpTxOutputSpk` bytes | 2-byte version, then the script: P2PK `0000 20<key> ac`, P2SH `0000 aa20<hash> 87` | Studio mainnet tests, Oct 4, 2026 |

## Open questions for testnet

These decide the numbers in this spec, not its design.

- [ ] Measure the real mass of a T1 trigger, one alone and a batch of two, including Toccata's compute budget. This sets the B0 floor.
- [ ] Run T1 and T1-N end to end: a trigger at N, a refused early trigger, a refused redirected output, a refused oversize fee, an owner escape, a batch of two, an address-mode extra output.
- [ ] Run T1-K: a keeper trigger inside G, a refused unsigned trigger inside G, an open trigger after N + G, an owner escape.
- [ ] Confirm that 8-byte header integers work in `OpMul`, `OpAdd` and `OpMin` as well as in CLTV.
- [ ] Check whether a replacement spreads to peers over P2P, or only reaches the node it was submitted to.
- [ ] Decide whether funding outputs should carry a covenant ID binding, so indexers can follow them by ID, and confirm a bound coin can still be paid to a plain beneficiary.
- [ ] Measure storage mass for ladders: how many rungs of a given size fit in one funding tx.
- [ ] Ask whether any pool wants a no-relay path into its own templates, or would rather be a T1-K keeper. Liveness needs neither.

## What changed from v0

| Area | v0 | v0.1 | Why |
| --- | --- | --- | --- |
| Liveness | Miners and pools scan | Anyone broadcasts, the beneficiary first; miners collect the fee | The trigger is keyless and the bounty pays the fee, so broadcasting costs nothing |
| Output rule | Exactly 1 input, 1 output | Output at my own input index pays the beneficiary | Batching and address mode come free; T1-A and T1-B are folded in |
| Owner escape | Always present | T1 has it; T1-N has none | A beneficiary needs a version that can't be revoked |
| Template ID | New Blake2b rule | KCC-1 template hash | One rule across the Studio verifier, KCC-20 and CATMA |
| Params | TLV | Fixed push header at the start of the script | Building the script is concatenation; no parser per template |
| Record channel | Funding tx payload only | Payload, a separate announce tx, or off-chain | Wallets like Kasware can't attach a payload; the hash check makes the channel irrelevant |
| Bounty example | B0 0.6 KAS | B0 0.01 KAS | Competition sets the price; 0.6 KAS is about 300 times the relay floor |
| T2 TIME\_WINDOW | Pure time template | Moved under oracles | Script can't enforce "not after"; only a signed timestamp can |
| T3, T4 | Later templates | Recipes on T1 | A ladder of T1s and an owner re-roll cover recurring payments and heartbeats |
| Scanner conflicts | Drop on any conflict | Replace a pending conflict by fee | A trigger parked in the mempool is not a spend |
| Paying a non-miner | Address mode | T1-K: a named keeper signs and keeps the bounty, with an open fallback after a grace window | A keyless output can be swapped by any block producer; only a party declared in advance can be paid reliably |

