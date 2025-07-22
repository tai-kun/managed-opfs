import { test, vi } from "vitest";
import mutex from "../src/mutex.js";

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

test("同時実行性が 1 である", async ({ expect }) => {
  using spy = vi.spyOn(console, "log").mockImplementation(() => {});

  class Runner {
    async runWithoutMutex(ms: number, value: string) {
      await sleep(ms);
      console.log(value);
    }

    @mutex
    async runWithMutex(ms: number, value: string) {
      await sleep(ms);
      console.log(value);
    }
  }

  const runner = new Runner();
  // without mutex
  await Promise.all([
    runner.runWithoutMutex(400, "A"),
    runner.runWithoutMutex(200, "B"),
    runner.runWithoutMutex(0, "C"),
  ]);
  // with mutex
  await Promise.all([
    runner.runWithMutex(400, "A"),
    runner.runWithMutex(200, "B"),
    runner.runWithMutex(0, "C"),
  ]);
  await vi.waitUntil(() => spy.mock.calls.length === 6);

  expect(spy.mock.calls).toStrictEqual([
    // without mutex
    ["C"],
    ["B"],
    ["A"],
    // with mutex
    ["A"],
    ["B"],
    ["C"],
  ]);
});
