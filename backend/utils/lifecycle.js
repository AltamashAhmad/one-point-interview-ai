/** Process-wide shutdown flag so readiness checks can report "draining" during a deploy. */
let shuttingDown = false;

module.exports = {
  isShuttingDown: () => shuttingDown,
  markShuttingDown: () => { shuttingDown = true; },
};
