# Access revocation + break-glass — solo operator version

**Purpose.** Two real failure modes for a 1-person company:
1. A contractor/collaborator leaves and keeps access (nobody revoked it)
2. Shlomo's account dies (locked out, banned, gone) and everything is orphaned

This is the checklist + the mitigation.

## A. Offboarding checklist — run when any contractor/collaborator leaves

Copy this into a Pile ticket when needed. ~15 minutes.

### Identity & code
- [ ] **GitHub**: remove from `VortexNYC` org (github.com/orgs/VortexNYC/people → remove). Check outside collaborators on every repo too.
- [ ] **1Password**: remove from the vaults they had (Agents + any shared vaults) — Settings → People.
- [ ] **Pile**: remove member from `org_vortex_main` workspace (their account + any API keys they minted — check `issues` they created hold no tokens).

### Infra
- [ ] **Cloudflare**: dash.cloudflare.com → account → Members → remove. Rotate any API tokens they created (R2 → Manage API tokens → check token names/dates).
- [ ] **Railway**: project `comp` (+ any other projects) → Members → remove. Rotate service tokens if they had dashboard access.
- [ ] **PlanetScale** (vortex DB): org members → remove.
- [ ] **Resend**: team members → remove. Rotate API key only if they had the raw key.
- [ ] **Finix**: dashboard users → remove.
- [ ] **PostHog**: project members → remove.
- [ ] **Trigger.dev** (if ever enabled): org members → remove.

### Product surfaces
- [ ] **CompAI orgs**: members list on each of vortex/veil/seal/pile orgs → deactivate.
- [ ] **Seal/pile/veil/vortex accounts**: delete or deactivate their product accounts.

### Secrets hygiene
- [ ] If they had terminal access to prod secrets: rotate the ones that matter (DB URL password, R2 tokens are already scoped/rotatable, better-auth secrets only if they touched them).
- [ ] Revoke any SSH/GPG keys on GitHub that were theirs.

## B. Break-glass admin — if Shlomo's account is unavailable

The single worst orphan risk is the **GitHub org** — code, deploys trigger, secrets all live there.

- [ ] **Add a second owner** to `VortexNYC` GitHub org — someone trusted who can take admin (a cofounder-level contact, lawyer, or family member with instructions). One-time action.
- [ ] Same for **Cloudflare** account (Members → invite as Super Administrator) — CF hosts the actual running products.
- [ ] **1Password**: emergency/recovery contact configured so the vault isn't locked forever.
- [ ] Leave a `BREAKGLASS.md` pointer in a shared place saying: "if unreachable for N days, the recovery contact uses these accounts" — without listing secrets in it.

### What the break-glass person would need (documented, not shared now)
- GitHub org owner rights → can regain control of repos + Actions secrets
- Cloudflare super admin → owns the running infrastructure
- 1Password vault access → the actual credentials
- Railway is recoverable via the CF/GH side or support

## C. Cadence

- Offboarding checklist: run on **every** contractor departure (it's a 15-min checkbox pass).
- Break-glass: set up once, verify yearly.
- These live here because CompAI tracks the recurring tasks — file a Pile ticket each time the checklist runs so there's an audit trail (access-review evidence).
