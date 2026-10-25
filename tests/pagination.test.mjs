import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import vm from "node:vm";

const job = (id, extra = {}) => ({ id, url: `https://jobicy.com/jobs/${id}`, jobTitle: "Python engineer", ...extra });
const page = (jobs, nextCursor = null) => ({ jobs, nextCursor, hasMore: nextCursor !== null });
const jsonResponse = (body, options) => new Response(JSON.stringify(body), options);

for (const bot of ["discord-jobs-bot"]) {
  test(`${bot} traverses every page before local keyword filtering`, async (t) => {
    const { fetchJobs } = await import(`../src/jobicy.js`);
    const requests = [];
    const pages = [page([job(1, { jobTitle: "Design role" })], "opaque+/="), page([job(2)], "last"), page([job(2), job(3)])];
    t.mock.method(globalThis, "fetch", async (url) => {
      requests.push(new URL(url));
      return jsonResponse(pages.shift());
    });
    const jobs = await fetchJobs({ geo: "usa", keywords: "python,backend", project: bot });
    assert.deepEqual(jobs.map(({ id }) => id), [2, 3]);
    assert.equal(requests.length, 3);
    assert.equal(requests[1].searchParams.get("cursor"), "opaque+/=");
    assert.equal(requests[2].searchParams.get("geo"), "usa");
    globalThis.fetch = async () => jsonResponse(page([], "repeat"));
    await assert.rejects(fetchJobs({ project: bot }), /repeated cursor/);
  });

  test(`${bot} retains more than 2,000 visible IDs across restart and prunes absent IDs`, async () => {
    const { SeenJobStore } = await import(`../src/storage.js`);
    const directory = await mkdtemp(path.join(tmpdir(), "jobicy-state-"));
    try {
      const file = path.join(directory, "state.json");
      const store = new SeenJobStore(file);
      await store.load();
      const jobs = Array.from({ length: 2100 }, (_, index) => job(index));
      await store.baseline(jobs);
      const restored = new SeenJobStore(file);
      await restored.load();
      assert.equal(restored.initialized, true);
      assert.equal(restored.ids.size, 2100);
      assert.equal(jobs.every(({ id }) => restored.has(id)), true);
      await restored.retain([job(2099), job(2100)]);
      assert.equal(restored.has(0), false);
      assert.equal(restored.has(2099), true);
      assert.equal(restored.has(2100), false);
      await restored.remember(2100);
      assert.equal(restored.has(2100), true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

