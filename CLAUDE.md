# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Dev server (uses Turbopack). On Windows, run via bash shell:
NODE_OPTIONS='--require ./node-compat.cjs' npx next dev --turbopack

# Build
NODE_OPTIONS='--require ./node-compat.cjs' npx next build

# Lint
npm run lint

# Run all tests
npm test

# Run a single test file
npx vitest run src/lib/__tests__/file-system.test.ts

# Run tests in watch mode
npx vitest

# Initial setup (install deps, generate Prisma client, run migrations)
npm run setup

# Reset database
npm run db:reset

# Regenerate Prisma client after schema changes
npx prisma generate

# Run database migrations
npx prisma migrate dev
```

**Note:** The `npm run dev` script uses Unix `NODE_OPTIONS=...` syntax which fails on Windows cmd. Use the bash shell or run the command directly as shown above.

## Architecture

**UIGen** is an AI-powered React component generator. Users describe components in a chat interface, Claude generates code via streaming tool calls, and components render live in an iframe preview.

### Core Flow

1. User sends a message in chat → POST `/api/chat` streams response from Claude (Haiku 4.5)
2. Claude uses two tools (`str_replace_editor`, `file_manager`) to create/modify files in a **Virtual File System** (in-memory, never touches disk)
3. Tool calls are executed client-side via `FileSystemContext`, triggering UI re-renders
4. `PreviewFrame` transpiles JSX via Babel standalone and renders in an iframe using esm.sh CDN imports
5. On completion, project is saved to SQLite via Prisma (if user is authenticated)

### Key Directories

- `src/app/` — Next.js App Router pages and API routes
- `src/app/api/chat/route.ts` — Main AI streaming endpoint (120s max, 10k tokens)
- `src/actions/` — Server actions for auth (signUp/signIn/signOut) and project CRUD
- `src/components/chat/` — Chat UI (MessageList, MessageInput, ChatInterface)
- `src/components/editor/` — Code editor with Monaco and file tree
- `src/components/preview/` — Iframe-based live preview with Babel transpilation
- `src/components/ui/` — shadcn/ui primitives (new-york style)
- `src/lib/contexts/` — React contexts for file system and chat state management
- `src/lib/tools/` — AI tool definitions (str-replace, file-manager)
- `src/lib/prompts/` — System prompt for Claude code generation
- `src/lib/transform/` — JSX transpilation via Babel standalone
- `src/lib/auth.ts` — JWT session management (jose, 7-day expiry, httpOnly cookies)
- `src/lib/file-system.ts` — VirtualFileSystem class (in-memory tree, serializable to JSON)
- `src/lib/provider.ts` — Model provider (Anthropic API or mock fallback when no API key)

### State Management

- **FileSystemContext** — Manages the virtual file system tree, handles AI tool call execution, serializes to JSON for DB storage
- **ChatContext** — Wraps Vercel AI SDK's `useChat`, integrates with FileSystemContext for tool execution
- **Anonymous work tracker** — sessionStorage-based tracking; migrates to a real project on sign-up/sign-in

### Database

SQLite via Prisma. Always refer to `prisma/schema.prisma` for the current database structure. Projects store messages and file system data as JSON strings. Anonymous users can work without auth; their work migrates on authentication.

### AI Provider

Uses `@ai-sdk/anthropic` with Vercel AI SDK. When `ANTHROPIC_API_KEY` is not set, falls back to a mock provider that returns static components. Real API allows 40 tool-calling steps; mock allows 4.

### Component Generation Conventions

- Entry point must be `/App.jsx` (enforced by system prompt)
- Generated code uses Tailwind CSS classes, not inline styles
- Preview resolves imports via esm.sh CDN import maps

## Tech Stack

- **Framework:** Next.js 15 (App Router, Turbopack, React 19)
- **Language:** TypeScript (strict, path alias `@/*` → `src/*`)
- **Styling:** Tailwind CSS v4, shadcn/ui, OKLch color system with CSS variables
- **Database:** SQLite + Prisma v6
- **Auth:** JWT (jose) with bcrypt password hashing
- **AI:** Anthropic Claude via Vercel AI SDK
- **Testing:** Vitest + Testing Library (jsdom environment)
- **Code Editor:** Monaco Editor
- **Preview:** Babel standalone for JSX transpilation

## Environment Variables

- `ANTHROPIC_API_KEY` — Required for real AI generation; without it, mock provider is used
- `JWT_SECRET` — Defaults to `"development-secret-key"` in dev
- `DATABASE_URL` — Managed by Prisma (SQLite `./prisma/dev.db`)

## Testing

Tests live in `__tests__/` directories adjacent to their source files. Use `@testing-library/react` with `@testing-library/user-event` for component tests. Vitest config is in `vitest.config.mts` with jsdom environment.
