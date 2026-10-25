# Boundaries

Use trusted local application assets and personally reviewed example data only. Captured JavaScript executes in Chromium. This is not a sandbox for hostile code, a general network-isolation product, or a scanner that guarantees detection of secrets. Only fixture fields are projected; source assets, journey text and media can contain data requiring manual review. Do not use authenticated profiles or private datasets.

The CLI never starts application shell commands. Inputs and output locations must be stable, private and not concurrently modified. Outputs must be new directories. Failed outputs may be partial and contain failure.json; never publish them as verified. A successful run requires the final valid manifest and matching file hashes. Hashes do not establish publisher authenticity. Browser/ffmpeg dependencies require their own updates.

Report a suspected issue without including private assets, credentials or recordings. No public third-party scanning or automated outreach is performed by this tool.
