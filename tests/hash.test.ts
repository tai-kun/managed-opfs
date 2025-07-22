import { describe, test } from "vitest";
import { hash } from "../src/index.js";

describe("digest", () => {
  test("同じデータに対しては常に同じ MD5 値を返す", async ({ expect }) => {
    const data = new TextEncoder().encode("こんにちは");
    const hash1 = await hash.digest(data);
    const hash2 = await hash.digest(data);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{32}$/);
  });

  test("異なるデータに対しては異なる MD5 値を返す", async ({ expect }) => {
    const data1 = new TextEncoder().encode("foo");
    const data2 = new TextEncoder().encode("bar");

    const digest1 = await hash.digest(data1);
    const digest2 = await hash.digest(data2);

    expect(digest1).not.toBe(digest2);
    expect(digest1).toMatch(/^[a-f0-9]{32}$/);
    expect(digest2).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe("create", () => {
  test("ストリームで複数回 update しても一括 digest の結果と一致する", async ({ expect }) => {
    const part1 = new TextEncoder().encode("Hello, ");
    const part2 = new TextEncoder().encode("world!");
    const all = new TextEncoder().encode("Hello, world!");

    const hashStream = await hash.create();
    hashStream.update(part1);
    hashStream.update(part2);
    const streamedDigest = hashStream.digest();
    const directDigest = await hash.digest(all);

    expect(streamedDigest).toBe(directDigest);
    expect(streamedDigest).toMatch(/^[a-f0-9]{32}$/);
  });

  test("空データに対する digest が期待通りのハッシュになる", async ({ expect }) => {
    const empty = new Uint8Array();
    const h = await hash.digest(empty);
    const expectedMD5 = "d41d8cd98f00b204e9800998ecf8427e"; // MD5("") の既知値

    expect(h).toBe(expectedMD5);
  });
});
