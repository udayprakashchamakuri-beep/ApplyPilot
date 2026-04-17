# ApplyPilot

ApplyPilot is a resume-first job matching and approval workflow. It analyzes a resume, searches
live job sources, explains why each role fits, flags skill gaps, prepares a tailored resume preview,
and keeps the final apply action behind user approval.

## Live site

After GitHub Pages finishes publishing, open:

```text
https://udayprakashchamakuri-beep.github.io/ApplyPilot/
```

Vercel deployment with backend API:

```text
https://applypilot-rose.vercel.app
```

## Run

Open `index.html` in a browser:

```text
C:\Users\reddy\HACKATHON\ApplyPilot\index.html
```

No install step is required.

## Run with the backend API

The public GitHub Pages site cannot store private API keys, so real job search runs through the backend.
Greenhouse, Lever, Ashby, and Remotive can return live jobs without secrets because the backend includes
a small default set of public company boards. Add your own board lists in `.env` or Vercel to expand coverage.

```powershell
copy .env.example .env
npm install
npm start
```

Then open:

```text
http://localhost:8787
```

When opened from `localhost:8787`, the frontend automatically calls the backend APIs.

## Deploy with Vercel

Vercel can host the static frontend and the backend API together. The backend API is exposed through:

```text
/api/health
/api/analyze-resume
/api/search-jobs
/api/intake
```

For Vercel deployments, add secrets in the Vercel project settings:

```text
FEATHERLESS_API_KEY
FIRECRAWL_API_KEY
SMARTRECRUITERS_API_KEY
GREENHOUSE_BOARDS
LEVER_ACCOUNTS
ASHBY_BOARDS
COMPANY_CAREER_URLS
USAJOBS_API_KEY
USAJOBS_USER_AGENT
ADZUNA_APP_ID
ADZUNA_APP_KEY
```

On `*.vercel.app`, the frontend automatically calls the same-origin backend API.

Backend endpoints:

- `POST /api/analyze-resume`: multipart form upload with `resume` and `preferences`.
- `POST /api/search-jobs`: JSON body with `profile`, `sources`, and optional `limit`.
- `POST /api/intake`: multipart form upload that analyzes the resume and searches jobs in one request.
- `GET /api/health`: confirms backend and source configuration.

## What works now

- Resume upload intake for PDF, DOCX, DOC, and TXT.
- Job-seeking intake for target roles, locations, salary, experience level, job type, work mode, notice period, and skills to emphasize.
- Server-side resume parsing for TXT, PDF, and DOCX through the backend API.
- Live job search from public Greenhouse, Lever, Ashby, and Remotive sources.
- A suited-jobs page with explainable match scores and skill gaps.
- Match scoring by role, skills, location, work mode, and approval threshold.
- An approval queue page for jobs waiting on user approval.
- Source adapter plan for Greenhouse, Lever, Ashby, SmartRecruiters, USAJOBS, Adzuna, Remotive, Firecrawl, Bright Data, and Apify.
- Tailored resume preview before applying.
- User approval gate.
- Calendar availability check.
- Google Calendar event preview link.
- Local approved-application tracking after approval.

## Needs production credentials before it can truly apply

- SmartRecruiters search needs `SMARTRECRUITERS_API_KEY`.
- Firecrawl fallback needs `FIRECRAWL_API_KEY` and `COMPANY_CAREER_URLS`.
- USAJOBS and Adzuna need their own API keys.
- Real application submission needs source-specific application credentials, user consent, and form handling.
- Google Calendar event creation needs Google OAuth. The current app gives a preview link until OAuth is wired.

## Production connector points

The frontend is ready for backend replacement at these functions in `app.js`:

- `connectors.analyzeResume`
- `connectors.searchJobs`
- `connectors.tailorResume`
- `connectors.checkCalendar`
- `connectors.createCalendarEvent`
- `connectors.applyToJob`

Real submissions need backend services with user consent, stored tokens, Google Calendar OAuth,
resume parsing, site-specific application adapters, and compliance checks for each job platform.

## Backend adapter files

- `docs/ADAPTERS.md` defines the source priority order and normalized job schema.
- `backend/server.js` exposes the API.
- `backend/resume-parser.js` parses TXT, PDF, and DOCX resumes server-side.
- `backend/source-adapters.js` calls public ATS feeds and Firecrawl fallback.
- `backend/matching.js` ranks normalized jobs for the user profile.
- `.env.example` lists the required environment variables without committing any real secrets.

Do not place real API keys in `index.html`, `app.js`, or any GitHub Pages file.
