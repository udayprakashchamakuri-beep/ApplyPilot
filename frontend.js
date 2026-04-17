const STORAGE_KEY = "applypilot:intake";
const SELECTED_JOB_KEY = "applypilot:selected-job";
const APPLICATIONS_KEY = "applypilot:applications";
const SETTINGS_KEY = "applypilot:settings";
const SAVED_JOBS_KEY = "applypilot:saved-jobs";
const SPA_ROUTE_KEY = "applypilot:route";

const LEGACY_ROUTE_PAGES = {
  intake: "index.html",
  dashboard: "insights.html",
  resume: "resume.html",
  "suited-jobs": "dashboard.html",
  applications: "tailoring.html",
  calendar: "calendar.html",
  preferences: "settings.html",
};

document.addEventListener("DOMContentLoaded", () => {
  setupSpaNavigation();
  setupLandingPage();
  setupResumePage();
  setupInsightsPage();
  setupDashboardPage();
  setupTailoringPage();
  setupCalendarPage();
  setupSettingsPage();
  setupGlobalActions();
});

function setupSpaNavigation() {
  if (!isSpaApp()) return;

  const links = document.querySelectorAll("[data-route-link]");
  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      const route = link.dataset.routeLink;
      if (!route) return;
      event.preventDefault();
      navigateTo(route);
    });
  });

  const hashRoute = normalizeRoute((window.location.hash || "").replace(/^#/, ""));
  const storedRoute = normalizeRoute(localStorage.getItem(SPA_ROUTE_KEY) || "");
  const initialRoute = hashRoute !== "intake" || window.location.hash ? hashRoute : storedRoute || "intake";

  if (window.location.hash) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  setSpaRoute(initialRoute);
}

function refreshSpaRoute(route) {
  if (!isSpaApp()) return;

  if (route === "resume") setupResumePage();
  if (route === "dashboard") setupInsightsPage();
  if (route === "suited-jobs") setupDashboardPage();
  if (route === "applications") setupTailoringPage();
  if (route === "calendar") setupCalendarPage();
  if (route === "preferences") setupSettingsPage();
}

function renderSpaRoute(route) {
  if (!isSpaApp()) return;

  document.querySelectorAll("[data-route-view]").forEach((section) => {
    section.classList.toggle("hidden", section.dataset.routeView !== route);
  });

  document.querySelectorAll("[data-route-link][data-route-nav]").forEach((link) => {
    const active = link.dataset.routeLink === route;
    link.classList.toggle("bg-indigo-50", active);
    link.classList.toggle("text-indigo-700", active);
    link.classList.toggle("font-semibold", active);
    link.classList.toggle("text-slate-600", !active);
  });

  const title = document.querySelector("[data-route-title]");
  if (title) {
    const label = document.querySelector(`[data-route-link="${route}"]`)?.dataset.routeLabel || route;
    title.textContent = label;
  }
}

function setSpaRoute(route) {
  const normalized = normalizeRoute(route);
  localStorage.setItem(SPA_ROUTE_KEY, normalized);
  renderSpaRoute(normalized);
  refreshSpaRoute(normalized);
}

function navigateTo(route) {
  const normalized = normalizeRoute(route);
  if (isSpaApp()) {
    setSpaRoute(normalized);
    return;
  }

  window.location.href = LEGACY_ROUTE_PAGES[normalized] || LEGACY_ROUTE_PAGES.intake;
}

function routeHref(route) {
  const normalized = normalizeRoute(route);
  return isSpaApp() ? "#" : LEGACY_ROUTE_PAGES[normalized] || LEGACY_ROUTE_PAGES.intake;
}

function isSpaApp() {
  return Boolean(document.querySelector("[data-spa-app]"));
}

function normalizeRoute(route) {
  const cleaned = String(route || "").trim().toLowerCase();
  if (LEGACY_ROUTE_PAGES[cleaned]) return cleaned;
  return "intake";
}

function setupLandingPage() {
  const uploadZone = document.querySelector("[data-upload-zone]");
  if (!uploadZone) return;
  if (uploadZone.dataset.bound === "true") return;
  uploadZone.dataset.bound = "true";

  const existingIntake = readJson(STORAGE_KEY);
  if (existingIntake?.profile) {
    setLandingStatus(`Last resume: ${existingIntake.profile.fileName || "uploaded resume"} is ready.`);
  }

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".pdf,.doc,.docx,.txt";
  fileInput.className = "hidden";
  uploadZone.appendChild(fileInput);

  uploadZone.addEventListener("click", () => fileInput.click());
  uploadZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadZone.classList.add("border-primary");
  });
  uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("border-primary"));
  uploadZone.addEventListener("drop", async (event) => {
    event.preventDefault();
    uploadZone.classList.remove("border-primary");
    const [file] = event.dataTransfer.files;
    if (file) await runIntake(file);
  });
  fileInput.addEventListener("change", async () => {
    const [file] = fileInput.files;
    if (file) await runIntake(file);
  });
}

async function runIntake(file) {
  setLandingStatus(`Analyzing ${file.name} and searching live sources...`);
  const settings = readJson(SETTINGS_KEY) || {};
  const sources = normalizeSources(settings.sources);
  const preferences = buildDefaultPreferences();
  const limit = Number(settings.limit || 24);

  try {
    const data = await requestIntakeWithFallback({ file, preferences, sources, limit });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.removeItem(SELECTED_JOB_KEY);
    setLandingStatus(`${data.jobs?.length || 0} live matches found. Opening resume view...`);
    showToast("Resume analyzed", "Your resume is parsed and ready.");
    setupResumePage();
    navigateTo("resume");
  } catch (error) {
    const cached = readJson(STORAGE_KEY);
    if (cached?.profile) {
      setLandingStatus("Live backend is currently unavailable. Loaded your last successful intake.");
      showToast("Using cached intake", "Backend is temporarily unavailable. Loaded your previous data.");
      setupResumePage();
      navigateTo("resume");
      return;
    }
    setLandingStatus(`Backend failed: ${error.message}`);
    showToast("Intake failed", error.message, "error");
  }
}

function setupResumePage() {
  const container = document.querySelector("[data-resume-page]");
  if (!container) return;

  const intake = readJson(STORAGE_KEY);
  const headline = document.querySelector("[data-resume-headline]");
  const summary = document.querySelector("[data-resume-summary]");
  const skills = document.querySelector("[data-resume-skills]");
  const meta = document.querySelector("[data-resume-meta]");
  const action = document.querySelector("[data-resume-action]");
  const editToggle = document.querySelector("[data-resume-edit-toggle]");
  const editPanel = document.querySelector("[data-resume-edit-panel]");
  const editForm = document.querySelector("[data-resume-edit-form]");
  const editHeadline = document.querySelector("[data-edit-headline]");
  const editSummary = document.querySelector("[data-edit-summary]");
  const editSkills = document.querySelector("[data-edit-skills]");

  if (!intake?.profile) {
    if (headline) headline.textContent = "No resume uploaded yet";
    if (summary) summary.textContent = "Upload your resume from the landing page to generate your profile.";
    if (skills) skills.innerHTML = `<span class="px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold">Waiting for resume</span>`;
    if (meta) meta.textContent = "Use Start intake on the landing page.";
    if (action) action.onclick = () => {
      navigateTo("intake");
    };
    editToggle?.setAttribute("disabled", "true");
    return;
  }

  renderResumeProfile(intake.profile, intake.jobs?.length || 0);

  if (editHeadline) editHeadline.value = intake.profile.headline || "";
  if (editSummary) editSummary.value = intake.profile.summary || "";
  if (editSkills) editSkills.value = safeList(intake.profile.skills, []).join(", ");

  if (container.dataset.bound !== "true") {
    container.dataset.bound = "true";

    editToggle?.addEventListener("click", () => {
      if (!editPanel) return;
      editPanel.classList.toggle("hidden");
      editToggle.textContent = editPanel.classList.contains("hidden") ? "Edit Details" : "Close Editor";
    });

    editForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const nextIntake = readJson(STORAGE_KEY) || intake;
      const nextProfile = {
        ...nextIntake.profile,
        headline: (editHeadline?.value || "").trim() || nextIntake.profile.headline,
        summary: (editSummary?.value || "").trim() || nextIntake.profile.summary,
        skills: csvToList(editSkills?.value || "").length
          ? csvToList(editSkills?.value || "")
          : safeList(nextIntake.profile.skills, []),
      };
      nextIntake.profile = nextProfile;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextIntake));
      renderResumeProfile(nextProfile, nextIntake.jobs?.length || 0);
      showToast("Resume details updated", "Your profile details were updated locally.");
    });

    action?.addEventListener("click", () => {
      navigateTo("suited-jobs");
    });
  }

  function renderResumeProfile(profile, jobCount) {
    if (headline) headline.textContent = profile.headline || profile.fileName || "Resume profile";
    if (summary) summary.textContent = profile.summary || "Profile generated from uploaded resume.";
    if (skills) {
      skills.innerHTML = safeList(profile.skills, ["Skills pending extraction"])
        .slice(0, 16)
        .map(
          (skill) =>
            `<span class="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">${escapeHtml(
              skill
            )}</span>`
        )
        .join("");
    }
    if (meta) {
      meta.textContent = `${escapeHtml(profile.fileName || "resume")} analyzed. ${jobCount} suited jobs are ready.`;
    }
  }
}

function setupInsightsPage() {
  const page = document.querySelector("[data-control-page]");
  if (!page) return;

  const intake = readJson(STORAGE_KEY) || {};
  const jobs = Array.isArray(intake.jobs) ? intake.jobs : [];
  const applications = readJson(APPLICATIONS_KEY) || [];
  const savedJobs = readJson(SAVED_JOBS_KEY) || [];
  const profile = intake.profile || {};

  const recommendedCount = jobs.length;
  const savedCount = savedJobs.length;
  const appliedCount = applications.length;
  const interviewCount = applications.filter((entry) => entry?.result?.calendar?.start || entry?.job?.interviewDate).length;

  setText("[data-kpi-recommended]", String(recommendedCount));
  setText("[data-kpi-saved]", String(savedCount));
  setText("[data-kpi-applied]", String(appliedCount));
  setText("[data-kpi-interview]", String(interviewCount));

  const profileStrength = computeProfileStrength(profile, jobs, applications);
  setText("[data-profile-strength]", `${profileStrength}%`);

  const missingSkills = collectMissingSkills(jobs);
  setList(
    "[data-top-missing-skills]",
    missingSkills.length ? missingSkills.slice(0, 6) : ["No major gap detected from current matches"]
  );

  const categories = collectTopCategories(jobs);
  setList(
    "[data-suitable-categories]",
    categories.length ? categories.slice(0, 6) : ["Upload resume and run intake to generate categories"]
  );

  const guidance = buildGuidance(profile, jobs, missingSkills, applications);
  setList("[data-guidance-list]", guidance);

  const recommendationRows = jobs.slice(0, 4).map((job) => {
    const role = `${job.title || job.role || "Role"} at ${job.company || "Company"}`;
    return `${role}: ${safeList(job.matchReasons, ["Strong overlap"]).slice(0, 1)[0]}`;
  });
  setList(
    "[data-recommendation-list]",
    recommendationRows.length ? recommendationRows : ["No recommendations yet. Complete intake to generate recommendations."]
  );

  const shortlistRows = jobs.slice(0, 4).map((job) => {
    const role = `${job.title || job.role || "Role"} at ${job.company || "Company"}`;
    const reason = safeList(job.whyNotMatch, ["No major blocker reported"]).slice(0, 1)[0];
    const change = safeList(job.suggestedImprovements, ["Tailor your resume before applying"]).slice(0, 1)[0];
    return `${role}: WHY NOT shortlisted -> ${reason}. Exact change -> ${change}.`;
  });
  setList(
    "[data-shortlist-reasons]",
    shortlistRows.length ? shortlistRows : ["No shortlist analysis yet. Add intake data first."]
  );

  const resultRows = applications.slice(0, 8).map((entry) => {
    const role = `${entry?.job?.title || entry?.job?.role || "Role"} at ${entry?.job?.company || "Company"}`;
    const confirmation = entry?.result?.application?.confirmationId || "Pending confirmation";
    const stage = entry?.result?.calendar?.start || entry?.job?.interviewDate ? "Interview stage possible" : "Applied";
    return `${role}: ${stage} (${confirmation})`;
  });
  setList(
    "[data-results-list]",
    resultRows.length ? resultRows : ["No applied jobs yet. Approve a role from Applications to start tracking results."]
  );
}

function setupCalendarPage() {
  const list = document.querySelector("[data-calendar-list]");
  if (!list) return;

  const applications = readJson(APPLICATIONS_KEY) || [];
  const intake = readJson(STORAGE_KEY);

  if (applications.length) {
    list.innerHTML = applications
      .map(({ job, result }) => {
        const slot = result?.calendar?.start || job.interviewDate || "";
        const link = result?.calendar?.link || buildCalendarLinkFromJob(job);
        return `
          <article class="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-2">
            <h3 class="text-lg font-bold text-slate-900">${escapeHtml(job.title || job.role || "Role")} at ${escapeHtml(
          job.company || "Company"
        )}</h3>
            <p class="text-sm text-slate-600">Source: ${escapeHtml(job.source || "Unknown")} | Match: ${escapeHtml(
          String(job.matchScore || job.match || "NA")
        )}%</p>
            <p class="text-sm text-slate-600">Interview/assessment slot: ${escapeHtml(formatDateTime(slot))}</p>
            <div class="flex gap-3 mt-2">
              <a class="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold" href="${escapeHtml(
                link
              )}" target="_blank" rel="noreferrer">Open in Google Calendar</a>
              <a class="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold" href="#" data-go-route="applications">Open Application</a>
            </div>
          </article>
        `;
      })
      .join("");
    return;
  }

  const upcoming = intake?.jobs?.slice(0, 5) || [];
  if (!upcoming.length) {
    list.innerHTML = `<p class="text-slate-600">No interview events yet. Approve a job from Applications to create one.</p>`;
    return;
  }

  list.innerHTML = upcoming
    .map(
      (job) => `
        <article class="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-2">
          <h3 class="text-lg font-bold text-slate-900">${escapeHtml(job.title || job.role || "Role")} at ${escapeHtml(
        job.company || "Company"
      )}</h3>
          <p class="text-sm text-slate-600">Suggested slot: ${escapeHtml(formatDateTime(job.interviewDate || ""))}</p>
          <a class="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold w-fit" href="#" data-go-route="applications">Approve to create event</a>
        </article>
      `
    )
    .join("");
}

function setupSettingsPage() {
  const form = document.querySelector("[data-settings-form]");
  if (!form) return;

  const status = document.querySelector("[data-settings-status]");
  const defaults = buildDefaultPreferences();
  const saved = readJson(SETTINGS_KEY) || {};

  const roles = document.querySelector("[data-setting-roles]");
  const locations = document.querySelector("[data-setting-locations]");
  const threshold = document.querySelector("[data-setting-threshold]");
  const minSalary = document.querySelector("[data-setting-min-salary]");
  const sources = document.querySelector("[data-setting-sources]");

  roles.value = toCsv(saved.roles || defaults.roles);
  locations.value = toCsv(saved.locations || defaults.locations);
  threshold.value = String(saved.threshold || defaults.threshold);
  minSalary.value = saved.minimumSalary || defaults.minimumSalary;
  sources.value = toCsv(saved.sources || normalizeSources());

  if (form.dataset.bound !== "true") {
    form.dataset.bound = "true";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const nextSettings = {
        roles: csvToList(roles.value),
        locations: csvToList(locations.value),
        threshold: clampNumber(threshold.value, 50, 99, 75),
        minimumSalary: minSalary.value.trim() || defaults.minimumSalary,
        sources: normalizeSources(csvToList(sources.value)),
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
      if (status) {
        status.textContent = "Preferences saved. New intake runs will use these values.";
      }
      showToast("Preferences saved", "Your next resume intake will use the updated preferences.");
    });
  }
}

function setupGlobalActions() {
  document.querySelectorAll("[data-new-application]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      navigateTo("intake");
    });
  });

  if (document.body.dataset.spaRouteBound !== "true") {
    document.body.dataset.spaRouteBound = "true";
    document.body.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-go-route]");
      if (!trigger) return;
      event.preventDefault();
      const route = trigger.dataset.goRoute;
      if (route) navigateTo(route);
    });
  }
}

function setupDashboardPage() {
  const grid = document.querySelector("[data-job-grid]");
  if (!grid) return;

  const intake = readJson(STORAGE_KEY);
  const searchInput = document.querySelector("[data-dashboard-search]");
  const updatePortfolioButton = document.querySelector("[data-update-portfolio]");
  let query = String(searchInput?.value || "").trim().toLowerCase();

  if (!intake?.jobs?.length) {
    setDashboardStatus("Upload a resume from the landing page to replace these sample cards with live jobs.");
    grid.innerHTML = renderEmptyJobsState();
    if (updatePortfolioButton && updatePortfolioButton.dataset.bound !== "true") {
      updatePortfolioButton.dataset.bound = "true";
      updatePortfolioButton.addEventListener("click", () => {
        navigateTo("resume");
      });
    }
    return;
  }

  const allJobs = intake.jobs;

  const rerender = () => {
    const savedIds = new Set((readJson(SAVED_JOBS_KEY) || []).map((job) => getJobId(job)));
    const filteredJobs = allJobs.filter((job) => {
      const roleText = `${job.title || job.role || ""} ${job.company || ""} ${job.location || ""}`.toLowerCase();
      const skillText = safeList(job.matchedSkills, []).join(" ").toLowerCase();
      const matchesQuery = !query || roleText.includes(query) || skillText.includes(query);
      return matchesQuery;
    });

    if (!filteredJobs.length) {
      setDashboardStatus("No jobs matched your current search. Clear search to see all matched jobs.");
      grid.innerHTML = renderNoFilterResultCard();
      return;
    }

    setDashboardStatus(`${filteredJobs.length} live jobs ready. Search is active.`);
    grid.innerHTML = filteredJobs.slice(0, 8).map((job) => renderJobCard(job, savedIds.has(getJobId(job)))).join("") + renderMarketCard(intake);
    grid.querySelectorAll("[data-select-job]").forEach((button) => {
      button.addEventListener("click", () => {
        const job = allJobs.find((candidate) => getJobId(candidate) === button.dataset.selectJob);
        localStorage.setItem(SELECTED_JOB_KEY, JSON.stringify(job));
        setupTailoringPage();
        navigateTo("applications");
      });
    });
    grid.querySelectorAll("[data-save-job]").forEach((button) => {
      button.addEventListener("click", () => {
        const job = allJobs.find((candidate) => getJobId(candidate) === button.dataset.saveJob);
        if (!job) return;
        const saved = readJson(SAVED_JOBS_KEY) || [];
        const exists = saved.some((item) => getJobId(item) === getJobId(job));
        const nextSaved = exists ? saved.filter((item) => getJobId(item) !== getJobId(job)) : [job, ...saved];
        localStorage.setItem(SAVED_JOBS_KEY, JSON.stringify(nextSaved.slice(0, 100)));
        showToast(exists ? "Removed from saved jobs" : "Saved job", `${job.title || job.role || "Role"} at ${job.company || "Company"}`);
        rerender();
      });
    });
  };

  if (searchInput && searchInput.dataset.bound !== "true") {
    searchInput.dataset.bound = "true";
    searchInput.addEventListener("input", (event) => {
      query = String(event.target.value || "").trim().toLowerCase();
      rerender();
    });
  }

  if (updatePortfolioButton && updatePortfolioButton.dataset.bound !== "true") {
    updatePortfolioButton.dataset.bound = "true";
    updatePortfolioButton.addEventListener("click", () => {
      navigateTo("resume");
    });
  }

  rerender();
}

async function setupTailoringPage() {
  const title = document.querySelector("[data-tailoring-title]");
  if (!title) return;

  bindTailoringSearch();
  bindManualEditButton();
  renderApplicationsQueue();

  const intake = readJson(STORAGE_KEY);
  const selectedJob = readJson(SELECTED_JOB_KEY) || intake?.jobs?.[0];
  const approveButton = document.querySelector("[data-approve-apply]");

  if (!intake?.profile || !selectedJob) {
    setTailoringStatus("Upload a resume and choose a matched job to generate a tailored application.");
    if (approveButton) {
      approveButton.onclick = () => {
        showToast("No selected job", "Pick a suited role from Suited Jobs first.");
        navigateTo("suited-jobs");
      };
    }
    return;
  }

  renderTailoringShell(intake.profile, selectedJob);
  setTailoringStatus("Generating tailored resume with backend...");

  try {
    const result = await postJson("/api/tailor-resume", {
      profile: intake.profile,
      job: selectedJob,
    });
    renderTailoredResume(result.tailoredResume, result.calendar);
    setTailoringStatus("Tailoring complete. You can edit manually or approve.");
  } catch (error) {
    setTailoringStatus(`Tailoring failed: ${error.message}`);
    showToast("Tailoring failed", error.message, "error");
  }

  if (!approveButton) return;
  approveButton.onclick = async () => {
    approveButton.disabled = true;
    approveButton.textContent = "APPLYING...";
    try {
      const tailoredResume = readCurrentTailoredResume();
      const result = await postJson("/api/apply", {
        profile: intake.profile,
        job: selectedJob,
        tailoredResume,
      });
      const applications = readJson(APPLICATIONS_KEY) || [];
      applications.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        job: selectedJob,
        result,
        stage: result?.calendar?.start ? "Interview stage possible" : "Applied",
        status: "queued",
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(applications));
      setTailoringStatus(`Application approved. Confirmation ${result.application.confirmationId}.`);
      approveButton.textContent = "APPLIED";
      showToast("Application queued", "Approved application is now visible in the queue below and in Interview Calendar.");
      setupInsightsPage();
      setupCalendarPage();
      renderApplicationsQueue();
    } catch (error) {
      approveButton.disabled = false;
      approveButton.textContent = "APPROVE & AI APPLY";
      setTailoringStatus(`Apply failed: ${error.message}`);
      showToast("Apply failed", error.message, "error");
    }
  };
}

function bindTailoringSearch() {
  const searchInput = document.querySelector("[data-tailoring-search]");
  if (!searchInput || searchInput.dataset.bound === "true") return;
  searchInput.dataset.bound = "true";
  const original = document.querySelector("[data-original-resume]");
  const tailored = document.querySelector("[data-tailored-resume]");
  const panels = [original, tailored].filter(Boolean);

  searchInput.addEventListener("input", (event) => {
    const query = String(event.target.value || "").trim().toLowerCase();
    if (!query) {
      panels.forEach((panel) => {
        panel.classList.remove("opacity-40");
      });
      return;
    }

    let hits = 0;
    panels.forEach((panel) => {
      const isMatch = panel.textContent.toLowerCase().includes(query);
      panel.classList.toggle("opacity-40", !isMatch);
      if (isMatch) hits += 1;
    });
    setTailoringStatus(`${hits} section(s) matched "${query}".`);
  });
}

function bindManualEditButton() {
  const button = document.querySelector("[data-edit-manual]");
  const target = document.querySelector("[data-tailored-resume]");
  if (!button || !target || button.dataset.bound === "true") return;
  button.dataset.bound = "true";

  button.addEventListener("click", () => {
    const currentlyEditable = target.getAttribute("contenteditable") === "true";
    target.setAttribute("contenteditable", currentlyEditable ? "false" : "true");
    target.classList.toggle("ring-2", !currentlyEditable);
    target.classList.toggle("ring-indigo-300", !currentlyEditable);
    button.textContent = currentlyEditable ? "Edit Manually" : "Stop Editing";
    setTailoringStatus(
      currentlyEditable
        ? "Manual edit mode disabled. You can approve and apply now."
        : "Manual edit mode enabled. Update text directly in the tailored resume panel."
    );
  });
}

function renderApplicationsQueue() {
  const list = document.querySelector("[data-application-queue-list]");
  const status = document.querySelector("[data-application-queue-status]");
  if (!list) return;

  const applications = readJson(APPLICATIONS_KEY) || [];
  if (status) {
    status.textContent = `${applications.length} queued/applied item${applications.length === 1 ? "" : "s"}`;
  }

  if (!applications.length) {
    list.innerHTML = `
      <article class="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
        No queued applications yet. Click <strong>Approve & AI Apply</strong> and it will appear here instantly.
      </article>
    `;
    return;
  }

  list.innerHTML = applications
    .slice(0, 10)
    .map((entry) => {
      const job = entry.job || {};
      const result = entry.result || {};
      const confirmation = result?.application?.confirmationId || "Pending";
      const stage = entry.stage || "Applied";
      const calendarLink = result?.calendar?.link || buildCalendarLinkFromJob(job);
      return `
        <article class="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
          <div class="flex items-center justify-between gap-3">
            <h4 class="font-semibold text-slate-900">${escapeHtml(job.title || job.role || "Role")} at ${escapeHtml(job.company || "Company")}</h4>
            <span class="text-xs font-semibold px-2 py-1 rounded-full bg-indigo-50 text-indigo-700">${escapeHtml(stage)}</span>
          </div>
          <p class="text-xs text-slate-600">Confirmation: ${escapeHtml(confirmation)} | Source: ${escapeHtml(job.source || "Unknown")}</p>
          <p class="text-xs text-slate-500">Queued on ${escapeHtml(formatDateTime(entry.createdAt || new Date().toISOString()))}</p>
          <div class="flex gap-2 pt-1">
            <a href="${escapeHtml(calendarLink)}" target="_blank" rel="noreferrer" class="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">Calendar</a>
            <a href="${escapeHtml(job.applyUrl || "#")}" target="_blank" rel="noreferrer" class="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">Job Post</a>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderJobCard(job, isSaved = false) {
  const score = Number(job.matchScore || job.match || 70);
  const offset = 213.6 - (score / 100) * 213.6;
  const reasons = safeList(job.matchReasons, ["Strong resume and role overlap"]);
  const friction = safeList(job.whyNotMatch, ["No major blocker detected"]);
  const improvements = safeList(job.suggestedImprovements, ["Tailor resume before approval"]);
  const id = getJobId(job);

  return `
    <article class="bg-surface-container-lowest rounded-full p-8 transition-all hover:translate-y-[-4px]">
      <div class="flex justify-between items-start mb-8">
        <div class="flex gap-4">
          <div class="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 overflow-hidden">
            <span class="font-headline font-black text-indigo-700">${escapeHtml((job.company || "A").charAt(0))}</span>
          </div>
          <div>
            <h3 class="text-xl font-bold font-headline text-on-surface">${escapeHtml(job.title || job.role || "Untitled role")}</h3>
            <p class="text-sm font-medium text-secondary">${escapeHtml(job.company || "Unknown company")} - ${escapeHtml(job.location || "Not specified")}</p>
            <div class="flex gap-2 mt-2 flex-wrap">
              <span class="text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">${escapeHtml(job.source || "Backend")}</span>
              <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded">${escapeHtml(formatPosted(job.postedAt))}</span>
            </div>
          </div>
        </div>
        <div class="relative w-20 h-20 flex items-center justify-center">
          <svg viewBox="0 0 80 80" preserveAspectRatio="xMidYMid meet" class="w-full h-full aspect-square -rotate-90">
            <circle class="text-surface-container-highest" cx="40" cy="40" fill="transparent" r="34" stroke="currentColor" stroke-width="6"></circle>
            <circle class="text-primary" cx="40" cy="40" fill="transparent" r="34" stroke="currentColor" stroke-dasharray="213.6" stroke-dashoffset="${offset}" stroke-width="6"></circle>
          </svg>
          <span class="absolute text-lg font-black font-headline text-primary">${score}%</span>
        </div>
      </div>
      <div class="space-y-6">
        <div class="bg-surface-container-low rounded-xl p-6">
          <div class="flex items-center gap-2 mb-4">
            <span class="material-symbols-outlined text-primary text-xl">auto_awesome</span>
            <h4 class="text-sm font-black font-headline uppercase tracking-widest text-on-surface">APPLYPILOT Analysis</h4>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p class="text-[11px] font-bold uppercase tracking-tighter text-indigo-700 mb-2">Core Alignment</p>
              <ul class="text-sm text-on-surface space-y-2">
                ${reasons.slice(0, 2).map((item) => `<li class="flex items-start gap-2"><span class="material-symbols-outlined text-sm mt-0.5 text-indigo-500">check_circle</span>${escapeHtml(item)}</li>`).join("")}
              </ul>
            </div>
            <div>
              <p class="text-[11px] font-bold uppercase tracking-tighter text-error mb-2">Potential Friction</p>
              <p class="text-sm text-on-surface">${escapeHtml(friction[0])}</p>
            </div>
          </div>
          <div class="mt-6 pt-6 border-t border-slate-200/50">
            <p class="text-[11px] font-bold uppercase tracking-tighter text-tertiary mb-3">Skill Gap Analysis & Recommendations</p>
            <div class="flex flex-wrap gap-2">
              ${improvements.slice(0, 3).map((item) => `<span class="bg-tertiary-fixed text-on-tertiary-fixed-variant text-xs font-semibold px-3 py-1 rounded-full">${escapeHtml(item)}</span>`).join("")}
            </div>
          </div>
        </div>
      </div>
      <div class="mt-8 flex gap-4">
        <button data-select-job="${escapeHtml(id)}" class="flex-1 py-3 bg-primary text-on-primary font-headline font-bold rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2">
          Review & Apply
          <span class="material-symbols-outlined text-sm">open_in_new</span>
        </button>
        <button data-save-job="${escapeHtml(id)}" class="px-4 py-3 bg-slate-50 ${isSaved ? "text-indigo-700" : "text-slate-500"} rounded-lg hover:text-indigo-700 transition-colors" title="${isSaved ? "Remove from saved jobs" : "Save job"}">
          <span class="material-symbols-outlined" style="${isSaved ? "font-variation-settings: 'FILL' 1;" : ""}">bookmark</span>
        </button>
      </div>
    </article>
  `;
}

function renderMarketCard(intake) {
  const skills = intake.profile?.skills?.slice(0, 3).join(", ") || "your uploaded resume";
  return `
    <article class="bg-gradient-to-br from-indigo-900 to-indigo-800 text-on-primary rounded-full p-10 flex flex-col justify-between relative overflow-hidden group">
      <div>
        <div class="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full mb-6">
          <span class="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></span>
          <span class="text-[10px] font-bold uppercase tracking-widest">Active Market Insight</span>
        </div>
        <h3 class="text-2xl font-black font-headline leading-tight mb-4">Your best matches are clustering around ${escapeHtml(skills)}.</h3>
        <p class="text-indigo-100 font-medium text-sm leading-relaxed mb-6">Approvals and skipped jobs will become learning signals so future recommendations improve over time.</p>
      </div>
      <button class="w-full py-4 bg-white text-indigo-900 font-headline font-black rounded-lg hover:bg-indigo-50 transition-colors">Adjust Strategy</button>
    </article>
  `;
}

function renderTailoringShell(profile, job) {
  document.querySelector("[data-tailoring-title]").innerHTML = `${escapeHtml(job.title || job.role || "Selected role")} <span class="text-primary">@ ${escapeHtml(job.company || "Company")}</span>`;
  const score = Number(job.matchScore || job.match || 70);
  const scoreText = document.querySelector("[data-tailoring-score]");
  if (scoreText) scoreText.innerHTML = `${score}<span class="text-[10px] font-bold">%</span>`;
  const original = document.querySelector("[data-original-resume]");
  if (original) {
    original.innerHTML = `
      <div class="border-b border-outline-variant/20 pb-4">
        <h3 class="text-lg font-bold font-headline mb-1">${escapeHtml(profile.fileName || "Uploaded resume")}</h3>
        <p class="text-sm">${escapeHtml(profile.headline || "Candidate profile")}</p>
      </div>
      <div class="space-y-4">
        <h4 class="text-xs font-bold uppercase tracking-wider text-secondary">Summary</h4>
        <p class="text-sm leading-relaxed">${escapeHtml(profile.summary || "Resume parsed by backend.")}</p>
      </div>
      <div class="space-y-4">
        <h4 class="text-xs font-bold uppercase tracking-wider text-secondary">Detected Skills</h4>
        <ul class="text-sm list-disc pl-4 space-y-2">
          ${safeList(profile.skills, ["Resume skills pending"]).slice(0, 8).map((skill) => `<li>${escapeHtml(skill)}</li>`).join("")}
        </ul>
      </div>
    `;
  }
}

function renderTailoredResume(tailoredResume, calendar) {
  const target = document.querySelector("[data-tailored-resume]");
  if (!target) return;
  target.innerHTML = `
    <div class="border-b border-primary/10 pb-4">
      <h3 class="text-lg font-bold font-headline text-on-surface mb-1">${escapeHtml(tailoredResume.headline)}</h3>
      <p class="text-sm text-on-surface-variant"><span class="bg-primary/10 text-primary px-1 rounded">AI Tailored Version</span></p>
    </div>
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h4 class="text-xs font-bold uppercase tracking-wider text-secondary">Executive Summary</h4>
        <span class="text-[10px] bg-tertiary-fixed text-on-tertiary-fixed-variant px-1.5 py-0.5 rounded font-bold">REWRITTEN</span>
      </div>
      <p class="text-sm leading-relaxed text-on-surface">${escapeHtml(tailoredResume.summary)}</p>
    </div>
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h4 class="text-xs font-bold uppercase tracking-wider text-secondary">Strategic Experience</h4>
        <span class="text-[10px] bg-tertiary-fixed text-on-tertiary-fixed-variant px-1.5 py-0.5 rounded font-bold">ENHANCED BULLETS</span>
      </div>
      <ul class="text-sm list-disc pl-4 space-y-3">
        ${(tailoredResume.bullets || []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
      </ul>
    </div>
    <div class="mt-8 bg-surface-container-low p-4 rounded-lg border-l-4 border-primary">
      <div class="flex gap-3">
        <span class="material-symbols-outlined text-primary text-lg">auto_awesome</span>
        <div>
          <p class="text-xs font-bold text-indigo-900 mb-1">APPLYPILOT Reasoning</p>
          <p class="text-[11px] text-on-surface-variant leading-normal">${escapeHtml(tailoredResume.changes?.join(" ") || "Backend generated a role-specific version for approval.")}</p>
          <p class="text-[11px] text-on-surface-variant leading-normal mt-2">${escapeHtml(calendar?.message || "")}</p>
        </div>
      </div>
    </div>
  `;
}

function renderEmptyJobsState() {
  return `
    <article class="bg-white rounded-xl border border-slate-200 p-8">
      <h3 class="text-2xl font-bold mb-2">No live jobs yet</h3>
      <p class="text-slate-600 mb-4">Upload your resume first so APPLYPILOT can fetch real jobs from backend sources.</p>
      <a href="#" data-go-route="intake" class="inline-flex px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold">Go to intake</a>
    </article>
  `;
}

function renderNoFilterResultCard() {
  return `
    <article class="bg-white rounded-xl border border-slate-200 p-8">
      <h3 class="text-2xl font-bold mb-2">No matches for current search</h3>
      <p class="text-slate-600">Clear the search box to see more jobs.</p>
    </article>
  `;
}

function readCurrentTailoredResume() {
  return {
    html: document.querySelector("[data-tailored-resume]")?.innerHTML || "",
  };
}

function buildDefaultPreferences() {
  const saved = readJson(SETTINGS_KEY) || {};
  return {
    roles: csvOrArray(saved.roles, ["Frontend Engineer", "Product Engineer", "Full Stack Developer"]),
    locations: csvOrArray(saved.locations, ["Bengaluru", "Hyderabad", "Remote"]),
    minimumSalary: saved.minimumSalary || "INR 18 LPA",
    threshold: clampNumber(saved.threshold, 50, 99, 75),
    experienceLevel: saved.experienceLevel || "Mid-senior",
    jobType: saved.jobType || "Full time",
    workMode: saved.workMode || "Remote or hybrid",
    noticePeriod: saved.noticePeriod || "Immediate to 30 days",
    focusSkills: csvOrArray(saved.focusSkills, ["React", "TypeScript", "APIs", "automation", "product engineering"]),
  };
}

function apiUrl(path) {
  const base = String(window.APPLYPILOT_API_BASE_URL || window.location.origin).replace(/\/$/, "");
  return `${base}${path}`;
}

async function requestIntakeWithFallback({ file, preferences, sources, limit }) {
  try {
    return await postForm("/api/intake", createIntakeFormData(file, preferences, sources, limit));
  } catch (intakeError) {
    const profileResult = await postForm("/api/analyze-resume", createAnalyzeFormData(file, preferences));
    const jobsResult = await postJson("/api/search-jobs", {
      profile: profileResult.profile,
      sources,
      limit,
    });
    return {
      profile: profileResult.profile,
      jobs: jobsResult.jobs || [],
      diagnostics: jobsResult.diagnostics || [],
      fallbackReason: intakeError.message,
    };
  }
}

function createIntakeFormData(file, preferences, sources, limit) {
  const formData = new FormData();
  formData.append("resume", file);
  formData.append("preferences", JSON.stringify(preferences));
  formData.append("sources", JSON.stringify(sources));
  formData.append("limit", String(limit || 24));
  return formData;
}

function createAnalyzeFormData(file, preferences) {
  const formData = new FormData();
  formData.append("resume", file);
  formData.append("preferences", JSON.stringify(preferences));
  return formData;
}

async function postForm(path, formData) {
  return requestWithFallback(path, { method: "POST", body: formData });
}

async function postJson(path, payload) {
  return requestWithFallback(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function requestWithFallback(path, init) {
  const candidates = getApiBaseCandidates();
  const errors = [];

  for (const base of candidates) {
    const url = `${base}${path}`;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(url, init);
        const data = await response.json().catch(() => ({}));
        if (response.ok) return data;

        const message = data.error || `Request failed with ${response.status}`;
        if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
          throw new Error(message);
        }
        errors.push(`${url} (attempt ${attempt}): ${message}`);
      } catch (error) {
        errors.push(`${url} (attempt ${attempt}): ${error.message}`);
      }
      if (attempt < 2) await wait(350);
    }
  }

  throw new Error("Could not reach backend services right now. Please try again in a moment.");
}

function getApiBaseCandidates() {
  const configured = String(window.APPLYPILOT_API_BASE_URL || "").replace(/\/$/, "");
  const current = String(window.location.origin || "").replace(/\/$/, "");
  const vercel = "https://applypilot-rose.vercel.app";
  const candidates = [configured, current, vercel].filter(Boolean);
  return Array.from(new Set(candidates));
}

function computeProfileStrength(profile, jobs, applications) {
  const skillScore = Math.min(35, safeList(profile.skills, []).length * 3);
  const summaryScore = Math.min(20, Math.floor(String(profile.summary || "").length / 10));
  const matchScore = jobs.length
    ? Math.min(
        30,
        Math.round(
          jobs
            .slice(0, 10)
            .reduce((sum, job) => sum + Number(job.matchScore || job.match || 0), 0) / Math.min(jobs.length, 10) / 3.4
        )
      )
    : 0;
  const activityScore = Math.min(15, applications.length * 3);
  return clampNumber(skillScore + summaryScore + matchScore + activityScore, 20, 99, 55);
}

function collectMissingSkills(jobs) {
  const tally = new Map();
  jobs.forEach((job) => {
    safeList(job.suggestedImprovements, []).forEach((item) => {
      const key = String(item || "").trim();
      if (!key) return;
      tally.set(key, (tally.get(key) || 0) + 1);
    });
  });
  return Array.from(tally.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label);
}

function collectTopCategories(jobs) {
  const tally = new Map();
  jobs.forEach((job) => {
    const title = String(job.title || job.role || "").toLowerCase();
    const category =
      title.includes("frontend")
        ? "Frontend Engineering"
        : title.includes("full stack")
        ? "Full Stack Engineering"
        : title.includes("product")
        ? "Product Engineering"
        : title.includes("backend")
        ? "Backend Engineering"
        : title.includes("data")
        ? "Data / Analytics"
        : title.includes("devops") || title.includes("platform") || title.includes("infra")
        ? "Platform / DevOps"
        : "General Software Engineering";
    tally.set(category, (tally.get(category) || 0) + 1);
  });
  return Array.from(tally.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label);
}

function buildGuidance(profile, jobs, missingSkills, applications) {
  const topJobs = jobs.filter((job) => Number(job.matchScore || job.match || 0) >= 80);
  const guidance = [];

  if (!topJobs.length && jobs.length) {
    guidance.push("You are targeting the wrong roles for your current profile strength. Shift to closer-fit roles first.");
  } else {
    guidance.push("Your strongest target roles are the ones with 80%+ match. Prioritize those first to improve shortlist rate.");
  }

  if (String(profile.summary || "").length < 120) {
    guidance.push("Your resume is too generic. Add quantified impact, ownership, and scale details in the summary.");
  } else {
    guidance.push("Your resume summary is strong, but it needs tighter role-specific wording for each application.");
  }

  if (missingSkills.length) {
    guidance.push(`Your projects are not aligned enough yet. Add proof for: ${missingSkills.slice(0, 2).join(", ")}.`);
    guidance.push(`Build ${missingSkills[0]} and ${missingSkills[1] || "a second project skill"} projects first, then apply.`);
  } else {
    guidance.push("Projects are mostly aligned. Keep tailoring bullets for each job before approval.");
  }

  guidance.push(
    applications.length
      ? "Track results by stage and keep approving similar roles that convert to interviews."
      : "Start with 3-5 approvals to generate enough behavior data for interaction-based learning."
  );

  return guidance;
}

function setText(selector, value) {
  const target = document.querySelector(selector);
  if (target) target.textContent = value;
}

function setList(selector, items) {
  const target = document.querySelector(selector);
  if (!target) return;
  target.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function setLandingStatus(message) {
  document.querySelectorAll("[data-upload-status]").forEach((target) => {
    target.textContent = message;
  });
}

function setDashboardStatus(message) {
  const target = document.querySelector("[data-dashboard-status]");
  if (target) target.textContent = message;
}

function setTailoringStatus(message) {
  const target = document.querySelector("[data-tailoring-status]");
  if (target) target.textContent = message;
}

function safeList(items, fallback) {
  return Array.isArray(items) && items.length ? items : fallback;
}

function getJobId(job) {
  return String(job.sourceJobId || job.applyUrl || `${job.company}-${job.title || job.role}`);
}

function formatPosted(value) {
  if (!value) return "Recent";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function buildCalendarLinkFromJob(job) {
  const start = new Date(job?.interviewDate || Date.now() + 5 * 24 * 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const format = (date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${job.company || "Company"} ${job.title || job.role || "Interview"} interview`,
    dates: `${format(start)}/${format(end)}`,
    details: `Prepared in APPLYPILOT after approval.`,
    location: job.location || "Online",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function showToast(title, message, type = "info") {
  const existing = document.querySelector("[data-global-toast]");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.dataset.globalToast = "true";
  toast.className = "max-w-sm rounded-xl px-4 py-3 shadow-xl text-sm";
  toast.style.position = "fixed";
  toast.style.bottom = "16px";
  toast.style.right = "16px";
  toast.style.zIndex = "1000";
  toast.style.background = type === "error" ? "#dc2626" : "#0f172a";
  toast.style.color = "#ffffff";
  toast.innerHTML = `<p class="font-semibold">${escapeHtml(title)}</p><p class="opacity-90">${escapeHtml(
    message
  )}</p>`;
  document.body.appendChild(toast);
  window.setTimeout(() => {
    toast.remove();
  }, 3500);
}

function csvOrArray(value, fallback) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") return csvToList(value);
  return fallback;
}

function csvToList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toCsv(value) {
  return Array.isArray(value) ? value.join(", ") : String(value || "");
}

function normalizeSources(list) {
  const fallback = ["Greenhouse", "Lever", "Ashby", "Remotive"];
  const items = Array.isArray(list) && list.length ? list : fallback;
  const allowed = new Set(["Greenhouse", "Lever", "Ashby", "SmartRecruiters", "USAJOBS", "Adzuna", "Remotive", "Firecrawl"]);
  const normalized = items.filter((source) => allowed.has(source));
  return normalized.length ? normalized : fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (Number.isNaN(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
