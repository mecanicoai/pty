# Mecanico v1

Spanish-first AI diagnostic chat app for mechanics and shop technicians.

## Stack

- Next.js (App Router) + React + TypeScript + Tailwind
- One backend endpoint for OpenAI chat
- Local browser storage for chat history and vehicle context
- OpenAI Responses API on the server
- Signed install tokens for device-level access control
- Optional Google Play license verification for Android releases

## Core Security Rules

- `OPENAI_API_KEY` exists only on the backend.
- Protected Mecanico instructions live in `lib/openai/mecanico-prompt.ts`.
- The frontend never sends or exposes the system prompt.
- The backend model defaults to `gpt-5.4-2026-03-05`.
- You can override it with `OPENAI_MODEL` in `.env.local`.
- Chat requests require a signed install token.
- Backend rate limiting is enforced per install.
- When `REQUIRE_PLAY_INTEGRITY_LICENSE=true`, chat access requires a verified Google Play licensed install.

## Persistence Model

- Chat sessions are stored in browser `localStorage`.
- Vehicle details are stored per local chat session.
- There is no PostgreSQL, Prisma, or server-side chat history dependency.

## API Endpoints

- `POST /api/install`
- `POST /api/chat`
- `POST /api/integrity/verify`
- `POST /api/purchase/verify`

## Production Notes

- This app does not require traditional email/password auth.
- It does require backend authorization if you are charging for access.
- Recommended Android production flow for a paid Play Store app:
  1. the native app calls `POST /api/install` with `installId`
  2. the backend returns an integrity challenge with `requestHash` when `REQUIRE_PLAY_INTEGRITY_LICENSE=true`
  3. the native layer requests a Play Integrity token using that `requestHash`
  4. the native layer sends `installId`, `integrityToken`, and `challengeToken` to `POST /api/integrity/verify`
  5. the backend validates the Play Integrity verdicts and returns a signed install token
  6. the native layer injects that token into the WebView with `window.MecanicoWebApp.setInstallToken(token, expiresAt)`
  7. the chat UI uses that token when calling `POST /api/chat`
- If you deploy with `REQUIRE_PLAY_INTEGRITY_LICENSE=false`, the app works in browser mode, but it is only rate-limited, not Play-licensed.

## Conditional Web Search

Decision helper is server-side in:

- `lib/openai/should-use-web-search.ts`

OpenAI service module:

- `lib/openai/mecanico-service.ts`

When the decision is true, OpenAI is called with:

- `tools: [{ type: "web_search" }]`

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env file:
   ```powershell
   Copy-Item .env.example .env.local
   ```
3. Set your value in `.env.local`:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (optional; defaults to `gpt-5.4-2026-03-05`)
   - `INSTALL_TOKEN_SECRET`
   - `REQUIRE_PLAY_INTEGRITY_LICENSE`
   - `REQUIRE_PURCHASE_VERIFICATION`
   - `CHAT_RATE_LIMIT_PER_MINUTE`
   - `CHAT_RATE_LIMIT_PER_DAY`
   - `GOOGLE_PLAY_PACKAGE_NAME`
   - `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_PLAY_PRIVATE_KEY`
4. Run app:
   ```powershell
   npm run dev
   ```

Open `http://localhost:3000`.

## Project Highlights

- Chat API route: `app/api/chat/route.ts`
- Install token route: `app/api/install/route.ts`
- Play Integrity verification route: `app/api/integrity/verify/route.ts`
- Purchase verification route: `app/api/purchase/verify/route.ts`
- Chat shell: `components/chat/chat-layout.tsx`
- Android/native media bridge: `lib/chat/native-bridge.ts`
- Local session store: `lib/chat/local-store.ts`
- Vehicle intake modal: `components/intake/vehicle-intake-drawer.tsx`
- Install token signing: `lib/security/install-tokens.ts`
- Rate limiting: `lib/security/rate-limit.ts`
- Play Integrity verification: `lib/security/play-integrity.ts`
- Google Play purchase verification: `lib/purchases/google-play.ts`

## Notes

- Legacy files from the previous single-file app (`index.html`, `serve-local.js`) remain in the repository and are not used by the Next.js runtime.
- For Android WebView wrappers, the web app now supports an optional native bridge:
  - `window.MecanicoAndroid.startVoiceInput(language)`
  - `window.MecanicoAndroid.stopVoiceInput()`
  - `window.MecanicoAndroid.pickAttachments(accept, multiple, maxFiles)`
  - native can return data through:
    - `window.MecanicoWebApp.receiveVoiceTranscript(...)`
    - `window.MecanicoWebApp.setVoiceRecording(...)`
    - `window.MecanicoWebApp.receiveAttachments(...)`
    - `window.MecanicoWebApp.receiveBridgeError(...)`
