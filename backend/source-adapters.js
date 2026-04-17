const ADAPTERS = [
  { name: "Greenhouse", priority: 1, auth: "none" },
  { name: "Lever", priority: 2, auth: "none" },
  { name: "Ashby", priority: 3, auth: "none" },
  { name: "SmartRecruiters", priority: 4, auth: "SMARTRECRUITERS_API_KEY" },
  { name: "USAJOBS", priority: 5, auth: "USAJOBS_API_KEY" },
  { name: "Adzuna", priority: 6, auth: "ADZUNA_APP_ID + ADZUNA_APP_KEY" },
  { name: "Remotive", priority: 7, auth: "none" },
  { name: "Firecrawl", priority: 8, auth: "FIRECRAWL_API_KEY" },
];

const DEFAULT_GREENHOUSE_BOARDS = [
  { boardToken: "airbnb", company: "Airbnb" },
  { boardToken: "figma", company: "Figma" },
  { boardToken: "discord", company: "Discord" },
];

const DEFAULT_LEVER_ACCOUNTS = [
  { account: "plaid", company: "Plaid" },
  { account: "spotify", company: "Spotify" },
  { account: "benchsci", company: "BenchSci" },
];

const DEFAULT_ASHBY_BOARDS = [
  { boardName: "linear", company: "Linear" },
  { boardName: "cursor", company: "Cursor" },
  { boardName: "supabase", company: "Supabase" },
  { boardName: "replit", company: "Replit" },
];

async function searchAllSources({ profile, sources, env = process.env, limit = 25 }) {
  const selected = new Set(sources?.length ? sources : ["Greenhouse", "Lever", "Ashby", "Remotive"]);
  const query = buildQuery(profile);
  const remoteQuery = buildRemoteQuery(profile, query);
  const searches = [];

  if (selected.has("Greenhouse")) searches.push(guarded("Greenhouse", searchGreenhouse(env, query, limit)));
  if (selected.has("Lever")) searches.push(guarded("Lever", searchLever(env, query, limit)));
  if (selected.has("Ashby")) searches.push(guarded("Ashby", searchAshby(env, query, limit)));
  if (selected.has("SmartRecruiters")) searches.push(guarded("SmartRecruiters", searchSmartRecruiters(query, env, limit)));
  if (selected.has("USAJOBS")) searches.push(guarded("USAJOBS", searchUSAJOBS(query, profile, env, limit)));
  if (selected.has("Adzuna")) searches.push(guarded("Adzuna", searchAdzuna(query, env, limit)));
  if (selected.has("Remotive")) searches.push(guarded("Remotive", searchRemotive(remoteQuery, limit)));
  if (selected.has("Firecrawl")) searches.push(guarded("Firecrawl", searchFirecrawl(env, limit)));

  const settled = await Promise.allSettled(searches);
  const jobs = settled.flatMap((result) => (result.status === "fulfilled" ? result.value.jobs : []));
  const diagnostics = settled.map((result) => result.value.diagnostic);

  return {
    jobs: dedupeJobs(jobs).slice(0, limit),
    diagnostics,
  };
}

async function guarded(source, promise) {
  try {
    return await promise;
  } catch (error) {
    return {
      jobs: [],
      diagnostic: { source, status: "failed", message: error.message || "Search failed" },
    };
  }
}

async function searchGreenhouse(env, query, limit) {
  const { items: boards, usingDefault } = configuredList(env.GREENHOUSE_BOARDS, DEFAULT_GREENHOUSE_BOARDS);

  const results = [];
  for (const board of boards) {
    const baseUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.boardToken)}`;
    const json = await getJson(`${baseUrl}/jobs`);
    const candidates = prioritizeSourceJobs(
      (json.jobs || []).map((job) => normalizeGreenhouse(job, board)).filter((job) => job.applyUrl),
      query,
      limit
    );
    const details = await Promise.all(
      candidates.map(async (job) => {
        try {
          const detail = await getJson(`${baseUrl}/jobs/${encodeURIComponent(job.sourceJobId)}`);
          return normalizeGreenhouse(detail, board);
        } catch {
          return job;
        }
      })
    );
    results.push(...details);
  }

  return ok(
    "Greenhouse",
    prioritizeSourceJobs(results, query, limit),
    usingDefault
      ? `Using live default boards: ${boards.map((board) => board.company || board.boardToken).join(", ")}.`
      : `${boards.length} configured boards searched.`
  );
}

async function searchLever(env, query, limit) {
  const { items: accounts, usingDefault } = configuredList(env.LEVER_ACCOUNTS, DEFAULT_LEVER_ACCOUNTS);

  const results = [];
  for (const account of accounts) {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(account.account)}`;
    const json = await getJson(url);
    results.push(...json.map((job) => normalizeLever(job, account)).filter((job) => job.applyUrl));
  }

  return ok(
    "Lever",
    prioritizeSourceJobs(results, query, limit),
    usingDefault
      ? `Using live default accounts: ${accounts.map((account) => account.company || account.account).join(", ")}.`
      : `${accounts.length} configured accounts searched.`
  );
}

async function searchAshby(env, query, limit) {
  const { items: boards, usingDefault } = configuredList(env.ASHBY_BOARDS, DEFAULT_ASHBY_BOARDS);

  const results = [];
  for (const board of boards) {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(
      board.boardName
    )}?includeCompensation=true`;
    const json = await getJson(url);
    const jobs = Array.isArray(json.jobs) ? json.jobs : [];
    results.push(...jobs.map((job) => normalizeAshby(job, board)).filter((job) => job.applyUrl));
  }

  return ok(
    "Ashby",
    prioritizeSourceJobs(results, query, limit),
    usingDefault
      ? `Using live default boards: ${boards.map((board) => board.company || board.boardName).join(", ")}.`
      : `${boards.length} configured boards searched.`
  );
}

async function searchSmartRecruiters(query, env, limit) {
  if (!env.SMARTRECRUITERS_API_KEY) {
    return skipped("SmartRecruiters", "SMARTRECRUITERS_API_KEY is required for this source.");
  }
  const url = `https://api.smartrecruiters.com/jobs?q=${encodeURIComponent(query)}&limit=${limit}`;
  const json = await getJson(url, { "x-smarttoken": env.SMARTRECRUITERS_API_KEY });
  const jobs = Array.isArray(json.content) ? json.content : Array.isArray(json.jobs) ? json.jobs : [];
  return ok("SmartRecruiters", jobs.map(normalizeSmartRecruiters).filter((job) => job.applyUrl));
}

async function searchUSAJOBS(query, profile, env, limit) {
  if (!env.USAJOBS_API_KEY || !env.USAJOBS_USER_AGENT) {
    return skipped("USAJOBS", "USAJOBS_API_KEY and USAJOBS_USER_AGENT are required.");
  }
  const locationName = profile.preferences?.locations?.[0] || "";
  const url = `https://data.usajobs.gov/api/Search?Keyword=${encodeURIComponent(query)}&LocationName=${encodeURIComponent(
    locationName
  )}&ResultsPerPage=${limit}`;
  const json = await getJson(url, {
    AuthorizationKey: env.USAJOBS_API_KEY,
    "User-Agent": env.USAJOBS_USER_AGENT,
  });
  const items = json.SearchResult?.SearchResultItems || [];
  return ok("USAJOBS", items.map(normalizeUSAJOBS).filter((job) => job.applyUrl));
}

async function searchAdzuna(query, env, limit) {
  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) {
    return skipped("Adzuna", "ADZUNA_APP_ID and ADZUNA_APP_KEY are required.");
  }
  const country = env.ADZUNA_COUNTRY || "in";
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${encodeURIComponent(
    env.ADZUNA_APP_ID
  )}&app_key=${encodeURIComponent(env.ADZUNA_APP_KEY)}&what=${encodeURIComponent(query)}&results_per_page=${limit}`;
  const json = await getJson(url);
  return ok("Adzuna", (json.results || []).map(normalizeAdzuna).filter((job) => job.applyUrl));
}

async function searchRemotive(query, limit) {
  const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=${limit}`;
  const json = await getJson(url);
  return ok("Remotive", (json.jobs || []).map(normalizeRemotive).filter((job) => job.applyUrl));
}

async function searchFirecrawl(env, limit) {
  const pages = parseJsonEnv(env.COMPANY_CAREER_URLS, []);
  if (!env.FIRECRAWL_API_KEY) return skipped("Firecrawl", "FIRECRAWL_API_KEY is required.");
  if (!pages.length) return skipped("Firecrawl", "No COMPANY_CAREER_URLS configured.");

  const results = [];
  for (const page of pages) {
    const response = await fetch("https://api.firecrawl.dev/v2/crawl", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: page.url,
        limit: Math.min(10, limit),
        scrapeOptions: { formats: ["markdown", "links"] },
      }),
    });
    if (!response.ok) throw new Error(`Firecrawl failed with ${response.status}`);
    const json = await response.json();
    const data = Array.isArray(json.data) ? json.data : [];
    results.push(...data.map((item) => normalizeFirecrawl(item, page)).filter((job) => job.applyUrl));
  }

  return ok("Firecrawl", results.slice(0, limit));
}

function normalizeGreenhouse(job, ctx) {
  return {
    source: "Greenhouse",
    sourceJobId: String(job.id),
    title: job.title,
    company: ctx.company || ctx.boardToken,
    location: normalizeLocation(job.location),
    remoteType: inferRemoteType(`${job.title} ${job.content || ""} ${normalizeLocation(job.location)}`),
    description: stripHtml(job.content || ""),
    applyUrl: job.absolute_url,
    postedAt: job.updated_at || null,
    compensation: null,
  };
}

function normalizeLever(job, ctx) {
  return {
    source: "Lever",
    sourceJobId: job.id,
    title: job.text,
    company: ctx.company || ctx.account,
    location: job.categories?.location || "Not specified",
    remoteType: inferRemoteType(`${job.text} ${job.categories?.location || ""} ${job.descriptionPlain || ""}`),
    description: job.descriptionPlain || stripHtml(job.description || ""),
    applyUrl: job.hostedUrl || job.applyUrl,
    postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
    compensation: null,
  };
}

function normalizeAshby(job, ctx) {
  return {
    source: "Ashby",
    sourceJobId: job.id,
    title: job.title,
    company: ctx.company || ctx.boardName,
    location: normalizeLocation(job.location),
    remoteType: inferRemoteType(`${job.title} ${normalizeLocation(job.location)} ${job.descriptionPlain || ""}`),
    description: job.descriptionPlain || stripHtml(job.descriptionHtml || ""),
    applyUrl: job.jobUrl || job.applyUrl,
    postedAt: job.publishedAt || null,
    compensation: normalizeCompensation(job.compensation),
  };
}

function normalizeSmartRecruiters(job) {
  const location = normalizeLocation(job.location);
  return {
    source: "SmartRecruiters",
    sourceJobId: job.id,
    title: job.name,
    company: job.company?.name || "Unknown company",
    location,
    remoteType: inferRemoteType(`${job.name} ${location} ${job.typeOfEmployment?.label || ""}`),
    description: job.ref || job.name,
    applyUrl: job.ref,
    postedAt: job.releasedDate || null,
    compensation: null,
  };
}

function normalizeUSAJOBS(job) {
  const descriptor = job.MatchedObjectDescriptor || {};
  return {
    source: "USAJOBS",
    sourceJobId: descriptor.PositionID,
    title: descriptor.PositionTitle,
    company: descriptor.OrganizationName,
    location: descriptor.PositionLocationDisplay,
    remoteType: inferRemoteType(`${descriptor.PositionTitle} ${descriptor.PositionLocationDisplay}`),
    description: descriptor.QualificationSummary || "",
    applyUrl: descriptor.PositionURI,
    postedAt: descriptor.PublicationStartDate || null,
    compensation: descriptor.PositionRemuneration?.[0]?.MinimumRange
      ? `${descriptor.PositionRemuneration[0].MinimumRange}-${descriptor.PositionRemuneration[0].MaximumRange}`
      : null,
  };
}

function normalizeAdzuna(job) {
  return {
    source: "Adzuna",
    sourceJobId: String(job.id),
    title: job.title,
    company: job.company?.display_name || "Unknown company",
    location: job.location?.display_name || "Not specified",
    remoteType: inferRemoteType(`${job.title} ${job.description || ""}`),
    description: stripHtml(job.description || ""),
    applyUrl: job.redirect_url,
    postedAt: job.created || null,
    compensation: job.salary_min || job.salary_max ? `${job.salary_min || ""}-${job.salary_max || ""}` : null,
  };
}

function normalizeRemotive(job) {
  return {
    source: "Remotive",
    sourceJobId: String(job.id),
    title: job.title,
    company: job.company_name,
    location: job.candidate_required_location || "Remote",
    remoteType: "remote",
    description: stripHtml(job.description || ""),
    applyUrl: job.url,
    postedAt: job.publication_date || null,
    compensation: job.salary || null,
  };
}

function normalizeFirecrawl(page, ctx) {
  const markdown = page.markdown || "";
  return {
    source: "Firecrawl",
    sourceJobId: page.metadata?.sourceURL || page.url,
    title: inferTitle(markdown),
    company: ctx.company || safeHostname(ctx.url),
    location: "Detected from page",
    remoteType: inferRemoteType(markdown),
    description: markdown,
    applyUrl: page.metadata?.sourceURL || page.url,
    postedAt: null,
    compensation: null,
  };
}

async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}`);
  }
  return response.json();
}

function buildQuery(profile) {
  const roles = profile.preferences?.roles || [];
  if (roles.length) return roles[0];
  return profile.skills?.slice(0, 2).join(" ") || "software engineer";
}

function buildRemoteQuery(profile, fallbackQuery) {
  const skills = profile.skills || [];
  const preferredSkill = skills.find((skill) => /react|python|node|java|typescript|javascript|data|design/i.test(skill));
  return preferredSkill || fallbackQuery;
}

function dedupeJobs(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = [
      job.applyUrl || "",
      job.sourceJobId || "",
      job.company?.toLowerCase() || "",
      job.title?.toLowerCase() || "",
      job.location?.toLowerCase() || "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseJsonEnv(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function configuredList(value, defaults) {
  const parsed = parseJsonEnv(value, []);
  if (Array.isArray(parsed) && parsed.length) {
    return { items: parsed, usingDefault: false };
  }
  return { items: defaults, usingDefault: true };
}

function prioritizeSourceJobs(jobs, query, limit) {
  const tokens = String(query || "")
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((token) => token.length > 1);

  return jobs
    .map((job, index) => {
      const title = String(job.title || "").toLowerCase();
      const description = String(job.description || "").toLowerCase();
      const score = tokens.reduce((total, token) => {
        if (title.includes(token)) return total + 4;
        if (description.includes(token)) return total + 1;
        return total;
      }, 0);
      return { job, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.job);
}

function ok(source, jobs, message) {
  return {
    jobs,
    diagnostic: { source, status: "ok", count: jobs.length, message: message || `${jobs.length} jobs returned` },
  };
}

function skipped(source, message) {
  return {
    jobs: [],
    diagnostic: { source, status: "skipped", message },
  };
}

function inferRemoteType(text) {
  const value = String(text).toLowerCase();
  if (value.includes("remote")) return "remote";
  if (value.includes("hybrid")) return "hybrid";
  if (value.includes("onsite") || value.includes("on-site")) return "onsite";
  return "unknown";
}

function normalizeLocation(location) {
  if (!location) return "Not specified";
  if (typeof location === "string") return location;
  if (location.name) return location.name;
  if (location.city || location.country) return [location.city, location.region, location.country].filter(Boolean).join(", ");
  return "Not specified";
}

function normalizeCompensation(compensation) {
  if (!compensation) return null;
  if (typeof compensation === "string") return compensation;
  if (compensation.compensationTierSummary) return compensation.compensationTierSummary;
  if (compensation.scrapeableCompensationSalarySummary) return compensation.scrapeableCompensationSalarySummary;
  const min = compensation.minValue || compensation.minimum;
  const max = compensation.maxValue || compensation.maximum;
  const currency = compensation.currencyCode || compensation.currency || "";
  return min || max ? `${currency} ${min || ""}-${max || ""}`.trim() : null;
}

function stripHtml(html) {
  return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function inferTitle(text) {
  return String(text).split("\n").find((line) => line.trim().length > 8)?.replace(/^#+\s*/, "") || "Career page role";
}

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "Company careers";
  }
}

module.exports = {
  ADAPTERS,
  DEFAULT_GREENHOUSE_BOARDS,
  DEFAULT_LEVER_ACCOUNTS,
  DEFAULT_ASHBY_BOARDS,
  searchAllSources,
  dedupeJobs,
};
