const { formatTime, dayKey, computeStreak, completePhase, tomatoLabel, DURATIONS } = TimerCore;

// Local-time date helper: day(2026, 9, 22) is Sept 22, 2026.
const day = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
const sessions = (...keys) => Object.fromEntries(keys.map(k => [k, { sessions: 1, minutes: 25 }]));
const freshState = (extra = {}) => ({ tasks: [], selected: null, history: {}, cycle: 0, ...extra });

describe('formatTime', () => {
  test('formats whole minutes', () => eq(formatTime(25 * 60000), '25:00'));
  test('formats minutes and seconds', () => eq(formatTime(61000), '01:01'));
  test('zero is 00:00', () => eq(formatTime(0), '00:00'));
  test('rounds partial seconds up', () => {
    eq(formatTime(1), '00:01');
    eq(formatTime(59001), '01:00');
  });
  test('clamps negative values to 00:00', () => eq(formatTime(-5000), '00:00'));
  test('handles an hour or more', () => eq(formatTime(90 * 60000), '90:00'));
});

describe('dayKey', () => {
  test('pads month and day', () => eq(dayKey(day(2026, 1, 5)), '2026-01-05'));
  test('uses local date late at night', () => eq(dayKey(new Date(2026, 11, 31, 23, 59)), '2026-12-31'));
  test('defaults to today', () => eq(dayKey(), dayKey(new Date())));
});

describe('computeStreak', () => {
  const today = day(2026, 9, 22);
  test('empty history is 0', () => eq(computeStreak({}, today), 0));
  test('a session today is 1', () => eq(computeStreak(sessions('2026-09-22'), today), 1));
  test('counts consecutive days ending today', () =>
    eq(computeStreak(sessions('2026-09-20', '2026-09-21', '2026-09-22'), today), 3));
  test('keeps a streak ending yesterday when nothing yet today', () =>
    eq(computeStreak(sessions('2026-09-20', '2026-09-21'), today), 2));
  test('a gap breaks the streak', () =>
    eq(computeStreak(sessions('2026-09-18', '2026-09-19', '2026-09-21', '2026-09-22'), today), 2));
  test('last session two days ago is 0', () => eq(computeStreak(sessions('2026-09-20'), today), 0));
  test('a day with zero sessions does not count', () => {
    const h = { ...sessions('2026-09-21'), '2026-09-22': { sessions: 0, minutes: 0 } };
    eq(computeStreak(h, today), 1);
  });
  test('crosses month boundaries', () =>
    eq(computeStreak(sessions('2026-02-27', '2026-02-28', '2026-03-01'), day(2026, 3, 1)), 3));
  test('crosses year boundaries', () =>
    eq(computeStreak(sessions('2025-12-31', '2026-01-01'), day(2026, 1, 1)), 2));
});

describe('completePhase: focus', () => {
  const now = day(2026, 9, 22);

  test('records a session and focus minutes for today', () => {
    const s = freshState();
    completePhase(s, 'focus', { now });
    eq(s.history, { '2026-09-22': { sessions: 1, minutes: DURATIONS.focus } });
  });
  test('adds to an existing day', () => {
    const s = freshState({ history: { '2026-09-22': { sessions: 2, minutes: 50 } } });
    completePhase(s, 'focus', { now });
    eq(s.history['2026-09-22'], { sessions: 3, minutes: 75 });
  });
  test('credits a tomato to the selected task only', () => {
    const s = freshState({ tasks: [{ id: 'a', pomos: 2 }, { id: 'b' }], selected: 'b' });
    completePhase(s, 'focus', { now });
    eq(s.tasks.map(t => t.pomos), [2, 1]);
  });
  test('works with no task selected', () => {
    const s = freshState({ tasks: [{ id: 'a', pomos: 0 }] });
    completePhase(s, 'focus', { now });
    eq(s.tasks[0].pomos, 0);
    eq(s.history['2026-09-22'].sessions, 1);
  });
  test('works when the selected task was deleted', () => {
    const s = freshState({ selected: 'gone' });
    completePhase(s, 'focus', { now });
    eq(s.history['2026-09-22'].sessions, 1);
  });
  test('uses custom focus duration for minutes', () => {
    const s = freshState();
    completePhase(s, 'focus', { now, durations: { focus: 50, short: 10, long: 30 } });
    eq(s.history['2026-09-22'].minutes, 50);
  });
});

describe('completePhase: skipping', () => {
  test('skipped focus records nothing and credits no task', () => {
    const s = freshState({ tasks: [{ id: 'a', pomos: 1 }], selected: 'a' });
    completePhase(s, 'focus', { skipped: true });
    eq(s.history, {});
    eq(s.tasks[0].pomos, 1);
  });
  test('skipped focus still advances the cycle', () => {
    const s = freshState();
    eq(completePhase(s, 'focus', { skipped: true }), 'short');
    eq(s.cycle, 1);
  });
});

describe('completePhase: mode sequence', () => {
  test('short, short, short, long, then repeats', () => {
    const s = freshState();
    const seq = Array.from({ length: 8 }, () => completePhase(s, 'focus'));
    eq(seq, ['short', 'short', 'short', 'long', 'short', 'short', 'short', 'long']);
  });
  test('respects a custom longEvery', () => {
    const s = freshState();
    const seq = Array.from({ length: 4 }, () => completePhase(s, 'focus', { longEvery: 2 }));
    eq(seq, ['short', 'long', 'short', 'long']);
  });
  test('breaks return to focus without touching state', () => {
    for (const mode of ['short', 'long']) {
      const s = freshState({ cycle: 3 });
      eq(completePhase(s, mode), 'focus');
      eq(s, freshState({ cycle: 3 }), mode);
    }
  });
});

describe('tomatoLabel', () => {
  test('empty for zero or missing', () => {
    eq(tomatoLabel(0), '');
    eq(tomatoLabel(undefined), '');
  });
  test('one tomato per session', () => eq(tomatoLabel(3), '🍅🍅🍅'));
  test('caps at five', () => eq(tomatoLabel(5), '🍅🍅🍅🍅🍅'));
  test('adds a plus past five', () => eq(tomatoLabel(7), '🍅🍅🍅🍅🍅+'));
});
