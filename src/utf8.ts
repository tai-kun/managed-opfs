declare global {
  var managed_opfs__utf8__buffer: Uint8Array | undefined;
  var managed_opfs__utf8__decoder: TextDecoder | undefined;
  var managed_opfs__utf8__encoder: TextEncoder | undefined;
}

const KiB = 1024;
const BUFFER_SIZE = 6 * KiB;
const SAFE_STRING_LENGTH = 2 * KiB; // BUFFER_SIZE の 3 分の 1

export type Uint8ArrayLike =
  | Uint8Array
  | (typeof globalThis extends { Buffer: new(...args: any) => infer B } ? B : never);

export default {
  /**
   * 引数として渡されたバッファーを UTF-8 の形式でデコードした文字列を返します。
   *
   * @param input エンコードされたテキストが入っている `Uint8Array`
   * @returns UTF-8 の形式でデコードされた文字列
   */
  decode(input: AllowSharedBufferSource): string {
    return decoder().decode(input);
  },
  /**
   * 引数として渡された文字列をエンコードして `Uint8Array` を返します。
   *
   * @param input エンコードするテキストが入った文字列
   * @returns `Uint8Array`
   */
  encode(input: string): Uint8Array {
    if (input.length > SAFE_STRING_LENGTH) {
      // バッファーに収まらない可能性があるので、それを使わずにエンコードします。
      return encoder().encode(input);
    }

    // 高速化のために、文字列が一定の長さ以下であれば、事前に準備したバッファーに書き込むことで、頻繁なアロケーションを防止します。
    // 上の処理で文字列の長さが SAFE_STRING_LENGTH 以下であることは確定しています。
    // また、エンコード後の配列の長さが .length の 3 倍を超えることはないので、BUFFER_SIZE のバッファーに収まります。
    // 参考: https://developer.mozilla.org/docs/Web/API/TextEncoder/encodeInto
    const buf = buffer();
    const res = this.encodeInto(input, buf);
    return buf.slice(0, res.written); // コピー
  },
  /**
   * エンコードする文字列と、 UTF-8 エンコード後のテキスト格納先となるバッファーを受け取り、
   * エンコードの進行状況を示すオブジェクトを返します。
   *
   * @param input エンコードするテキストが入った文字列
   * @param dest バッファーに収まる範囲で　UTF-8 エンコードされたテキストが入ります。
   * @returns エンコード結果
   */
  encodeInto(input: string, dest: Uint8ArrayLike): TextEncoderEncodeIntoResult {
    return encoder().encodeInto(input, dest);
  },
  /**
   * 引数として渡された文字列またはバッファーが有効な UTF-8 文字列であるかどうかを返します。
   *
   * @param input 文字列またはバッファー
   * @returns `input` が有効な UTF-8 文字列である場合は `true` 、それ以外の場合は `false`
   */
  isValidUtf8(input: string | Uint8ArrayLike): boolean {
    if (typeof input === "string") {
      input = this.encode(input);
    }

    try {
      this.decode(input); // 不正な UTF-8 でエラーが投げられます。
      return true;
    } catch {
      return false;
    }
  },
};

function buffer(): Uint8Array {
  return globalThis.managed_opfs__utf8__buffer ||= new Uint8Array(BUFFER_SIZE);
}

function decoder(): TextDecoder {
  return globalThis.managed_opfs__utf8__decoder ||= new TextDecoder("utf-8", {
    // 文字列のデコードパフォーマンスは落ちるが、より厳格になる。
    fatal: true,
    ignoreBOM: true,
  });
}

function encoder(): TextEncoder {
  return globalThis.managed_opfs__utf8__encoder ||= new TextEncoder();
}
