const STORAGE_KEY = "applypilot:intake";
const SELECTED_JOB_KEY = "applypilot:selected-job";
const APPLICATIONS_KEY = "applypilot:applications";

document.addEventListener("DOMContentLoaded", () => {
  setupLandingPage();
  setupDashboardPage();
  setupTailoringPage();
});

function setupLandingPage() {
  const uploadZone = document.querySelector("[data-upload-zone]");
  if (!uploadZone) return;

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
  const formData = new FormData();
  formData.append("resume", file);
  formData.append("preferences", JSON.stringify(buildDefaultPreferences()));
  formData.append("sources", JSON.stringify(["Greenhouse", "Lever", "Ashby", "Remotive"]));
  formData.append("limit", "24");

  try {
    const data = await postForm("/api/intake", formData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.removeItem(SELECTED_JOB_KEY);
    setLandingStatus(`${data.jobs?.length || 0} live matches found. Opening dashboard...`);
    window.location.href = "dashboard.html";
  } catch (error) {
    setLandingStatus(`Backend failed: ${error.message}`);
  }
}

function setupDashboardPage() {
  const grid = document.querySelector("[data-job-grid]");
  if (!grid) return;

  const intake = readJson(STORAGE_KEY);
  if (!intake?.jobs?.length) {
    setDashboardStatus("Upload a resume from the landing page to replace these sample cards with live jobs.");
    return;
  }

  setDashboardStatus(`${intake.jobs.length} live jobs ranked from backend sources.`);
  grid.innerHTML = intake.jobs.slice(0, 8).map((job) => renderJobCard(job)).join("") + renderMarketCard(intake);
  grid.querySelectorAll("[data-select-job]").forEach((button) => {
    button.addEventListener("click", () => {
      const job = intake.jobs.find((candidate) => getJobId(candidate) === button.dataset.selectJob);
      localStorage.setItem(SELECTED_JOB_KEY, JSON.stringify(job));
      window.location.href = "tailoring.html";
    });
  });
}

async function setupTailoringPage() {
  const title = document.querySelector("[data-tailoring-title]");
  if (!title) return;

  const intake = readJson(STORAGE_KEY);
  const selectedJob = readJson(SELECTED_JOB_KEY) || intake?.jobs?.[0];
  if (!intake?.profile || !selectedJob) {
    setTailoringStatus("Upload a resume and choose a match to generate a tailored application dossier.");
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
    setTailoringStatus("Backend tailoring complete. Ready for approval.");
  } catch (error) {
    setTailoringStatus(`Tailoring failed: ${error.message}`);
  }

  const approveButton = document.querySelector("[data-approve-apply]");
  approveButton?.addEventListener("click", async () => {
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
      applications.unshift({ job: selectedJob, result, createdAt: new Date().toISOString() });
      localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(applications));
      setTailoringStatus(`Application approved. Confirmation ${result.application.confirmationId}.`);
      approveButton.textContent = "APPROVED";
    } catch (error) {
      approveButton.disabled = false;
      approveButton.textContent = "APPROVE & AI APPLY";
      setTailoringStatus(`Apply failed: ${error.message}`);
    }
  });
}

function renderJobCard(job) {
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
          <svg class="w-full h-full -rotate-90">
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
            <h4 class="text-sm font-black font-headline uppercase tracking-widest text-on-surface">Architect AI Analysis</h4>
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
        <a href="${escapeHtml(job.applyUrl || "#")}" target="_blank" rel="noreferrer" class="px-4 py-3 bg-slate-50 text-slate-400 rounded-lg hover:text-error transition-colors">
          <span class="material-symbols-outlined">open_in_new</span>
        </a>
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
        ${tailoredResume.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
      </ul>
    </div>
    <div class="mt-8 bg-surface-container-low p-4 rounded-lg border-l-4 border-primary">
      <div class="flex gap-3">
        <span class="material-symbols-outlined text-primary text-lg">auto_awesome</span>
        <div>
          <p class="text-xs font-bold text-indigo-900 mb-1">Architect AI Reasoning</p>
          <p class="text-[11px] text-on-surface-variant leading-normal">${escapeHtml(tailoredResume.changes?.join(" ") || "Backend generated a role-specific version for approval.")}</p>
          <p class="text-[11px] text-on-surface-variant leading-normal mt-2">${escapeHtml(calendar?.message || "")}</p>
        </div>
      </div>
    </div>
  `;
}

function readCurrentTailoredResume() {
  return {
    html: document.querySelector("[data-tailored-resume]")?.innerHTML || "",
  };
}

function buildDefaultPreferences() {
  return {
    roles: ["Frontend Engineer", "Product Engineer", "Full Stack Developer"],
    locations: ["Bengaluru", "Hyderabad", "Remote"],
    minimumSalary: "INR 18 LPA",
    threshold: 75,
    experienceLevel: "Mid-senior",
    jobType: "Full time",
    workMode: "Remote or hybrid",
    noticePeriod: "Immediate to 30 days",
    focusSkills: ["React", "TypeScript", "APIs", "automation", "product engineering"],
  };
}

function apiUrl(path) {
  const base = String(window.APPLYPILOT_API_BASE_URL || window.location.origin).replace(/\/$/, "");
  return `${base}${path}`;
}

async function postForm(path, formData) {
  const response = await fetch(apiUrl(path), { method: "POST", body: formData });
  return parseResponse(response);
}

async function postJson(path, payload) {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseResponse(response);
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed with ${response.status}`);
  return data;
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function setLandingStatus(message) {
  const target = document.querySelector("[data-upload-status]");
  if (target) target.textContent = message;
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
