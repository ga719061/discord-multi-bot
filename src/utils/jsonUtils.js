export function safeJsonParse(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function parseJsonArray(value, fallback = []) {
  const parsed = safeJsonParse(value, fallback);
  return Array.isArray(parsed) ? parsed : fallback;
}

export function parseJsonObject(value, fallback = {}) {
  const parsed = safeJsonParse(value, fallback);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
}

export function normalizePollVotes(rawVotes, optionCount) {
  const votes = parseJsonObject(rawVotes, {});
  const normalized = {};

  for (let i = 0; i < optionCount; i++) {
    normalized[i] = Array.isArray(votes[i]) ? votes[i] : [];
  }

  return normalized;
}
