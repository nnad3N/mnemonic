# Local self-hosting (alpha)

Mnemonic is in **alpha**. This guide covers local self-hosting only, not deployment to the public internet. Expect rough edges, breaking changes, and incomplete features.

## Requirements

| Requirement                       | Notes                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------- |
| **Docker** and **Docker Compose** | Docker Engine on Linux, or Docker Desktop 4.34+ with host networking enabled |
| **OpenRouter API key**            | Create one at [openrouter.ai/keys](https://openrouter.ai/keys)               |
| **Disk and memory**               | Allow several GB. Firecrawl runs a browser, PostgreSQL, Valkey, and RabbitMQ |
| **Deno**                          | Optional; only required for the convenience tasks documented below           |

On Docker Desktop, enable **Settings → Resources → Network → Enable host networking**, apply the change, and restart Docker Desktop. The Mnemonic container uses host networking so the app and browser can use the same localhost endpoints.

## Services and ports

| Service        | Address                                        | Notes                                             |
| -------------- | ---------------------------------------------- | ------------------------------------------------- |
| Mnemonic       | [http://localhost:3000](http://localhost:3000) | Started by the `selfhost` profile                 |
| RustFS S3 API  | [http://localhost:9000](http://localhost:9000) | Used by the app and browser for presigned uploads |
| RustFS console | [http://localhost:9001](http://localhost:9001) | RustFS administration UI                          |
| Firecrawl      | [http://localhost:3002](http://localhost:3002) | Local crawling API                                |
| SearXNG        | [http://localhost:8080](http://localhost:8080) | Search backend used by Firecrawl                  |

Keep `S3_ENDPOINT=http://localhost:9000`. Presigned URLs are opened by the browser, so a Compose-only hostname such as `http://rustfs:9000` would not work. No separate public S3 URL is required for local self-hosting.

## Configure the environment

1. Clone the repository:

   ```bash
   git clone <repo-url> mnemonic
   cd mnemonic
   ```

2. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

3. Set these required values in `.env`:

   - `OPENROUTER_API_KEY` — your OpenRouter key.
   - `BETTER_AUTH_SECRET` — a random secret.

   Generate the auth secret on Linux, macOS, or WSL:

   ```bash
   openssl rand -base64 32
   ```

   Or with Windows PowerShell:

   ```powershell
   [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   ```

The remaining `.env.example` defaults match the local Compose stack. In the self-hosted app container, Compose overrides `DATABASE_URL`, `BETTER_AUTH_URL`, and `FIRECRAWL_API_URL` with container-specific values. Change the default RustFS credentials if other users or devices can access the exposed ports.

## Run the complete stack in Docker

With Deno installed:

```bash
deno task docker:selfhost
```

The equivalent Docker-only commands are:

```bash
docker compose --profile selfhost up -d --build --wait
docker compose --profile selfhost run --rm rustfs-init
```

The second command runs a one-shot initializer that creates the configured S3 bucket and then exits. It is safe to rerun because bucket creation uses `--ignore-existing`. It is not a persistent second RustFS service.

The first build downloads several large images and compiles the app, so it can take several minutes. When the stack is ready, open [http://localhost:3000](http://localhost:3000) and create an account.

## Run only the dependencies in Docker

Use this mode when running the Mnemonic app directly on the host with Vite:

```bash
deno task docker:dev
deno task dev
```

`docker:dev` removes a previously created self-hosted app container, starts RustFS and the Firecrawl stack with the `host` profile, and runs the same one-shot S3 initializer. The app itself then runs on the host at [http://localhost:3000](http://localhost:3000).

The equivalent dependency startup commands are:

```bash
docker compose --profile selfhost rm -sf app
docker compose --profile host up -d --wait
docker compose --profile host run --rm rustfs-init
```

## Day-to-day commands

### Complete self-hosted stack

```bash
# Show app logs
docker compose --profile selfhost logs -f app

# Stop containers but keep all data
docker compose --profile selfhost down

# Rebuild and start after source or dependency changes
deno task docker:selfhost

# Stop containers and delete all self-hosted data
deno task docker:reset-selfhost
# equivalent: docker compose --profile selfhost down -v
```

`docker:reset-selfhost` deletes the app database, uploaded S3 objects, and persisted Firecrawl state.

### Docker dependencies with a host app

```bash
# Stop dependency containers but keep their data
docker compose --profile host down

# Start the dependencies again
deno task docker:dev

# Stop dependencies and delete their persisted data
deno task docker:reset-dev
# equivalent: docker compose --profile host down -v
```

`docker:reset-dev` deletes RustFS and persisted Firecrawl data. It does not select the self-hosted app or its `mnemonic_data` volume.

## Persistent data

| Volume                    | Contents                                                          |
| ------------------------- | ----------------------------------------------------------------- |
| `mnemonic_data`           | SQLite application database used by the self-hosted app container |
| `rustfs_data`             | Uploaded files and other S3 objects                               |
| `firecrawl_postgres_data` | Firecrawl PostgreSQL data                                         |
| `firecrawl_rabbitmq_data` | Firecrawl RabbitMQ data                                           |

Stopping the stack without `-v` preserves these volumes. A reset command uses `down -v` and permanently deletes the volumes selected by that profile.

## Troubleshooting

- Check container status with `docker compose --profile selfhost ps` or `docker compose --profile host ps`.
- If startup fails, verify that ports `3000`, `3002`, `8080`, `9000`, and `9001` are available.
- If the app cannot upload files, verify that [http://localhost:9000](http://localhost:9000) is reachable from the browser and that `S3_ENDPOINT` still uses that address.
- If the S3 bucket is missing, rerun `docker compose --profile selfhost run --rm rustfs-init` for the complete stack or use the `host` profile for dependency-only mode.
- On Docker Desktop, confirm that host networking is enabled if the app container cannot reach localhost services.
