# Technology Stack

**Analysis Date:** 2026-05-04

## Languages

**Primary:**
- TypeScript 5.x - All source code in frontend and backend
- JavaScript (Node.js) - Build scripts and configuration

**Secondary:**
- HTML/CSS - Rendered via Next.js and Tailwind
- Shell/PowerShell - Build and deployment scripts

## Runtime

**Environment:**
- Node.js 20 (monorepo root and frontend per `package.json` engines field)
- Node.js 22 (Cloud Functions backend per `apps/functions/package.json` engines field)
- Google Cloud Run (southamerica-east1 region) - Backend deployment target

**Package Manager:**
- npm (workspace-based monorepo)
- Lockfile: `package-lock.json` (present, committed)

## Frameworks

**Core:**
- Next.js 16.1.6 - Frontend App Router (SSR/SSG) at `apps/web/src/app/`
- React 19.2.1 - UI library for frontend
- Firebase Functions V2 - Serverless backend via `firebase-functions@7.2.5`
- Express 5.2.1 - HTTP routing in Cloud Functions monolith

**Testing:**
- Jest 30.3.0 (monorepo root) - Unit tests for functions and Firestore rules
- Playwright 1.59.1 - E2E tests (59 tests in `tests/e2e/`)
- Firebase Rules Unit Testing 5.0.0 - Security rules validation

**Build/Dev:**
- Tailwind CSS 4 - CSS-first styling (configured via CSS, no `tailwind.config.ts`)
- TypeScript - Compilation: `tsc` command, CommonJS output for functions
- Babel Compiler - React Server Components optimization

## Key Dependencies

**Critical (Business Logic):**
- `stripe@20.0.0` (frontend), `stripe@17.0.0` (backend) - Payment processing
- `firebase@12.6.0` (frontend) - Client-side Firebase SDK
- `firebase-admin@12.7.0` (frontend), `firebase-admin@13.6.1` (backend) - Admin SDK for auth and Firestore
- `firebase-functions@7.2.5` - Cloud Functions runtime
- `zod@4.3.6` - Schema validation in backend

**UI Components:**
- `@radix-ui/react-dialog@1.1.15`, `@radix-ui/react-alert-dialog@1.1.15` - Dialog primitives
- `radix-ui@1.4.3` - Full Radix UI component library
- Shadcn/ui patterns (via `@radix-ui` and custom components) - Component system in `apps/web/src/components/ui/`

**Data & Visualization:**
- `recharts@3.5.1` - Charts and graphs
- `exceljs@4.4.0`, `xlsx@0.18.5` - Excel import/export
- `@univerjs/presets@0.11.0` - Spreadsheet editing (Univer)
- `@fullcalendar/react@6.1.20` - Calendar UI with plugins

**PDF Generation:**
- `playwright-core@1.58.2` - Headless browser rendering
- `@sparticuz/chromium@143.0.4` - Optimized Chromium binary for serverless

**AI:**
- `@google/generative-ai@0.24.1` - Google Gemini API client
- `@google/genai@1.50.1` - Alternative Google GenAI package
- `groq-sdk@1.1.2` - Groq LLM SDK (alternative provider for local dev)

**External APIs:**
- `axios@1.13.2` (frontend), `axios@1.13.5` (backend) - HTTP client
- `@mercadopago/sdk-react@1.0.7` - Mercado Pago payment integration
- `googleapis@171.4.0` - Google Workspace APIs (Calendar)

**Utilities:**
- `gsap@3.14.2` - Animation library
- `uuid@13.0.0` - UUID generation
- `cpf-cnpj-validator@2.1.0` - Brazilian document validation
- `sanitize-html@2.17.2` - HTML sanitization
- `react-markdown@10.1.0`, `tiptap-markdown@0.9.0` - Markdown support
- `@tiptap/starter-kit@3.22.5` - Rich text editor

**Observability & Monitoring:**
- `@sentry/nextjs` - Error tracking client (configured via `NEXT_PUBLIC_SENTRY_DSN`)
- `@sentry/node` - Error tracking server (configured via `SENTRY_DSN` in backend)
- `@vercel/analytics@2.0.1` - Page views/sessions
- `@vercel/speed-insights@2.0.0` - Core Web Vitals monitoring
- `@opentelemetry/api@1.9.1` - Observability instrumentation

**Development Only:**
- `eslint@9.39.3`, `@typescript-eslint/eslint-plugin@8.46.2` - Code linting
- `ts-jest@29.4.9` - Jest TypeScript support
- `tsx@4.21.0` - TypeScript execution
- `patch-package@8.0.1` - NPM patch workflow
- `concurrently@9.2.1` - Run multiple scripts in parallel

## Configuration

**Environment (Frontend):**
- `NEXT_PUBLIC_FIREBASE_API_KEY` - Firebase client key (public)
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Firebase project ID
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` - Firebase Storage bucket
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` - FCM sender ID
- `NEXT_PUBLIC_FIREBASE_APP_ID` - Firebase app ID
- `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true|false` - Point to emulators in dev
- `NEXT_PUBLIC_SITE_URL` - Public site URL (https://proops.com.br in prod)
- `NEXT_PUBLIC_SEARCH_CONSOLE_VERIFICATION` - Google Search Console token
- `NEXT_PUBLIC_GA_ID` - Google Analytics 4 measurement ID
- Reference: `apps/web/.env.local.example`

**Environment (Backend - Firebase Functions):**
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Stripe billing
- `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` - Meta WhatsApp API
- `CRON_SECRET` - Internal cron job authentication
- `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` - Firebase Admin SDK
- `SENTRY_DSN` - Error tracking (optional, fails gracefully if missing)
- `SECURITY_OBSERVABILITY_ENABLED=true` - Audit trail in Firestore
- `RATE_LIMIT_PROTECTED_MAX`, `RATE_LIMIT_PROTECTED_WINDOW_MS` - Rate limiting config
- `ALLOWED_CORS_ORIGINS` - CORS allowed origins
- `PROTECTED_ROUTE_TIMEOUT_MS`, `PROTECTED_PDF_ROUTE_TIMEOUT_MS` - Request timeouts
- `MERCADOPAGO_APP_ID`, `MERCADOPAGO_CLIENT_SECRET`, `MERCADOPAGO_OAUTH_REDIRECT_URI`, `MERCADOPAGO_STATE_SECRET`, `MERCADOPAGO_WEBHOOK_SECRET` - Mercado Pago OAuth
- `GEMINI_API_KEY` - Google Gemini API (production)
- `GROQ_API_KEY` - Groq SDK API (development override)
- Reference: `apps/functions/.env.example`

**Build Configuration:**

| File | Purpose |
|------|---------|
| `apps/web/next.config.ts` | Next.js build config: CSP headers, security headers, image patterns |
| `apps/web/tsconfig.json` | TypeScript: strict mode, `@/` path alias to `src/`, React JSX |
| `apps/functions/tsconfig.json` | TypeScript: CommonJS output to `lib/`, strict, ES2018 target |
| `firebase.json` | Firebase project config: functions source, Firestore rules, emulator ports |
| `.firebaserc` | Firebase project aliases: `dev` → erp-softcode, `prod` → erp-softcode-prod |
| `eslint.config.mjs` (both apps) | ESLint config: strict linting |
| `.eslintignore` - Style ignored (auto-generated directories) |

**TypeScript Strict Mode:**
- Both frontend and backend run with `strict: true`
- No implicit `any`
- Path aliases: `@/*` maps to `apps/web/src/*` in frontend

## Platform Requirements

**Development:**
- Node.js 20 (frontend, monorepo root)
- Node.js 22 (backend Cloud Functions)
- npm (for workspace install)
- Firebase Emulators (for local development)
  - Functions emulator (port 5001)
  - Firestore emulator (port 8080)
  - Auth emulator (port 9099)
  - Storage emulator (port 9199)
  - Emulator UI (port 4000)

**Production:**
- Cloud Run (Google Cloud) - `southamerica-east1` region
- Firestore (Firebase) - NoSQL database
- Firebase Authentication
- Cloud Storage (Firebase)
- Vercel (Next.js frontend hosting)
- Firebase Billing enabled (Stripe integration)

**CI/CD:**
- GitHub Actions (`.github/workflows/`)
  - push-checks.yml - On every push (type-check, lint, security-audit, e2e, rules, performance, security-scan)
  - test-suite.yml - On PR to main/develop (consolidated gate)
  - deploy-functions.yml - Auto-deploy functions on develop/main push
  - dependency-review.yml - Audit new dependencies
  - stale.yml - Cleanup stale issues

---

*Stack analysis: 2026-05-04*
