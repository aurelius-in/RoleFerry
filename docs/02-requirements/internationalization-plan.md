# Internationalization (i18n) Plan
## RoleFerry Platform - Phase 3

**Version**: 1.0  
**Audience**: Product, Engineering  
**Purpose**: Expand to non-US markets (UK, Canada, EU, APAC)

---

## 1. Market Priority

| Market | Priority | Timeline | Users (Potential) | ARR Potential |
|--------|----------|----------|-------------------|---------------|
| **Canada** | P1 | Q1 2027 | 50K | $500K |
| **UK** | P1 | Q1 2027 | 100K | $1M |
| **Australia** | P2 | Q2 2027 | 25K | $250K |
| **Germany** | P2 | Q3 2027 | 80K | $800K |
| **France** | P3 | Q4 2027 | 60K | $600K |

**Selection Criteria**:
- English-speaking (easier launch): Canada, UK, Australia
- Large job markets: UK, Germany
- Similar business culture: Canada, UK, Australia (vs. Japan, China = harder)

---

## 2. Localization Requirements

### 2.1 Language Support

**Tier 1** (Launch Markets):
- English (US) - Default
- English (UK) - Spelling, terminology differences
- English (Canada) - Currency (CAD)

**Tier 2** (Phase 3):
- French (Canada, France)
- German (Germany, Austria, Switzerland)
- Spanish (Spain, Mexico)

---

### 2.2 Regional Differences

| Aspect | US | UK | Canada | Germany |
|--------|----|----|--------|---------|
| **Language** | English | English (colour, CV) | English/French | German |
| **Currency** | USD | GBP | CAD | EUR |
| **Date Format** | MM/DD/YYYY | DD/MM/YYYY | YYYY-MM-DD | DD.MM.YYYY |
| **Privacy Law** | CCPA | GDPR | PIPEDA | GDPR |
| **Job Titles** | PM, Engineer | Programme Manager, Developer | Similar to US | Projektleiter, Entwickler |

---

## 3. Technical Implementation

### 3.1 i18n Library

```typescript
// Frontend: next-intl
import {useTranslations} from 'next-intl';

function JobCard() {
  const t = useTranslations('JobCard');
  
  return (
    <button>{t('apply')}</button>  // "Apply" (EN) | "Aplicar" (ES)
  );
}
```

**Translation Files**:
```
locales/
  en-US.json
  en-GB.json
  fr-CA.json
  de-DE.json
```

---

### 3.2 Backend Localization

```python
# backend: Use locale in responses
from babel.numbers import format_currency

def format_salary(amount, locale='en_US'):
    if locale == 'en_US':
        return format_currency(amount, 'USD', locale=locale)
    elif locale == 'en_GB':
        # Convert USD → GBP (use exchange rate API)
        gbp_amount = amount * get_exchange_rate('USD', 'GBP')
        return format_currency(gbp_amount, 'GBP', locale=locale)
```

---

## 4. Data Residency (GDPR)

### 4.1 EU Data Storage

**Requirement**: EU user data must stay in EU (GDPR Article 44)

**Implementation**:
```python
# Route EU users to EU database
def get_database_url(user_region):
    if user_region in ['DE', 'FR', 'UK', 'ES']:  # EU countries
        return settings.EU_DATABASE_URL  # RDS in eu-west-1 (Ireland)
    else:
        return settings.US_DATABASE_URL  # RDS in us-east-1
```

**Infrastructure**:
- AWS eu-west-1 (Ireland): RDS, ElastiCache, S3
- Replicate application code (same Docker images)
- Route 53 geo-routing (EU users → EU region)

---

## 5. Content Localization

### 5.1 UI Strings

**Example Translations**:
```json
// en-US.json
{
  "apply_button": "Apply Now",
  "match_score": "Match Score",
  "reply_rate": "Reply Rate"
}

// en-GB.json (UK spelling)
{
  "apply_button": "Apply Now",
  "match_score": "Match Score",
  "reply_rate": "Response Rate"  // "Reply" less common in UK
}

// de-DE.json
{
  "apply_button": "Jetzt Bewerben",
  "match_score": "Übereinstimmungswert",
  "reply_rate": "Antwortquote"
}
```

---

### 5.2 Job Data

**Challenges**:
- Job titles vary (US: PM, UK: Programme Manager, Germany: Produktmanager)
- Industries vary (SaaS not universal term)
- Locations (UK: postcodes, Germany: PLZ)

**Solution**: Separate job sources per market (UK job boards, German job boards)

---

## 6. Compliance Per Region

### 6.1 GDPR (EU, UK)
- Data residency (EU data in EU)
- DPO (Data Protection Officer) required
- Cookie consent banner
- 72-hour breach notification
- See: [GDPR Compliance Guide](../07-compliance/gdpr-compliance-guide.md)

### 6.2 PIPEDA (Canada)
- Similar to GDPR (consent, access, deletion rights)
- Canadian Privacy Commissioner oversight
- 72-hour breach notification

### 6.3 Australian Privacy Act
- Australian Privacy Principles (APPs)
- Consent for data collection
- Overseas disclosure rules

---

## 7. Pricing Localization

### 7.1 Currency & Pricing

| Market | Currency | Pro Plan | Conversion | Local Price |
|--------|----------|----------|------------|-------------|
| **US** | USD | $49/mo | 1.0x | $49 |
| **UK** | GBP | £39/mo | 0.8x | Lower (purchasing power) |
| **Canada** | CAD | $65/mo | 1.3x | Higher (currency) |
| **Australia** | AUD | $75/mo | 1.5x | Higher |
| **Germany** | EUR | €45/mo | 0.9x | Similar |

**Strategy**: Adjust for purchasing power parity (not just currency conversion)

---

## 8. Launch Phases

### Phase 1: Canada & UK (Q1 2027)
- [ ] English (UK) translations
- [ ] Currency support (GBP, CAD)
- [ ] Job sources (Indeed UK/CA, LinkedIn UK/CA)
- [ ] Payment: Stripe supports GBP, CAD (no changes needed)
- [ ] Marketing: Localized landing pages, SEO

**Effort**: 6 weeks (backend + frontend changes)

---

### Phase 2: Germany & France (Q3 2027)
- [ ] German, French translations (all UI strings)
- [ ] EUR currency support
- [ ] Job sources (StepStone, XING for DE; APEC, Cadremploi for FR)
- [ ] GDPR: EU data residency (AWS eu-west-1)
- [ ] DPO appointed

**Effort**: 12 weeks (translations + infrastructure)

---

## 9. Acceptance Criteria

- [ ] Market priority defined (Canada/UK first)
- [ ] i18n framework implemented (next-intl, babel)
- [ ] Translation files created (en-US, en-GB as MVP)
- [ ] Currency support (multi-currency pricing)
- [ ] Data residency plan (EU users → EU database)
- [ ] Compliance requirements per region documented
- [ ] Job sources identified (UK/CA job boards)

---

**Document Owner**: VP Product, International Lead (future)  
**Version**: 1.0  
**Date**: October 2025  
**Target Launch**: Q1 2027 (Canada, UK)

