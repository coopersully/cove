# Contributing to Cove

Thank you for your interest in contributing to Cove! This document provides guidelines and information for contributors.

## Development Setup

1. Fork the repository and clone your fork
2. Follow the [Getting Started](README.md#getting-started) guide
3. Create a new branch for your work: `git checkout -b feat/your-feature`

## Coding Standards

### TypeScript

- All code must be written in TypeScript with strict mode enabled
- Use `type` imports for type-only imports (`import type { Foo }`)
- Prefer `const` assertions and discriminated unions over enums where practical

### Linting & Formatting

We use [Biome](https://biomejs.dev/) for both linting and formatting with strict rules enabled. Before submitting:

```bash
# Check for lint and format issues
pnpm lint

# Auto-fix issues
pnpm lint:fix

# Format all files
pnpm format
```

All code must pass `pnpm lint` with zero errors. CI will reject PRs that fail lint checks.

### Type Checking

```bash
pnpm check
```

All packages must pass strict TypeScript type checking.

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code changes that neither fix a bug nor add a feature
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system or dependency changes
- `ci`: CI/CD configuration changes
- `chore`: Other changes that don't modify src or test files

### Scopes

Use the package or app name as the scope:

- `api`, `ws`, `web`, `mobile`, `desktop`
- `shared`, `gateway`, `db`, `auth`, `api-client`, `ui`, `config`
- `root` for monorepo-level changes

### Examples

```
feat(api): add user registration endpoint
fix(web): resolve dark mode flash on initial load
docs(root): update contributing guidelines
ci(root): add playwright e2e tests to CI pipeline
```

## Pull Request Process

1. **Create a focused PR**: Each PR should address a single concern
2. **Write a clear description**: Explain what changed, why, and how to test it
3. **Ensure CI passes**: All checks must be green before review
4. **Request review**: Tag relevant maintainers based on CODEOWNERS
5. **Address feedback**: Respond to review comments and push updates

### PR Checklist

- [ ] Code follows the project's coding standards
- [ ] All lint checks pass (`pnpm lint`)
- [ ] Type checking passes (`pnpm check`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Tests pass (`pnpm test`)
- [ ] New features include tests
- [ ] Documentation is updated if needed

## Project Structure

See the [Architecture](README.md#architecture) section in the README for an overview of the monorepo structure.

## Getting Help

- Open a [Discussion](https://github.com/coopersully/cove/discussions) for questions
- Check existing [Issues](https://github.com/coopersully/cove/issues) before filing a new one
- Join our community channels (coming soon)

## License

By contributing to Cove, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).
