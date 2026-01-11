This directory is intentionally committed so Vitest can reliably load environment
variables from `envDir: "tests/env"` (see `vitest.config.ts`) without needing to
read the repo-root `.env` (which can be blocked by macOS/iCloud permissions).

Optional: create a local `tests/env/.env` (or `tests/env/.env.test`) for any
additional test-only environment variables. Do not commit secrets.

