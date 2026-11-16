# Health Chat

**Live app:** [health-chat.app.space](https://health-chat.app.space)

Health Chat creates a weekly workout plan based on a body part, muscle group, or specific exercise goal. Sign in, enter a goal such as "chest," and receive a seven-day schedule with up to five exercises per workout day, local exercise images, and rest days. Vague or unrelated requests are rejected.

## How it works

1. A user signs in with DeepSpace. The React page shows the workout search once the session is signed in.
2. The browser sends the goal as JSON to `POST /api/workout`, along with a short-lived DeepSpace JWT.
3. The DeepSpace Worker routes the request to the workout handler, which verifies the JWT before calling Groq.
4. The backend sends the goal, system instructions, exercise catalog, and a structured response schema to Groq's `openai/gpt-oss-120b` model. The schema limits exercise IDs to those in the catalog.
5. The app validates the response, matches each ID to a local image, and displays the plan.

## Tools used

- **React, JavaScript, HTML, and CSS** for the interface; **Bootstrap** for styling.
- **DeepSpace SDK and Cloudflare Workers**, with **Hono**, for authentication, routing, and the backend.
- **Groq** for model inference; **Zod** for validating requests and responses.
- Exercise images from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db), via the Fitness-App catalog ([Unlicense](https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md)).

## Run locally

Requires Node.js 22.15+, 24, or 26 and npm 11.6+.

```powershell
npm install
npx deepspace auth login
npx deepspace auth whoami
```

Add `GROQ_API_KEY=your_key_here` to `.env`, then upload it to DeepSpace's encrypted secrets store and start the app:

```powershell
npx deepspace secrets upload .env
npm run dev
```

Open the local URL printed by the CLI. Keep `.env` and `.dev.vars` private; re-upload the key and restart the server if it changes.

## Notes

Workout plans are AI-generated guidance, not medical advice. Authentication is required, but the app does not currently enforce per-user rate limits; signed-in users can consume the owner's Groq quota.
