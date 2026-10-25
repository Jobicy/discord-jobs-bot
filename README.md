# Jobicy Discord Bot

Send new remote jobs to a Discord channel through an official incoming webhook. No Discord Gateway bot or privileged intents are required.

## Create a webhook

1. Open the target Discord channel's settings.
2. Choose **Integrations → Webhooks → New Webhook**.
3. Select the destination channel and copy the webhook URL.
4. Keep the URL private: possession of the URL allows posting to that channel.

```bash
git clone https://github.com/Jobicy/discord-jobs-bot.git
cd discord-jobs-bot
cp .env.example .env
npm ci
npm start
```

Set `DISCORD_WEBHOOK_URL` in `.env`. Optionally configure official `JOBICY_GEO` and `JOBICY_INDUSTRY` slugs, plus comma-separated case-insensitive `JOBICY_KEYWORDS`.

Requires Node.js 22+. The default and minimum synchronization interval is one hour (`CHECK_INTERVAL_SECONDS=3600`). Each pass requests pages of 100 jobs using `nextCursor` until the seven-day feed is exhausted. Filters remain fixed within a pass. HTTP 429 responses extend the delay using `Retry-After` when available; failed traversals are retried from the first page on a later pass.

The first successful full traversal establishes a silent baseline. New jobs discovered afterward are posted as Discord embeds with title, company, location, optional salary, optional employer logo, description, original Jobicy URL, and attribution. Previously posted IDs from the current matching seven-day feed persist in `data/seen-jobs.json`. A corrupt state file rebuilds the baseline rather than replaying old jobs.

IDs are pruned only after a successful full traversal, avoiding duplicates caused by a fixed ID-count cap. If you change filters and want a new silent baseline, stop the bot and remove its state file before restarting. Cursors are used only during a pass, expire after 24 hours, and are never stored as a long-term polling checkpoint.

[OpenAPI JSON](https://jobicy.com/api/openapi.json) · [OpenAPI YAML](https://jobicy.com/api/openapi.yaml)

## Stored listings

If you extend this integration to retain listings, use the [batch status endpoint](https://github.com/Jobicy/remote-jobs-api#batch-status-check) to check up to 100 IDs at a time. Older open jobs can remain `active` after leaving the seven-day feed. Do not mark jobs closed just because a fresh feed omits them, or because a check returns `unknown` or fails. The sample does not automatically reconcile stored listings.

## Deploy with Docker Compose

```bash
cp .env.example .env
# Set DISCORD_WEBHOOK_URL and optional filters.
docker compose up -d --build
docker compose logs -f
```

Keep the `jobicy-discord-data` volume. Run one worker per state directory; multiple independent copies can post duplicates. A crash after Discord accepted a message but before its ID was saved can also cause a repeated message. Delivery is not exactly once. Corrupt or deleted state starts a fresh silent baseline. Interval values are clamped between one hour and one week.

The sender disables all Discord mentions, waits for delivery confirmation and rejects redirects. HTTP 429 metadata extends the next polling delay. Never commit the webhook URL. Stop with `docker compose down`; it preserves the state volume.

## Checks

```bash
npm test
npm run check
```

Tests verify pagination, persisted IDs, outgoing embed/source fields, disabled mentions and rate-limit metadata. They do not send messages to Discord. Validate your own webhook and channel permissions before leaving the bot running.

[All integrations](https://github.com/Jobicy/jobicy-api-examples) · [MIT license](LICENSE) · [Data terms](PROVENANCE.md)
