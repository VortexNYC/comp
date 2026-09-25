# What Could Go Wrong — a solo operator's scenario playbook

**Purpose.** Every compliance policy/control exists because something went wrong for
someone. This doc translates the CompAI inventory into the actual questions — "what
if X happens?" — with an honest answer for where we stand.

Legend:
- ✅ real answer exists today
- ⚠️ partial — works but has a hole, or untested
- ❌ no answer today
- 🚫 can't realistically fix at this size (accept + note)

This is a private working doc. Don't publish it — it's our honest gap map.

---

## 1. Universal — applies to every product

### Access & identity

| What if… | Today | Verdict |
|---|---|---|
| a contractor's access isn't revoked after they leave? | No formal offboarding checklist; access is via personal GitHub/Railway/CF accounts | ⚠️ few contractors now — document an offboarding checklist in CompAI (task exists) |
| my laptop is stolen? | FileVault on, 1Password for creds, session cookies could ride with the machine | ⚠️ add: revoke-active-sessions runbook |
| an API key/token leaks into a repo or log? | TruffleHog in vortex CI; seal+pile have NO secret scanning (SEA-51, PILE-182) | ⚠️→❌ for seal/pile until scanning lands |
| my GitHub account is compromised? | GH is the root of deploys + code — MFA on, but no second admin on the org | ❌ bus-factor: no break-glass admin |

### Data

| What if… | Today | Verdict |
|---|---|---|
| the comp Postgres dies/corrupts? | Daily pg_dump→R2 since today (COMP-9), 30d retention, restore path documented | ✅ (untested restore — schedule one) |
| pile's D1 is corrupted/loses data? | No export path at all (PILE-183) | ❌ — biggest universal hole |
| seal's D1 loses signed docs/audit rows? | Same class — no DR doc (SEA-49) | ❌ |
| someone requests GDPR deletion? | veil has self-serve delete verbs; vortex/seal/pile have no documented DSAR path | ⚠️ per-product work |
| data is subpoenaed / legally requested? | No process documented | ❌ low likelihood, write a 5-line response runbook |

### Incidents

| What if… | Today | Verdict |
|---|---|---|
| breach at 3am — who notices? | Nobody. No alerting, no on-call. First notice = user complaint or downtime | ❌→🚫 at 1 person: add uptime monitor (CF/Healthchecks) → phone push. That's the achievable version of "on-call" |
| customer data leaks — notification flow? | veil has incident-response.md; others don't | ⚠️ clone veil's doc, adapt per product |
| a vendor (Cloudflare/Railway/Finix) has an outage or breach? | CF hosts pile+seal entirely — total outage = total product down. Finix = all payments stop | ⚠️ inherent at this stage; document dependencies (vendor register does) + know the status-page URLs |

### Code & supply chain

| What if… | Today | Verdict |
|---|---|---|
| a dependency ships malware? | renovate on vortex; others manual | ⚠️ dependency update automation gap (PILE-182 covers pile) |
| an agent writes bad code to prod? | Agents push via PRs — but who reviews? | ⚠️ this IS your review layer question — agent output needs the same scrutiny as human PRs |
| prod deploy breaks everything? | Railway keeps prior deploys (rollback exists); CF Workers versions rollback | ⚠️ rollback exists, no documented drill |

### Legal & enterprise questions

| What if… | Today | Verdict |
|---|---|---|
| an enterprise asks "show me your SOC 2"? | We show the public repo: what's tracked, what isn't, real progress | ✅ honest posture exists |
| they ask for a pentest report? | None exists, no bounty (tracked on all boards) | ❌ until first pentest |
| they ask for a DPA / subprocessor list? | Vendor registers now in CompAI per org; no public subprocessor page | ⚠️ draft page per product = easy win |
| someone asks "are you HIPAA compliant"? | We're not — and the public page says so explicitly | ✅ honest no |

### People (the solo-operator section)

| What if… | Today | Verdict |
|---|---|---|
| I get hit by a bus? | Everything dies with me — infra creds, prod access, compliance state | 🚫 partially: 1Password vault + COMP-1 runbook + this doc help; a trusted second contact on GH org is the real mitigation |
| I get phished/socially engineered? | MFA + 1Password; but I'm the only check on myself | ⚠️ |

---

## 2. vortex — payments-specific

| What if… | Today | Verdict |
|---|---|---|
| a fraudster onboards as a merchant? | Underwriting collects KYC data, but fraud primitives unused: `fraud_session_id` never sent, AVS not collected, CVV result ignored, no 3DS (VOR-554–558) | ❌ the fraud surface is wide open — this is the scariest vortex cluster |
| card-testing attack through our flow? | Same — no screening signals reach Finix | ❌ same fix |
| disputes/chargebacks arrive? | Lifecycle untested (VOR-558) | ❌ |
| Finix suspends our account / has an outage? | Payments halt completely; no secondary processor | 🚫 accept — monitor + document; revisit at scale |
| a merchant claims double-charge? | Idempotency keys used broadly (verified) | ✅ real strength |
| someone asks "are you PCI compliant"? | SAQ-A posture documented (COMP-12 memo) — honest, defensible | ✅ |
| webhook replay/forgery? | Webhook signature verification untested (VOR-558) | ⚠️→❌ |

## 3. veil — identity/secrets-specific

| What if… | Today | Verdict |
|---|---|---|
| the ciphertext DB is stolen? | By design: ciphertext-only store — keys live client-side | ✅ core design strength |
| an agent credential is abused/rogue? | Scoped agent creds exist; no usage audit-log review | ⚠️ |
| Ory stack (Kratos/Keto/Hydra) drops a critical CVE? | No dependency CVE alerting on a security-critical dependency | ⚠️ add OSV/dependabot for veil specifically |
| a customer asks for our pentest report? | None (VEIL-53) | ❌ matters MORE for a secrets product |
| someone asks "how do you handle my secrets"? | The whitepaper doesn't exist publicly (VEIL-54) | ❌ docs exist internally — publish-able |

## 4. seal — e-signature-specific (evidentiary)

| What if… | Today | Verdict |
|---|---|---|
| a signer denies they signed? | Consent captured (IP+timestamp+version) + lifecycle events logged — BUT audit table is a plain append table, tampering undetectable (SEA-44) | ❌ the existential one: the product IS the evidence |
| someone challenges document integrity in a dispute? | QR-token public verify page exists ✅ + signature hashes — but no certificate-of-completion PDF, no crypto seal on the doc (SEA-54/55) | ⚠️ has the seed, lacks the artifact |
| a signer claims they never consented? | esignConsentAt/Ip/Version instrumented | ✅ real answer |
| signing link forwarded to wrong person? | Email-link only auth — no passcode/SMS/IDV tiers (SEA-56) | ⚠️→❌ for high-value docs |
| signed PDF needs to survive D1 loss? | No DR doc (SEA-49) | ❌ |
| a regulated customer asks for 21 CFR Part 11 / eIDAS QES? | Not offered; positioned in custom framework as future | 🚫 documented as out-of-scope today |

## 5. pile — work-tracker-specific

| What if… | Today | Verdict |
|---|---|---|
| a bug exposes one workspace's issues to another? | App-level rls() on 64/114 routes — the other 50 unaudited (PILE-184) | ❌ highest-risk pile item |
| D1 loses workspace data? | No export path (PILE-183) | ❌ |
| a member asks us to delete their data? | No documented member data-export/delete path (PILE-182→177) | ⚠️ |
| OAuth tokens (GitHub/GitLab) leak? | `encryptOAuthTokens: true` confirmed in better-auth config ✅ | ✅ likely fine — PILE-178 to verify |
| enterprise asks for SAML/SCIM? | Doesn't exist (PILE-185/187) | ❌ honest no — on roadmap |

---

## The honest totals

**Answered well today:** ~12 (idempotency, ciphertext-only design, consent capture, public verify, PCI scope memo, comp-DB backups, token encryption, honest "no" on HIPAA/SOC3)

**Partial:** ~15 (most have the shape but a hole or no test)

**No real answer:** ~12 — concentrated in: seal evidentiary integrity (SEA-44/49/55), vortex fraud surface (VOR-554–558), pile tenant isolation + DR (PILE-183/184), DSAR/delete paths everywhere, pentest/bounty everywhere, alerting/on-call nowhere.

**Can't do at this size:** 24×7 on-call, QES/eIDAS, multi-admin orgs, secondary processor — accepted, documented, revisit triggers noted.

## What this maps to

Every ❌/⚠️ row above already exists as a CompAI finding + a Pile issue on the owning board (VOR/VEIL/SEA/PILE). This doc is the narrative version — read top to bottom once, then it's your incident-prep syllabus.
