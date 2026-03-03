# BotForge (Free Telegram Bot Hosting SaaS)

BotForge is a free-for-all SaaS starter where users can sign up, log in, drag-and-drop Telegram bot flows, and deploy bots without any subscription billing.

## Features

- Login system (register, login, logout, session cookie)
- Free forever plan (`$0`) for everyone
- Drag-and-drop flow builder UI for Telegram bot steps
- Deploy/list/delete hosted bots per authenticated user
- Light/Dark theme switch button
- Zero external dependencies (Node.js built-in modules)
- Ready to deploy on Vercel

## Run locally

```bash
npm run dev
```

Open http://localhost:3000.

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repo in Vercel.
3. Vercel will use `vercel.json`:
   - static app from `public/`
   - serverless API handler from `api/index.js`
   - rewrites `/api/*` to the serverless API
4. Deploy.

## API

- `GET /api/health`
- `GET /api/plan`
- `GET /api/auth/me`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/bots` (auth required)
- `POST /api/bots` (auth required)
- `DELETE /api/bots/:id` (auth required)

## Publish to GitHub

1. Create a new empty repository on GitHub.
2. Add your repository remote:

```bash
git remote add origin <YOUR_GITHUB_REPO_URL>
```

3. Push this branch:

```bash
git push -u origin HEAD
```

The included GitHub Actions workflow (`.github/workflows/ci.yml`) runs `node --test` on every push and pull request.
