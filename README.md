# Herve Hub — Express + SQLite prototype

This branch adds a minimal Express backend to the Herve Hub project (for local development and prototyping).

What is included
- server.js — Express API implementing register, login, posts (list/create) and an /api/ai proxy to OpenAI.
- migrations.sql — SQLite schema for users and posts.
- package.json — dependencies and scripts.
- .env.example — environment variables to configure.
- .gitignore — ignores node_modules, .env, and the local DB file.

Quick start (local)
1. Create a branch locally (already done in repo): feature/full-backend-express
2. Install dependencies:
   npm install
3. Copy .env.example to .env and edit values (set a secure JWT_SECRET and your OPENAI_KEY):
   cp .env.example .env
4. Run the server in development:
   npm run dev
5. Open http://localhost:3000 (the existing index.html at repo root will be served)

API endpoints
- POST /api/register { name, email, password } -> { token, user }
- POST /api/login { email, password } -> { token, user }
- GET /api/posts -> [ posts ]
- POST /api/posts { content, image_url? }  -> requires Authorization: Bearer <token>
- POST /api/ai { prompt } -> requires Authorization: Bearer <token>

Notes & next steps
- This setup uses SQLite for quick prototyping. For production use PostgreSQL and real migrations.
- Do NOT commit your .env file or any secret keys to the repo.
- Production hardening: HTTPS, CORS restrictions, helmet, rate-limiting, input sanitization, refresh tokens, email verification.
- The server currently serves static files from the repo root and from /public — you can keep the existing index.html or replace it with a frontend that calls the API.

If you want, I can now:
- Wire the existing index.html to call these endpoints (login/register, publish posts, and call AI).  
- Or create a demo frontend at /public/demo.html that shows register/login, create post and ask AI flows.  

Tell me which you prefer and I will update the branch and open a PR.