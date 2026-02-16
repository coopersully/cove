<p align="center">
  <img src="apps/web/public/logo.svg" alt="Cove" width="48" height="48" />
  <h1 align="center">Cove</h1>
  <p align="center">A warm, open-source community platform — built for connection, not extraction.</p>
</p>

<p align="center">
  <a href="#overview">Overview</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="#getting-started">Getting Started</a> &middot;
  <a href="#contributing">Contributing</a> &middot;
  <a href="#license">License</a>
</p>

---

## Overview

Cove is a Discord-like community platform that puts people first. It's designed from the ground up to be open-source, self-hostable, and extensible — offering real-time messaging, voice/video chat, rich media sharing, and community management tools.

### Vision

- **Open & Transparent**: Fully open-source under AGPL-3.0. No black boxes.
- **Privacy-First**: Your data, your rules. Self-host or trust a provider.
- **Warm & Inviting**: A cozy, human-centered design language inspired by fireside gatherings.
- **Extensible**: Plugin-ready architecture for communities to customize their experience.

## Architecture

Cove is a **pnpm monorepo** powered by **Turborepo**, structured as:

```
cove/
├── apps/
│   ├── api/          # REST API (Hono on Node.js)
│   ├── ws/           # WebSocket gateway (custom protocol)
│   ├── web/          # Web client (Vite + React 19)
│   ├── mobile/       # Mobile client (React Native + Expo)
│   └── desktop/      # Desktop client (Tauri)
├── packages/
│   ├── config/       # Shared TypeScript & Tailwind configs
│   ├── shared/       # Constants, types, validators (Zod)
│   ├── gateway/      # WebSocket protocol definitions
│   ├── db/           # Database schema & client (Drizzle + PostgreSQL)
│   ├── auth/         # Authentication logic
│   ├── api-client/   # Typed API client
│   └── ui/           # Shared UI components (React + Tailwind)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 24 LTS |
| Language | TypeScript 5.8 (strict) |
| API | Hono |
| Database | PostgreSQL 17 + Drizzle ORM |
| Cache/PubSub | Redis (Dragonfly) |
| Validation | Zod |
| Web | Vite + React 19 + React Router + Zustand + TanStack Query |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Mobile | React Native + Expo SDK 54 |
| Desktop | Tauri v2 |
| Linting | Biome (strict) |
| Testing | Vitest + Playwright |
| CI/CD | GitHub Actions + Turborepo |

## Getting Started

### Prerequisites

- [Node.js 24+](https://nodejs.org/)
- [pnpm 10.16+](https://pnpm.io/)
- [Docker](https://www.docker.com/) (for PostgreSQL and Redis)

### Setup

```bash
# Clone the repository
git clone https://github.com/coopersully/cove.git
cd cove

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start local services (PostgreSQL + Redis)
docker compose up -d

# Run the full build
pnpm build

# Start development servers
pnpm dev
```

### Available Scripts

| Command | Description |
|---------|------------|
| `pnpm dev` | Start all development servers |
| `pnpm build` | Build all packages and apps |
| `pnpm check` | Run TypeScript type checking |
| `pnpm lint` | Run Biome linting and format checks |
| `pnpm lint:fix` | Auto-fix lint and format issues |
| `pnpm test` | Run all tests |
| `pnpm format` | Format all files with Biome |

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our development process, coding standards, and how to submit pull requests.

Please also review our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Cove is licensed under the [GNU Affero General Public License v3.0](LICENSE).

This means you can freely use, modify, and distribute Cove, but any modifications to the server-side code must also be made available under the same license — even when running as a network service.
