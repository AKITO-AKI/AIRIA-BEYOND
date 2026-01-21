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

### Phase 1: Session Management & JSON Export
- Japanese UI with session start/stop
- 4-choice mood selection (穏やか, 嬉しい, 不安, 疲れ)
- 30s-3m duration
- Intermediate representation JSON download

### Phase 2: PNG Generation (NEW!)
- Generate abstract generative art from session data
- Deterministic image generation (same session data → same PNG)
- Mood-based color palettes:
  - 穏やか (Calm): Cool blues
  - 嬉しい (Happy): Warm yellows/oranges
  - 不安 (Anxious): Grays
  - 疲れ (Tired): Earth tones
- Duration influences visual complexity
- On-screen preview and PNG download

## Usage

### Running a Session and Generating Images

1. **Start the development server:**
   ```bash
   npm run dev
   ```
   Navigate to `http://localhost:5173/AIRIA-BEYOND/`

2. **Create a session:**
   - Select a mood (穏やか, 嬉しい, 不安, or 疲れ)
   - Select a duration (30s, 60s, 120s, or 180s)
   - Click "Start" to begin the session
   - Click "Stop" when finished

3. **Download session data:**
   - Click "Download JSON" to save the intermediate representation

4. **Generate and download PNG:**
   - Click "PNG生成" to generate an abstract image based on your session
   - View the preview on screen
   - Click "Download PNG" to save the generated image

The generated PNG is deterministic - generating from the same session data (including seed) will always produce the same image.

## Project Status

**Phase 2**: PNG generation complete - abstract generative art from session IR.

## Contributing

This is a monorepo using npm workspaces. All commands at the root proxy to the appropriate workspace.
