# ApplyAI Autopilot Frontend

This folder turns the six exported ApplyAI screens into one interactive browser app.

## Run

Open `index.html` in a browser:

```text
C:\Users\reddy\HACKATHON\ApplyPilot\index.html
```

No install step is required.

## What works in the browser demo

- Resume upload intake for PDF, DOCX, DOC, and TXT.
- Text resume parsing for TXT files.
- Mock resume analysis for document files.
- Job search across LinkedIn, Naukri.com, Indeed, and company career sites.
- Match scoring by role, skills, location, salary, and approval threshold.
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
