# @zero-gate/cli

The `zero` CLI for Zero Gate developers.

## Install

```sh
npm i -g @zero-gate/cli
# or, from the monorepo
cd cli && npm install && npm run build && npm link
```

## Quick start

```sh
zero login                       # paste your CLI token from the dashboard
zero init                        # adds @zero-gate/sdk to the current project
zero agents create my-bot        # creates an agent, prints credentials
zero agents list
zero whoami
```

## Configuration

- Config is stored at `~/.zero-gate/config.json` (chmod 600).
- `ZEROGATE_URL` overrides the API endpoint (default `http://localhost:3000`).
- `ZEROGATE_TOKEN` overrides the stored token, useful for CI.

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
