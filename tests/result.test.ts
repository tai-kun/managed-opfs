import { describe, test } from "vitest";
import { Result } from "../src/index.js";

describe("Result.ok", () => {
  test("明示的な値を渡した場合、成功として扱われる", ({ expect }) => {
    const result = Result.ok(123);

    expect(result.ok).toBe(true);
    expect(result.value).toBe(123);
    expect(result.unwrap()).toBe(123);
    expect("reason" in result).toBe(false);
  });

  test("値を省略した場合、undefined を含む成功として扱われる", ({ expect }) => {
    const result = Result.ok();

    expect(result.ok).toBe(true);
    expect(result.value).toBe(undefined);
    expect(result.unwrap()).toBe(undefined);
    expect("reason" in result).toBe(false);
  });
});

describe("Result.err", () => {
  test("失敗原因を指定した場合、失敗として扱われる", ({ expect }) => {
    const error = new Error("失敗の理由");
    const result = Result.err(error);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe(error);
    expect("value" in result).toBe(false);
  });

  test("unwrap を呼び出すと原因を投げる", ({ expect }) => {
    const reason = "エラー文字列";
    const result = Result.err(reason);

    expect(() => result.unwrap()).toThrow(reason);
  });
});

describe("Result.try", () => {
  test("非同期関数が正常に完了した場合、成功の Result を返す", async ({ expect }) => {
    const result = await Result.try(async () => "成功値");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("成功値");
      expect(result.unwrap()).toBe("成功値");
    }
  });

  test("非同期関数が例外を投げた場合、失敗の Result を返す", async ({ expect }) => {
    const error = new Error("非同期の失敗");
    const result = await Result.try(async () => {
      throw error;
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe(error);
      expect(() => result.unwrap()).toThrow(error);
    }
  });
});
