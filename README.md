# AIRIA BEYOND

An AI-powered session management and mood tracking application.

🚀 **Live Demo**: [https://akito-aki.github.io/AIRIA-BEYOND/](https://akito-aki.github.io/AIRIA-BEYOND/)

## Architecture

AIRIA BEYOND uses a split architecture for cost-effective deployment:

- **Frontend**: GitHub Pages (static hosting) - `https://akito-aki.github.io/AIRIA-BEYOND/`
- **Backend API**: Render (Node.js/Express) - `https://airia-beyond.onrender.com`

```
┌─────────────────────────────┐
│  GitHub Pages               │
│  (Frontend Static Files)    │
│  https://akito-aki.github.io│
│  /AIRIA-BEYOND/             │
└──────────┬──────────────────┘
           │
           │ API Calls (CORS enabled)
           ▼
┌─────────────────────────────┐
│  Render Web Service         │
│  (Express.js Backend)       │
│  https://airia-beyond.      │
│  onrender.com               │
│  /api/*                     │
└─────────────────────────────┘
```

**See [docs/RENDER_DEPLOYMENT.md](./docs/RENDER_DEPLOYMENT.md) for deployment instructions.**

## Repository Structure

```
AIRIA-BEYOND/
├── apps/
│   └── web/              # Main web application (Vite + React + TypeScript)
├── api/
│   ├── routes/           # Express API routes
│   ├── controllers/      # Express API controllers
│   ├── lib/              # Utility libraries (rate limiting, etc.)
│   └── *.js              # Supporting modules (job stores, LLM services, etc.)
├── packages/
│   └── core/             # Shared core packages
├── .github/
│   └── workflows/        # CI/CD workflows
├── server.js             # Express API server entry point
├── render.yaml           # Render deployment configuration
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

For external image generation with Replicate SDXL and LLM-based analysis, you need to configure API tokens:

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Get your API tokens:
   - **Replicate**: [https://replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
   - **OpenAI**: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

3. Add your tokens to `.env`:
```
REPLICATE_API_TOKEN=your_replicate_token_here
OPENAI_API_KEY=your_openai_api_key_here
```

**Note:** 
- Without `REPLICATE_API_TOKEN`, the app falls back to local image generation
- Without `OPENAI_API_KEY`, the app uses rule-based analysis instead of LLM
- Set `DISABLE_LLM_ANALYSIS=true` to force rule-based analysis (for cost control)

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
- Backend API (Express) at `http://localhost:3000/api/*`

**Alternative: Run separately**

Frontend only:
```bash
npm run dev:web
```

Backend API only:
```bash
npm run dev:api  # or npm run server:dev
```

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

### Phase P1: Robust Generation Flow (NEW! 🎉)
- **Enhanced Job State Management**:
  - Retry tracking with `retryCount` and `maxRetries` (default: 3)
  - Error tracking with standardized error codes (TIMEOUT, NETWORK_ERROR, API_ERROR, etc.)
  - Complete lifecycle logging (created → running → succeeded/failed)
  - Full input parameter storage for retry capability

- **Timeout Handling**:
  - 120-second timeout for API calls to prevent hung requests
  - Automatic job failure on timeout with TIMEOUT error code
  - Comprehensive timeout event logging

- **Server-Side Automatic Retry**:
  - Automatic retry on transient errors (network issues, 5xx server errors)
  - Exponential backoff between retries (2s → 4s → 8s, max 30s)
  - Stops after 3 retries and marks as permanently failed
  - All retry attempts logged with context

- **Client-Side Manual Retry**:
  - Retry button appears on failed jobs in the UI
  - Creates new job with same input parameters
  - Clear user feedback during retry process

- **Fallback Mechanism**:
  - Option to fall back to local Canvas generation on external failure
  - Clear Japanese prompt: "外部生成に失敗しました。ローカル生成に切り替えますか？"
  - Seamless transition to deterministic local generation

- **Enhanced UI Status Display**:
  - Clear display for all job states (queued/running/succeeded/failed)
  - Animated progress indicator with spinner
  - Detailed error information with error codes and messages
  - Retry count display (e.g., "リトライ回数: 1/3")
  - Job ID display for tracking

- **Error Logging & Monitoring**:
  - All job lifecycle events logged with timestamps
  - Context includes provider, model, input summary, error details
  - Standardized error codes for consistent monitoring

- **Job Cleanup**:
  - Admin endpoints for job management (`GET/DELETE /api/admin/jobs`)
  - Auto-cleanup of old jobs after 1 hour

**User Experience**: Never leaves users stuck! Always provides clear feedback, automatic recovery from transient errors, manual retry options, and fallback to local generation when needed.

### Phase P2: LLM-based Analysis (NEW! 🎉)
- **Intelligent Session Analysis**:
  - Uses OpenAI GPT-4o-mini to generate intermediate representation (IR) from session data
  - Analyzes mood, duration, and optional free text to produce emotional metrics
  - Returns valence (-1 to +1), arousal (0 to 1), focus (0 to 1), and artistic motif tags

- **Intermediate Representation (IR)**:
  - **Valence**: Emotional pleasantness (-1=unpleasant, +1=pleasant)
  - **Arousal**: Energy level (0=calm, 1=excited)
  - **Focus**: Attention/concentration level (0 to 1)
  - **Motif Tags**: 3-5 classical/artistic vocabulary terms (e.g., 静寂, 水面, 光, 影)
  - **Confidence**: Analysis certainty (0 to 1)
  - **Classical Profile**: Optional hints for music generation (tempo, dynamics, harmony)

- **LLM Prompt Design**:
  - Japanese-language prompt with classical music and fine art context
  - Rich vocabulary: light/shadow (光/影), nature (水面/霧/森), emotion (孤独/荘厳/静寂)
  - Strict JSON output with examples for guidance
  - Emphasizes classical music and painting aesthetics

- **JSON Validation**:
  - Zod schema validation ensures type safety and range constraints
  - Validation failures logged with raw LLM response
  - One retry attempt with stricter prompt
  - Falls back to rule-based on persistent validation errors

- **Rule-based Fallback**:
  - Deterministic generation when LLM unavailable or fails
  - Mood-based mappings (穏やか→valence:0.6, 嬉しい→valence:0.8, etc.)
  - Duration influences focus (longer sessions = higher focus, capped at 0.9)
  - Predefined motif tags per mood category
  - Always returns confidence: 0.5 for rule-based

- **Privacy-First Design**:
  - No raw audio or video sent to LLM
  - Only text-based session metadata (mood, duration, optional freeText)
  - onboardingData optional and user-controlled
  - Timestamp for context

- **Analysis API (`/api/analyze`)**:
  - POST endpoint returns job ID immediately (202 Accepted)
  - Async processing with status polling
  - Integrates with P1 job system (retry, timeout, error handling)
  - Rate limited (5 req/min) and concurrency limited (3 concurrent)

- **Client Integration**:
  - Analysis runs automatically before image generation
  - Beautiful gradient UI card displays IR results to user
  - Shows valence, arousal, focus, motif tags, and confidence
  - Analysis status indicator with provider (openai/rule-based)
  - IR data flows seamlessly into SDXL image generation

- **Cost Control**:
  - `DISABLE_LLM_ANALYSIS=true` env var forces rule-based mode
  - Token usage logged for monitoring
  - GPT-4o-mini used for cost efficiency (~$0.15 per 1M tokens)

**User Experience**: Get AI-powered emotional insights before image generation! The system analyzes your session and displays artistic interpretation with classical music vocabulary, then generates images that reflect your analyzed emotional state.

### Phase P3: Full Image Generation Pipeline (NEW! 🎉)
- **Enhanced Prompt Generation from IR**:
  - Valence (-1 to +1) → atmosphere keywords (dark/bright, melancholic/uplifting)
  - Arousal (0 to 1) → energy keywords (calm/intense, peaceful/dynamic)
  - Focus (0 to 1) → composition clarity (diffuse/sharp, ethereal/crisp)
  - Automatic translation of Japanese motif tags to English for SDXL
  - Rich classical aesthetic vocabulary integration

- **Auto-Style Preset Selection**:
  - Intelligent style choice based on valence/arousal values
  - Low arousal + positive valence → watercolor (calm, soft)
  - High arousal → romantic landscape (dramatic, intense)
  - Customizable manual selection available

- **Updated Style Presets**:
  - **油絵** (Oil Painting): Thick brushstrokes, rich texture, classical
  - **水彩画** (Watercolor): Soft edges, translucent layers, delicate
  - **印象派** (Impressionism): Light-focused, natural scenery, atmospheric
  - **抽象ミニマル** (Abstract Minimal): Monochrome gradient, geometric calm
  - **ロマン派風景** (Romantic Landscape): Dramatic sky, sublime nature

- **Enhanced Album System**:
  - Full metadata storage: IR data, generation parameters, style, seed, provider
  - Beautiful organized metadata display in Album view
  - Provider badges in Gallery (AI / ローカル)
  - Regenerate function: same parameters, new seed for variations

- **Progress Flow Visualization**:
  - 3-step visual indicator: 解析中 → 画像生成中 → 完了
  - Animated states with pulse effects
  - Clear feedback through entire pipeline

- **Complete Pipeline Integration**:
  - Session → Analysis (P2) → Prompt (P3) → Image (P0/P1) → Album → Gallery
  - Seamless metadata flow through all stages
  - Fallback to local generation on failures

**User Experience**: Complete journey from session to gallery! Create sessions, watch AI analyze your emotions, generate beautiful classical-style art, save to albums with full metadata, and explore your emotional collection in the 3D gallery bookshelf. Regenerate variations with a single click!

### Phase P0: External Image Generation (Replicate SDXL)
- High-quality AI image generation using Replicate's SDXL model
- Style presets for classic aesthetics (see P3 for updated presets)
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

5. **Generate with external AI (Replicate SDXL) - P3 Enhanced:**
   - Select a style preset (油絵, 水彩画, 印象派, etc.) or let auto-select based on your mood
   - Click "外部生成(Replicate)" to generate a high-quality AI image
   - **Watch the progress flow:**
     - Step 1: "解析中..." - AI analyzes your session (2-5 seconds)
     - See your emotional analysis (valence, arousal, focus, motif tags)
     - Step 2: "画像生成中..." - Replicate SDXL generates image (30-60 seconds)
     - Step 3: "完了" - Generation complete!
   - View retry count if automatic retries occur
   - Wait 30-60 seconds for generation to complete
   - If it fails:
     - Click "🔄 再試行" to manually retry
     - Or click "🎨 ローカル生成に切り替え" to use local generation
   - Click "📚 アルバムに保存" to save to album with full metadata
   - Note: Requires `REPLICATE_API_TOKEN` to be set in `.env`

6. **View your albums in Gallery:**
   - Navigate to Gallery room
   - See your saved images as 3D book spines
   - Notice "AI" or "ローカル" badges showing generation method
   - Hover over books to see metadata tooltip
   - Click a book to view full details in Album room

7. **Album details and regeneration:**
   - In Album room, view organized metadata:
     - Basic info (mood, duration, creation date)
     - Emotional analysis (valence, arousal, focus, motifs, confidence)
     - Generation parameters (style, seed, provider)
   - For AI-generated images, click "🔄 再生成 (新しいシード)" to create a variation
   - New variation saved as separate album with new seed

The generated images reflect your emotional state through intelligent prompt generation combining mood, analysis results, and classical aesthetic vocabulary.

## Project Status

**Phase P3 (Prototype)**: ✅ Full image generation pipeline complete - Enhanced prompt generation from IR, auto-style selection, complete album system with metadata, gallery integration, regeneration, and visual progress flow.

**Phase P2 (Prototype)**: ✅ LLM-based analysis complete - OpenAI integration, intermediate representation generation, rule-based fallback, JSON validation, and beautiful UI display of emotional insights.

**Phase P1 (Prototype)**: ✅ Robust generation flow complete - Timeout handling, automatic retry with exponential backoff, manual retry UI, fallback mechanism, enhanced error display, and comprehensive logging.

**Phase P0 (Prototype)**: ✅ External image generation integration complete - Replicate SDXL with style presets, job tracking, rate limiting, and fallback support.

**Phase B**: Onboarding deep-life questions complete - 4-step questionnaire capturing emotional patterns, triggers, and goals with localStorage persistence.

**Phase A**: Room navigation complete - multi-room layout with smooth swipe/touch navigation.

**Phase 1-2**: Session management and PNG generation complete - abstract generative art from session IR.

**Phase 3**: GitHub Pages deployment configured - automatic deployment on push to main branch.

## Testing

### Running Tests

See [docs/TESTING.md](./docs/TESTING.md) for comprehensive test scenarios covering P0/P1/P2.

See [docs/P3_IMPLEMENTATION.md](./docs/P3_IMPLEMENTATION.md) for P3 feature documentation and examples.

### P3 Test Scenarios

1. **End-to-End Flow:**
   - Create session → Watch analysis → See IR results → Image generation → Save to album → View in gallery → Open album details
   
2. **Auto-Style Selection:**
   - Create sessions with different moods
   - Observe different style auto-selection based on emotional analysis
   
3. **Progress Flow:**
   - Watch 3-step progress indicator during generation
   - Verify animated states and completion markers

4. **Album Metadata:**
   - Save album and verify all metadata is stored
   - Check IR values, style preset, seed, provider
   
5. **Gallery Features:**
   - Verify provider badges appear on book spines
   - Hover to see metadata tooltips
   
6. **Regeneration:**
   - Open AI-generated album
   - Click regenerate button
   - Verify new album created with same style but different seed

### Quick Test
- Admin endpoints

### Quick Test

1. Start the development server:
```bash
npm run dev
```

2. Create a session in Main room

3. Try external generation (with or without API token to test fallback)

4. Verify status updates and retry/fallback options

## Security

See [docs/SECURITY_SUMMARY.md](./docs/SECURITY_SUMMARY.md) for security analysis.

**Key Security Features:**
- Rate limiting (5 requests/min per IP)
- Concurrency limiting (3 concurrent jobs per IP)
- 120-second timeout protection
- Input validation
- No SQL injection risk (in-memory storage)
- Environment variable protection for API tokens

**Pre-existing Dependency Vulnerabilities:**
- 3 vulnerabilities in @vercel/node dependencies
- Recommend upgrading in a separate maintenance task

## Documentation

- **docs/P2_TESTING.md**: Test scenarios and guide for LLM analysis (P2)
- **docs/P2_IMPLEMENTATION.md**: Detailed P2 implementation summary
- **docs/TESTING.md**: Comprehensive test scenarios for P0 and P1
- **docs/P1_IMPLEMENTATION.md**: Detailed P1 implementation summary
- **docs/SECURITY_SUMMARY.md**: Security analysis and recommendations

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
