# Frontend Architecture
## RoleFerry Platform

**Framework**: Next.js 14, React 18, TypeScript  
**Audience**: Frontend Engineers  
**Purpose**: Frontend structure, patterns, best practices

---

## 1. Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth group
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── jobs/              # Jobs list
│   │   ├── tracker/           # Application tracker
│   │   ├── settings/          # User settings
│   │   └── layout.tsx         # Root layout
│   ├── components/            # Reusable components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── JobCard.tsx
│   │   ├── ApplicationCard.tsx
│   │   ├── Copilot.tsx
│   │   └── Navbar.tsx
│   ├── lib/                   # Utilities
│   │   ├── api.ts            # API client
│   │   ├── auth.ts           # Auth helpers
│   │   └── utils.ts          # General utilities
│   ├── hooks/                 # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useJobs.ts
│   │   └── useApplications.ts
│   ├── store/                 # Zustand stores
│   │   ├── authStore.ts
│   │   └── uiStore.ts
│   └── types/                 # TypeScript types
│       ├── user.ts
│       ├── job.ts
│       └── application.ts
├── public/                    # Static assets
├── tests/                     # Jest tests
└── package.json
```

---

## 2. State Management

### 2.1 Global State (Zustand)

```typescript
// src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      
      login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        set({
          user: response.data.user,
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token
        });
      },
      
      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null });
      },
      
      refreshAccessToken: async () => {
        const { refreshToken } = get();
        const response = await api.post('/auth/refresh', { refresh_token: refreshToken });
        set({ accessToken: response.data.access_token });
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ refreshToken: state.refreshToken })  // Only persist refresh token
    }
  )
);
```

---

### 2.2 Server State (React Query)

```typescript
// src/hooks/useJobs.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useJobs(filters?: JobFilters) {
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: async () => {
      const response = await api.get('/api/jobs', { params: filters });
      return response.data.jobs;
    },
    staleTime: 5 * 60 * 1000,  // 5 minutes
    cacheTime: 10 * 60 * 1000,  // 10 minutes
    refetchOnWindowFocus: false
  });
}

export function useApplyToJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (jobId: number) => {
      return api.post('/api/applications', { job_id: jobId });
    },
    onSuccess: () => {
      // Invalidate applications query (refresh Tracker)
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    }
  });
}
```

---

## 3. API Client

```typescript
// src/lib/api.ts
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor (add auth token)
api.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor (handle 401, refresh token)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Attempt to refresh token
        await useAuthStore.getState().refreshAccessToken();
        
        // Retry original request with new token
        const newToken = useAuthStore.getState().accessToken;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export { api };
```

---

## 4. Component Patterns

### 4.1 Feature-Based Components

```tsx
// src/components/JobCard.tsx
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, MapPin, DollarSign } from 'lucide-react';

interface JobCardProps {
  job: Job;
  matchScore: number;
  onApply: (jobId: number) => void;
  onSave: (jobId: number) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, matchScore, onApply, onSave }) => {
  const matchColor = 
    matchScore >= 90 ? 'bg-purple-100 text-purple-700' :
    matchScore >= 75 ? 'bg-green-100 text-green-700' :
    matchScore >= 50 ? 'bg-yellow-100 text-yellow-700' :
    'bg-red-100 text-red-700';
  
  const matchLabel =
    matchScore >= 90 ? 'Excellent' :
    matchScore >= 75 ? 'Strong' :
    matchScore >= 50 ? 'Fair' : 'Low';
  
  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={job.company.logo_url} 
              alt={job.company.name}
              className="w-12 h-12 rounded"
            />
            <div>
              <h3 className="font-semibold text-lg">{job.title}</h3>
              <p className="text-sm text-gray-600">{job.company.name}</p>
            </div>
          </div>
          <Badge className={matchColor}>
            {matchScore} {matchLabel}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="flex flex-col gap-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>{job.location}</span>
            {job.remote && <Badge variant="outline">Remote</Badge>}
          </div>
          
          {job.comp_min && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span>${job.comp_min.toLocaleString()} - ${job.comp_max.toLocaleString()}</span>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 mt-4">
          <Button onClick={() => onApply(job.id)} className="flex-1">
            Apply
          </Button>
          <Button onClick={() => onSave(job.id)} variant="outline">
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
```

---

## 5. Performance Optimization

### 5.1 Code Splitting
```typescript
// Lazy load heavy components
import dynamic from 'next/dynamic';

const Copilot = dynamic(() => import('@/components/Copilot'), {
  loading: () => <CopilotSkeleton />,
  ssr: false  // Don't render on server
});
```

### 5.2 Image Optimization
```tsx
import Image from 'next/image';

<Image 
  src={job.company.logo_url}
  alt={job.company.name}
  width={48}
  height={48}
  loading="lazy"
  placeholder="blur"
/>
```

---

## 6. Testing

```typescript
// tests/components/JobCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { JobCard } from '@/components/JobCard';

test('renders job title and company', () => {
  const mockJob = {
    id: 1,
    title: 'Senior PM',
    company: { name: 'Acme Corp', logo_url: '...' }
  };
  
  render(<JobCard job={mockJob} matchScore={85} onApply={jest.fn()} onSave={jest.fn()} />);
  
  expect(screen.getByText('Senior PM')).toBeInTheDocument();
  expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  expect(screen.getByText('85 Strong')).toBeInTheDocument();
});

test('calls onApply when Apply button clicked', () => {
  const onApply = jest.fn();
  render(<JobCard job={mockJob} matchScore={85} onApply={onApply} onSave={jest.fn()} />);
  
  fireEvent.click(screen.getByText('Apply'));
  expect(onApply).toHaveBeenCalledWith(1);
});
```

---

**Document Owner**: Frontend Lead  
**Version**: 1.0  
**Date**: October 2025

