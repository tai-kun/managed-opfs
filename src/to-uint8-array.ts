import { MopfsTypeError } from "./error/errors.js";
import utf8 from "./utf8.js";

/**
 * `Uint8Array` に変換可能な値の型です。
 */
export type Uint8ArraySource = string | ArrayBuffer | ArrayBufferView;

/**
 * 与えられた値を `Uint8Array` に変換します。
 *
 * @param source `Uint8Array` に変換する値です。`string`、`ArrayBuffer`、または `ArrayBufferView` を受け入れます。
 * @returns 変換された `Uint8Array` です。
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
      throw new MopfsTypeError("Uint8ArraySource", source);
  }
}

/**
 * `Object.prototype.toString` メソッドを定数として保持しています。
 * このメソッドは、オブジェクトのクラス名を文字列として取得するために使用されます。
 */
const toString = Object.prototype.toString;

/**
 * 引数に与えられた値が `ArrayBuffer` オブジェクトかどうかを判定します。
 *
 * @param value `ArrayBuffer` オブジェクトであるか検証する値です。
 * @returns `value` が `ArrayBuffer` オブジェクトであれば `true`、そうでなければ `false` です。
 */
function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return (
    value instanceof ArrayBuffer
    // Firefox では fetch のレスポンスボディーを ArrayBuffer にしたときにそれを instanceof
    // で判定できないようなので、タグ名で判定します。
    || toString.call(value) === "[object ArrayBuffer]"
  );
}
