import { test } from "vitest";
import jsonify from "../src/jsonify.js";

test("BigInt を Number に変換して JSON に変換できること", ({ expect }) => {
  const input = { id: BigInt(1234567890) };
  const result = jsonify<typeof input>(input);

  expect(result).toEqual({ id: 1234567890 });
  expect(result.id).toBeTypeOf("number");
});

test("BigInt が Number.MAX_SAFE_INTEGER を超える場合は例外を投げること", ({ expect }) => {
  const input = { value: BigInt(Number.MAX_SAFE_INTEGER) + 1n };

  expect(() => jsonify(input))
    .toThrow("BigInt too large to convert to Number: 9007199254740992");
});

test("BigInt を含まない通常のオブジェクトはそのまま変換されること", ({ expect }) => {
  const input = { name: "太郎", age: 30, isAdmin: true };
  const result = jsonify<typeof input>(input);

  expect(result).toEqual(input);
});

test("ネストされたオブジェクト内の BigInt も適切に変換されること", ({ expect }) => {
  const input = {
    user: {
      id: BigInt(42),
      profile: { followers: BigInt(1000) },
    },
  };
  const result = jsonify<typeof input>(input);

  expect(result).toEqual({
    user: {
      id: 42,
      profile: { followers: 1000 },
    },
  });
  expect(result.user.id).toBeTypeOf("number");
  expect(result.user.profile.followers).toBeTypeOf("number");
});

test("BigInt を含む配列が適切に変換されること", ({ expect }) => {
  const input = [1n, 2n, 3n];
  const result = jsonify<number[]>(input);

  expect(result).toEqual([1, 2, 3]);
});
