# Deployment

The app runs as a single Docker container on an AWS Lightsail instance, behind Caddy for SSL.

Deployment is automated via GitHub Actions: every push to `main` builds a fresh
image, pushes it to GitHub Container Registry (GHCR), and tells the Lightsail
instance to pull and restart. The manual flow below is kept as a fallback.

## Automated deployment (GitHub Actions)

The workflow lives at `.github/workflows/deploy.yml`. It runs on every push to
`main` and can also be triggered manually from the Actions tab
(`workflow_dispatch`).

### Required GitHub secrets

Set these under **Settings → Secrets and variables → Actions**:

| Secret | What it is |
|--------|------------|
| `LIGHTSAIL_HOST` | Public IP or DNS of the Lightsail instance |
| `LIGHTSAIL_USER` | SSH user (e.g. `ubuntu`) |
| `LIGHTSAIL_SSH_KEY` | Private SSH key with access to the instance (the full PEM, including BEGIN/END lines) |
| `GHCR_PULL_USER` | GitHub username that owns the pull token |
| `GHCR_PULL_TOKEN` | Personal access token with `read:packages` scope, used by the server to pull from GHCR |

The image is pushed using the workflow's built-in `GITHUB_TOKEN` (no secret
needed for that side). The server-side pull uses a separate PAT because
`GITHUB_TOKEN` only exists inside the workflow run.

### One-time server setup for the automated flow

On the Lightsail instance, make sure the SSH user can run docker without sudo
(see "Install Docker" below — `usermod -aG docker ubuntu` covers this) and that
the GHCR PAT can be used to pull the image:

```bash
echo "$GHCR_PULL_TOKEN" | docker login ghcr.io -u "$GHCR_PULL_USER" --password-stdin
```

The workflow re-runs `docker login` on every deploy, so this is only needed to
verify connectivity once.

### What the workflow does

1. **build** job — builds the Docker image with Buildx (using GHA cache) and
   pushes it to `ghcr.io/<owner>/<repo>` tagged with both the commit SHA and
   `latest`.
2. **deploy** job — SSHes into the Lightsail instance, runs `docker pull` on
   `:latest`, then stops/removes/runs the container with the same flags as the
   manual deploy (`--restart unless-stopped`, `--shm-size=256m`, port
   `3002:3000`). Old images are pruned at the end.

## Manual deployment (fallback)

On your local machine:

```bash
docker build -t huutoscraper3 .
docker save huutoscraper3 -o huutoscraper3.tar
scp -i C:\path\to\your-key.pem huutoscraper3.tar ubuntu@YOUR_INSTANCE_IP:~
```

SSH into the instance, then:

```bash
docker stop huutoscraper3
docker rm huutoscraper3
docker load < huutoscraper3.tar
docker run -d \
  --name huutoscraper3 \
  --restart unless-stopped \
  --shm-size=256m \
  -p 3002:3000 \
  huutoscraper3
```

## Docker image

The Dockerfile is a multi-stage build:

1. **client-build** — `npm ci` + `vite build`, outputs `dist/client/`
2. **server-build** — `npm ci` + `tsc`, outputs `dist/server/`
3. **Production image** — `node:20-slim` + Debian Chromium package, copies built files and production `node_modules`

Key environment variables baked into the image:

| Variable | Value |
|----------|-------|
| `PUPPETEER_SKIP_DOWNLOAD` | `true` (uses system Chromium, not Puppeteer's bundled one) |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium` |
| `PORT` | `3000` |

The `--shm-size=256m` flag is required — Chrome needs more shared memory than Docker's default 64MB.

## Server setup (from scratch)

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu
newgrp docker
```

### 2. Configure Caddy

Add to `/etc/caddy/Caddyfile`:

```
scraper.yourdomain.com {
    reverse_proxy localhost:3002
}
```

```bash
sudo systemctl reload caddy
```

Caddy provisions SSL certificates automatically. Ports 80 and 443 must be open in the Lightsail firewall.

### 3. DNS

Add an A record for `scraper.yourdomain.com` pointing to the instance's static IP.

### 4. Deploy

```bash
docker load < huutoscraper3.tar
docker run -d \
  --name huutoscraper3 \
  --restart unless-stopped \
  --shm-size=256m \
  -p 3002:3000 \
  huutoscraper3
```

## Resource requirements

- **Minimum:** 1 GB RAM (Lightsail Micro)
- **Recommended:** 2 GB RAM (Lightsail Small) for 5+ monitored URLs
- Chrome uses ~200-400 MB at runtime

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Container exits immediately | `docker logs huutoscraper3` |
| SSL error on subdomain | DNS not propagated yet, or ports 80/443 not open — check `sudo journalctl -u caddy --no-pager -n 50` |
| Scraping returns 0 listings | Site may have changed DOM structure — parser selectors need updating |
| Chrome crashes / OOM | Instance too small, or `--shm-size` not set |
