# MentorBot

Discord bot that detects when users tag the **mentor role** outside working hours, replies politely in-channel with a link to a ChatGPT share-chat (self-help), and optionally DMs the user. Lightweight Node.js app ready for local development and deploy to Railway (or Docker).

---

## Features

* Detect role mention (mentor role) in messages.
* If outside configured working hours, reply in-channel with a friendly message + `SHARE_CHAT_URL`.
* Optional DM fallback if user allows DMs.
* Cooldown per-user to avoid spam.
* Small HTTP `/health` endpoint for easy uptime checks.

---

## Requirements

* Node.js **≥ 18**
* npm
* Discord bot token (from Developer Portal)
* GitHub repo for deploy (recommended)
* Railway account (or any host that supports long-running Node processes)

---

## Quick start (local)

1. Clone repo:

```bash
git clone <your-repo-url>
cd mentorbot
```

2. Copy `.env.example` to `.env` and fill values:

```bash
cp .env.example .env
# then edit .env
```

3. Install dependencies:

```bash
npm ci
```

4. Run locally:

```bash
node index.js
# or for development use: npm start
```

5. Check logs — you should see:

```
Health server listening on 8080
Bot ready: MentorBot#1234
```

6. Test in Discord: mention the mentor role (`@Mentor`) in a channel while your configured "outside hours" are active — the bot should reply.

---

## Environment variables

Add these to your `.env` (see `.env.example`):

```
DISCORD_TOKEN=                       # required, bot token from Discord Developer Portal
MENTOR_ROLE_ID=                      # required, role ID of mentors (Copy ID from Discord)
SHARE_CHAT_URL=https://...           # required, link to the ChatGPT share-chat
WORK_DAYS=1,2,3,4,5                  # optional, 1=Mon .. 7=Sun (default: weekdays)
WORK_START=9                         # optional, inclusive hour (Kyiv timezone)
WORK_END=18                          # optional, exclusive hour (Kyiv timezone)
KYIV_TZ=Europe/Kyiv                  # timezone for working hours
COOLDOWN_MS=3000                     # cooldown between triggers per user (ms)
FALLBACK_DM=true                     # whether to attempt DM fallback if public ping doesn't notify
HEALTH_PORT=8080                     # port for health endpoint
```

**Important:** Never commit `.env` or tokens to source control.

---

## Docker

Example `Dockerfile` (already included in repo):

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 8080
CMD ["npm", "start"]
```

Build & run locally:

```bash
docker build -t mentorbot:local .
docker run --env-file .env -d --name mentorbot mentorbot:local
docker logs -f mentorbot
```

---

## Deploy to Railway (summary)

1. Push your repo to GitHub.
2. Sign in to Railway and create a new project → **Deploy from GitHub**.
3. Select your repository; Railway auto-detects a Node project.
4. Set Start Command: `npm start` (if asked).
5. Add Environment Variables in Railway (same keys as `.env`).
6. Deploy and check logs in Railway dashboard.
7. Confirm bot is online in your Discord server.

Railway supports Docker builds if you prefer the Dockerfile route.

---

## Health check

The bot exposes a simple health endpoint:

```
GET /health -> 200 OK (body: ok)
```

Useful for monitoring and platform health probes (port from `HEALTH_PORT`).

---

## Handling DeprecationWarning: `ready` → `clientReady`

To avoid `DeprecationWarning: The ready event has been renamed to clientReady`, the code subscribes safely to readiness and includes a small guard. If you need, add the following near the top of `index.js` to *silence only that specific deprecation warning*:

```js
process.on('warning', (warning) => {
  if (
    warning.name === 'DeprecationWarning' &&
    /ready event has been renamed to clientReady/i.test(String(warning.message))
  ) return;
  console.warn(warning);
});
```

The repo's `index.js` already includes a safe `clientReady` handler; prefer to use that pattern.

---

## Troubleshooting

* **Bot not online**: check `DISCORD_TOKEN` is correct and bot is invited to server with required scopes/permissions.
* **Bot doesn’t read messages**: enable **Message Content Intent** in Discord Developer Portal AND ensure `GatewayIntentBits.MessageContent` is present in client options.
* **Role mention not notifying**: role must be *mentionable* in server settings for pings to produce notifications. This project defaults to *not pinging* roles; it replies in-channel and uses DM fallback.
* **DM fallback failing**: users may disable DMs from server members — it’s expected behavior.
* **Missing env var**: app logs will print which env var is missing and exit on required variables like `DISCORD_TOKEN` and `MENTOR_ROLE_ID`.
* **Node errors on start**: run `npm ci` locally and resolve missing deps, or check Node version.

---

## Security & Best practices

* Keep bot token secret — rotate token if it accidentally leaks.
* Run `npm audit` periodically.
* Use `npm ci` in CI/Docker for deterministic installs (commit `package-lock.json`).
* Limit bot permissions to the minimal set required (Send Messages, Read Message History).
* Monitor logs and set platform alerts for restarts/failures.

---

## Contributing

1. Fork → branch → PR.
2. Keep changes small and documented in commit message.
3. Run `npm ci` and test locally (`node index.js`) before opening PR.

---

## License

MIT.

