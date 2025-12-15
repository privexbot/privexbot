# Contributing to PrivexBot

Thank you for your interest in contributing to PrivexBot! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Documentation](#documentation)
- [Community](#community)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in all interactions.

### Our Standards

**Positive behaviors:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community

**Unacceptable behaviors:**
- Trolling, insulting comments, or personal attacks
- Public or private harassment
- Publishing others' private information
- Other conduct inappropriate in a professional setting

### Enforcement

Instances of unacceptable behavior may be reported to support@privexbot.com. All complaints will be reviewed and investigated.

---

## Getting Started

### 1. Fork and Clone

```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/privexbot.git
cd privexbot

# Add upstream remote
git remote add upstream https://github.com/privexbot/privexbot.git
```

### 2. Set Up Development Environment

```bash
# Copy environment file
cp .env.example .env

# Start services
docker compose up -d

# Verify everything works
docker compose ps
```

**See [GETTING_STARTED.md](./GETTING_STARTED.md) for detailed setup instructions.**

### 3. Create a Branch

```bash
# Update your fork
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

---

## Development Workflow

### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Adding tests
- `chore/` - Build/tooling changes

**Examples:**
- `feature/telegram-integration`
- `fix/chatbot-response-timeout`
- `docs/api-reference-update`
- `refactor/services-cleanup`

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Build/tooling changes

**Examples:**
```
feat(chatbot): add temperature control to LLM config

Add slider to chatbot builder for adjusting model temperature.
Default value set to 0.7 with range 0-2.

Closes #123
```

```
fix(widget): resolve chat bubble z-index conflict

Widget bubble was appearing behind some website elements.
Increased z-index from 1000 to 9999.

Fixes #456
```

### Development Process

1. **Write code** - Implement your changes
2. **Test locally** - Ensure everything works
3. **Add tests** - Write unit/integration tests
4. **Update docs** - Document new features
5. **Lint code** - Run linters and formatters
6. **Commit** - Make atomic commits with good messages
7. **Push** - Push to your fork
8. **Pull Request** - Open PR with description

---

## Code Standards

### Python (Backend)

**Style Guide:** PEP 8

**Tools:**
- **ruff** - Linting (replaces flake8, isort, black)
- **mypy** - Type checking

**Run checks:**
```bash
cd backend

# Lint
ruff check .

# Format
ruff format .

# Type check
mypy app/
```

**Configuration:** `backend/pyproject.toml`

**Code Style:**
```python
# Good
from typing import Optional
from uuid import UUID

async def get_chatbot(
    chatbot_id: UUID,
    workspace_id: UUID,
    *,
    include_kb: bool = False
) -> Optional[Chatbot]:
    """
    Retrieve a chatbot by ID within workspace context.

    Args:
        chatbot_id: The chatbot UUID
        workspace_id: The workspace UUID for tenant isolation
        include_kb: Whether to eager-load knowledge bases

    Returns:
        Chatbot instance or None if not found

    Raises:
        PermissionError: If chatbot doesn't belong to workspace
    """
    ...
```

### TypeScript (Frontend)

**Style Guide:** Airbnb TypeScript Style Guide

**Tools:**
- **ESLint** - Linting
- **Prettier** - Formatting
- **TypeScript** - Type checking

**Run checks:**
```bash
cd frontend

# Lint
npm run lint

# Format
npm run format

# Type check
npm run type-check
```

**Code Style:**
```typescript
// Good
import { useState, useEffect } from 'react';
import type { Chatbot, ChatbotConfig } from '@/types';

interface ChatbotBuilderProps {
  initialData?: Chatbot;
  onSave: (chatbot: Chatbot) => Promise<void>;
  onCancel: () => void;
}

export function ChatbotBuilder({
  initialData,
  onSave,
  onCancel
}: ChatbotBuilderProps) {
  const [config, setConfig] = useState<ChatbotConfig>({
    temperature: 0.7,
    maxTokens: 1000,
  });

  // Component logic...
}
```

### JavaScript (Widget)

**Style Guide:** Standard JS

**Tools:**
- **ESLint** - Linting
- **Prettier** - Formatting

**Run checks:**
```bash
cd widget

# Lint
npm run lint

# Format
npm run format
```

### General Principles

1. **Keep functions small** - Single responsibility
2. **Use meaningful names** - Self-documenting code
3. **Comment why, not what** - Code explains what, comments explain why
4. **Avoid magic numbers** - Use named constants
5. **Error handling** - Always handle errors gracefully
6. **Type safety** - Use TypeScript/type hints where possible

---

## Testing

### Backend Tests

**Framework:** pytest

**Structure:**
```
backend/tests/
├── conftest.py           # Fixtures
├── unit/                 # Unit tests
│   ├── test_services.py
│   └── test_utils.py
└── integration/          # Integration tests
    ├── test_api.py
    └── test_database.py
```

**Run tests:**
```bash
cd backend

# All tests
pytest

# Specific test file
pytest tests/unit/test_services.py

# With coverage
pytest --cov=app --cov-report=html
```

**Writing tests:**
```python
import pytest
from app.services.chatbot_service import ChatbotService

@pytest.fixture
def chatbot_service(db_session):
    return ChatbotService(db_session)

def test_create_chatbot(chatbot_service, test_user, test_workspace):
    """Test chatbot creation with valid data."""
    chatbot_data = {
        "name": "Test Bot",
        "description": "A test chatbot",
        "workspace_id": test_workspace.id,
    }

    chatbot = chatbot_service.create(chatbot_data, test_user)

    assert chatbot.name == "Test Bot"
    assert chatbot.workspace_id == test_workspace.id
    assert chatbot.created_by == test_user.id
```

### Frontend Tests

**Framework:** Vitest + React Testing Library

**Run tests:**
```bash
cd frontend

# All tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

**Writing tests:**
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatbotBuilder } from './ChatbotBuilder';

describe('ChatbotBuilder', () => {
  it('renders form with initial data', () => {
    const initialData = {
      name: 'Test Bot',
      description: 'Test description',
    };

    render(<ChatbotBuilder initialData={initialData} />);

    expect(screen.getByLabelText('Name')).toHaveValue('Test Bot');
    expect(screen.getByLabelText('Description')).toHaveValue('Test description');
  });

  it('calls onSave when form is submitted', async () => {
    const onSave = vi.fn();

    render(<ChatbotBuilder onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'New Bot' },
    });
    fireEvent.click(screen.getByText('Save'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Bot' })
    );
  });
});
```

### Test Coverage Requirements

- **Backend:** Minimum 80% coverage
- **Frontend:** Minimum 70% coverage
- **Critical paths:** 100% coverage (auth, payment, data loss)

---

## Submitting Changes

### Pull Request Process

1. **Update your branch**
   ```bash
   git checkout main
   git pull upstream main
   git checkout your-branch
   git rebase main
   ```

2. **Push to your fork**
   ```bash
   git push origin your-branch
   ```

3. **Open Pull Request**
   - Go to GitHub repository
   - Click "New Pull Request"
   - Select your branch
   - Fill in PR template

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How Has This Been Tested?
Describe testing process

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Linting passes
- [ ] Type checking passes
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated checks** - CI/CD must pass
2. **Code review** - At least one maintainer approval
3. **Testing** - Reviewer tests changes locally
4. **Merge** - Maintainer merges PR

### What Happens Next?

- PR reviewed within 2-3 business days
- Feedback provided for improvements
- Once approved, merged to `main`
- Included in next release

---

## Documentation

### When to Update Docs

**Always update:**
- Adding new features
- Changing API endpoints
- Modifying configuration
- Updating dependencies

**Documentation locations:**
- **README.md** - Overview and quick start
- **ARCHITECTURE.md** - System design
- **API_REFERENCE.md** - API endpoints
- **docs/** - Detailed documentation

### Documentation Standards

**Use clear headings:**
```markdown
# Top-Level (once per file)
## Second Level (sections)
### Third Level (subsections)
#### Fourth Level (details)
```

**Include code examples:**
````markdown
```python
# Example with explanation
result = function_call()
```
````

**Add diagrams for complex concepts:**
```
┌─────────┐     ┌─────────┐
│ Frontend│────▶│ Backend │
└─────────┘     └─────────┘
```

---

## Community

### Getting Help

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and ideas
- **Discord** - Real-time chat
- **Email** - support@privexbot.com

### Issue Labels

- `good first issue` - Good for newcomers
- `help wanted` - Need community help
- `bug` - Something isn't working
- `enhancement` - New feature request
- `documentation` - Docs improvements

### Feature Requests

Open an issue with:
1. **Problem statement** - What problem does this solve?
2. **Proposed solution** - How should it work?
3. **Alternatives** - Other solutions considered
4. **Additional context** - Screenshots, examples

---

## Release Process

**Versioning:** Semantic Versioning (semver)

- **Major** (1.0.0) - Breaking changes
- **Minor** (0.1.0) - New features (backwards compatible)
- **Patch** (0.0.1) - Bug fixes

**Release Cycle:**
- Patch releases: As needed
- Minor releases: Monthly
- Major releases: Quarterly

---

## Attribution

Contributors are acknowledged in:
- GitHub contributors page
- CHANGELOG.md
- Release notes

Thank you for making PrivexBot better! 🎉

---

**Questions?** Open a [GitHub Discussion](https://github.com/privexbot/privexbot/discussions) or join our [Discord](https://discord.gg/privexbot)
