import { MopfsError } from "./error/errors.js";
import Result from "./result.js";
import utf8 from "./utf8.js";

const DOT = 46; // "." の UTF-8 コードポイント
const SLASH = 47; // "/" の UTF-8 コードポイント
let internalUse = false;

/**
 * ファイルパス
 */
export default class Path {
  /**
   * ファイルパスを解析します。
   *
   * @param path ファイルパス
   * @returns 解析結果
   */
  public static parse(path: string): Path {
    return new Path(path);
  }

  /**
   * ファイルパスが解析可能かどうか検証します。
   *
   * @param path ファイルパス
   * @returns 解析できるなら `true`、そうでないなら `false`
   */
  public static canParse(path: string): boolean {
    return encodePath(path).ok;
  }

  /**
   * ファイルパスを解析します。
   *
   * @param path ファイルパス
   * @returns 解析結果
   */
  public static safeParse(path: string): Result<Path> {
    const result = encodePath(path);
    if (!result.ok) {
      return result;
    }

    try {
      internalUse = true;
      // 内部利用ではエンコードのオーバーヘッドを減らすために `path` にバッファーを渡します。
      return Result.ok(new Path(result.value as any));
    } finally {
      internalUse = false;
    }
  }

  /**
   * ファイルパスが有効かどうか検証します。
   *
   * @param path ファイルパス
   * @returns 有効なら `true`、そうでないなら `false`
   */
  public static validate(path: string): boolean {
    const result = Path.safeParse(path);
    return result.ok && result.value.fullpath === path;
  }

  /**
   * ファイルパスが有効かどうか検証します。
   *
   * @param path ファイルパス
   * @returns 検証結果
   */
  public static safeValidate(path: string): Result<Path> {
    const result = Path.safeParse(path);
    return (result.ok && result.value.fullpath === path) || !result.ok
      ? result
      : Result.err(new Error("Invalid bucket name: needs transform"));
  }

  /**
   * ファイルパスのバイト列
   */
  readonly #pathBuff: Uint8Array;
  /**
   * ファイルパスの文字列表現
   */
  readonly #fullpath: string;
  // 以下キャッシュ
  #segments?: readonly string[];
  #dirname?: string;
  #basenameBuff?: Uint8Array | null;
  #basename?: string;
  #filename?: string;
  #extname?: string;

  /**
   * `Path` を構築します。
   *
   * @param path ファイルパス
   */
  public constructor(path: string) {
    if (internalUse) {
      // 内部利用ではエンコードのオーバーヘッドを減らすために `path` にバッファーが渡されます。
      const buff: unknown = path;
      if (!(buff instanceof Uint8Array)) {
        throw new Error("Invalid path: must be a Uint8Array");
      }

      this.#pathBuff = buff;
      this.#fullpath = utf8.decode(this.#pathBuff);
    } else {
      this.#pathBuff = encodePath(path).unwrap();
      this.#fullpath = path;
    }
  }

  /**
   * 完全なファイルパス
   */
  public get fullpath(): string {
    return this.#fullpath;
  }

  /**
   * ファイルパスのセグメントです。1 つ以上のセグメントを持ちます。一番最後のセグメントは `.basename` と同じです。
   */
  public get segments(): [...string[], string] {
    if (this.#segments === undefined) {
      const segments: string[] = [];
      let buff = this.#pathBuff;
      for (let i = 0, j = 0; j < this.#pathBuff.length; j++, i++) {
        if (this.#pathBuff[j] === SLASH) {
          segments.push(utf8.decode(buff.slice(0, i)));
          buff = buff.slice(i + 1);
          i = -1; // リセット
        }
      }

      segments.push(utf8.decode(buff));
      this.#basenameBuff = buff;
      this.#segments = segments;
    }

    const cloned = this.#segments.slice() as [...string[], string];
    return cloned;
  }

  /**
   * ディレクトリパスです。
   */
  public get dirname(): string {
    return this.#dirname ??= this.segments.slice(0, -1).join("/");
  }

  /**
   * 拡張子付きのファイル名です。
   *
   * @example "file.txt"
   */
  public get basename(): string {
    if (this.#basename === undefined) {
      const segments = this.segments;
      this.#basename = segments[segments.length - 1]!;
    }

    return this.#basename;
  }

  /**
   * 拡張子を除くファイル名です。
   */
  public get filename(): string {
    if (this.#filename === undefined) {
      this.segments; // ゲッターを呼び出して、this.#basenameBuff を計算します。
      let filename: Uint8Array;
      let extname: Uint8Array;
      const lastDotIndex = this.#basenameBuff!.lastIndexOf(DOT);
      if (lastDotIndex === -1 || lastDotIndex === 0) {
        filename = this.#basenameBuff!; // 例えば拡張子なしの Makefile や隠しファイルの .bashrc など
        extname = new Uint8Array(0);
      } else {
        filename = this.#basenameBuff!.slice(0, lastDotIndex);
        extname = this.#basenameBuff!.slice(lastDotIndex);
      }

      this.#filename = utf8.decode(filename);
      this.#extname = utf8.decode(extname);
      this.#basenameBuff = null; // 使い終わったので破棄
    }

    return this.#filename!;
  }

  /**
   * 拡張子です。ドット (.) から始まります。
   *
   * @example ".txt"
   */
  public get extname(): string {
    if (this.#extname === undefined) {
      this.filename; // this.#extname を計算します。
    }

    return this.#extname!;
  }

  /**
   * JSON 形式に変換します。
   *
   * @returns パスの文字列表現です。
   */
  public toJSON(): string {
    return this.#fullpath;
  }

  /**
   * 文字列に変換します。
   *
   * @returns パスの文字列表現です。
   */
  public toString(): string {
    return this.#fullpath;
  }

  /**
   * 複製します。
   *
   * @returns 複製された新しい `Path` です。
   */
  public clone(): Path {
    try {
      internalUse = true;
      // 内部利用ではエンコードのオーバーヘッドを減らすために `path` にバッファーを渡します。
      return new Path(this.#pathBuff as any);
    } finally {
      internalUse = false;
    }
  }
}

/**
 * ファイルパスを検証しつつエンコードします。
 *
 * @param path ファイルパス
 * @returns エンコード結果
 */
function encodePath(path: string): Result<Uint8Array> {
  if (typeof path !== "string") {
    return Result.err(new MopfsError("Invalid path: must be a string"));
  }

  // エンコードでオーバーヘッドが発生する前に .length で高速に検証します。
  if (path.length > 1024) {
    return Result.err(new MopfsError("Invalid path: cannot be longer than 1024 bytes"));
  }

  const encoded = utf8.encode(path);
  if (encoded.length > 1024) {
    return Result.err(new MopfsError("Invalid path: cannot be longer than 1024 bytes"));
  }
  if (!utf8.isValidUtf8(encoded)) {
    return Result.err(new MopfsError("Invalid path: malformed UTF-8"));
  }

  return Result.ok(encoded);
}
