function isRateLimited(lastCallTimestamps, chatId, now, cooldownMs) {
  const last = lastCallTimestamps.get(chatId);
  if (last === undefined) return false;
  return now - last < cooldownMs;
}

function recordCall(lastCallTimestamps, chatId, now) {
  lastCallTimestamps.set(chatId, now);
}

function msUntilAllowed(lastCallTimestamps, chatId, now, cooldownMs) {
  const last = lastCallTimestamps.get(chatId);
  if (last === undefined) return 0;
  const remaining = cooldownMs - (now - last);
  return remaining > 0 ? remaining : 0;
}

function formatRemaining(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes} min ${seconds}s`;
}

module.exports = { isRateLimited, recordCall, msUntilAllowed, formatRemaining };
