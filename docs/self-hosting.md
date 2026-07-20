# Local self-hosting (alpha)

Mnemonic is in **alpha**. These deployment docs cover **local self-hosting only** — not a production or public internet deploy. Expect rough edges, breaking changes, and incomplete features.

## What you need

| Requirement                     | Notes                                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| **Docker** + **Docker Compose** | Docker Desktop (Windows/macOS/WSL2) or Docker Engine + Compose on Linux                |
| **OpenRouter API key**          | [openrouter.ai/keys](https://openrouter.ai/keys) — the only cloud API key required     |
| **Disk / RAM**                  | Several GB free. The Firecrawl stack (browser + Postgres + Valkey + RabbitMQ) is heavy |

## What gets started

- **Mnemonic app** on [http://localhost:3000](http://localhost:3000)
- **RustFS** (S3) on `localhost:9000` (console on `9001`)
- **Firecrawl** on `localhost:3002`
- **SearXNG** on `localhost:8080`
- **SQLite** database in a Docker volume (`mnemonic_data`)

## Steps

1. **Clone the repo**

   ```bash
   git clone <repo-url> mnemonic
   cd mnemonic
   ```

2. **Create `.env`**

   ```bash
   cp .env.example .env
   ```

   Set at least:

   - `OPENROUTER_API_KEY` — your OpenRouter key
   - `BETTER_AUTH_SECRET` — random secret

   Generate a secret:

   ```bash
   # Linux / macOS / WSL
   openssl rand -base64 32
   ```

   ```powershell
   # Windows (PowerShell)
   [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   ```

   The remaining `.env.example` defaults (`S3_*`, `FIRECRAWL_API_URL`, `BETTER_AUTH_URL`, …) are fine for a private local machine. Change them if you do not trust the environment (shared host, exposed ports, other users on the same network) — especially the RustFS access key/secret. Compose overrides `DATABASE_URL` and `FIRECRAWL_API_URL` inside the app container.

3. **Start the stack**

   With Deno installed (optional convenience script):

   ```bash
   deno task docker:selfhost
   ```

   Or with Docker only:

   ```bash
   docker compose up -d --build --wait
   docker compose run --rm rustfs-init
   ```

   First build pulls large images and compiles the app — expect to wait for several minutes.

4. **Open the app**

   Visit [http://localhost:3000](http://localhost:3000) and create an account.

## Day-to-day commands

```bash
# Logs
docker compose logs -f app

# Stop (keeps data volumes)
docker compose down

# Stop and wipe all local data (SQLite, S3 objects, Firecrawl state)
deno task docker:reset
# or: docker compose down -v
```
