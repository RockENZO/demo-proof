# Contributing

Start with a minimal, non-sensitive local reproduction. Run `npm ci`, install Playwright Chromium and ffmpeg, then `npm test`. Use the current supported Node baseline. Changes to replay, field projection or export gating need a regression that fails before the fix. Do not include raw HAR, user cookies, personal data or recordings from third-party sites.

Keep scope small: v1 is a constrained static HTTP app snapshot, not a general browser recorder. Document unsupported behavior and avoid claiming that a passing export validates an application's backend or all sensitive data. CI and exact-head review must complete before merge.
