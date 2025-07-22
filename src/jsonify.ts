/**
 * JSON 形式のオブジェクトに変換します。BigInt は Number に変換します。。
 * ただし、`Number.MAX_SAFE_INTEGER` を超える `BigInt` はエラーになります。
 *
 * @param input オブジェクトです。
 * @returns JSON 形式のオブジェクトです。
 */
export default function jsonify<T = unknown>(input: unknown): T {
  return JSON.parse(JSON.stringify(input, bigIntReplacer));
}

const MAX_SAFE_INTEGER_B = /* @__PURE__ */ BigInt(Number.MAX_SAFE_INTEGER);

function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value !== "bigint") {
    return value;
  }

  if (value > MAX_SAFE_INTEGER_B) {
    throw new RangeError(`BigInt too large to convert to Number: ${value}`);
  }

  return Number(value);
}
