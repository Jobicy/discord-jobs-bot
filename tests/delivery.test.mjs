import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sendDiscordJob } from '../src/discord.js';

const webhook = 'https://discord.com/api/webhooks/123/test_token';
const job = { id: 1, url: 'https://jobicy.com/jobs/1', jobTitle: '@everyone <script>Role</script>', companyName: 'Example' };

test('Discord disables mentions, confirms delivery and preserves the source URL', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(new URL(url).searchParams.get('wait'), 'true');
    assert.equal(init.redirect, 'error');
    const body = JSON.parse(init.body);
    assert.deepEqual(body.allowed_mentions, { parse: [] });
    assert.equal(body.embeds[0].url, job.url);
    assert.doesNotMatch(body.embeds[0].title, /<script>/);
    assert.match(body.embeds[0].footer.text, /Jobicy/);
    return new Response('{}');
  });
  await sendDiscordJob(webhook, job);
});

test('Discord propagates rate limits without leaking the webhook', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ retry_after: 7200.2 }), { status: 429 }));
  await assert.rejects(sendDiscordJob(webhook, job), (error) => error.status === 429 && error.retryAfterSeconds === 7201 && !error.message.includes('test_token'));
  await assert.rejects(sendDiscordJob('https://example.com/api/webhooks/123/token', job), /official Discord/);
});
