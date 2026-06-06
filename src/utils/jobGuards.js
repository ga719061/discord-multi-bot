export function createJobOverlapGuard(name, run, logger) {
  let inFlight = false;

  return async function runGuarded(...args) {
    if (inFlight) {
      logger?.debug?.(`[${name}] Previous run still in progress; skipping this tick.`);
      return false;
    }

    inFlight = true;
    try {
      await run(...args);
      return true;
    } finally {
      inFlight = false;
    }
  };
}
