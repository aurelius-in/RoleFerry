# Feature Flag Strategy
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Backend Engineers, Frontend Engineers, Product  
**Purpose**: Safe feature rollouts and experimentation

---

## 1. Why Feature Flags?

**Benefits**:
- Deploy code without releasing features (decouple deploy from release)
- Test in production with small % of users
- Kill switch for bad features
- A/B testing for product decisions
- Gradual rollouts (1% → 10% → 100%)

---

## 2. Feature Flag Tool

**Choice**: LaunchDarkly (or self-hosted alternative: Unleash)

**Why LaunchDarkly?**:
- Battle-tested (Atlassian, IBM, Microsoft use it)
- Real-time flag updates (no redeploy)
- Targeting rules (user attributes, %, random)
- A/B testing built-in
- $20/seat/month (affordable for small team)

**Alternative** (Phase 2): Self-hosted Unleash (open-source, free)

---

## 3. Feature Flag Types

### 3.1 Release Flags (Temporary)

**Use Case**: Hide new features until ready

**Example**: AI Copilot (Phase 1)
```typescript
if (featureFlags.isEnabled('ai-copilot', user)) {
  return <CopilotPanel />;
}
```

**Lifecycle**:
1. **Development**: Flag OFF (100%)
2. **Internal Testing**: Flag ON for team emails (@roleferry.com)
3. **Beta**: Flag ON for 10% of users
4. **GA**: Flag ON for 100%
5. **Cleanup**: Remove flag from code (after 2 weeks at 100%)

**Cleanup is Critical**: Flags accumulate tech debt if not removed

---

### 3.2 Experiment Flags (Temporary)

**Use Case**: A/B test product decisions

**Example**: Pricing page variant
```typescript
const pricingVariant = featureFlags.getVariant('pricing-experiment', user);

if (pricingVariant === 'control') {
  return <PricingPageA />;  // $49/month
} else {
  return <PricingPageB />;  // $59/month
}
```

**Lifecycle**:
1. **Run Experiment**: 50/50 split for 2 weeks
2. **Analyze Results**: Which variant converted better?
3. **Winner Chosen**: Deploy winner to 100%
4. **Cleanup**: Remove flag, keep winning variant

---

### 3.3 Ops Flags (Permanent)

**Use Case**: Operational controls (no code change needed)

**Examples**:
- **Maintenance Mode**: Disable signups during database migration
- **Rate Limiting**: Adjust API rate limits without deploy
- **Circuit Breaker**: Disable enrichment if provider is down

```python
if featureFlags.is_enabled('enrichment_enabled', user=None):
    enrich_application.delay(application_id)
else:
    # Skip enrichment, provider is down
    logging.info(f"Enrichment disabled via flag for app {application_id}")
```

**Lifecycle**: Permanent (never remove these flags)

---

### 3.4 Permission Flags (Permanent)

**Use Case**: Control access to features by subscription tier

**Example**: Copilot only for Pro users
```typescript
const user = await getCurrentUser();
const canAccessCopilot = featureFlags.isEnabled('copilot', user, {
  tier: user.subscriptionTier  // 'free' | 'pro' | 'teams'
});
```

**LaunchDarkly Rule**:
```json
{
  "rules": [{
    "clauses": [{
      "attribute": "tier",
      "op": "in",
      "values": ["pro", "teams", "enterprise"]
    }],
    "variation": 1  // ON
  }],
  "fallthrough": {
    "variation": 0  // OFF for free tier
  }
}
```

---

## 4. Implementation

### 4.1 Backend (Python)

```python
# backend/app/feature_flags.py
from ldclient import get as ld_client, Config

class FeatureFlagService:
    def __init__(self):
        self.client = ld_client(sdk_key=settings.LAUNCHDARKLY_SDK_KEY)
    
    def is_enabled(self, flag_key: str, user: dict = None) -> bool:
        """Check if feature flag is enabled for user"""
        
        # Default context (anonymous)
        context = {"key": "anonymous", "anonymous": True}
        
        if user:
            context = {
                "key": str(user['id']),
                "email": user['email'],
                "tier": user['subscription_tier'],
                "custom": {
                    "signupDate": user['created_at'].isoformat()
                }
            }
        
        return self.client.variation(flag_key, context, default=False)
    
    def get_variant(self, flag_key: str, user: dict) -> str:
        """Get experiment variant (for A/B tests)"""
        context = {...}  # Same as above
        return self.client.variation(flag_key, context, default="control")

# Usage
feature_flags = FeatureFlagService()

@app.post("/api/applications")
async def create_application(request: Request):
    user = request.state.user
    
    # Check flag before enriching
    if feature_flags.is_enabled('auto-enrich', user):
        enrich_application.delay(application_id)
```

---

### 4.2 Frontend (React)

```typescript
// src/lib/featureFlags.ts
import { useLDClient, useFlags } from 'launchdarkly-react-client-sdk';

export function useFeatureFlag(flagKey: string): boolean {
  const flags = useFlags();
  return flags[flagKey] ?? false;
}

// Usage in component
function CopilotButton() {
  const copilotEnabled = useFeatureFlag('ai-copilot');
  
  if (!copilotEnabled) {
    return null;  // Hide button if flag OFF
  }
  
  return <button>Ask Copilot</button>;
}
```

---

## 5. Targeting Rules

### 5.1 Percentage Rollout

**Use Case**: Gradual rollout (canary deployment)

**LaunchDarkly**:
```
Serve TRUE to 10% of users (bucketed by user ID)
Serve FALSE to 90% of users
```

**Week 1**: 10%  
**Week 2**: 50% (if no issues)  
**Week 3**: 100% (full rollout)

---

### 5.2 User Segment Targeting

**Example**: Beta testers

**LaunchDarkly**:
```json
{
  "rules": [{
    "clauses": [{
      "attribute": "email",
      "op": "endsWith",
      "values": ["@roleferry.com", "@beta-tester.com"]
    }],
    "variation": 1  // ON for team + beta testers
  }]
}
```

---

### 5.3 Custom Attributes

**Example**: Users who signed up after Oct 1

```json
{
  "clauses": [{
    "attribute": "signupDate",
    "op": "after",
    "values": ["2025-10-01T00:00:00Z"]
  }]
}
```

---

## 6. A/B Testing

### 6.1 Pricing Experiment

**Hypothesis**: Raising price to $59/month won't hurt conversion

**Setup**:
- **Control**: $49/month (50% of users)
- **Treatment**: $59/month (50% of users)

**Metrics**:
- Free → Paid conversion rate
- 30-day retention
- Revenue per user

**Code**:
```typescript
const pricingVariant = useFeatureFlag('pricing-test');

const price = pricingVariant === 'treatment' ? 59 : 49;

return (
  <div>
    <h2>Pro Plan - ${price}/month</h2>
    <button onClick={() => upgrade(price)}>Upgrade</button>
  </div>
);
```

**Duration**: 2 weeks (500+ conversions for statistical significance)

**Decision**: If treatment revenue >control (with same or better retention), roll out $59

---

## 7. Kill Switch (Circuit Breaker)

### 7.1 Enrichment Circuit Breaker

**Use Case**: Apollo API is down, disable auto-enrichment

**Flag**: `enrichment_enabled`

**LaunchDarkly**:
- Default: ON
- Toggle to OFF if Apollo down (no redeploy needed)

**Code**:
```python
@celery_app.task
def enrich_application(application_id):
    if not feature_flags.is_enabled('enrichment_enabled'):
        logging.info(f"Enrichment disabled via flag")
        return {"status": "skipped", "reason": "flag_disabled"}
    
    # Proceed with enrichment
    return apollo.search_people(...)
```

**Benefit**: Instant disable (no deploy), prevent cascade failures

---

## 8. Monitoring Flag Usage

### 8.1 Track Flag Evaluations

```python
# Log flag checks (for debugging)
@feature_flags.track_evaluation
def is_enabled(self, flag_key, user):
    result = self.client.variation(...)
    
    # Log to Datadog
    statsd.increment(
        'roleferry.feature_flags.evaluated',
        tags=[f'flag:{flag_key}', f'result:{result}']
    )
    
    return result
```

---

### 8.2 Alert on Unexpected Evaluations

**Datadog Monitor**:
```yaml
name: "Feature Flag Evaluations Spiking"
query: "avg(last_5m):sum:roleferry.feature_flags.evaluated{flag:ai-copilot} > 10000"
message: |
  @slack-engineering
  AI Copilot flag evaluated 10K+ times in 5 min (spike detected).
  Check if LaunchDarkly is slow or flag misconfigured.
```

---

## 9. Flag Hygiene (Avoid Tech Debt)

### 9.1 Flag Lifecycle Policy

**Temporary Flags** (Release, Experiment):
- **Max Lifetime**: 60 days
- **Cleanup**: Remove from code after 100% rollout (2+ weeks)
- **Alert**: Flag older than 60 days → Slack reminder to clean up

**Permanent Flags** (Ops, Permission):
- **Review**: Quarterly (are we still using this?)
- **Document**: Why is this permanent?

---

### 9.2 Flag Audit (Monthly)

**Report**:
```
Flags Active: 15
- 8 release flags (4 > 60 days old ⚠️)
- 2 experiment flags
- 3 ops flags (permanent)
- 2 permission flags (permanent)

Action Items:
- Remove 'old-copilot-v1' (100% rollout 90 days ago)
- Remove 'pricing-test' (experiment concluded)
```

**Assign Cleanup**: Engineering sprint task (15 min each)

---

## 10. Acceptance Criteria

- [ ] Feature flag tool integrated (LaunchDarkly)
- [ ] Flag types defined (release, experiment, ops, permission)
- [ ] Targeting rules implemented (%, segments, attributes)
- [ ] A/B testing framework (variant assignment)
- [ ] Kill switch pattern (circuit breaker for enrichment)
- [ ] Monitoring (flag evaluations tracked)
- [ ] Cleanup policy (60-day max for temporary flags)

---

**Document Owner**: Engineering Manager, Product  
**Version**: 1.0  
**Date**: October 2025

