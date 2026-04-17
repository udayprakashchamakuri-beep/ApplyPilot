function rankJobs(profile, jobs) {
  const ranked = jobs.map((job) => {
    const matchedSkills = matchSkills(profile.skills || [], job.description || job.title || "");
    const roleBoost = includesAny(job.title, profile.preferences?.roles) ? 12 : 0;
    const locationBoost = includesAny(job.location, profile.preferences?.locations) ? 7 : 0;
    const remoteBoost = matchesRemotePreference(job, profile.preferences?.workMode) ? 6 : 0;
    const gaps = inferGaps(profile.skills || [], job.description || "");
    const skillScore = Math.min(38, matchedSkills.length * 6);
    const score = clamp(52 + skillScore + roleBoost + locationBoost + remoteBoost, 0, 98);

    return {
      ...job,
      matchedSkills,
      gaps,
      matchReasons: explainMatch({ matchedSkills, roleBoost, locationBoost, remoteBoost, gaps }),
      whyNotMatch: explainMismatch({ matchedSkills, roleBoost, locationBoost, remoteBoost, gaps }),
      suggestedImprovements: suggestImprovements(gaps, matchedSkills),
      learningSignals: buildLearningSignals(job),
      matchScore: score,
      match: score,
    };
  });

  const threshold = Number(profile.preferences?.threshold || 70);
  return ranked
    .filter((job) => job.matchScore >= threshold - 10)
    .sort((a, b) => b.matchScore - a.matchScore);
}

function explainMatch({ matchedSkills, roleBoost, locationBoost, remoteBoost, gaps }) {
  const reasons = [];
  if (matchedSkills.length) {
    reasons.push(`Matched resume skills: ${matchedSkills.slice(0, 5).join(", ")}`);
  }
  if (roleBoost) {
    reasons.push("Role title aligns with the user's target roles");
  }
  if (locationBoost) {
    reasons.push("Location matches the user's preference");
  }
  if (remoteBoost) {
    reasons.push("Work mode matches the user's preference");
  }
  if (gaps.length) {
    reasons.push(`Skill gaps to improve: ${gaps.join(", ")}`);
  }
  if (!reasons.length) {
    reasons.push("Limited direct evidence, review the job description before approval");
  }
  return reasons;
}

function explainMismatch({ matchedSkills, roleBoost, locationBoost, remoteBoost, gaps }) {
  const reasons = [];
  if (!matchedSkills.length) {
    reasons.push("The description has few direct skill overlaps with the resume");
  }
  if (!roleBoost) {
    reasons.push("The title is not a direct match for the target role keywords");
  }
  if (!locationBoost) {
    reasons.push("The location does not clearly match the preferred locations");
  }
  if (!remoteBoost) {
    reasons.push("The work mode is not clearly aligned with the user's preference");
  }
  if (gaps.length) {
    reasons.push(`Missing or weakly evidenced skills: ${gaps.join(", ")}`);
  }
  return reasons.length ? reasons : ["No major blocker detected; review compensation, culture, and application questions"];
}

function suggestImprovements(gaps, matchedSkills) {
  const improvements = [];
  if (gaps.length) {
    improvements.push(`Add a resume bullet or project proof for ${gaps.slice(0, 2).join(" and ")}`);
  }
  if (matchedSkills.length) {
    improvements.push(`Move ${matchedSkills.slice(0, 3).join(", ")} higher in the tailored summary`);
  }
  improvements.push("Save approval or rejection feedback so future recommendations learn the user's preference");
  return improvements;
}

function buildLearningSignals(job) {
  return [
    `Track whether the user approves, rejects, or ignores this ${job.source || "source"} role`,
    "Learn from user behavior across approvals, rejections, and skipped roles",
    "Use accepted roles to raise similar titles, companies, skills, and work modes",
    "Use rejected roles to lower similar mismatches and improve future recommendations",
  ];
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
  explainMatch,
  explainMismatch,
  rankJobs,
  suggestImprovements,
};
