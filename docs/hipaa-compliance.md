# HIPAA Compliance — FCC Transport Board

**Infrastructure compliance requirements & cost estimate**

Prepared: July 10, 2026 · Updated: July 19, 2026
Application: FCC Transport Board (hospital patient-transport tracker)

> **Disclaimer:** This document is a technical/operational summary to support planning. It is **not legal advice**. Vendor pricing and terms change — verify current figures directly with each vendor. The final compliance determination and vendor approvals should be made by Northside's HIPAA/privacy compliance and IT-security teams.

---

## 1. Purpose & scope

The FCC Transport Board tracks patient transports on the mother-baby unit. Although the app **does not store patient names**, it records **room number + transport event + timestamp** (and optionally free-text notes). Under HIPAA, this combination is **Protected Health Information (PHI)** — it identifies a specific individual's care event. Therefore, any third-party service that **creates, receives, stores, or transmits** this data on our behalf requires a signed **Business Associate Agreement (BAA)**.

## 2. Data classification

| Data element | Classification | In the app? |
|---|---|---|
| Room number | PHI (location identifier) | Yes |
| Transport time / event | PHI (care event) | Yes |
| Origin floor / destination | PHI (location) | Yes |
| Free-text notes | Potential PHI | Yes — with guardrails (see §8); can be disabled by an admin |
| Patient name | PHI | **No — deliberately excluded** |
| Staff name / email / extension / role | Employee data (not patient PHI) | Yes |

## 3. Vendor BAA matrix

| Vendor | Role | Touches PHI? | BAA required? | Status / notes |
|---|---|---|---|---|
| **Supabase** | Database (PHI at rest) | Yes | **Yes** | Requires Team plan + HIPAA add-on |
| **Render** | API hosting (PHI in transit/processing) | Yes | **Yes** | Requires Scale/Enterprise plan |
| **Twilio** | SMS (optional) | No — **not configured** | Not currently | SMS is disabled: the service requires `TWILIO_*` env vars, which are not set in the deployment. Even if enabled, messages contain no patient data (PHI stripped in code). Re-evaluate BAA only if SMS is turned on. |
| **Google / Gmail** | Email (staff password resets) | No patient PHI | No (for current use) | Consumer Gmail has **no BAA**; do not route PHI through it |
| **GitHub** | Source code | No | No | No PHI is committed (`.env` is gitignored) |
| Domain / DNS registrar | Routing | No | No | — |

## 4. Supabase HIPAA checklist

- [ ] Upgrade to the **Team plan** (minimum). *Free and Pro projects cannot be made HIPAA-compliant.*
- [ ] **Sign the BAA** with Supabase (request via dashboard or the HIPAA form).
- [ ] **Enable the HIPAA add-on** on the organization.
- [ ] Mark the project **"High Compliance"** in *General → Project Settings*.
- [ ] Configure required security settings:
  - [ ] **Point-in-Time Recovery (PITR)** enabled (requires a compute add-on)
  - [ ] **SSL Enforcement** on *(already using verified TLS — see §9)*
  - [ ] **Network Restrictions** enabled (IP allowlist)
  - [ ] **Postgres connection logging** kept on (off by default)
- [ ] Monitor the **Security Advisor** for any disabled HIPAA controls.

## 5. Render HIPAA checklist

- [ ] Upgrade the workspace to the **Scale** (or Enterprise) plan.
- [ ] **Sign the BAA** directly from the Render dashboard.
- [ ] Specify **which workspace** becomes HIPAA-enabled. ⚠️ **This is irreversible.**
- [ ] Provision a **static outbound IP set** if using Supabase Network Restrictions (so there's a fixed IP to allowlist).
- [ ] Follow Render's HIPAA best-practices configuration guide.

## 6. Cost estimate

> Ballpark for budgeting, based on published pricing as of July 2026. The **Supabase HIPAA add-on price is quote-only** and is the main unknown.

### Supabase (database)

| Item | Cost/mo | Notes |
|---|---|---|
| Team plan (required minimum) | $599 | Free/Pro cannot do HIPAA |
| HIPAA add-on (required) | quote-only | Not published — contact Supabase (the wildcard) |
| Point-in-Time Recovery (required) | $100 | per 7 days retention |
| Compute add-on (for PITR) | ~$15 | at least "Small" if not already included |
| **Subtotal** | **~$715+/mo** | plus the unknown HIPAA add-on |

### Render (API hosting)

| Item | Cost/mo | Notes |
|---|---|---|
| Scale plan (required) | $499 | flat, unlimited members |
| API service instance (Standard) | ~$25 | web service compute |
| Static outbound IP set | $100 | for Supabase Network Restrictions |
| **Subtotal** | **~$625/mo** | |

### Total

**≈ $1,350 – $1,700 / month → roughly $16,000 – $20,000 / year**, **plus** the Supabase HIPAA add-on (quote-only, could push higher).

**Context:** current spend is likely ~$0–50/month (Free/Pro tiers). HIPAA compliance is the expensive part, not the application. The figures above are **vendor infrastructure only** — they exclude Twilio, HIPAA email, and non-software costs (legal/compliance review, security assessments, staff time, audits).

## 7. Key considerations & risks

1. **Cheaper alternative worth evaluating first:** Many hospital deployments run on **infrastructure the hospital already holds a BAA for** (e.g., internal Azure/AWS under an existing enterprise agreement) rather than signing new vendor BAAs. This could eliminate the Supabase/Render BAA costs entirely. **Ask Northside IT before committing to new vendor contracts.**
2. **Supabase Network Restrictions vs. Render dynamic IPs:** Render's outbound IPs are dynamic by default; a static outbound IP set ($100/mo) is likely needed so Supabase can allowlist a fixed address.
3. **Render HIPAA workspace upgrade is irreversible** — choose the workspace carefully.
4. **A BAA is necessary but not sufficient** — each service must also be *configured* to the HIPAA requirements (see §4–5), and Northside (the covered entity) retains overall responsibility.

## 8. Recommended next steps

1. **Get the Supabase HIPAA add-on quote** — this is the missing cost number.
2. **Consult Northside compliance/IT-security** on: (a) approved-vendor status for Supabase & Render, and (b) whether to host on internal hospital infrastructure instead.
3. If proceeding with vendors: execute the §4 and §5 checklists.
4. Complete the one remaining application-side item: the **temp-account audit** — remove or disable the seeded test accounts (shared known passwords) in the production database. *(PHI-out-of-notes/SMS guardrails: ✅ done July 2026.)*
5. Produce a final annual cost figure for budget approval.

## 9. Application security already in place

The application has already been hardened for a PHI deployment (completed July 2026):

- **Encryption in transit:** Verified TLS to the database (certificate pinned via `DATABASE_CA_CERT`); HSTS and strict security headers on client and API.
- **Access control:** Role-based authorization; object-level access checks (IDOR fixes); CSRF protection; durable session revocation.
- **Automatic logoff (45 CFR §164.312(a)(2)(iii)):** Configurable daily auto-logout that ends every session across all roles — including supervisors and managers — with durable token revocation, so no login survives past the scheduled time; managers can also force-logout any individual user or secretary session on demand (added July 19, 2026).
- **Authentication:** bcrypt password hashing (cost 12); 12-character + symbol password policy; constant-time login; account lockout.
- **PHI minimization:** Patient names excluded by design; PHI stripped from SMS; free-text notes carry an identifier warning, automatic MRN/identifier detection, and an admin toggle to disable notes entirely.
- **Auditability:** PHI read/export audit logging; ~6-year audit-log retention.
- **Supply chain:** Production dependency trees audit clean.

## Sources

- Supabase — HIPAA Compliance: https://supabase.com/docs/guides/security/hipaa-compliance
- Supabase — HIPAA Projects: https://supabase.com/docs/guides/platform/hipaa-projects
- Supabase — Pricing: https://supabase.com/pricing
- Render — HIPAA-enabled Workspaces: https://render.com/blog/introducing-hipaa-enabled-workspaces
- Render — Pricing (Scale plan): https://render.com/blog/better-pricing-for-fast-growing-teams
- Render — Dedicated / Static Outbound IPs: https://render.com/docs/dedicated-ips
