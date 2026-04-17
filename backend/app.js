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

  const allowedOrigins = String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
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

  app.use((error, req, res, next) => {
    const status = error.message?.includes("required") || error.message?.includes("Unsupported") ? 400 : 500;
    res.status(status).json({
      error: error.message || "Unexpected server error",
    });
  });

  return app;
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

module.exports = {
  createApp,
  parsePreferences,
  parseSources,
  hasJsonItems,
};
