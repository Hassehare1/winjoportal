# Client Portal (Next.js + TypeScript + Tailwind)

En stabil, modulär och utbyggbar portal med enkel lösenordsgate, signerad session-cookie, dashboard och en MVP för promptoptimering.

## Tech stack
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Vitest (tester)
- Deploy: Vercel
- Repo: GitHub
- Node 20+

## Projektstruktur
```text
.
├─ app/
│  ├─ (protected)/
│  │  ├─ apps/
│  │  │  ├─ games/page.tsx
│  │  │  └─ prompt-optimizer/page.tsx
│  │  ├─ about/page.tsx
│  │  ├─ dashboard/page.tsx
│  │  ├─ fortnox/page.tsx
│  │  └─ layout.tsx
│  ├─ api/
│  │  └─ auth/
│  │     ├─ login/route.ts
│  │     └─ logout/route.ts
│  ├─ login/page.tsx
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ components/ui/
│  ├─ logout-button.tsx
│  ├─ nav-links.tsx
│  ├─ portal-shell.tsx
│  └─ section-card.tsx
├─ features/
│  ├─ auth/
│  │  ├─ components/login-form.tsx
│  │  └─ server/
│  │     ├─ constants.ts
│  │     ├─ logging.ts
│  │     ├─ password.ts
│  │     ├─ rate-limit.ts
│  │     └─ session.ts
│  ├─ fortnox/server/access.ts
│  └─ prompt-optimizer/
│     ├─ components/prompt-optimizer-form.tsx
│     ├─ lib/build-improved-prompt.ts
│     └─ types.ts
├─ tests/
│  ├─ auth-session.test.ts
│  └─ prompt-builder.test.ts
├─ proxy.ts
├─ .env.example
├─ package.json
└─ tailwind.config.ts
```

## Auth-design
- Shared password i env: `PORTAL_PASSWORD`
- Signerad session-cookie (`portal_session`) med HMAC SHA-256
- Cookie är `httpOnly`, `sameSite=lax`, `secure` i produktion
- Login/logout via route handlers (`/api/auth/login`, `/api/auth/logout`)
- Enkel throttling/light bruteforce-skydd:
  - Exponentiell fördröjning per IP vid misslyckade försök
  - Tillfällig blockering efter flera fel
- Server-side auth logging (`login_success`, `login_failure`, `login_blocked`, `logout`)
- Inga hemligheter exponeras i klientbundle

## Exakta kommandon

### 1) Skapa projektet (från scratch)
```bash
npx create-next-app@latest client-portal --typescript --tailwind --app --eslint --use-npm
cd client-portal
```

### 2) Installera dependencies (inkl. test)
```bash
npm install
```

### 3) Lägg env
```bash
cp .env.example .env.local
```
Fyll sedan i:
- `PORTAL_PASSWORD`
- `AUTH_COOKIE_SECRET` (minst 32 tecken)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (valfri, default `gpt-4.1-mini`)

### 4) Kör lokalt
```bash
npm run dev
```
Öppna `http://localhost:3000`

### 5) Kör tester
```bash
npm run test
```

### 6) Synka analytics assets lokalt
```bash
npm run analytics:sync
```
Kopierar KPI JSON/HTML fran `services/analytics/data/reports/sales_monthly/v1` till `public/analytics` och uppdaterar `public/analytics/index.json`.

## Lokal setup steg-för-steg
1. Installera Node 20+ (`node -v`).
2. `npm install`
3. Kopiera `.env.example` till `.env.local`.
4. Sätt hemligheter i `.env.local`.
5. `npm run dev`
6. Testa login med `PORTAL_PASSWORD`.
7. `npm run test`

## Deploychecklista: Lokal kod -> GitHub -> Vercel
1. Initiera git om behövs:
```bash
git init
git add .
git commit -m "Initial client portal MVP"
```
2. Skapa repo på GitHub och pusha:
```bash
git branch -M main
git remote add origin <DIN_GITHUB_REPO_URL>
git push -u origin main
```
3. Logga in i Vercel -> `New Project` -> importera GitHub-repot.
4. Lägg env vars i Vercel Project Settings -> Environment Variables:
  - `PORTAL_PASSWORD`
  - `AUTH_COOKIE_SECRET`
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
5. Deploya (`Production`).
6. Verifiera:
  - `/login` fungerar
  - fel lösenord blockeras/throttlas
  - `/dashboard` kräver session
  - logout rensar cookie

## Vanliga fel och lösningar
1. `PORTAL_PASSWORD saknas i environment`
   - Lägg `PORTAL_PASSWORD` i `.env.local` (lokalt) och i Vercel env (prod).
2. `AUTH_COOKIE_SECRET saknas i environment`
   - Lägg `AUTH_COOKIE_SECRET` i `.env.local`/Vercel.
3. `OPENAI_API_KEY saknas i environment`
   - Lägg `OPENAI_API_KEY` i `.env.local`/Vercel.
3. Login loopar tillbaka till `/login`
   - Kontrollera att cookie kan sättas:
     - kör över `http://localhost:3000`
     - kontrollera att systemklockan inte är fel
     - säkerställ att `AUTH_COOKIE_SECRET` är samma mellan requests
4. Får `429` vid login
   - För många försök. Vänta en minut och försök igen.
5. Tester körs inte
   - Kontrollera att `npm install` är körd och att `vitest` finns i `devDependencies`.

## Framtida utbyggnad
- Fortnox ligger i separat route (`/fortnox`) och har egen feature-modul för framtida step-up login.
- Promptoptimeraren använder nu server-side OpenAI-anrop via `app/api/prompt-optimizer/route.ts` och kan byggas vidare med t.ex. historik/databas.
