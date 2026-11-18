# Bright Mind

An accessible cognitive-practice web app designed for older adults. Includes account flow, three short activities, saved progress, accessibility preferences, and English/Hindi foundations.

## Run locally

1. Copy `.env.example` to `.env` and set a long random `JWT_SECRET`.
2. Run `npm ci`.
3. Run `npm run dev`, then open the Vite address shown (usually `http://localhost:5173`).

### Supabase hosted database

The free Supabase tier can host the PostgreSQL database. Create a project, open its SQL Editor, and run `database/schema.sql`. Copy the project URL and **service_role** key into `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`; never put the service role key in frontend code or commit `.env`. Keep a strong, private `JWT_SECRET`. Restart the server. If the Supabase values are absent, the app uses its local JSON store in `data/`.

Deploy the Node API to a host that runs long-lived Express services, configure the same server environment variables, and point the client API requests to that service (or serve the Vite build from the same origin with `/api` proxied). Hosted free tiers and usage limits can change, so check the provider's current plan before deploying.

`npm run check` checks TypeScript and `npm run build` creates production assets.

## Product boundaries

Bright Mind supports enjoyable skills practice and never offers medical assessment or diagnosis. Caregiver and administrator workflows are not implemented yet.
