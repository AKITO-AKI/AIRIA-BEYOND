# AIRIA BEYOND

An AI-powered session management and mood tracking application.

## Repository Structure

```
AIRIA-BEYOND/
├── apps/
│   └── web/              # Main web application (Vite + React + TypeScript)
├── packages/
│   └── core/             # Shared core packages
├── .github/
│   └── workflows/        # CI/CD workflows
└── package.json          # Monorepo root configuration
```

## Prerequisites

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0

Check your versions:
```bash
node --version
npm --version
```

## Installation

From the repository root, run:

```bash
npm install
```

This will install all dependencies for the monorepo workspaces.

## Development

### Start Development Server

```bash
npm run dev
```

This starts the Vite development server for the web app at `http://localhost:5173/AIRIA-BEYOND/`

### Build for Production

```bash
npm run build
```

This creates an optimized production build in `apps/web/dist/`

### Preview Production Build

```bash
npm run preview
```

This serves the production build locally for testing.

## MVP Flow

- Japanese UI with session start/stop
- 4-choice mood selection
- 30s-3m duration
- Intermediate representation JSON download

## Project Status

**Phase 1.5**: Stabilization complete - reliable installation and build process established.

## Contributing

This is a monorepo using npm workspaces. All commands at the root proxy to the appropriate workspace.
