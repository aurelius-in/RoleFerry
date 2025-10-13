# API Versioning Strategy
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Backend Engineers, API Consumers  
**Purpose**: Manage breaking changes without disrupting clients

---

## 1. Versioning Approach

**Strategy**: URL-based versioning (e.g., `/api/v1/jobs`, `/api/v2/jobs`)

**Why URL-based?**:
- ✅ Simple (version in path, explicit)
- ✅ Cacheable (different versions = different URLs)
- ✅ Browser-friendly (easy to test in Postman, curl)
- ❌ Alternative header-based (Accept: application/vnd.roleferry.v1+json) is more "REST-ful" but harder to use

---

## 2. Versioning Rules

### 2.1 When to Bump Version

**Minor Changes** (v1.1, v1.2 - NO version bump):
- Add new endpoint
- Add optional field to request
- Add new field to response
- Change internal implementation (same behavior)

**Breaking Changes** (v1 → v2 - REQUIRES version bump):
- Remove endpoint
- Remove field from response
- Rename field
- Change field type (string → int)
- Change behavior (e.g., pagination default)

---

## 3. Current API Versions

### v1 (Current - October 2025)

**Status**: Stable, production

**Endpoints**: See [API Documentation](api-documentation.md)

**Support**: Indefinite (will support v1 for 2+ years)

---

### v2 (Future - Planned Q2 2026)

**Status**: Not yet released

**Breaking Changes** (from v1):
- `POST /api/v2/applications`: Remove `jobUrl` field (replaced by `jobId`)
- `GET /api/v2/applications`: Add pagination (default 20, max 100)
- `GET /api/v2/match-score`: Return `breakdown` as nested object (was flat)

**Migration Guide**: [Link to v1 → v2 migration doc when ready]

---

## 4. API Lifecycle

```
┌─────────────────────────────────────────────────┐
│   v1 Released (Oct 2025)                         │
│   Status: Current, supported                     │
└────────────────┬────────────────────────────────┘
                 │
                 ▼ (6 months later)
┌─────────────────────────────────────────────────┐
│   v2 Released (Apr 2026)                         │
│   Status: Current, supported                     │
│   v1 Status: Deprecated (12-month sunset)        │
└────────────────┬────────────────────────────────┘
                 │
                 ▼ (12 months later)
┌─────────────────────────────────────────────────┐
│   v1 Sunset (Apr 2027)                           │
│   v1 Returns HTTP 410 Gone                       │
│   v2 Status: Current, supported                  │
└─────────────────────────────────────────────────┘
```

**Deprecation Policy**: 12-month notice before sunset

---

## 5. Deprecation Process

### 5.1 Announce Deprecation

**When**: v2 launches (v1 deprecated)

**How**:
- Blog post ("API v2 Released, v1 Deprecated")
- Email to API consumers
- Add deprecation header to v1 responses:
  ```
  Deprecation: version="v1", sunset="2027-04-01T00:00:00Z"
  Link: <https://docs.roleferry.com/api/v2>; rel="successor-version"
  ```

**Email Template**:
```
Subject: RoleFerry API v2 Released (v1 Deprecated)

Hi [API Consumer],

We've released API v2 with improvements:
• Better pagination
• Cleaner data models
• Improved error messages

v1 will be supported until April 2027 (12 months).

Migration guide: https://docs.roleferry.com/api/migration-v1-v2

Questions? Reply to this email.

- RoleFerry API Team
```

---

### 5.2 Monitor v1 Usage

**Track**:
- Which endpoints are still used (v1 vs. v2)
- Which API consumers haven't migrated

**Datadog**:
```python
statsd.increment(
    'roleferry.api.requests',
    tags=[f'version:v1', f'endpoint:/applications', f'consumer:{api_key_owner}']
)
```

**Alert** (3 months before sunset):
```
Email to consumers still using v1:
"Reminder: API v1 sunsets in 3 months. Please migrate to v2."
```

---

### 5.3 Sunset v1

**Date**: April 2027 (12 months after v2 release)

**Response**:
```http
HTTP/1.1 410 Gone
Content-Type: application/json

{
  "error": {
    "code": "API_VERSION_SUNSET",
    "message": "API v1 is no longer supported. Please upgrade to v2.",
    "docs": "https://docs.roleferry.com/api/v2"
  }
}
```

---

## 6. Backwards Compatibility (Within Version)

### 6.1 Add Fields Safely

**Safe** (v1.1, no breaking change):
```json
// v1.0 response
{
  "id": 123,
  "title": "Senior PM"
}

// v1.1 response (added field, backwards compatible)
{
  "id": 123,
  "title": "Senior PM",
  "salary": "$150K"  // NEW, but existing clients ignore it
}
```

**Unsafe** (requires v2):
```json
// v1 response
{
  "title": "Senior PM"
}

// v2 response (renamed field, BREAKING)
{
  "jobTitle": "Senior PM"  // RENAMED (breaks clients expecting "title")
}
```

---

## 7. Version Negotiation (Optional)

**Content Negotiation** (header-based, Phase 2):
```http
GET /api/jobs
Accept: application/vnd.roleferry.v2+json
```

**Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/vnd.roleferry.v2+json

{...}
```

**Fallback**: If no version specified, default to latest stable (v2)

---

## 8. API Change Log

### v1.1 (November 2025)

**Added**:
- `GET /api/match-score/:userId/:jobId/explain` (new endpoint, detailed breakdown)
- `salary` field in `GET /api/jobs` response (optional, nullable)

**Deprecated**:
- Nothing

**Breaking Changes**:
- None

---

### v2.0 (April 2026 - Planned)

**Added**:
- Pagination on all list endpoints (default: 20, max: 100)
- Cursor-based pagination (no OFFSET, better performance)

**Changed** (Breaking):
- `POST /api/applications`: `jobUrl` → `jobId` (required)
- `GET /api/match-score`: `breakdown` now nested object

**Removed** (Breaking):
- `GET /api/jobs?limit=1000` (max limit reduced to 100)

**Migration**:
```python
# v1
response = requests.post('/api/v1/applications', json={
    'jobUrl': 'https://example.com/job'
})

# v2
response = requests.post('/api/v2/applications', json={
    'jobId': 12345  # Must resolve jobId from URL first
})
```

---

## 9. SDK Versioning

### 9.1 Python SDK

```bash
pip install roleferry-sdk==1.0.0  # v1 API
pip install roleferry-sdk==2.0.0  # v2 API
```

**Usage**:
```python
from roleferry import RoleFerryClient

# v1
client = RoleFerryClient(api_key="...", version="v1")

# v2
client = RoleFerryClient(api_key="...", version="v2")
```

---

## 10. Acceptance Criteria

- [ ] Versioning strategy defined (URL-based, /api/v1/)
- [ ] Versioning rules documented (when to bump version)
- [ ] Deprecation policy established (12-month notice)
- [ ] Deprecation headers added to responses
- [ ] API change log maintained (per version)
- [ ] Migration guides published (v1 → v2)
- [ ] Usage monitoring (track v1 vs. v2 adoption)

---

**Document Owner**: Backend Lead, API Team  
**Version**: 1.0  
**Date**: October 2025

