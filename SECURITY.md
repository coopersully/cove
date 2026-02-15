# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Cove, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email security concerns to: **coopersully@pm.me**

### What to Include

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fixes (optional)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Fix & Disclosure**: We aim to resolve confirmed vulnerabilities within 30 days

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest on `master` | Yes |
| Older versions | No |

## Security Best Practices

When contributing to Cove, please:

- Never commit secrets, API keys, or credentials
- Use parameterized queries (Drizzle ORM handles this)
- Validate all user input at system boundaries
- Follow the principle of least privilege
- Keep dependencies up to date
