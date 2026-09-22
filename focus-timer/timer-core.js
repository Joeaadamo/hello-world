// Pure timer logic, kept free of DOM access so it can be unit tested (see timer-core.test.js).
// Loaded as a classic script so index.html still works when opened via file://.
(function (root) {
  const DURATIONS = { focus: 25, short: 5, long: 15 }; // minutes
  const LONG_EVERY = 4;

  // Milliseconds -> "MM:SS", rounding up so the display never shows 00:00 early.
  function formatTime(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  // Local-time YYYY-MM-DD.
  function dayKey(d = new Date()) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // Consecutive days with at least one session, counting back from today
  // (or from yesterday if there's nothing yet today, so the streak isn't lost mid-morning).
  function computeStreak(history, now = new Date()) {
    const d = new Date(now);
    if (!history[dayKey(d)]?.sessions) d.setDate(d.getDate() - 1);
    let streak = 0;
    while (history[dayKey(d)]?.sessions) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }

  // Handles the end of a phase: records completed focus sessions, credits the
  // selected task, advances the cycle, and returns the next mode. Mutates state.
  function completePhase(state, mode, { skipped = false, now = new Date(), durations = DURATIONS, longEvery = LONG_EVERY } = {}) {
    if (mode !== 'focus') return 'focus';
    if (!skipped) {
      const today = dayKey(now);
      const h = state.history[today] || { sessions: 0, minutes: 0 };
      h.sessions++; h.minutes += durations.focus;
      state.history[today] = h;
      const t = state.tasks.find(t => t.id === state.selected);
      if (t) t.pomos = (t.pomos || 0) + 1;
    }
    state.cycle++;
    return state.cycle % longEvery === 0 ? 'long' : 'short';
  }

  // Up to five tomatoes, then a "+".
  function tomatoLabel(pomos) {
    if (!pomos) return '';
    return '🍅'.repeat(Math.min(pomos, 5)) + (pomos > 5 ? '+' : '');
  }

  const api = { DURATIONS, LONG_EVERY, formatTime, dayKey, computeStreak, completePhase, tomatoLabel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TimerCore = api;
})(this);
