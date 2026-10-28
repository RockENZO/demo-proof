# Validation and evidence

Collected 26 October 2026. All weather values are fictional, approved fixtures.

The included [bundle](demo/bundle.json) and [manifest](demo/manifest.json) come from a real Chromium run of `examples/weather`. Four declared UI assertions pass, two API calls receive projected fixture responses, and three static assets are replayed. The complete original local server was stopped before the replay, so both the API and the frontend origin were unavailable. The MP4 lasts 22.96 seconds at 1280×900. The GIF is an encoding of that actual screen recording, not generated UI frames. Capture/replay timestamps, config/bundle and media hashes are in the manifest. The original field `internalNote` and its example value do not appear in the bundle.

This is an internal, purpose-built example and a small regression suite. It is not evidence of external users, broad framework compatibility, automatic de-identification, performance improvement or comprehensive application correctness. The sample source is included under MIT. No third-party footage or live weather was used.

## Reproduction

Follow the root README to capture the example, stop its server, then replay. Each run needs fresh output directories. Alternatively replay `docs/demo/bundle.json` directly with no server. Encoding bytes can differ by Chromium, OS, fonts and ffmpeg version; verify your own run's manifest rather than expecting identical media hashes.

Local verification used Node 26.8.2, Playwright 1.64.1 and installed ffmpeg. The supported CI baseline is Linux Node 22/24; check actual workflow results. The first sandbox-restricted Chromium run crashed in the local Node runtime; rerunning with authorized browser execution permissions passed. This is not counted as a passing test or a diagnosed Node defect.

The test suite covers:

- Explicit scalar projection; missing/empty allowlists, nested values and prototype-like keys rejected.
- Loopback origin restrictions, query/traversal/redirect rejection, input and resource bounds.
- Actual browser capture and replay after source-server shutdown, fixture responses, valid media, hashes and output-directory refusal.
- Unexpected network requests even when the app catches errors, failed UI assertions, modified resource bytes, and capture cookie/header omission.

The real example is also a side-by-side workflow assessment: stock Playwright provides routing/video/assertions, while DemoProof adds a config gate, field projection, bundle verification, stopped-server replay checks, ffmpeg outputs and a standalone evidence report. The tutorial-recorder alternative focuses on interactive recording/narration. No measured usability advantage or missing-feature claim about those tools is made. External pilot feedback is still required before considering this positioning validated.

## Review regressions

The first automatic review identified hidden-text false positives and a one-second early timeout for asynchronously inserted elements. Both were reproduced as failing browser tests. Assertions now require visibility and retry transient missing/detached elements within the same five-second deadline. Capture and stopped-server replay cover hidden-text rejection and an element inserted after 1.5 seconds. These are part of the 29-test suite.

## 28 October 2026: artifact handoff and real application integration

The v0.2.0 verification command checks the existing v0.1.0 weather export as well
as a new actual [Readme Reality recording](demo/readme-reality/report.html).
The second recording uses the exact v0.2.0 source commit and unmodified built
HTML/JS/CSS. The original static server was confirmed unavailable before replay.
Four visible assertions pass during capture and again during replay; no API
fixture or remote repository scan occurs. Its MP4 lasts 23.88 seconds at
1280×960. This is a real internal application integration using fictional README
snapshots, not a second purpose-built weather mock or external customer trial.
Source/build hashes, capture/replay times, media hashes and attribution notices
are included beside its manifest. The recipe remains manual and explicit.

New verification tests use tiny synthetic non-media bytes to isolate hash and
filesystem input checks. Actual Chromium/ffmpeg integration separately verifies
real produced media. The standalone verify CLI is tested with no Playwright
package or encoder available in that copied CLI directory. Old manifests,
optional GIFs, tampering, missing/truncated artifacts, invalid size/schema,
traversal/absolute/nested paths, symlinks and independently pinned manifest
digests are covered. The test demonstrating simultaneous manifest/media edits
is deliberate: matching self-declared hashes alone are not authentication.

Verification is read-only and streams bounded files. It does not execute the
HTML report, decode media, rerun assertions, validate all files in a directory,
recover missing bundles or create a filesystem transaction. Stable trusted
input directories remain required. No new model, productivity or market-demand
metrics are claimed.
