const ADAPTERS = [
  {
    name: "Greenhouse",
    priority: 1,
    auth: "none",
    buildUrl: ({ boardToken }) =>
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`,
    normalize: (job, ctx) => ({
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
    }),
  },
  {
    name: "Lever",
    priority: 2,
    auth: "none",
    buildUrl: ({ account }) => `https://api.lever.co/v0/postings/${encodeURIComponent(account)}`,
    normalize: (job, ctx) => ({
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
    }),
  },
  {
    name: "Ashby",
    priority: 3,
    auth: "none",
    buildUrl: ({ boardName }) =>
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(boardName)}?includeCompensation=true`,
    normalize: (job, ctx) => ({
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
    }),
  },
  {
    name: "SmartRecruiters",
    priority: 4,
    auth: "none",
    buildUrl: ({ query, pageId, limit = 25 }) =>
      `https://api.smartrecruiters.com/jobs?q=${encodeURIComponent(query)}&limit=${limit}${
        pageId ? `&pageId=${encodeURIComponent(pageId)}` : ""
      }`,
    normalize: (job) => ({
      source: "SmartRecruiters",
      sourceJobId: job.id,
      title: job.name,
      company: job.company?.name || "Unknown company",
      location: normalizeLocation(job.location),
      remoteType: inferRemoteType(`${job.name} ${normalizeLocation(job.location)} ${job.typeOfEmployment?.label || ""}`),
      description: job.ref || "",
      applyUrl: job.ref,
      postedAt: job.releasedDate || null,
      compensation: null,
    }),
  },
  {
    name: "USAJOBS",
    priority: 5,
    auth: "USAJOBS_API_KEY",
    buildUrl: ({ query, locationName, page = 1 }) =>
      `https://data.usajobs.gov/api/Search?Keyword=${encodeURIComponent(query)}&LocationName=${encodeURIComponent(
        locationName || ""
      )}&Page=${page}`,
    headers: (env) => ({
      AuthorizationKey: env.USAJOBS_API_KEY,
      "User-Agent": env.USAJOBS_USER_AGENT,
    }),
    normalize: (job) => {
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
    },
  },
  {
    name: "Firecrawl",
    priority: 8,
    auth: "FIRECRAWL_API_KEY",
    buildUrl: () => "https://api.firecrawl.dev/v2/crawl",
    headers: (env) => ({
      Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    }),
    buildBody: ({ url }) => ({
      url,
      limit: 20,
      scrapeOptions: {
        formats: ["markdown", "links"],
      },
    }),
    normalize: (page, ctx) => ({
      source: "Firecrawl",
      sourceJobId: page.metadata?.sourceURL || page.url,
      title: inferTitle(page.markdown || page.html || ""),
      company: ctx.company || new URL(ctx.url).hostname,
      location: "Detected from page",
      remoteType: inferRemoteType(page.markdown || ""),
      description: page.markdown || "",
      applyUrl: page.metadata?.sourceURL || page.url,
      postedAt: null,
      compensation: null,
    }),
  },
];

function normalizeJob(rawJob, sourceName, context = {}) {
  const adapter = ADAPTERS.find((item) => item.name === sourceName);
  if (!adapter) {
    throw new Error(`Unknown adapter: ${sourceName}`);
  }
  return adapter.normalize(rawJob, context);
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
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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

module.exports = {
  ADAPTERS,
  normalizeJob,
  dedupeJobs,
};
