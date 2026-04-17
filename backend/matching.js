function rankJobs(profile, jobs) {
  const ranked = jobs.map((job) => {
    const matchedSkills = matchSkills(profile.skills || [], job.description || job.title || "");
    const roleBoost = includesAny(job.title, profile.preferences?.roles) ? 12 : 0;
    const locationBoost = includesAny(job.location, profile.preferences?.locations) ? 7 : 0;
    const remoteBoost = matchesRemotePreference(job, profile.preferences?.workMode) ? 6 : 0;
    const skillScore = Math.min(38, matchedSkills.length * 6);
    const score = clamp(52 + skillScore + roleBoost + locationBoost + remoteBoost, 0, 98);

    return {
      ...job,
      matchedSkills,
      gaps: inferGaps(profile.skills || [], job.description || ""),
      matchScore: score,
      match: score,
    };
  });

  const threshold = Number(profile.preferences?.threshold || 70);
  return ranked
    .filter((job) => job.matchScore >= threshold - 10)
    .sort((a, b) => b.matchScore - a.matchScore);
}

function matchSkills(profileSkills, text) {
  const lowerText = String(text).toLowerCase();
  return profileSkills.filter((skill) => lowerText.includes(String(skill).toLowerCase())).slice(0, 8);
}

function inferGaps(profileSkills, description) {
  const common = ["AWS", "GraphQL", "Kubernetes", "Docker", "Testing", "PostgreSQL", "Python"];
  const lowerSkills = new Set(profileSkills.map((skill) => String(skill).toLowerCase()));
  const lowerDescription = String(description).toLowerCase();
  return common
    .filter((skill) => lowerDescription.includes(skill.toLowerCase()) && !lowerSkills.has(skill.toLowerCase()))
    .slice(0, 3);
}

function includesAny(value, candidates = []) {
  const lower = String(value || "").toLowerCase();
  return candidates.some((candidate) => lower.includes(String(candidate).toLowerCase().split(" ")[0]));
}

function matchesRemotePreference(job, workMode = "") {
  const preference = String(workMode).toLowerCase();
  const remoteType = String(job.remoteType || "").toLowerCase();
  const location = String(job.location || "").toLowerCase();
  if (preference.includes("remote")) return remoteType === "remote" || location.includes("remote");
  if (preference.includes("hybrid")) return remoteType === "hybrid" || location.includes("hybrid");
  if (preference.includes("site")) return remoteType === "onsite";
  return false;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

module.exports = {
  rankJobs,
};
