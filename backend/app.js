const path = require("path");
const cors = require("cors");
const express = require("express");
const multer = require("multer");
const { parseResumeFile, analyzeResumeText } = require("./resume-parser");
const {
  DEFAULT_ASHBY_BOARDS,
  DEFAULT_GREENHOUSE_BOARDS,
  DEFAULT_LEVER_ACCOUNTS,
  searchAllSources,
} = require("./source-adapters");
const { rankJobs } = require("./matching");

function createApp(options = {}) {
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  const allowedOrigins = uniqueList(
    String(process.env.CORS_ORIGIN || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
      .concat([
        "http://localhost:8787",
        "http://127.0.0.1:8787",
        "https://applypilot-rose.vercel.app",
        "https://udayprakashchamakuri-beep.github.io",
      ])
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || isVercelPreviewOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin not allowed: ${origin}`));
      },
    })
  );
  app.use(express.json({ limit: "1mb" }));

  if (options.serveStatic) {
    app.use(express.static(path.resolve(__dirname, "..")));
  }

  app.get("/api/health", (req, res) => {
    res.json({
      ok: true,
      service: "ApplyPilot backend",
      sources: {
        greenhouseConfigured: hasJsonItems(process.env.GREENHOUSE_BOARDS),
        greenhouseDefaultBoards: DEFAULT_GREENHOUSE_BOARDS.length,
        leverConfigured: hasJsonItems(process.env.LEVER_ACCOUNTS),
        leverDefaultAccounts: DEFAULT_LEVER_ACCOUNTS.length,
        ashbyConfigured: hasJsonItems(process.env.ASHBY_BOARDS),
        ashbyDefaultBoards: DEFAULT_ASHBY_BOARDS.length,
        smartRecruitersConfigured: Boolean(process.env.SMARTRECRUITERS_API_KEY),
        firecrawlConfigured: Boolean(process.env.FIRECRAWL_API_KEY && hasJsonItems(process.env.COMPANY_CAREER_URLS)),
        usajobsConfigured: Boolean(process.env.USAJOBS_API_KEY && process.env.USAJOBS_USER_AGENT),
        adzunaConfigured: Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
      },
    });
  });

  app.post("/api/analyze-resume", upload.single("resume"), async (req, res, next) => {
    try {
      const preferences = parsePreferences(req.body.preferences);
      const text = await parseResumeFile(req.file);
      const profile = analyzeResumeText(text, req.file.originalname, preferences);
      res.json({ profile });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/search-jobs", async (req, res, next) => {
    try {
      const profile = req.body.profile;
      if (!profile) {
        res.status(400).json({ error: "profile is required" });
        return;
      }

      const sources = Array.isArray(req.body.sources) ? req.body.sources : [];
      const limit = Number(req.body.limit || 25);
      const result = await searchAllSources({ profile, sources, limit });
      const jobs = rankJobs(profile, result.jobs);
      res.json({ jobs, diagnostics: result.diagnostics });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/intake", upload.single("resume"), async (req, res, next) => {
    try {
      const preferences = parsePreferences(req.body.preferences);
      const sources = parseSources(req.body.sources);
      const text = await parseResumeFile(req.file);
      const profile = analyzeResumeText(text, req.file.originalname, preferences);
      const result = await searchAllSources({ profile, sources, limit: Number(req.body.limit || 25) });
      const jobs = rankJobs(profile, result.jobs);
      res.json({ profile, jobs, diagnostics: result.diagnostics });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/tailor-resume", async (req, res, next) => {
    try {
      const { profile, job } = req.body;
      if (!profile) {
        res.status(400).json({ error: "profile is required" });
        return;
      }
      if (!job) {
        res.status(400).json({ error: "job is required" });
        return;
      }

      const tailoredResume = buildTailoredResume(profile, job);
      const calendar = buildCalendarSuggestion(job);
      res.json({ tailoredResume, calendar });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/apply", async (req, res, next) => {
    try {
      const { profile, job, tailoredResume } = req.body;
      if (!profile) {
        res.status(400).json({ error: "profile is required" });
        return;
      }
      if (!job) {
        res.status(400).json({ error: "job is required" });
        return;
      }

      const calendarDraft = buildCalendarSuggestion(job);
      const calendar = await maybeCreateCalendarEvent(job, calendarDraft);
      const application = {
        provider: job.source || "ApplyPilot",
        confirmationId: `APP-${String(job.source || "JOB").slice(0, 3).toUpperCase()}-${Date.now()
          .toString()
          .slice(-6)}`,
        status: "queued_for_connector",
        submittedAt: new Date().toISOString(),
        applyUrl: job.applyUrl,
        note:
          "Approved application has been queued. If a Google Calendar access token is configured, interview events are added automatically.",
      };

      res.json({
        ok: true,
        application,
        calendar,
        tailoredResume: tailoredResume || buildTailoredResume(profile, job),
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, req, res, next) => {
    const status = error.message?.includes("required") || error.message?.includes("Unsupported") ? 400 : 500;
    res.status(status).json({
      error: error.message || "Unexpected server error",
    });
  });

  return app;
}

function buildTailoredResume(profile, job) {
  const matchedSkills = Array.isArray(job.matchedSkills) && job.matchedSkills.length ? job.matchedSkills : [];
  const skills = matchedSkills.length ? matchedSkills : profile.skills || [];
  const leadSkill = skills[0] || "product engineering";
  const secondSkill = skills[1] || "API delivery";
  const company = job.company || "the company";
  const role = job.title || job.role || "the role";
  const gap = Array.isArray(job.gaps) && job.gaps.length ? job.gaps[0] : "role-specific depth";

  return {
    headline: `${profile.headline || "Software candidate"} - tailored for ${role}`,
    summary: `Position ${profile.fileName || "the resume"} around ${company}'s need for ${leadSkill}, ${secondSkill}, measurable delivery, and role-specific ownership.`,
    bullets: [
      `Lead ${leadSkill} work aligned to ${role} responsibilities and measurable product outcomes.`,
      `Build maintainable systems using ${secondSkill} with clear ownership, testability, and production readiness.`,
      `Prioritize matched evidence from the uploaded resume for ${company}'s screening and ATS review.`,
      `Address ${gap} as a focused improvement area while keeping the application honest and explainable.`,
    ],
    changes: [
      `Moved ${leadSkill} and ${secondSkill} into the opening summary.`,
      "Converted generic responsibilities into impact-led bullets.",
      "Kept gaps visible so the user can improve before approval.",
    ],
  };
}

function buildCalendarSuggestion(job) {
  const base = job.interviewDate || defaultFutureDate(5);
  const start = new Date(base);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    provider: "Google Calendar",
    status: "ready_for_oauth",
    start: start.toISOString(),
    end: end.toISOString(),
    title: `${job.company || "Company"} ${job.title || job.role || "interview"} interview or assessment`,
    message:
      "Calendar slot prepared. If Google token is available, ApplyPilot will create the event automatically.",
    link: buildCalendarUrl(job, start, end),
  };
}

async function maybeCreateCalendarEvent(job, calendarDraft) {
  const accessToken =
    String(process.env.GOOGLE_CALENDAR_ACCESS_TOKEN || process.env.GOOGLE_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    return calendarDraft;
  }

  const calendarId = encodeURIComponent(String(process.env.GOOGLE_CALENDAR_ID || "primary"));
  const timeZone = String(process.env.GOOGLE_CALENDAR_TIMEZONE || "Asia/Kolkata");
  const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;

  const payload = {
    summary: calendarDraft.title,
    description: `Application approved in ApplyPilot.\nSource: ${job.source || "Unknown"}\nJob URL: ${
      job.applyUrl || "Not available"
    }`,
    location: job.location || "Online",
    start: { dateTime: calendarDraft.start, timeZone },
    end: { dateTime: calendarDraft.end, timeZone },
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await readResponseText(response);
      return {
        ...calendarDraft,
        status: "ready_for_oauth",
        error: errorText || `Google Calendar API error ${response.status}`,
        message: "Automatic calendar sync failed. Open the calendar link to add it manually.",
      };
    }

    const event = await response.json();
    return {
      ...calendarDraft,
      status: "created",
      eventId: event.id,
      htmlLink: event.htmlLink,
      link: event.htmlLink || calendarDraft.link,
      message: "Interview event added to Google Calendar automatically.",
    };
  } catch (error) {
    return {
      ...calendarDraft,
      status: "ready_for_oauth",
      error: error.message || "Google Calendar request failed",
      message: "Automatic calendar sync is unavailable right now. Open the calendar link to add it manually.",
    };
  }
}

function buildCalendarUrl(job, start, end) {
  const format = (date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${job.company || "Company"} ${job.title || job.role || "interview"} interview or assessment`,
    dates: `${format(start)}/${format(end)}`,
    details: `Application approved in ApplyPilot. Source: ${job.source || "Unknown"}.`,
    location: job.location || "Online",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function defaultFutureDate(daysAhead) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(10, 0, 0, 0);
  return date.toISOString();
}

async function readResponseText(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function parsePreferences(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function parseSources(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hasJsonItems(value) {
  if (!value) return false;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

function isVercelPreviewOrigin(origin) {
  try {
    return new URL(origin).hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

function uniqueList(items) {
  return Array.from(new Set(items));
}

module.exports = {
  createApp,
  parsePreferences,
  parseSources,
  hasJsonItems,
  isVercelPreviewOrigin,
};
