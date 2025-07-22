import utf8 from "./utf8.js";

/**
 * `Uint8Array` になれる値の型です。
 */
export type Uint8ArraySource = string | ArrayBuffer | ArrayBufferView;

/**
 * `Uint8Array` に変換します。
 *
 * @param source `Uint8Array` になれる値
 * @returns `Uint8Array` に変換された値
 */
export default function toUint8Array(source: Uint8ArraySource): Uint8Array {
  switch (true) {
    case typeof source === "string":
      return utf8.encode(source);

    case source instanceof Uint8Array:
      return source;

    case ArrayBuffer.isView(source):
      return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);

    case isArrayBuffer(source):
      return new Uint8Array(source);

    default:
      throw new Error("Source that cannot be Uint8Array", {
        cause: source,
      });
  }
}

const toString = Object.prototype.toString;

/**
 * 引数に与えられた値が `ArrayBuffer` オブジェクトどうかを判定します。
 *
 * @param value `ArrayBuffer` オブジェクトを期待する値
 * @returns `value` が `ArrayBuffer` なら `true`、そうでなければ `false`
 */
function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return (
    value instanceof ArrayBuffer
    // Firefox では fetch のレスポンスボディーを ArrayBuffer にしたときにそれを instanceof
    // で判定できないようなので、タグ名で判定します。
    || toString.call(value) === "[object ArrayBuffer]"
  );
}
