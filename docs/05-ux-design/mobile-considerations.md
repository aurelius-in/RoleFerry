# Mobile Experience Considerations
## RoleFerry Platform (Phase 2)

**Version**: 1.0  
**Audience**: Product, Design, Mobile Engineers  
**Purpose**: Plan for mobile app (React Native)

---

## 1. Mobile Strategy

### Phase 1 (Current): Mobile-Responsive Web
- Next.js responsive design (Tailwind breakpoints)
- Core features accessible on mobile browser
- Install as PWA (Progressive Web App)

### Phase 2 (Q4 2026): Native Mobile App
- React Native (iOS + Android)
- Focus: Tracker + Notifications (not full feature parity)
- Use case: On-the-go reply management, interview tracking

---

## 2. Responsive Web (Current)

### 2.1 Breakpoints
```css
/* Mobile First */
.job-grid {
  grid-template-columns: 1fr;  /* 1 column */
}

@media (min-width: 768px) {
  .job-grid {
    grid-template-columns: repeat(2, 1fr);  /* 2 columns */
  }
}

@media (min-width: 1024px) {
  .job-grid {
    grid-template-columns: repeat(3, 1fr);  /* 3 columns */
  }
}
```

---

### 2.2 Mobile Navigation

**Desktop**: Top nav (Jobs, Tracker, Copilot, Settings)  
**Mobile**: Bottom nav (icons only)

```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-white border-t md:hidden">
  <div className="flex justify-around py-2">
    <Link href="/jobs"><BriefcaseIcon /></Link>
    <Link href="/tracker"><ClipboardIcon /></Link>
    <Link href="/settings"><SettingsIcon /></Link>
  </div>
</nav>
```

---

### 2.3 Touch Targets

**Minimum size**: 44px × 44px (Apple HIG, Android Material Design)

```css
/* ✅ GOOD: Large enough for touch */
.button {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 16px;
}

/* ❌ BAD: Too small */
.icon-button {
  width: 24px;
  height: 24px;
}
```

---

## 3. Native Mobile App (React Native)

### 3.1 Feature Scope (MVP)

**Included**:
- ✅ Tracker (Board + Table view)
- ✅ Reply notifications (push notifications)
- ✅ Application detail (view, add notes, log interviews)
- ✅ Quick reply (respond to emails)
- ✅ Settings (basic profile, notifications)

**Excluded** (use web):
- ❌ Jobs discovery (better on desktop, larger screen)
- ❌ Apply workflow (enrichment, draft editing)
- ❌ Copilot (typing-heavy, desktop-optimized)
- ❌ Advanced settings (deliverability, sequences)

**Rationale**: Mobile is for **managing active pipeline**, not full job search.

---

### 3.2 Tech Stack

```typescript
// React Native
react-native: 0.73
react-navigation: 6.x (routing)
react-native-push-notification: Push alerts
react-native-webview: Fallback to web views
react-query: API state management
zustand: Global state (auth, user)

// Backend
No changes (same FastAPI endpoints)
Add: Push notification service (FCM for Android, APNS for iOS)
```

---

### 3.3 Push Notifications

**Trigger Events**:
- Reply received ("Sarah Smith replied!")
- Interview reminder (1 hour before)
- Sequence started ("Outreach sent to 2 contacts")
- Health alert (Deliverability issue, recruiter only)

**Implementation**:
```typescript
// Mobile app: Register device token
import messaging from '@react-native-firebase/messaging';

async function registerForPushNotifications() {
  const token = await messaging().getToken();
  
  // Send to backend
  await api.post('/api/user/device-token', { token });
}

// Backend: Send push notification
from firebase_admin import messaging

def send_push_notification(user_id, title, body):
    device_tokens = get_user_device_tokens(user_id)
    
    message = messaging.MulticastMessage(
        notification=messaging.Notification(
            title=title,
            body=body
        ),
        tokens=device_tokens
    )
    
    response = messaging.send_multicast(message)
    logging.info(f"Sent push to {response.success_count} devices")
```

---

## 4. Offline Support

### 4.1 Read-Only Offline Mode
**Use Case**: User on airplane, wants to review applications

**Strategy**:
- Cache last-fetched data (React Query persistence)
- Show "Offline" banner
- Disable actions requiring server (Apply, Send)

```typescript
import NetInfo from '@react-native-community/netinfo';

// Detect connectivity
NetInfo.addEventListener(state => {
  setIsConnected(state.isConnected);
});

// Show offline banner
{!isConnected && (
  <Banner variant="warning">
    You're offline. Viewing cached data.
  </Banner>
)}
```

---

## 5. Mobile UX Patterns

### 5.1 Swipe Actions (Tracker)
```tsx
// Swipe left on application card → Quick actions
<Swipeable
  renderRightActions={() => (
    <>
      <Button onPress={moveToInterviewing}>Interviewing</Button>
      <Button onPress={reject}>Reject</Button>
    </>
  )}
>
  <ApplicationCard />
</Swipeable>
```

---

### 5.2 Pull-to-Refresh
```tsx
import { RefreshControl } from 'react-native';

<ScrollView
  refreshControl={
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={async () => {
        setIsRefreshing(true);
        await refetchApplications();
        setIsRefreshing(false);
      }}
    />
  }
>
  {applications.map(app => <ApplicationCard key={app.id} app={app} />)}
</ScrollView>
```

---

## 6. Acceptance Criteria (Mobile Web - Current)

- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Touch targets ≥44px
- [ ] Bottom nav on mobile (<768px)
- [ ] Forms usable on mobile (large inputs, native keyboards)
- [ ] Performance: <3s page load on 3G

## 7. Acceptance Criteria (Native App - Phase 2)

- [ ] React Native app builds (iOS + Android)
- [ ] Push notifications work (replies, interviews)
- [ ] Tracker syncs with web (same data)
- [ ] Offline mode (read-only cached data)
- [ ] App Store approval (iOS, Android)
- [ ] App size <50MB (download-able on cellular)

---

**Document Owner**: Mobile Lead (future hire), UX Designer  
**Version**: 1.0  
**Date**: October 2025  
**Next Review**: Q3 2026 (before mobile app development starts)

