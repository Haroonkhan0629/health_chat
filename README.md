# Health Chat

A simple weekly workout planner built with the [DeepSpace SDK](https://docs.deep.space/), React, Bootstrap, and Groq. DeepSpace uses a Cloudflare Worker with Hono for the backend; there is no separate Express server or Python installation. React is included because it is part of the DeepSpace scaffold and makes the changing workout cards straightforward.

## Setup

1. Use Node.js 22.15+, 24, or 26 and npm 11.6+. Dependencies are already installed here; on another machine run `npm install`.
2. Put your Groq API key in `.env`:

   ```dotenv
   GROQ_API_KEY=your_key_here
   ```

3. From this folder, sign in and confirm the account that will own the app:

   ```powershell
   npx deepspace auth login
   npx deepspace auth whoami
   ```

4. Upload the key to DeepSpace's encrypted secrets store, then start the app:

   ```powershell
   npx deepspace secrets upload .env
   npm run dev
   ```

   Open the local URL printed by the CLI. First use registers the app to the signed-in DeepSpace account. DeepSpace sends the key to its encrypted secrets store and generates `.dev.vars` for the worker; it does not read `.env` directly when `.dev.vars` exists. Re-upload after changing the key and restart the server. Both files are ignored by Git. Never put a key in client-side code.

The backend sends the request to Groq's `openai/gpt-oss-120b` model with a system instruction, examples, and the exercise IDs, names, and muscle groups from `src/exercise-catalog.json`. Workout days have up to five exercises; rest days have none. The model selects IDs; the app validates them and displays the matching locally hosted image from `public/images/exercises`. The 102 catalog entries and images were copied from the Fitness-App exercise image catalog, which credits [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) ([Unlicense](https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md)). To add an exercise, add its image and an entry with a unique ID, name, group, and local image path to the catalog.

The model decides whether a request is specific enough; this is probabilistic and not a security or medical safeguard. The schedule is general AI-generated guidance, not medical advice. If you have an injury or medical condition, consult a qualified professional. The model can select only from the included catalog, so some requests may have limited exercise choices.

Users sign in through DeepSpace before creating workouts. The browser obtains a short-lived JWT from DeepSpace and sends it to the workout endpoint, where the Worker verifies it before calling Groq. Authentication does not limit how much a signed-in user can consume; add rate limiting before deploying publicly.

## Checks

Run `npm run validate` for TypeScript and unit tests, and `npm run build` for a production build. DeepSpace requires the app to be registered before its standard tests or build can run. A real Groq request also requires your API key and a DeepSpace account.
