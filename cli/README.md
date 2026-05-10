# @zero-gate/cli

The `zero` CLI for Zero Gate developers.

## Install

Pick one of the three paths. **Path 1** is the recommended way for now (matches how the SDK is shipped).

### 1. Install the published tarball (recommended)

```sh
npm install -g https://github.com/platanus-hack/platanus-hack-26-ar-team-17/raw/main/cli/zero-gate-cli-0.1.0.tgz
zero --version
```

Drops a global `zero` binary on your `PATH`. Works on macOS, Linux, and Windows (PowerShell, Git Bash, cmd).

### 2. Run with `npx`, no install

```sh
npx -p https://github.com/platanus-hack/platanus-hack-26-ar-team-17/raw/main/cli/zero-gate-cli-0.1.0.tgz zero --help
```

Useful for one-off use or CI.

### 3. Local development (clone the repo)

```sh
git clone https://github.com/platanus-hack/platanus-hack-26-ar-team-17.git
cd platanus-hack-26-ar-team-17/cli
npm install
npm run build
npm link            # creates a global symlink → `zero` on your PATH
```

After `npm link`, edits to `cli/src/*.ts` followed by `npm run build` (or `npm run dev` for watch mode) update the global `zero` instantly.

To remove: `npm unlink -g @zero-gate/cli`.

## Quick start

```sh
zero login                       # paste your CLI token from the dashboard
zero init                        # adds @zero-gate/sdk to the current project
zero agents create my-bot        # creates an agent, prints credentials
zero agents list
zero whoami
```

## Configuration

- Config is stored at `~/.zero-gate/config.json` (chmod 600 on Unix).
- `ZEROGATE_URL` overrides the API endpoint (default `http://localhost:3000`).
- `ZEROGATE_TOKEN` overrides the stored token, useful for CI.

For local dev against your own ZeroGate instance:

```sh
ZEROGATE_URL=http://localhost:3000 zero login
ZEROGATE_URL=https://your-zero.vercel.app zero login
```

## Commands

| Command                  | Description                                |
| ------------------------ | ------------------------------------------ |
| `zero login`             | Save a CLI token after validating it       |
| `zero logout`            | Delete local credentials                   |
| `zero whoami`            | Show the currently signed-in user          |
| `zero init`              | Install SDK + scaffold `.env.local`        |
| `zero agents create`     | Create an agent and print credentials      |
| `zero agents list`       | List your agents                           |

The CLI authenticates by sending the stored token as `Authorization: Bearer ...`
to the same API the dashboard uses. The token is the user's session JWT —
copy it from the dashboard for now (a dedicated "Copy CLI token" button is
on the roadmap).

## Releasing a new tarball

```sh
cd cli
# bump version in package.json
npm run build
npm pack            # produces zero-gate-cli-x.y.z.tgz
git add zero-gate-cli-*.tgz package.json
git commit -m "release(cli): vX.Y.Z"
```

The committed tarball under `cli/` is what consumers install via `npm i -g <github-raw-url>`.
