# Job Source Adapter Spec

ApplyPilot should search clean public ATS feeds before crawling. Crawling is a fallback, not the first dependency.

## Priority Order

| Priority | Source | Endpoint pattern | Auth | Usage |
|---|---|---|---|---|
| 1 | Greenhouse | `GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true` | None for public boards | Company ATS feed |
| 2 | Lever | `GET https://api.lever.co/v0/postings/{account}` | None for public postings | Company ATS feed |
| 3 | Ashby | `GET https://api.ashbyhq.com/posting-api/job-board/{JOB_BOARD_NAME}?includeCompensation=true` | Public posting API | Company ATS feed with compensation |
| 4 | SmartRecruiters | `GET https://api.smartrecruiters.com/jobs?q={query}&limit={n}&pageId={id}` | Public search API | Searchable feed |
| 5 | USAJOBS | `GET https://data.usajobs.gov/api/Search` | API key | US public sector jobs |
| 6 | Adzuna | `GET https://api.adzuna.com/v1/api/jobs/{country}/search/1?...` | app id + app key | Aggregator |
| 7 | Remotive | Public jobs API or RSS | Public | Remote-only jobs |
| 8 | Firecrawl | `POST https://api.firecrawl.dev/v2/crawl` | Backend API key | Company careers fallback |
| 9 | Bright Data | Web Scraper API | Backend API key | Blocked or JS-heavy pages |
| 10 | Apify | Actor run APIs | Backend token | Community scraper fallback |

## Normalized Job Schema

```json
{
  "source": "Greenhouse",
  "sourceJobId": "123456",
  "title": "Frontend Engineer",
  "company": "Example Co",
  "location": "Bengaluru, India",
  "remoteType": "remote",
  "description": "Full job description",
  "applyUrl": "https://...",
  "postedAt": "2026-04-17T00:00:00.000Z",
  "compensation": "INR 20-30 LPA",
  "matchScore": 92
}
```

## Backend Rules

- Keep API keys in backend environment variables only.
- Never put Firecrawl, Featherless, USAJOBS, Adzuna, Bright Data, Apify, or Google OAuth secrets in GitHub Pages.
- Deduplicate jobs by `applyUrl`, `sourceJobId`, and `company + title + location`.
- Only submit applications after a user approves the tailored resume and calendar slot.
- Use direct ATS feeds whenever possible instead of scraping LinkedIn, Indeed, or Naukri directly.
