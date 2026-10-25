import { formatSalary, normalizeText } from "./jobicy.js";

function validateWebhook(value) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("DISCORD_WEBHOOK_URL must be a valid HTTPS URL");
  }

  const allowedHosts = new Set(["discord.com", "discordapp.com", "canary.discord.com", "ptb.discord.com"]);

  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || !allowedHosts.has(parsed.hostname) || !/^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+$/.test(parsed.pathname)) {
    throw new Error("DISCORD_WEBHOOK_URL must point to an official Discord incoming webhook");
  }

  return parsed;
}

export class DiscordError extends Error {
  constructor(status, retryAfterSeconds = null) {
    super(`Discord webhook returned HTTP ${status}`);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export async function sendDiscordJob(webhookUrl, job) {
  const endpoint = validateWebhook(webhookUrl);
  endpoint.searchParams.set("wait", "true");
  const salary = formatSalary(job);
  const fields = [
    { name: "Company", value: normalizeText(job.companyName || "Not specified", 200), inline: true },
    { name: "Location", value: normalizeText(job.jobGeo || "Not specified", 200), inline: true }
  ];

  if (salary) fields.push({ name: "Salary", value: salary, inline: false });

  const embed = {
    title: normalizeText(job.jobTitle || "Remote opportunity", 250),
    url: job.url,
    description: normalizeText(job.jobExcerpt, 800) || "Open the original Jobicy listing for full details.",
    color: 16163504,
    fields,
    footer: { text: "Jobs powered by Jobicy · https://jobicy.com/" }
  };

  if (typeof job.companyLogo === "string" && /^https:\/\//i.test(job.companyLogo)) {
    embed.thumbnail = { url: job.companyLogo };
  }

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Jobicy Jobs", embeds: [embed], allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    throw new Error("Discord request failed; check connectivity and webhook configuration");
  }

  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    const retry = Number(details.retry_after ?? response.headers.get("retry-after"));
    throw new DiscordError(response.status, Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : null);
  }
}
