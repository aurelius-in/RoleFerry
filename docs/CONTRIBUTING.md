# Contributing to RoleFerry

Thank you for your interest in contributing to RoleFerry! This document provides guidelines for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Maintain professional communication

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 15+
- Redis 7+
- Docker (for local development)

### Local Setup
```bash
# Clone repository
git clone https://github.com/your-org/roleferry.git
cd roleferry

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install

# Start services
docker-compose up -d  # PostgreSQL, Redis
npm run dev  # Frontend (port 3000)
python -m app  # Backend (port 8000)
```

## Development Workflow

### Branch Strategy
- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: New features
- `bugfix/*`: Bug fixes
- `hotfix/*`: Critical production fixes

### Making Changes
1. Create branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. Make your changes
3. Write/update tests
4. Run linters:
   ```bash
   # Backend
   black .
   isort .
   mypy .
   
   # Frontend
   npm run lint
   npm run type-check
   ```

5. Commit with conventional commits:
   ```
   feat: Add user persona builder
   fix: Resolve enrichment timeout issue
   docs: Update API specification
   test: Add unit tests for match scoring
   ```

6. Push and create Pull Request:
   ```bash
   git push origin feature/your-feature-name
   ```

### Pull Request Guidelines
- **Title**: Use conventional commit format
- **Description**: Explain what and why
- **Screenshots**: For UI changes
- **Tests**: Ensure >80% coverage
- **Documentation**: Update docs if needed

### Code Review Process
1. At least 1 approval required
2. All CI checks must pass
3. No merge conflicts
4. Reviewer feedback addressed

## Coding Standards

### Python (Backend)
- Follow PEP 8
- Use type hints
- Docstrings for public functions
- Max line length: 100 characters

```python
from typing import Optional

def calculate_match_score(user_id: int, job_id: int) -> Optional[int]:
    """Calculate match score between user and job.
    
    Args:
        user_id: User identifier
        job_id: Job identifier
        
    Returns:
        Match score (0-100) or None if data insufficient
    """
    # Implementation
    pass
```

### TypeScript (Frontend)
- Use functional components
- Props types defined
- Avoid `any` type
- Max line length: 100 characters

```typescript
interface JobCardProps {
  job: Job;
  matchScore: number;
  onApply: (jobId: number) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, matchScore, onApply }) => {
  // Implementation
};
```

## Testing

### Backend Tests
```bash
cd backend
pytest tests/ --cov=app --cov-report=html
```

### Frontend Tests
```bash
cd frontend
npm test
npm run test:coverage
```

### E2E Tests
```bash
npm run test:e2e
```

## Documentation

- Update README.md for setup changes
- Update docs/ for architecture changes
- API changes → update `docs/04-technical/api-specification.md`
- Add inline comments for complex logic

## Need Help?

- 💬 Slack: #engineering channel
- 📧 Email: engineering@roleferry.com
- 📖 Docs: /docs folder

---

Thank you for contributing to RoleFerry! 🚀

