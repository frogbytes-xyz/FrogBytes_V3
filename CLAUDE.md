# Claude Code Instructions for FrogBytes

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

## Project Context

FrogBytes is a multifunctional lecture summarization & learning platform that helps students transcribe lectures, generate AI summaries, create study materials, and build a collaborative knowledge base.

**🚨 ARCHITECTURE RULE: This is a Next.js 15 monolithic full-stack application. ALL features are implemented within the Next.js framework using:**
- API Routes (`app/api/`) for backend endpoints
- Server Actions for mutations
- Server Components for data fetching
- Client Components only when interactivity is needed
- TypeScript throughout the entire stack

**NEVER introduce separate backend frameworks (FastAPI, Express standalone, etc.). Everything must integrate into the existing Next.js architecture.**

## 🚫 CRITICAL: No Documentation Files Rule

**NEVER create markdown documentation files (.md) as part of your implementation work. This includes:**
- ❌ No `FEATURE_NAME.md` files
- ❌ No `IMPLEMENTATION_SUMMARY.md` files
- ❌ No `FIX_SUMMARY.md` files
- ❌ No `COMMIT_MESSAGE.txt` files
- ❌ No technical documentation files of any kind

**Why?** These files are a waste of time and clutter the repository. Focus exclusively on:
- ✅ Writing production code
- ✅ Fixing bugs
- ✅ Implementing features
- ✅ Writing tests

**Only exception:** Updating the existing `README.md` if explicitly requested by the user.

**If you need to document something:** Put it in code comments, JSDoc, or commit messages - never in separate .md files.

### Key Technologies
- **Framework**: Next.js 15+ with App Router and Turbopack
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **AI**: Google Gemini API for summarization, ElevenLabs for transcription
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Type System**: TypeScript with strict mode + exactOptionalPropertyTypes
- **Storage**: Supabase Storage + Telegram archival system

### Code Quality Standards

This project enforces **senior-level, multi-billion company standards**:

1. **TypeScript Strict Mode**: All strict compiler options enabled
   - `strict: true`
   - `exactOptionalPropertyTypes: true`
   - `noUncheckedIndexedAccess: true`
   - `noUnusedLocals: true`
   - `noUnusedParameters: true`

2. **Zero Tolerance**:
   - No explicit `any` types
   - No unused variables or imports
   - ESLint warnings cause build failures
   - All code must be formatted with Prettier

3. **Testing Requirements**:
   - 90%+ code coverage (branches, functions, lines, statements)
   - Unit tests for all business logic
   - E2E tests for critical user flows

4. **Performance**:
   - Minimize bundle size
   - Optimize re-renders
   - Use React Server Components where possible
   - Implement proper loading states

### Project Structure

```
app/                    # Next.js pages and API routes
components/             # React components (organized by feature)
  ├── features/         # Feature-specific components
  ├── layout/           # Layout components (Menubar, Footer)
  └── ui/               # Reusable UI primitives (Radix UI based)
lib/                    # Core business logic
  ├── api-keys/         # API key rotation and management
  ├── services/         # Business logic services
  ├── summarization/    # AI summarization logic
  ├── transcription/    # Audio transcription
  └── pdf/              # PDF compilation with LaTeX
services/               # Data access layer (Supabase queries)
supabase/               # Database schema and migrations
types/                  # Shared TypeScript types
hooks/                  # React hooks (useAuth, useVoting, etc.)
```

### Important Patterns

1. **Database Access**:
   - Always use the Supabase client from `services/supabase/`
   - Respect Row Level Security (RLS) policies
   - Use typed queries with database types from `types/database.ts`

2. **Error Handling**:
   - Provide user-friendly error messages
   - Log errors with context for debugging
   - Handle edge cases explicitly (null, undefined, empty arrays)

3. **Component Structure**:
   - Use Server Components by default
   - Add `'use client'` only when needed (state, effects, event handlers)
   - Extract complex logic into custom hooks
   - Keep components focused and single-purpose

4. **API Routes**:
   - Validate all inputs with Zod or similar
   - Use proper HTTP status codes
   - Implement rate limiting for expensive operations
   - Add JSDoc comments for all public endpoints

### Common Gotchas

1. **Optional Properties with `exactOptionalPropertyTypes`**:
   - Use conditional spreading: `{...(value ? { prop: value } : {})}`
   - Or build objects incrementally: `if (value) obj.prop = value`
   - Type guards don't always narrow as expected with this flag

2. **Supabase Client**:
   - Use `createClient()` from `services/supabase/client` for client components
   - Use server-side client for API routes and Server Components
   - Auth state may be null - always check before accessing

3. **File Uploads**:
   - Max size: 500MB
   - Supported formats: MP3, WAV, MP4, M4A, MOV, MPEG
   - Files are stored in Supabase Storage + archived to Telegram

4. **Testing**:
   - Tests are not yet implemented (will be added in Task #20)
   - Configuration files exist: `vitest.config.ts` and `playwright.config.ts`
   - Test directory structure: `__tests__/` for unit, `tests/e2e/` for E2E

### Development Workflow

```bash
# Before starting work
npm run type-check        # Verify no TypeScript errors
npm run lint              # Check for linting issues

# During development
npm run dev               # Start dev server with Turbopack
npm run db:start          # Start local Supabase (if needed)

# Before committing
npm run lint:fix          # Auto-fix linting issues
npm run format            # Format all files
npm run type-check        # Final TypeScript check
npm run test:unit         # Run tests (when implemented)
```

### Current State (Post-Cleanup)

Recent refactoring has established a clean foundation:
- ✅ TypeScript strict mode fully enforced (zero errors)
- ✅ Jest removed in favor of Vitest
- ✅ Documentation consolidated (only README.md and this file remain)
- ✅ Test infrastructure prepared (configs ready, implementation pending)
- 🚧 Component organization needs improvement (Task #23)
- 🚧 Comprehensive testing to be implemented (Task #20)

### When Making Changes

1. **CRITICAL: Maintain Architecture Consistency** - This is a Next.js 15 full-stack application. NEVER create separate backend directories (Python, Express, etc.). ALL backend logic goes in `app/api/` routes, `lib/` for business logic, and `services/` for data access. Any new feature must integrate into the existing Next.js architecture.
2. **Read existing code first** - understand patterns before adding new code
3. **Follow the existing structure** - don't introduce new patterns without reason
4. **Type safety is paramount** - prefer type-safe solutions over quick hacks
5. **Test your changes** - ensure TypeScript compiles and linting passes
6. **Document complex logic** - add JSDoc for non-obvious behavior
7. **Performance matters** - profile before optimizing, but be aware of bundle size
8. **Security first** - validate inputs, sanitize outputs, respect RLS

### Resources

- Database types: Auto-generated in `types/database.ts`
- UI components: Based on Radix UI in `components/ui/`
- API documentation: JSDoc comments in route files
- Supabase docs: https://supabase.com/docs
- Next.js 15 docs: https://nextjs.org/docs
