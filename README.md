# FrogBytes

Multifunctional Lecture Summarization & Learning Platform - AI-powered platform for transcribing lectures, generating summaries, creating study materials, and building a collaborative knowledge base.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start local Supabase (requires Docker)
supabase start

# Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to access the application.

## 📋 Prerequisites

- Node.js 22+ (recommended)
- Docker (for local Supabase)
- Supabase CLI (`npm install -g supabase`)
- yt-dlp (`pip install yt-dlp` or `brew install yt-dlp`) - for URL video downloads

## 🔐 Browser Extension (Optional - Auto Cookie Extraction)

The **FrogBytes Cookie Helper** browser extension enables automatic cookie extraction for downloading protected university lectures and authenticated video content.

**Features:**
- 🚀 **One-Click Authentication** - No manual cookie copying
- 🎓 **University Lectures** - Works with Kaltura, Panopto, Canvas, etc.
- 🔒 **Privacy-First** - Cookies only shared with FrogBytes, never stored
- ⚡ **Universal Support** - Works with 1500+ platforms via yt-dlp

**Installation:**
1. Open `chrome://extensions/` in Chrome
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `/public` folder from this project
5. Extension is now active! Look for the 🐸 icon

**Usage:**
1. Go to FrogBytes upload page
2. Click "Paste URL" tab
3. Enter a protected video URL
4. If authentication needed, click "🚀 Auto Extract with Extension"
5. Extension automatically handles authentication
6. Download proceeds seamlessly!

Extension files are in `/public/`:
- `manifest.json` - Extension configuration
- `extension-content.js` - Detects FrogBytes page
- `extension-background.js` - Handles cookie extraction
- `extension-popup.html` - Extension popup UI

## ✨ Features

- **Audio/Video Transcription**: Upload lectures and automatically transcribe using AI
- **URL Download**: Paste video URLs from YouTube, Vimeo, and 10+ platforms instead of uploading files
- **AI Summarization**: Generate structured summaries with key points and concepts
- **PDF Generation**: Compile summaries into professional PDFs with LaTeX support
- **Quiz & Flashcard Generation**: Create study materials from lecture content
- **Collaborative Library**: Share summaries and documents with the community
- **Collections**: Organize and group related lectures and materials
- **Smart Recommendations**: Get personalized content based on your study history
- **Voting System**: Community-driven quality ratings for shared content

## 🏗️ Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS + Radix UI
- **Language**: TypeScript (Strict Mode with exactOptionalPropertyTypes)
- **Testing**: Vitest + Playwright
- **AI Integration**: Google Gemini API, ElevenLabs
- **Storage**: Supabase Storage + Telegram Archive
- **Deployment**: Vercel

## 📁 Project Structure

```
FrogBytes/
├── app/                      # Next.js App Router pages
│   ├── api/                  # API routes
│   ├── auth/                 # Authentication pages
│   ├── dashboard/            # User dashboard
│   ├── library/              # Public library
│   ├── learn/                # Learning interface
│   └── upload/               # File upload workflow
├── components/               # React components
│   ├── features/             # Feature-specific components
│   ├── layout/               # Layout components
│   └── ui/                   # Reusable UI primitives
├── lib/                      # Core libraries
│   ├── api-keys/             # API key management
│   ├── services/             # Business logic services
│   ├── summarization/        # AI summarization
│   ├── transcription/        # Audio transcription
│   └── pdf/                  # PDF generation
├── services/                 # Data access layer
│   └── supabase/             # Supabase client utilities
├── supabase/                 # Database and backend
│   ├── migrations/           # Database migrations
│   └── seed.sql              # Seed data
├── types/                    # TypeScript type definitions
└── hooks/                    # React hooks
```

## 🔧 Development Commands

```bash
# Development
npm run dev              # Start development server with Turbopack
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint (zero warnings policy)
npm run lint:fix         # Auto-fix linting issues
npm run type-check       # TypeScript strict type checking

# Testing
npm run test             # Run Vitest tests
npm run test:unit        # Run unit tests with coverage
npm run test:e2e         # Run Playwright E2E tests
npm run test:watch       # Run tests in watch mode
npm run test:ci          # Run all tests (CI pipeline)

# Database
npm run db:start         # Start local Supabase
npm run db:stop          # Stop local Supabase
npm run db:reset         # Reset database to migrations
npm run db:generate-types # Generate TypeScript types from schema

# Utilities
npm run security-audit   # Run security audit
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting
```

## 🔒 Environment Variables

Required environment variables (add to `.env.local`):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Services
GEMINI_API_KEY=your_gemini_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# Telegram (optional - for file archival)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_ARCHIVE_CHAT_ID=your_chat_id
```

## 🧪 Testing

This project maintains high test coverage standards:

- **Unit Tests**: Vitest with React Testing Library
- **E2E Tests**: Playwright across multiple browsers
- **Coverage Requirements**: 90%+ for branches, functions, lines, and statements
- **Test Location**: Unit tests will be in `__tests__` directories, E2E tests in `tests/e2e/`

Run tests before committing:
```bash
npm run type-check    # Ensure no TypeScript errors
npm run lint          # Ensure no linting errors
npm run test:unit     # Run unit tests
```

## 📚 Code Quality Standards

This project enforces strict coding standards:

- **TypeScript Strict Mode**: All strict flags enabled including `exactOptionalPropertyTypes`
- **Zero `any` Types**: No explicit `any` usage allowed
- **No Unused Code**: `noUnusedLocals` and `noUnusedParameters` enforced
- **Comprehensive Testing**: 90%+ code coverage required
- **ESLint Zero Warnings**: Build fails on any ESLint warnings
- **Prettier Formatting**: Consistent code style across the project

## 🚀 Deployment

The application is deployed on Vercel with automatic deployments from the main branch.

Database migrations are managed through Supabase and should be applied before deploying new features that require schema changes.

## 📄 Additional Documentation

- `CLAUDE.md` - AI assistant guidelines and project context

## 🤝 Contributing

When contributing to this project:

1. Ensure all tests pass (`npm run test:ci`)
2. Run type checking (`npm run type-check`)
3. Fix linting errors (`npm run lint:fix`)
4. Format code (`npm run format`)
5. Follow the existing code structure and conventions
6. Add tests for new features
7. Update documentation as needed

## 📄 License

Private project - All rights reserved.
