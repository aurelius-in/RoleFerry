# Launch Page Checks — Dependency Report (DNS Validation + Bounce History)
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Founder/Operator, DevOps, Engineering  
**Purpose**: Explain which Launch-page checks cannot be fully completed without additional configuration/integrations, and provide step-by-step instructions to resolve each warning.

---

## 1) Executive Summary

On the **Deliverability / Launch** page, RoleFerry runs “pre-flight” checks. Two of the warnings you saw are expected unless you provide additional inputs or integrations:

- **DNS Validation (SPF/DMARC/DKIM)** requires you to provide a **sender domain** (and optionally a DKIM selector) *and* to have real DNS records configured in your DNS provider.
- **Bounce History** requires RoleFerry to receive **delivery events** (bounces/spam reports) from a real sending provider over time. This needs a provider integration (webhooks/API) and storage.

---

## 2) DNS Validation — Why it warns, and how to fix it

### 2.1 What RoleFerry can do today

RoleFerry can perform a best-effort DNS check for:

- **SPF**: TXT record containing `v=spf1`
- **DMARC**: TXT record at `_dmarc.<domain>` containing `v=DMARC1`
- **DKIM** (optional): TXT at `<selector>._domainkey.<domain>` containing `v=DKIM1` **if you provide a selector**
- **MX**: existence of an MX record

### 2.2 What RoleFerry cannot do without you doing something

- If you do **not** enter a sender domain, RoleFerry cannot know what domain to check, so it must warn:
  - “Sender domain not provided (SPF/DMARC/DKIM not checked)”

### 2.3 Operator instructions (what to do)

**Step A — Identify your sender domain**

- Your sender domain is the domain part of the email address you will send from, e.g.:
  - `you@yourdomain.com` → sender domain = `yourdomain.com`

**Step B — Enter it in RoleFerry**

1. Go to **Deliverability / Launch**
2. In **Sender domain (optional, enables real DNS checks)** enter: `yourdomain.com`

**Step C — (Optional) Provide DKIM selector**

DKIM selectors are provider-specific. Examples:

- Google Workspace often uses selector: `google`
- Some providers use: `default`, `selector1`, `s1`, `s2`

1. Find your DKIM selector in your email provider’s “Domain authentication / DKIM” settings.
2. Enter the selector in RoleFerry’s **DKIM selector** field.

**Step D — Configure SPF/DMARC/DKIM in DNS**

You must add records at your DNS host (Cloudflare/Namecheap/etc.) based on your sending provider.

- For a concrete example, see: `docs/04-technical/email-infrastructure-guide.md`  
  (it includes example SPF/DKIM/DMARC records and guidance.)

**Step E — Re-run Pre-Flight Checks**

- Click **Run Pre-Flight Checks**
- DNS Validation should move from WARNING → PASS (or WARNING with specific missing pieces).

### 2.4 Notes / constraints

- If you’re using a sending provider that publishes DKIM as **CNAME records** (common), RoleFerry’s current DKIM check may not be able to verify DKIM purely via TXT pattern matching. In that case, the check may remain a WARNING until RoleFerry supports CNAME-based DKIM verification or DNS-over-HTTPS parsing improvements.

---

## 3) Bounce History — Why it warns, and how to fix it

### 3.1 What RoleFerry can do today

- RoleFerry can **record “launch events”** (campaign launched, contacts targeted).
- RoleFerry can run **copy risk + verification** checks before launch.

### 3.2 What RoleFerry cannot do without you doing something

RoleFerry cannot produce real bounce history unless:

- You send email via a real provider, and
- That provider sends delivery events back to RoleFerry (bounces, blocks, spam complaints), and
- RoleFerry stores those events and aggregates them by domain/mailbox over time.

Without those pieces, RoleFerry must warn:

- “Bounce history unavailable… requires tracking sends from a connected mailbox/domain over time.”

### 3.3 Two valid paths (pick one)

#### Path 1 — Use an ESP (recommended for early demos)

**Examples**: SendGrid, Mailgun, Postmark, Amazon SES

What you need:

1. **A sending provider account**
2. **Domain authentication** (SPF/DKIM/DMARC) — see Section 2
3. **Webhooks configured** to call RoleFerry when events happen (delivered, bounced, spam report, etc.)
4. **RoleFerry webhook endpoints** to receive and store those events (engineering work)

Good reference in existing docs:

- `docs/04-technical/email-infrastructure-guide.md` includes an example SendGrid Event Webhook configuration.

#### Path 2 — Use an outreach platform (Smartlead/Instantly)

If you send through a platform like Smartlead/Instantly:

- They will track bounces/replies inside their product.
- To show bounce history inside RoleFerry, you’d need:
  - Their **API key**
  - A RoleFerry integration that pulls stats + maps them to contacts/campaigns (engineering work)

### 3.4 What’s needed in RoleFerry to remove the warning (engineering checklist)

- [ ] Pick a provider target for V1 (SendGrid or Postmark)
- [ ] Implement webhook route(s) in backend (e.g. `/webhooks/sendgrid`)
- [ ] Store events in Postgres (tables for `email_event`, `bounce_event`, `complaint_event`)
- [ ] Aggregate “Bounce History” metrics (last 7d / 30d rates, per mailbox/domain)
- [ ] Update Launch page pre-flight check to use real aggregated metrics

---

## 4) Quick “What you can do right now” checklist

- **To fix DNS Validation warning**:
  - Enter sender domain on Launch screen
  - Add SPF/DMARC (and DKIM selector if applicable)
  - Re-run checks

- **To fix Bounce History warning**:
  - Choose a sending provider (SendGrid/Postmark/etc.)
  - Configure authenticated sending + event webhooks
  - (Requires engineering) implement webhook ingestion + storage in RoleFerry

---

**Document Owner**: RoleFerry Engineering  
**Date**: January 2026

