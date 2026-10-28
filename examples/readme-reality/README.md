# Internal integration: Readme Reality v0.2.0

This records the real application at commit
`9298574e5bc5e042ab9955b2be50081c646cf51d`; its built-in README/file snapshots
are fictional examples. It does not scan remote repositories or call a model.
No fixtures are configured because this application computes its examples
entirely in the browser. This is internal reuse, not external adoption.

## Build and serve explicitly

Use a sibling source checkout at the pinned commit. Build dependencies require
Node 22.12+; DemoProof does not start servers or install app dependencies for you.
From that Readme Reality checkout:

```bash
git checkout --detach 9298574e5bc5e042ab9955b2be50081c646cf51d
npm ci
npm run build:web
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4179 --strictPort
```

In another terminal, from the DemoProof checkout:

```bash
mkdir -p .demo-proof
node examples/readme-reality/create-config.mjs ../readme-reality/site .demo-proof/readme-reality-config.json
node bin/demo-proof.mjs capture --config .demo-proof/readme-reality-config.json --out .demo-proof/readme-reality-capture
```

The generator reads the built HTML's two static JS/CSS references and creates an
exclusive new config. Review it before capture. It intentionally expects this
known build shape; changing apps/build formats requires an explicitly reviewed
asset list, not automatic arbitrary-site crawling. Each declared asset must be
observed during capture. The journey inspects the Node and HTML-card examples,
switching each from broken to corrected and asserting visible status text.

**Stop the Vite preview server** before the next command. Confirm the application
URL no longer responds. Then, still in the DemoProof checkout:

```bash
node bin/demo-proof.mjs replay --bundle .demo-proof/readme-reality-capture/bundle.json --out .demo-proof/readme-reality-export --gif
node bin/demo-proof.mjs verify --manifest .demo-proof/readme-reality-export/manifest.json
```

All output directories/configs must be fresh. For the published internal run,
see [provenance](../../docs/demo/readme-reality/provenance.json) and
[the recorded report](../../docs/demo/readme-reality/report.html). Original app
assets are copied verbatim; MIT and bundled third-party notices accompany the
published example. No native app, real backend, private inputs or API key is
represented by this recording. Encoding hashes vary by runtime.
