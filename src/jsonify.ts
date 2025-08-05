/**
 * オブジェクトを JSON 形式に変換します。`BigInt` は `Number` に変換します。
 * ただし、`Number.MAX_SAFE_INTEGER` を超える `BigInt` はエラーを投げます。
 *
 * @template T 変換後のオブジェクトの型です。
 * @param input 変換するオブジェクトです。
 * @returns JSON 形式に変換されたオブジェクトです。
 */
export default function jsonify<T = unknown>(input: unknown): T {
  return JSON.parse(JSON.stringify(input, bigIntReplacer));
}

/**
 * `Number.MAX_SAFE_INTEGER` を `BigInt` に変換した定数です。
 * これを超える `BigInt` は安全に `Number` に変換できません。
 */
const MAX_SAFE_INTEGER_B = /* @__PURE__ */ BigInt(Number.MAX_SAFE_INTEGER);

/**
 * `JSON.stringify` で使用される、`BigInt` を `Number` に変換するためのリプレイサー関数です。
 *
 * @param _key 現在のプロパティーのキーです。
 * @param value 現在処理中の値です。
 * @returns 変換された値、または元の値です。
 */
function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value !== "bigint") {
    return value;
  }

  if (value > MAX_SAFE_INTEGER_B) {
    throw new RangeError(`BigInt too large to convert to Number: ${value}`);
  }

  return Number(value);
}
