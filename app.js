const state = {
  resumeFile: null,
  resumeProfile: null,
  matches: [],
  approvedApplications: [],
  selectedJob: null,
  selectedSources: ["Greenhouse", "Lever", "Ashby", "SmartRecruiters", "Firecrawl"],
};

const adapterPlan = [
  {
    priority: 1,
    name: "Greenhouse",
    endpoint: "boards-api.greenhouse.io",
    auth: "Public GET",
    role: "Clean company ATS feed",
  },
  {
    priority: 2,
    name: "Lever",
    endpoint: "api.lever.co",
    auth: "Public GET",
    role: "Fast public postings",
  },
  {
    priority: 3,
    name: "Ashby",
    endpoint: "api.ashbyhq.com",
    auth: "Public posting API",
    role: "Strong metadata and compensation",
  },
  {
    priority: 4,
    name: "SmartRecruiters",
    endpoint: "api.smartrecruiters.com",
    auth: "Public search API",
    role: "Broad indexed job search",
  },
  {
    priority: 5,
    name: "USAJOBS",
    endpoint: "data.usajobs.gov",
    auth: "API key",
    role: "Government jobs",
  },
  {
    priority: 6,
    name: "Adzuna",
    endpoint: "api.adzuna.com",
    auth: "app_id + app_key",
    role: "Aggregator coverage",
  },
  {
    priority: 7,
    name: "Remotive",
    endpoint: "public jobs API",
    auth: "Public",
    role: "Remote-only layer",
  },
  {
    priority: 8,
    name: "Firecrawl",
    endpoint: "api.firecrawl.dev",
    auth: "Backend secret",
    role: "Company careers fallback",
  },
  {
    priority: 9,
    name: "Bright Data",
    endpoint: "web scraper API",
    auth: "Backend secret",
    role: "Blocked or JS-heavy pages",
  },
  {
    priority: 10,
    name: "Apify",
    endpoint: "actor runs",
    auth: "Backend token",
    role: "Community job scrapers",
  },
];

const calendarEvents = [
  {
    title: "Cloud systems interview",
    start: new Date("2026-04-22T10:30:00+05:30"),
    end: new Date("2026-04-22T11:30:00+05:30"),
  },
  {
    title: "Product review",
    start: new Date("2026-04-24T15:00:00+05:30"),
    end: new Date("2026-04-24T16:00:00+05:30"),
  },
];

const jobCatalog = [
  {
    id: "job-linkedin-atlas",
    source: "Greenhouse",
    company: "AtlasForge Systems",
    role: "Senior Frontend Engineer",
    location: "Bengaluru, Hybrid",
    salary: "INR 28-36 LPA",
    type: "Full time",
    posted: "2 hours ago",
    skills: ["React", "TypeScript", "Tailwind CSS", "Accessibility", "Node.js"],
    gaps: ["GraphQL federation"],
    interviewDate: "2026-04-22T09:00:00+05:30",
    assessmentDate: "2026-04-21T18:00:00+05:30",
    applyUrl: "https://www.linkedin.com/jobs/",
    companyUrl: "https://www.linkedin.com/company/",
    friction: "Greenhouse board application path after approval",
  },
  {
    id: "job-naukri-sentient",
    source: "Lever",
    company: "SentientOps Labs",
    role: "Product Engineer",
    location: "Hyderabad, Remote",
    salary: "INR 22-30 LPA",
    type: "Full time",
    posted: "Today",
    skills: ["React", "Node.js", "Python", "APIs", "PostgreSQL"],
    gaps: ["Kubernetes"],
    interviewDate: "2026-04-24T15:30:00+05:30",
    assessmentDate: "2026-04-23T19:30:00+05:30",
    applyUrl: "https://www.naukri.com/",
    companyUrl: "https://www.naukri.com/",
    friction: "Lever posting form with profile confirmation",
  },
  {
    id: "job-indeed-river",
    source: "Ashby",
    company: "Riverstone Digital",
    role: "Full Stack Developer",
    location: "Remote India",
    salary: "INR 20-27 LPA",
    type: "Full time",
    posted: "1 day ago",
    skills: ["JavaScript", "React", "Node.js", "MongoDB", "REST APIs"],
    gaps: ["AWS Lambda"],
    interviewDate: "2026-04-25T11:00:00+05:30",
    assessmentDate: "2026-04-23T10:00:00+05:30",
    applyUrl: "https://www.indeed.com/",
    companyUrl: "https://www.indeed.com/",
    friction: "Ashby job board application and screening questions",
  },
  {
    id: "job-company-linearcore",
    source: "SmartRecruiters",
    company: "LinearCore",
    role: "Frontend Platform Engineer",
    location: "Bengaluru, Remote friendly",
    salary: "INR 32-42 LPA",
    type: "Full time",
    posted: "4 hours ago",
    skills: ["React", "TypeScript", "Design Systems", "Performance", "Testing"],
    gaps: ["Web components"],
    interviewDate: "2026-04-27T14:30:00+05:30",
    assessmentDate: "2026-04-26T17:00:00+05:30",
    applyUrl: "https://boards.greenhouse.io/",
    companyUrl: "https://www.greenhouse.com/",
    friction: "SmartRecruiters public job flow with custom questions",
  },
  {
    id: "job-company-veridian",
    source: "Firecrawl",
    company: "Veridian Careers",
    role: "Application Automation Engineer",
    location: "Pune, Hybrid",
    salary: "INR 24-33 LPA",
    type: "Full time",
    posted: "3 days ago",
    skills: ["Python", "Playwright", "APIs", "Node.js", "Queues"],
    gaps: ["OAuth app review"],
    interviewDate: "2026-04-29T12:00:00+05:30",
    assessmentDate: "2026-04-28T18:30:00+05:30",
    applyUrl: "https://lever.co/",
    companyUrl: "https://www.lever.co/",
    friction: "Company careers page discovered through Firecrawl fallback",
  },
];

const connectors = {
  async analyzeResume(file, text, preferences) {
    await wait(650);
    return buildProfile(file, text, preferences);
  },
  async searchJobs(profile, sources) {
    await wait(650);
    return scoreJobs(profile, sources);
  },
  async tailorResume(profile, job) {
    await wait(300);
    return buildTailoredResume(profile, job);
  },
  async checkCalendar(job) {
    await wait(220);
    return checkAvailability(job);
  },
  async createCalendarEvent(job) {
    await wait(220);
    return {
      provider: "Google Calendar",
      eventId: `gcal-${job.id}`,
      link: buildCalendarUrl(job),
    };
  },
  async applyToJob(job) {
    await wait(420);
    return {
      provider: job.source,
      confirmationId: `APP-${job.source.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`,
      submittedAt: new Date(),
    };
  },
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  hydrateElements();
  bindEvents();
  renderTimeline();
  renderAdapterPlan();
  navigateToPage("intake");
});

function hydrateElements() {
  [
    "resumeForm",
    "resumeFile",
    "resumeFileLabel",
    "dropZone",
    "analysisTimeline",
    "profileSummary",
    "jobList",
    "sourceMeter",
    "approvalDialog",
    "approvalContent",
    "activityList",
    "adapterGrid",
    "queueList",
    "queueBadge",
    "calendarBadge",
    "connectorStatus",
    "resetDemo",
    "targetRoles",
    "targetLocations",
    "minimumSalary",
    "approvalThreshold",
    "experienceLevel",
    "jobType",
    "workMode",
    "noticePeriod",
    "focusSkills",
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });
}

function bindEvents() {
  elements.resumeFile.addEventListener("change", (event) => {
    setResumeFile(event.target.files[0]);
  });

  elements.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("is-dragging");
  });

  elements.dropZone.addEventListener("dragleave", () => {
    elements.dropZone.classList.remove("is-dragging");
  });

  elements.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-dragging");
    const [file] = event.dataTransfer.files;
    setResumeFile(file);
  });

  elements.resumeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await runAutopilotSearch();
  });

  elements.resetDemo.addEventListener("click", () => {
    resetState();
  });

  document.querySelectorAll("[data-page-target]").forEach((button) => {
    button.addEventListener("click", () => {
      navigateToPage(button.dataset.pageTarget);
    });
  });
}

function setResumeFile(file) {
  if (!file) {
    return;
  }
  state.resumeFile = file;
  elements.resumeFileLabel.textContent = file.name;
  elements.connectorStatus.textContent = "Resume ready for analysis";
}

async function runAutopilotSearch() {
  if (!state.resumeFile) {
    showToast("Resume required", "Upload a resume before analysis starts.");
    return;
  }

  state.selectedSources = Array.from(document.querySelectorAll("input[name='source']:checked")).map(
    (input) => input.value
  );

  if (!state.selectedSources.length) {
    showToast("Choose at least one source", "Select LinkedIn, Naukri, Indeed, or company sites.");
    return;
  }

  navigateToPage("intake");
  elements.connectorStatus.textContent = "Analyzing resume and searching sources";
  renderTimeline("read");
  elements.profileSummary.innerHTML = `<p class="empty-note">Reading ${escapeHtml(
    state.resumeFile.name
  )} and extracting candidate signals.</p>`;

  const resumeText = await readResumeText(state.resumeFile);
  await wait(250);
  renderTimeline("analyze");

  const preferences = {
    roles: splitInput(elements.targetRoles.value),
    locations: splitInput(elements.targetLocations.value),
    minimumSalary: elements.minimumSalary.value.trim(),
    threshold: Number(elements.approvalThreshold.value || 85),
    experienceLevel: elements.experienceLevel.value,
    jobType: elements.jobType.value,
    workMode: elements.workMode.value,
    noticePeriod: elements.noticePeriod.value.trim(),
    focusSkills: splitInput(elements.focusSkills.value),
  };

  state.resumeProfile = await connectors.analyzeResume(state.resumeFile, resumeText, preferences);
  renderProfile(state.resumeProfile);

  renderTimeline("search");
  state.matches = await connectors.searchJobs(state.resumeProfile, state.selectedSources);

  renderTimeline("rank");
  await wait(250);
  renderTimeline("done");
  renderJobs();
  renderApprovalQueue();
  navigateToPage("jobs");
  elements.connectorStatus.textContent = `${state.matches.length} matches ready for approval`;
}

function renderTimeline(activeStage) {
  const steps = [
    {
      id: "read",
      title: "Resume received",
      body: "The app reads text resumes directly and queues PDF or DOCX bytes for the analysis connector.",
    },
    {
      id: "analyze",
      title: "Resume analyzed",
      body: "Skills, years, seniority, target roles, and likely strengths are extracted from the resume.",
    },
    {
      id: "search",
      title: "Job sources searched",
      body: "Greenhouse, Lever, Ashby, SmartRecruiters, and company fallback adapters are queried through source connectors.",
    },
    {
      id: "rank",
      title: "Matches ranked",
      body: "Jobs are ranked by skills, location, salary, application friction, and approval threshold.",
    },
    {
      id: "done",
      title: "Approval queue ready",
      body: "Each job waits for user approval before calendar booking and application submission.",
    },
  ];

  const activeIndex = steps.findIndex((step) => step.id === activeStage);

  elements.analysisTimeline.innerHTML = steps
    .map((step, index) => {
      const statusClass =
        activeStage === undefined
          ? ""
          : index < activeIndex
          ? "is-complete"
          : index === activeIndex
          ? "is-running"
          : "";
      return `
        <div class="timeline-item ${statusClass}">
          <span class="timeline-dot"></span>
          <div>
            <strong>${step.title}</strong>
            <p>${step.body}</p>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderProfile(profile) {
  elements.profileSummary.innerHTML = `
    <article class="profile-card">
      <h3>${escapeHtml(profile.headline)}</h3>
      <p>${escapeHtml(profile.summary)}</p>
      <div class="tag-row">
        ${profile.skills.map((skill) => `<span class="tag">${escapeHtml(skill)}</span>`).join("")}
      </div>
    </article>
    <article class="profile-card">
      <h3>Search preferences</h3>
      <p>Roles: ${escapeHtml(profile.preferences.roles.join(", "))}</p>
      <p>Locations: ${escapeHtml(profile.preferences.locations.join(", "))}</p>
      <p>Minimum salary: ${escapeHtml(profile.preferences.minimumSalary)}</p>
      <p>Experience level: ${escapeHtml(profile.preferences.experienceLevel)}</p>
      <p>Job type: ${escapeHtml(profile.preferences.jobType)}</p>
      <p>Work mode: ${escapeHtml(profile.preferences.workMode)}</p>
      <p>Notice period: ${escapeHtml(profile.preferences.noticePeriod)}</p>
      <p>Approval threshold: ${profile.preferences.threshold}%</p>
    </article>
  `;
}

function renderJobs() {
  if (!state.matches.length) {
    elements.jobList.innerHTML = `<p class="empty-note">No jobs matched the selected sources. Add more sources or lower the threshold.</p>`;
    return;
  }

  elements.sourceMeter.textContent = `${state.selectedSources.join(", ")} searched`;

  elements.jobList.innerHTML = state.matches
    .map(
      (job) => {
        const applied = isJobApplied(job.id);
        return `
      <article class="job-card">
        <div>
          <div class="job-title-row">
            <h3>${escapeHtml(job.role)}</h3>
            <span class="tag neutral">${escapeHtml(job.source)}</span>
            <span class="tag">${job.match}% match</span>
            ${applied ? `<span class="tag">Applied</span>` : `<span class="tag warning">Needs approval</span>`}
          </div>
          <p class="job-meta">${escapeHtml(job.company)} - ${escapeHtml(job.location)} - ${escapeHtml(
        job.salary
      )}</p>
          <p class="job-details">${escapeHtml(job.friction)}. Matching skills: ${job.matchedSkills
        .map(escapeHtml)
        .join(", ")}.</p>
          <div class="tag-row">
            ${job.skills.slice(0, 5).map((skill) => `<span class="tag neutral">${escapeHtml(skill)}</span>`).join("")}
          </div>
        </div>
        <div class="job-card-actions">
          <div>
            <div class="score">${job.match}%</div>
            <small>Resume fit</small>
          </div>
          ${
            applied
              ? `<button class="button secondary" type="button" disabled>Already applied</button>`
              : `<button class="button primary" type="button" data-review-job="${job.id}">Review and approve</button>`
          }
        </div>
      </article>
    `;
      }
    )
    .join("");

  document.querySelectorAll("[data-review-job]").forEach((button) => {
    button.addEventListener("click", async () => {
      const job = state.matches.find((candidate) => candidate.id === button.dataset.reviewJob);
      await openApproval(job);
    });
  });
}

function renderAdapterPlan() {
  elements.adapterGrid.innerHTML = adapterPlan
    .map(
      (adapter) => `
        <article class="adapter-card">
          <header>
            <h3>${escapeHtml(adapter.name)}</h3>
            <span class="adapter-rank">P${adapter.priority}</span>
          </header>
          <p><strong>Endpoint:</strong> ${escapeHtml(adapter.endpoint)}</p>
          <p><strong>Auth:</strong> ${escapeHtml(adapter.auth)}</p>
          <p>${escapeHtml(adapter.role)}</p>
        </article>
      `
    )
    .join("");
}

async function openApproval(job) {
  state.selectedJob = job;
  navigateToPage("queue");
  elements.approvalContent.innerHTML = `<div class="approval-main"><p class="empty-note">Preparing tailored resume and calendar check.</p></div>`;
  elements.approvalDialog.showModal();

  const [tailoredResume, calendar] = await Promise.all([
    connectors.tailorResume(state.resumeProfile, job),
    connectors.checkCalendar(job),
  ]);

  renderApproval(job, tailoredResume, calendar);
}

function renderApproval(job, tailoredResume, calendar) {
  const interviewDate = new Date(job.interviewDate);
  const assessmentDate = new Date(job.assessmentDate);
  const conflictClass = calendar.available ? "" : "is-conflict";

  elements.approvalContent.innerHTML = `
    <div class="approval-content">
      <section class="approval-main">
        <p class="eyebrow">Step 03</p>
        <h2>${escapeHtml(job.role)} at ${escapeHtml(job.company)}</h2>
        <p>${escapeHtml(job.location)} - ${escapeHtml(job.salary)} - ${escapeHtml(job.source)}</p>

        <h3>Why this job matches</h3>
        <div class="tag-row">
          ${job.matchedSkills.map((skill) => `<span class="tag">${escapeHtml(skill)}</span>`).join("")}
          ${job.gaps.map((gap) => `<span class="tag warning">Gap: ${escapeHtml(gap)}</span>`).join("")}
        </div>

        <h3>Tailored resume before applying</h3>
        <div class="resume-preview">
          <p><strong>${escapeHtml(tailoredResume.headline)}</strong></p>
          <p>${escapeHtml(tailoredResume.summary)}</p>
          <ul>
            ${tailoredResume.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
          </ul>
        </div>
      </section>

      <aside class="approval-side">
        <p class="eyebrow">Step 04</p>
        <div class="calendar-check ${conflictClass}">
          <h3>Availability check</h3>
          <p><strong>Assessment:</strong> ${formatDateTime(assessmentDate)}</p>
          <p><strong>Interview or exam slot:</strong> ${formatDateTime(interviewDate)}</p>
          <p>${escapeHtml(calendar.message)}</p>
          ${
            calendar.conflicts.length
              ? `<ul>${calendar.conflicts
                  .map((item) => `<li>Conflict: ${escapeHtml(item.title)} at ${formatDateTime(item.start)}</li>`)
                  .join("")}</ul>`
              : ""
          }
        </div>

        <h3>Approval action</h3>
        <p>
          Approval will create a Google Calendar event, attach the tailored resume, and submit
          the application through the ${escapeHtml(job.source)} connector.
        </p>

        <label class="approval-consent">
          <input id="approvalConsent" type="checkbox" />
          <span>
            I approve this tailored resume and confirm the listed assessment or interview date can be booked.
          </span>
        </label>

        <button class="button primary wide" type="button" id="confirmApplyButton" disabled>
          Approve, schedule, and apply
        </button>
        <a class="button secondary wide" href="${escapeHtml(buildCalendarUrl(job))}" target="_blank" rel="noreferrer">
          Preview Google Calendar event
        </a>
      </aside>
    </div>
  `;

  const consent = document.getElementById("approvalConsent");
  const confirmButton = document.getElementById("confirmApplyButton");
  consent.addEventListener("change", () => {
    confirmButton.disabled = !consent.checked;
  });
  confirmButton.addEventListener("click", async () => {
    await approveAndApply(job);
  });
}

async function approveAndApply(job) {
  const confirmButton = document.getElementById("confirmApplyButton");
  confirmButton.disabled = true;
  confirmButton.textContent = "Scheduling and applying...";

  const [calendarResult, applicationResult] = await Promise.all([
    connectors.createCalendarEvent(job),
    connectors.applyToJob(job),
  ]);

  const application = {
    job,
    calendar: calendarResult,
    application: applicationResult,
  };
  state.approvedApplications.unshift(application);
  renderJobs();
  renderApprovalQueue();
  renderActivity();
  elements.approvalDialog.close();
  navigateToPage("queue");
  elements.connectorStatus.textContent = "Application submitted after approval";
  showToast(
    "Application submitted",
    `${job.company} received the tailored application. Calendar event ${calendarResult.eventId} is ready.`
  );
}

function renderApprovalQueue() {
  const pendingJobs = state.matches.filter((job) => !isJobApplied(job.id));
  elements.queueBadge.textContent = `${pendingJobs.length} waiting for approval`;

  if (!state.matches.length) {
    elements.queueList.innerHTML = `<p class="empty-note">Analyze a resume to build the approval queue.</p>`;
    return;
  }

  if (!pendingJobs.length) {
    elements.queueList.innerHTML = `<p class="empty-note">Every matched job has been approved or submitted.</p>`;
    return;
  }

  elements.queueList.innerHTML = pendingJobs
    .map((job) => {
      const interviewDate = new Date(job.interviewDate);
      return `
        <article class="queue-card">
          <div>
            <div class="job-title-row">
              <h3>${escapeHtml(job.role)}</h3>
              <span class="tag">${job.match}% match</span>
              <span class="tag neutral">${escapeHtml(job.source)}</span>
            </div>
            <p>${escapeHtml(job.company)} - ${escapeHtml(job.location)} - ${escapeHtml(job.salary)}</p>
            <p>Suggested interview or exam slot: ${formatDateTime(interviewDate)}.</p>
            <div class="tag-row">
              ${job.matchedSkills.map((skill) => `<span class="tag">${escapeHtml(skill)}</span>`).join("")}
              ${job.gaps.map((gap) => `<span class="tag warning">Gap: ${escapeHtml(gap)}</span>`).join("")}
            </div>
          </div>
          <div class="queue-actions">
            <button class="button primary" type="button" data-review-job="${job.id}">
              Review approval
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  elements.queueList.querySelectorAll("[data-review-job]").forEach((button) => {
    button.addEventListener("click", async () => {
      const job = state.matches.find((candidate) => candidate.id === button.dataset.reviewJob);
      await openApproval(job);
    });
  });
}

function renderActivity() {
  if (!state.approvedApplications.length) {
    elements.activityList.innerHTML = `<p class="empty-note">No approved applications yet.</p>`;
    return;
  }

  elements.activityList.innerHTML = state.approvedApplications
    .map(({ job, calendar, application }) => {
      const interviewDate = new Date(job.interviewDate);
      return `
        <article class="activity-card">
          <div>
            <h3>${escapeHtml(job.role)} at ${escapeHtml(job.company)}</h3>
            <p>Submitted through ${escapeHtml(application.provider)} with confirmation ${escapeHtml(
        application.confirmationId
      )}.</p>
            <p>Google Calendar event: ${escapeHtml(calendar.eventId)} for ${formatDateTime(interviewDate)}.</p>
          </div>
          <a class="button secondary" href="${escapeHtml(calendar.link)}" target="_blank" rel="noreferrer">
            Open event
          </a>
        </article>
      `;
    })
    .join("");
}

function buildProfile(file, text, preferences) {
  const knownSkills = [
    "React",
    "TypeScript",
    "JavaScript",
    "Tailwind CSS",
    "Node.js",
    "Python",
    "PostgreSQL",
    "MongoDB",
    "REST APIs",
    "APIs",
    "Testing",
    "Accessibility",
    "Performance",
    "Design Systems",
    "Playwright",
  ];

  const normalized = `${file.name} ${text}`.toLowerCase();
  const detectedSkills = knownSkills.filter((skill) => normalized.includes(skill.toLowerCase()));
  const intakeSkills = preferences.focusSkills.filter(Boolean);
  const skills = uniqueList(
    detectedSkills.length
      ? [...detectedSkills, ...intakeSkills]
      : ["React", "TypeScript", "Node.js", "REST APIs", "Tailwind CSS", "Testing", ...intakeSkills]
  );

  const yearsMatch = normalized.match(/(\d+)\+?\s*(years|yrs)/);
  const years = yearsMatch ? Number(yearsMatch[1]) : Math.max(3, Math.min(8, skills.length));
  const seniority = years >= 6 ? "Senior" : years >= 3 ? "Mid-level" : "Early-career";

  return {
    fileName: file.name,
    headline: `${seniority} software candidate with ${years}+ years of relevant experience`,
    summary: `Seeking ${preferences.jobType.toLowerCase()} ${preferences.roles.join(
      " or "
    )} roles with ${preferences.workMode.toLowerCase()} flexibility, ${preferences.minimumSalary} minimum compensation, and ${preferences.noticePeriod.toLowerCase()} availability.`,
    skills,
    years,
    preferences,
  };
}

function scoreJobs(profile, selectedSources) {
  const threshold = profile.preferences.threshold;
  return jobCatalog
    .filter((job) => selectedSources.includes(job.source))
    .map((job) => {
      const matchedSkills = job.skills.filter((skill) =>
        profile.skills.some((candidateSkill) => candidateSkill.toLowerCase() === skill.toLowerCase())
      );
      const roleBoost = profile.preferences.roles.some((role) =>
        job.role.toLowerCase().includes(role.toLowerCase().split(" ")[0])
      )
        ? 7
        : 0;
      const locationBoost = profile.preferences.locations.some((location) =>
        job.location.toLowerCase().includes(location.toLowerCase().split(" ")[0])
      )
        ? 5
        : 0;
      const typeBoost = job.type.toLowerCase() === profile.preferences.jobType.toLowerCase() ? 4 : 0;
      const modePreference = profile.preferences.workMode.toLowerCase();
      const modeBoost =
        modePreference.includes("remote") && job.location.toLowerCase().includes("remote")
          ? 5
          : modePreference.includes("hybrid") && job.location.toLowerCase().includes("hybrid")
          ? 4
          : 0;
      const baseScore = 68 + matchedSkills.length * 5 + roleBoost + locationBoost + typeBoost + modeBoost;
      const match = Math.min(98, Math.max(62, baseScore));
      return {
        ...job,
        matchedSkills,
        match,
      };
    })
    .filter((job) => job.match >= threshold - 6)
    .sort((a, b) => b.match - a.match);
}

function buildTailoredResume(profile, job) {
  const leadSkill = job.matchedSkills[0] || job.skills[0];
  const secondSkill = job.matchedSkills[1] || job.skills[1];
  return {
    headline: `${profile.headline} - tailored for ${job.role}`,
    summary: `Positioning ${profile.fileName} around ${job.company}'s need for ${leadSkill}, ${secondSkill}, and production-ready delivery.`,
    bullets: [
      `Led ${leadSkill} work aligned to ${job.role} responsibilities and measurable product outcomes.`,
      `Built maintainable interfaces using ${secondSkill} with clear API contracts and testing coverage.`,
      `Prepared application answers for ${job.source} using the candidate's uploaded resume and target role preferences.`,
      `Flagged ${job.gaps[0]} as a growth area while emphasizing directly matched skills.`,
    ],
  };
}

function checkAvailability(job) {
  const start = new Date(job.interviewDate);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const conflicts = calendarEvents.filter((event) => start < event.end && end > event.start);
  return {
    available: conflicts.length === 0,
    conflicts,
    message: conflicts.length
      ? "A calendar conflict was found. Approve only if you want the app to proceed with this slot."
      : "Calendar is free for this slot. Approval can schedule the event and submit the application.",
  };
}

function buildCalendarUrl(job) {
  const start = new Date(job.interviewDate);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const format = (date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${job.company} ${job.role} interview or exam`,
    dates: `${format(start)}/${format(end)}`,
    details: `Application submitted by ApplyPilot after user approval. Source: ${job.source}.`,
    location: job.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

async function readResumeText(file) {
  if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
    return file.text();
  }
  return `${file.name} uploaded. Production parser should extract PDF or DOCX text on the backend.`;
}

function splitInput(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function navigateToPage(pageName) {
  document.querySelectorAll("[data-page]").forEach((page) => {
    page.classList.toggle("is-active", page.dataset.page === pageName);
  });

  document.querySelectorAll("[data-page-target]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.pageTarget === pageName);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetState() {
  state.resumeFile = null;
  state.resumeProfile = null;
  state.matches = [];
  state.approvedApplications = [];
  state.selectedJob = null;
  elements.resumeForm.reset();
  elements.targetRoles.value = "Frontend Engineer, Product Engineer, Full Stack Developer";
  elements.targetLocations.value = "Bengaluru, Hyderabad, Remote";
  elements.minimumSalary.value = "INR 18 LPA";
  elements.approvalThreshold.value = "85";
  elements.experienceLevel.value = "Mid-senior";
  elements.jobType.value = "Full time";
  elements.workMode.value = "Remote or hybrid";
  elements.noticePeriod.value = "Immediate to 30 days";
  elements.focusSkills.value = "React, TypeScript, APIs, automation, product engineering";
  elements.resumeFileLabel.textContent = "Drop resume here or browse";
  elements.profileSummary.innerHTML = `<p class="empty-note">Upload a resume to generate the candidate profile.</p>`;
  elements.jobList.innerHTML = `<p class="empty-note">Resume analysis will populate matching roles here.</p>`;
  elements.queueList.innerHTML = `<p class="empty-note">Analyze a resume to build the approval queue.</p>`;
  elements.activityList.innerHTML = `<p class="empty-note">No approved applications yet.</p>`;
  elements.queueBadge.textContent = "No queue yet";
  elements.sourceMeter.textContent = "No sources searched yet";
  elements.connectorStatus.textContent = "Automation connectors ready for backend keys";
  renderTimeline();
  navigateToPage("intake");
  showToast("Demo reset", "Upload a resume to start again.");
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(title, body) {
  const existing = document.querySelector(".toast");
  if (existing) {
    existing.remove();
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p>`;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function isJobApplied(jobId) {
  return state.approvedApplications.some(({ job }) => job.id === jobId);
}

function uniqueList(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
