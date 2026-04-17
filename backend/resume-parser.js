const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");

const KNOWN_SKILLS = [
  "React",
  "TypeScript",
  "JavaScript",
  "Tailwind CSS",
  "Node.js",
  "Express",
  "Python",
  "Django",
  "Flask",
  "FastAPI",
  "PostgreSQL",
  "MongoDB",
  "MySQL",
  "REST APIs",
  "GraphQL",
  "AWS",
  "Azure",
  "GCP",
  "Docker",
  "Kubernetes",
  "Playwright",
  "Testing",
  "Accessibility",
  "Performance",
  "Design Systems",
  "Machine Learning",
  "Data Analysis",
  "Java",
  "Spring",
  "C++",
  "Go",
  "Rust",
];

async function parseResumeFile(file) {
  if (!file) {
    throw new Error("Resume file is required.");
  }

  const name = file.originalname || "resume";
  const lowerName = name.toLowerCase();

  if (file.mimetype === "text/plain" || lowerName.endsWith(".txt")) {
    return file.buffer.toString("utf8");
  }

  if (file.mimetype === "application/pdf" || lowerName.endsWith(".pdf")) {
    const result = await pdfParse(file.buffer);
    return result.text || "";
  }

  if (
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value || "";
  }

  throw new Error("Unsupported resume format. Upload PDF, DOCX, or TXT.");
}

function analyzeResumeText(text, fileName, preferences) {
  const normalized = String(text || "").toLowerCase();
  const skillsFromResume = KNOWN_SKILLS.filter((skill) => normalized.includes(skill.toLowerCase()));
  const focusSkills = preferences.focusSkills || [];
  const skills = uniqueList(skillsFromResume.concat(focusSkills)).slice(0, 20);
  const yearsMatch = normalized.match(/(\d+)\+?\s*(years|yrs|year)/);
  const years = yearsMatch ? Number(yearsMatch[1]) : estimateYearsFromText(text);
  const seniority = inferSeniority(years, preferences.experienceLevel);

  return {
    fileName,
    rawTextLength: text.length,
    headline: `${seniority} candidate with ${years}+ years of relevant experience`,
    summary: buildSummary(preferences),
    skills: skills.length ? skills : focusSkills,
    years,
    preferences,
  };
}

function buildSummary(preferences) {
  const roles = preferences.roles?.length ? preferences.roles.join(" or ") : "target";
  const workMode = preferences.workMode || "preferred";
  const salary = preferences.minimumSalary || "configured";
  const notice = preferences.noticePeriod || "configured";
  return `Seeking ${preferences.jobType || "full time"} ${roles} roles with ${workMode.toLowerCase()} flexibility, ${salary} minimum compensation, and ${notice.toLowerCase()} availability.`;
}

function estimateYearsFromText(text) {
  const length = String(text || "").length;
  if (length > 5000) return 6;
  if (length > 2500) return 4;
  return 2;
}

function inferSeniority(years, preferredLevel) {
  if (preferredLevel && preferredLevel !== "Mid-senior") {
    return preferredLevel;
  }
  if (years >= 8) return "Senior";
  if (years >= 4) return "Mid-senior";
  if (years >= 1) return "Entry level";
  return "Internship";
}

function uniqueList(items) {
  const seen = new Set();
  return items.filter((item) => {
    const normalized = String(item).trim();
    if (!normalized) return false;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = {
  parseResumeFile,
  analyzeResumeText,
  KNOWN_SKILLS,
};
