# Deployment

The app runs as a single Docker container on an AWS Lightsail instance, behind Caddy for SSL.

## Updating the app (quick reference)

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
