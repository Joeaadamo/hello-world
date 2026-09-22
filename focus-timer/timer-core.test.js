const { formatTime, dayKey, computeStreak, completePhase, tomatoLabel, DURATIONS } = require('./timer-core');

// Local-time date helper: day(2026, 9, 22) is Sept 22, 2026.
const day = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
const sessions = (...keys) => Object.fromEntries(keys.map(k => [k, { sessions: 1, minutes: 25 }]));
const freshState = (extra = {}) => ({ tasks: [], selected: null, history: {}, cycle: 0, ...extra });

describe('formatTime', () => {
  test('formats whole minutes', () => expect(formatTime(25 * 60000)).toBe('25:00'));
  test('formats minutes and seconds', () => expect(formatTime(61000)).toBe('01:01'));
  test('zero is 00:00', () => expect(formatTime(0)).toBe('00:00'));
  test('rounds partial seconds up', () => {
    expect(formatTime(1)).toBe('00:01');
    expect(formatTime(59001)).toBe('01:00');
  });
  test('clamps negative values to 00:00', () => expect(formatTime(-5000)).toBe('00:00'));
  test('handles an hour or more', () => expect(formatTime(90 * 60000)).toBe('90:00'));
});

describe('dayKey', () => {
  test('pads month and day', () => expect(dayKey(day(2026, 1, 5))).toBe('2026-01-05'));
  test('uses local date late at night', () => expect(dayKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31'));

  describe('with the clock mocked', () => {
    beforeEach(() => jest.useFakeTimers().setSystemTime(day(2026, 9, 22)));
    afterEach(() => jest.useRealTimers());

    test('defaults to today', () => expect(dayKey()).toBe('2026-09-22'));
  });
});

describe('computeStreak', () => {
  const today = day(2026, 9, 22);

  test('empty history is 0', () => expect(computeStreak({}, today)).toBe(0));
  test('a session today is 1', () => expect(computeStreak(sessions('2026-09-22'), today)).toBe(1));
  test('counts consecutive days ending today', () =>
    expect(computeStreak(sessions('2026-09-20', '2026-09-21', '2026-09-22'), today)).toBe(3));
  test('keeps a streak ending yesterday when nothing yet today', () =>
    expect(computeStreak(sessions('2026-09-20', '2026-09-21'), today)).toBe(2));
  test('a gap breaks the streak', () =>
    expect(computeStreak(sessions('2026-09-18', '2026-09-19', '2026-09-21', '2026-09-22'), today)).toBe(2));
  test('last session two days ago is 0', () => expect(computeStreak(sessions('2026-09-20'), today)).toBe(0));
  test('a day with zero sessions does not count', () => {
    const h = { ...sessions('2026-09-21'), '2026-09-22': { sessions: 0, minutes: 0 } };
    expect(computeStreak(h, today)).toBe(1);
  });
  test('crosses month boundaries', () =>
    expect(computeStreak(sessions('2026-02-27', '2026-02-28', '2026-03-01'), day(2026, 3, 1))).toBe(3));
  test('crosses year boundaries', () =>
    expect(computeStreak(sessions('2025-12-31', '2026-01-01'), day(2026, 1, 1))).toBe(2));
});

describe('completePhase', () => {
  const now = day(2026, 9, 22);

  describe('finishing focus', () => {
    test('records a session and focus minutes for today', () => {
      const s = freshState();
      completePhase(s, 'focus', { now });
      expect(s.history).toEqual({ '2026-09-22': { sessions: 1, minutes: DURATIONS.focus } });
    });
    test('adds to an existing day', () => {
      const s = freshState({ history: { '2026-09-22': { sessions: 2, minutes: 50 } } });
      completePhase(s, 'focus', { now });
      expect(s.history['2026-09-22']).toEqual({ sessions: 3, minutes: 75 });
    });
    test('credits a tomato to the selected task only', () => {
      const s = freshState({ tasks: [{ id: 'a', pomos: 2 }, { id: 'b' }], selected: 'b' });
      completePhase(s, 'focus', { now });
      expect(s.tasks.map(t => t.pomos)).toEqual([2, 1]);
    });
    test('works with no task selected', () => {
      const s = freshState({ tasks: [{ id: 'a', pomos: 0 }] });
      completePhase(s, 'focus', { now });
      expect(s.tasks[0].pomos).toBe(0);
      expect(s.history['2026-09-22'].sessions).toBe(1);
    });
    test('works when the selected task was deleted', () => {
      const s = freshState({ selected: 'gone' });
      completePhase(s, 'focus', { now });
      expect(s.history['2026-09-22'].sessions).toBe(1);
    });
    test('uses custom focus duration for minutes', () => {
      const s = freshState();
      completePhase(s, 'focus', { now, durations: { focus: 50, short: 10, long: 30 } });
      expect(s.history['2026-09-22'].minutes).toBe(50);
    });
  });

  describe('skipping', () => {
    test('skipped focus records nothing and credits no task', () => {
      const s = freshState({ tasks: [{ id: 'a', pomos: 1 }], selected: 'a' });
      completePhase(s, 'focus', { skipped: true });
      expect(s.history).toEqual({});
      expect(s.tasks[0].pomos).toBe(1);
    });
    test('skipped focus still advances the cycle', () => {
      const s = freshState();
      expect(completePhase(s, 'focus', { skipped: true })).toBe('short');
      expect(s.cycle).toBe(1);
    });
  });

  describe('mode sequence', () => {
    test('short, short, short, long, then repeats', () => {
      const s = freshState();
      const seq = Array.from({ length: 8 }, () => completePhase(s, 'focus'));
      expect(seq).toEqual(['short', 'short', 'short', 'long', 'short', 'short', 'short', 'long']);
    });
    test('respects a custom longEvery', () => {
      const s = freshState();
      const seq = Array.from({ length: 4 }, () => completePhase(s, 'focus', { longEvery: 2 }));
      expect(seq).toEqual(['short', 'long', 'short', 'long']);
    });
    test.each(['short', 'long'])('%s break returns to focus without touching state', mode => {
      const s = freshState({ cycle: 3 });
      expect(completePhase(s, mode)).toBe('focus');
      expect(s).toEqual(freshState({ cycle: 3 }));
    });
  });
});

describe('tomatoLabel', () => {
  test.each([0, undefined])('empty for %p', n => expect(tomatoLabel(n)).toBe(''));
  test('one tomato per session', () => expect(tomatoLabel(3)).toBe('🍅🍅🍅'));
  test('caps at five', () => expect(tomatoLabel(5)).toBe('🍅🍅🍅🍅🍅'));
  test('adds a plus past five', () => expect(tomatoLabel(7)).toBe('🍅🍅🍅🍅🍅+'));
});
