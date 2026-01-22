# AIRIA BEYOND

An AI-powered session management and mood tracking application.

🚀 **Live Demo**: [https://akito-aki.github.io/AIRIA-BEYOND/](https://akito-aki.github.io/AIRIA-BEYOND/)

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

## Configuration

### Environment Variables

For external image generation with Replicate SDXL, you need to configure your API token:

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Get your Replicate API token from [https://replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)

3. Add your token to `.env`:
```
REPLICATE_API_TOKEN=your_actual_token_here
```

**Note:** Without the API token, the application will automatically fall back to local image generation.

### Cost and Rate Limits

- **Rate Limiting**: 5 requests per minute per IP address
- **Concurrency**: Maximum 3 concurrent image generations per IP
- **Costs**: Each SDXL image generation on Replicate costs ~$0.0055 (check current pricing at [replicate.com/pricing](https://replicate.com/pricing))
- **Generation Time**: 30-60 seconds per image

## Development

### Running Locally (Frontend + API)

To run both the frontend and API together:

```bash
npm run dev
```

This starts:
- Frontend (Vite) at `http://localhost:5173/AIRIA-BEYOND/`
- API (Vercel serverless functions) at `http://localhost:3000/api/*`

**Alternative: Run separately**

Frontend only:
```bash
npm run dev:web
```

API only:
```bash
npm run dev:api
```

### Start Development Server (Legacy - Frontend Only)

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

### Phase A: Room Navigation
- Multi-room layout with 5 distinct rooms:
  - **Onboarding**: Welcome and deep-life questions
  - **Main**: Session management and PNG generation
  - **Gallery**: Content placeholder
  - **Album**: Content placeholder
  - **Music**: Content placeholder
- Smooth horizontal swipe navigation between rooms
- Touch and mouse drag support for intuitive room switching
- Click navigation buttons at the top for direct room access
- Minimal white + transparency styling
- Internal routing without external dependencies

### Phase B: Onboarding Deep-Life Questions (NEW!)
- 4-step questionnaire capturing foundational emotional data:
  1. **Recent Emotional Moment**: When, what emotion, and why it happened
  2. **Daily Emotional Pattern**: Time of day and associated emotions
  3. **Emotional Triggers**: Key factors that influence emotions and their importance
  4. **Emotional Goals**: Desired emotional state and timeline for achievement
- Mix of dropdowns and minimal free-text inputs for easy answering
- Data stored in localStorage for persistence
- Progress indicator showing current step
- Blend-mode text effects for elegant minimal design
- Exportable profile data as JSON
- Designed to capture life data that an LLM cannot infer later

### Phase 1: Session Management & JSON Export
- Japanese UI with session start/stop
- 4-choice mood selection (穏やか, 嬉しい, 不安, 疲れ)
- 30s-3m duration
- Intermediate representation JSON download

### Phase 2: PNG Generation
- Generate abstract generative art from session data
- Deterministic image generation (same session data → same PNG)
- Mood-based color palettes:
  - 穏やか (Calm): Cool blues
  - 嬉しい (Happy): Warm yellows/oranges
  - 不安 (Anxious): Grays
  - 疲れ (Tired): Earth tones
- Duration influences visual complexity
- On-screen preview and PNG download

### Phase P0: External Image Generation (Replicate SDXL) 🆕
- High-quality AI image generation using Replicate's SDXL model
- Style presets for classic aesthetics:
  - **抽象油絵** (Abstract Oil Painting): Thick brushstrokes, rich textures
  - **印象派風景** (Impressionist Landscape): Soft brushwork, natural light
  - **ロマン派風景** (Romantic Landscape): Dramatic sky, sublime nature
  - **ミニマル抽象** (Minimal Abstract): Monochromatic, geometric shapes
- Automatic prompt generation from session IR data (mood, duration, tags)
- Asynchronous job processing with real-time status updates
- Fallback to local generation when API token is not configured
- Rate limiting and concurrency guards for cost protection
- 1024x1024px high-quality output

## Usage

### Completing the Onboarding (Onboarding Room)

1. **Navigate to the Onboarding room** using the navigation buttons

2. **Answer 4 deep-life questions:**
   - **Step 1**: Describe a recent emotional moment (when, what emotion, why)
   - **Step 2**: Identify your daily emotional patterns (time and emotion)
   - **Step 3**: Specify your main emotional triggers (what and why)
   - **Step 4**: Set emotional goals (what you want to achieve and when)

3. **Progress through the questions:**
   - Each step requires all fields to be filled before proceeding
   - Use the "次へ →" button to advance to the next step
   - Use the "← 戻る" button to go back and edit previous answers
   - Click "✓ 完了" on the final step to complete

4. **After completion:**
   - Your answers are automatically saved in your browser
   - Download your profile as JSON using "プロフィールをダウンロード"
   - Edit your answers anytime with "回答を編集"

The onboarding data is stored locally and can be used to personalize your session experience.

### Navigating Between Rooms

1. **Start the development server:**
   ```bash
   npm run dev
   ```
   Navigate to `http://localhost:5173/AIRIA-BEYOND/`

2. **Navigate between rooms:**
   - Click on room buttons at the top (Onboarding, Main, Gallery, Album, Music)
   - Swipe left/right or drag with mouse to move between rooms
   - The active room is highlighted in the navigation bar

### Running a Session and Generating Images (Main Room)

1. **Navigate to the Main room** using the navigation buttons

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

5. **Generate with external AI (Replicate SDXL):**
   - Select a style preset (抽象油絵, 印象派風景, etc.)
   - Click "外部生成(Replicate)" to generate a high-quality AI image
   - Wait 30-60 seconds for generation to complete
   - View the result and save to album
   - Note: Requires `REPLICATE_API_TOKEN` to be set in `.env`

The generated PNG is deterministic - generating from the same session data (including seed) will always produce the same image.

## Project Status

**Phase P0 (Prototype)**: External image generation integration complete - Replicate SDXL with style presets, job tracking, rate limiting, and fallback support.

**Phase B**: Onboarding deep-life questions complete - 4-step questionnaire capturing emotional patterns, triggers, and goals with localStorage persistence.

**Phase A**: Room navigation complete - multi-room layout with smooth swipe/touch navigation.

**Phase 1-2**: Session management and PNG generation complete - abstract generative art from session IR.

**Phase 3**: GitHub Pages deployment configured - automatic deployment on push to main branch.

## Deployment

### GitHub Pages (Frontend Only)

The static frontend is automatically deployed to GitHub Pages when changes are pushed to the main branch. The deployment workflow:
1. Builds the application using `npm run build`
2. Uploads the build artifacts from `apps/web/dist/`
3. Deploys to GitHub Pages at https://akito-aki.github.io/AIRIA-BEYOND/

**Note:** GitHub Pages only hosts the static frontend. External image generation requires the API to be deployed separately.

### Vercel (Full Stack - Recommended)

For the complete experience with external image generation:

1. Install Vercel CLI: `npm install -g vercel`
2. Link to Vercel: `vercel link`
3. Add environment variable: `vercel env add REPLICATE_API_TOKEN`
4. Deploy: `vercel --prod`

The `vercel.json` configuration automatically handles:
- Frontend build from `apps/web/dist`
- Serverless API functions from `/api`
- API routing at `/api/*`

### Manual Deployment Testing

To test the production build locally before deployment:

```bash
npm run build
npm run preview
```

This will build and serve the app at `http://localhost:4173/AIRIA-BEYOND/`

## Contributing

This is a monorepo using npm workspaces. All commands at the root proxy to the appropriate workspace.
