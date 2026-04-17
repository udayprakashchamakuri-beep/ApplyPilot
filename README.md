# ApplyPilot Frontend

This folder turns the six exported prototype screens into one interactive ApplyPilot browser app.

## Live site

After GitHub Pages finishes publishing, open:

```text
https://udayprakashchamakuri-beep.github.io/ApplyPilot/
```

## Run

Open `index.html` in a browser:

```text
C:\Users\reddy\HACKATHON\ApplyPilot\index.html
```

No install step is required.

## What works in the browser demo

- Resume upload intake for PDF, DOCX, DOC, and TXT.
- Job-seeking intake for target roles, locations, salary, experience level, job type, work mode, notice period, and skills to emphasize.
- Text resume parsing for TXT files.
- Mock resume analysis for document files.
- A suited-jobs page with jobs from LinkedIn, Naukri.com, Indeed, and company career sites.
- Match scoring by role, skills, location, salary, and approval threshold.
- An approval queue page for jobs waiting on user approval.
- Source adapter plan for Greenhouse, Lever, Ashby, SmartRecruiters, USAJOBS, Adzuna, Remotive, Firecrawl, Bright Data, and Apify.
- Tailored resume preview before applying.
- User approval gate.
- Calendar availability check.
- Google Calendar event preview link.
- Mock application submission after approval.

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
- `backend/source-adapters.js` contains backend-safe adapter and normalization scaffolding.
- `.env.example` lists the required environment variables without committing any real secrets.

Do not place real API keys in `index.html`, `app.js`, or any GitHub Pages file.
