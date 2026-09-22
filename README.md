# hello-world

[![Tests](https://github.com/Joeaadamo/hello-world/actions/workflows/test.yml/badge.svg)](https://github.com/Joeaadamo/hello-world/actions/workflows/test.yml)

A place for small, self-contained web projects. Each one lives in its own folder.

## Focus Timer

[`focus-timer/`](focus-timer/) is a Pomodoro timer with a task list, built as a single HTML page with no dependencies.

- **Focus and breaks:** 25-minute focus sessions and 5-minute short breaks, with a 15-minute long break after every 4th session.
- **Tasks:** add tasks, pick the one you're working on, and check them off. Each finished session earns that task a 🍅.
- **Daily stats:** sessions and focus minutes for today, plus a streak of consecutive days with at least one session.
- **Nice touches:** a countdown in the tab title, a chime when a session ends, and a desktop notification if the tab is in the background. Works in light and dark mode, and on phones.

Everything is saved in your browser's local storage, so nothing leaves your machine.

### Run it

Open the page directly in a browser:

```bash
open focus-timer/index.html
```

Or serve the folder locally:

```bash
python3 -m http.server 8123 --directory focus-timer
```

Then visit http://localhost:8123. Keyboard shortcut: <kbd>Space</kbd> starts and pauses the timer.

### How it's built

| File | What it does |
| --- | --- |
| [`index.html`](focus-timer/index.html) | The page: layout, styles, rendering, sound, and notifications |
| [`timer-core.js`](focus-timer/timer-core.js) | The timer logic, with no page access: time formatting, streaks, and what happens when a session ends |
| [`timer-core.test.js`](focus-timer/timer-core.test.js) | Jest unit tests for `timer-core.js` |

`timer-core.js` loads as a plain `<script>` in the browser and as a CommonJS module in Node, so the same code runs in the app and in the tests.

### Tests

The tests need Node.js; the app itself doesn't.

```bash
cd focus-timer
npm install
npm test
```

GitHub Actions runs the tests on every pull request and on every push to `main` ([workflow](.github/workflows/test.yml)).
