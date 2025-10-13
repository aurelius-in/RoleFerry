# Error Handling Guide
## RoleFerry Platform

**Version**: 1.0  
**Audience**: Backend Engineers, Frontend Engineers  
**Purpose**: Standard error handling patterns and user-facing messages

---

## 1. Error Categories

### 1.1 HTTP Status Codes

| Code | Category | When to Use | Example |
|------|----------|-------------|---------|
| **400** | Bad Request | Invalid input (validation failed) | Missing required field |
| **401** | Unauthorized | Missing/invalid auth token | JWT expired |
| **403** | Forbidden | Authenticated but no permission | Accessing other user's data |
| **404** | Not Found | Resource doesn't exist | Job ID not in database |
| **422** | Unprocessable Entity | Semantic validation failed | Email already registered |
| **429** | Too Many Requests | Rate limit exceeded | 60 requests/minute cap hit |
| **500** | Internal Server Error | Unexpected server failure | Database connection failed |
| **503** | Service Unavailable | Temporary outage | Maintenance mode |

---

## 2. Backend Error Handling

### 2.1 Custom Exception Classes

```python
# backend/app/exceptions.py
from fastapi import HTTPException

class RoleFerryException(Exception):
    """Base exception for all RoleFerry errors"""
    pass

class EnrichmentError(RoleFerryException):
    """Enrichment-specific errors"""
    pass

class DeliverabilityError(RoleFerryException):
    """Email sending errors"""
    pass

class RateLimitError(RoleFerryException):
    """Rate limiting errors"""
    pass

# HTTP exception factory
def http_error(status_code: int, message: str, details: dict = None):
    """Create standardized HTTP exception"""
    return HTTPException(
        status_code=status_code,
        detail={
            "error": {
                "code": ERROR_CODES.get(status_code, "UNKNOWN_ERROR"),
                "message": message,
                "details": details or {}
            }
        }
    )

ERROR_CODES = {
    400: "INVALID_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMIT_EXCEEDED",
    500: "INTERNAL_ERROR",
    503: "SERVICE_UNAVAILABLE"
}
```

---

### 2.2 Global Exception Handler

```python
# backend/app/main.py
from fastapi import Request
from fastapi.responses import JSONResponse
import logging

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all for unhandled exceptions"""
    
    # Log error (with context)
    logging.error(
        f"Unhandled exception: {exc}",
        extra={
            "path": request.url.path,
            "method": request.method,
            "user_id": getattr(request.state, 'user', {}).get('user_id')
        },
        exc_info=True
    )
    
    # Don't expose internal details to client
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred. Please try again.",
                "support": "If this persists, contact support@roleferry.com"
            }
        }
    )

@app.exception_handler(RateLimitError)
async def rate_limit_handler(request: Request, exc: RateLimitError):
    """Handle rate limit errors"""
    return JSONResponse(
        status_code=429,
        content={
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "You've exceeded the rate limit. Please try again in a moment.",
                "retry_after": 60
            }
        },
        headers={"Retry-After": "60"}
    )
```

---

## 3. Frontend Error Handling

### 3.1 API Error Interceptor

```typescript
// src/lib/api.ts
import axios from 'axios';
import toast from 'react-hot-toast';

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const errorData = error.response?.data?.error;
    
    // User-friendly error messages
    const messages = {
      400: "Invalid request. Please check your input.",
      401: "Please log in to continue.",
      403: "You don't have permission to do that.",
      404: "We couldn't find what you're looking for.",
      422: errorData?.message || "Please correct the highlighted fields.",
      429: "Too many requests. Please wait a moment.",
      500: "Something went wrong. We're working on it.",
      503: "System is temporarily unavailable. Try again soon."
    };
    
    const message = messages[status] || "An error occurred. Please try again.";
    
    // Show toast notification
    toast.error(message);
    
    // Log to Sentry (error tracking)
    if (status >= 500) {
      Sentry.captureException(error);
    }
    
    return Promise.reject(error);
  }
);
```

---

### 3.2 Error Boundaries (React)

```tsx
// src/components/ErrorBoundary.tsx
import { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true };
  }
  
  componentDidCatch(error: Error, errorInfo: any) {
    // Log to Sentry
    Sentry.captureException(error, { extra: errorInfo });
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-gray-600 mt-2">
            We've been notified and are working on a fix.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 btn-primary"
          >
            Refresh Page
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// Usage
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

---

## 4. User-Facing Error Messages

### 4.1 Principles
- **Be specific**: "Email already registered" (not "Error 422")
- **Be actionable**: "Try a different email" (next step)
- **Be friendly**: "Oops" or "Sorry about that" (human tone)
- **No jargon**: "We couldn't find contacts" (not "Enrichment job failed")

### 4.2 Examples

**Generic Error** (500):
```
"Something went wrong on our end. We've been notified and are working on a fix. Please try again in a few minutes."
```

**Enrichment Failed**:
```
"We couldn't find contacts at [Company]. This can happen for small or private companies. Try:
• Add contact manually (paste LinkedIn URL)
• Skip this job and try another"
```

**Email Sending Failed**:
```
"Your email couldn't be sent right now. This is temporary—we'll retry automatically. Check back in a few minutes."
```

**Payment Failed**:
```
"Payment declined. Please:
• Check your card details
• Try a different card
• Contact your bank

Need help? Email support@roleferry.com"
```

---

## 5. Logging Errors

### 5.1 Structured Error Logs

```python
import logging
import json

logging.error(json.dumps({
    "event": "enrichment_failed",
    "application_id": 123,
    "company": "Acme Corp",
    "error": str(e),
    "provider": "apollo",
    "retry_attempt": 2,
    "timestamp": datetime.utcnow().isoformat()
}))
```

---

## 6. Monitoring & Alerts

### 6.1 Error Rate Alerts

```yaml
# Datadog monitor
name: "API Error Rate High"
query: "avg(last_5m):sum:roleferry.api.errors{status:5xx}.as_count() / sum:roleferry.api.requests.as_count() > 0.01"
message: |
  @pagerduty-roleferry
  API 5xx error rate is >1%.
  Check Datadog APM for stack traces.
```

---

## 7. Acceptance Criteria

- [ ] All HTTP status codes used correctly
- [ ] User-facing messages are friendly, actionable
- [ ] Errors logged (structured JSON)
- [ ] Sentry captures frontend errors
- [ ] Error rate monitored (Datadog alerts)
- [ ] No stack traces exposed to users

---

**Document Owner**: Backend Lead, Frontend Lead  
**Version**: 1.0  
**Date**: October 2025

