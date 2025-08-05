import type { File as NodeFile } from "node:buffer";
import * as v from "valibot";
import FileIdent from "./file-ident.js";
import Path from "./path.js";
import * as schemas from "./schemas.js";

/**
 * ファイルに関する説明文とメタデータの操作を定義するインターフェースです。
 * このインターフェースは、`File` クラスが依存するカタログデータベースの抽象化を提供します。
 */
interface Catalog {
  /**
   * ファイルの説明文を取得します。
   *
   * @param inp ファイルの説明文を取得するための入力パラメーターです。
   * @returns ファイルの説明文を取得した結果です。
   */
  readDescription(
    inp: Readonly<{
      /**
       * バケット内のファイルパスです。
       */
      filePath: Path;
    }>,
  ): Promise<{
    /**
     * ファイルの説明文です。
     */
    description: string | null;
  }>;

  /**
   * ファイルのメタデータを取得します。
   *
   * @param inp ファイルのメタデータを取得するための入力パラメーターです。
   * @returns ファイルのメタデータを取得した結果です。
   */
  readMetadata(
    inp: Readonly<{
      /**
       * バケット内のファイルパスです。
       */
      filePath: Path;
    }>,
  ): Promise<{
    /**
     * ファイルのメタデータです。
     */
    metadata: unknown;
  }>;
}

/**
 * `File` を構築するための入力パラメーターです。
 */
type FileInput = Readonly<{
  /**
   * カタログデータベースです。
   */
  catalog: Catalog;

  /**
   * JavaScript の `File` オブジェクト、または Node.js の `File` オブジェクトです。
   */
  file: globalThis.File | NodeFile;

  /**
   * バケット名です。
   */
  bucketName: v.InferOutput<typeof schemas.BucketName>;

  /**
   * バケット内のファイルパスです。
   */
  filePath: Path;

  /**
   * ファイルのチェックサム (MD5 ハッシュ値) です。
   */
  checksum: v.InferOutput<typeof schemas.Checksum>;

  /**
   * ファイル形式です。
   */
  mimeType: v.InferOutput<typeof schemas.MimeType>;

  /**
   * ファイルサイズ (バイト数) です。
   */
  fileSize: v.InferOutput<typeof schemas.UnsignedInteger>;

  /**
   * 最終更新日 (ミリ秒) です。
   */
  lastModified: number;
}>;

/**
 * `File` の JSON 形式での表現を表す型です。
 */
export type FileJson = {
  /**
   * ファイルが存在するバケットの名前です。
   */
  bucketName: v.InferOutput<typeof schemas.BucketName>;

  /**
   * バケット内のファイルパスです。
   */
  path: Path;

  /**
   * ファイルサイズ (バイト数) です。
   */
  size: v.InferOutput<typeof schemas.UnsignedInteger>;

  /**
   * ファイル形式です。
   */
  type: v.InferOutput<typeof schemas.MimeType>;

  /**
   * ファイルのチェックサム (MD5 ハッシュ値) です。
   */
  checksum: v.InferOutput<typeof schemas.Checksum>;

  /**
   * 最終更新日 (ミリ秒) です。
   */
  lastModified: number;

  /**
   * `webkitdirectory` 属性が設定された `input` 要素でユーザーが選択した、祖先ディレクトリーを基準にしたファイルの相対パスです。
   */
  webkitRelativePath?: string;
};

/**
 * ファイルの情報を表すクラスです。
 */
export default class File {
  /**
   * ファイルの情報が保存されているカタログデータベースです。
   */
  readonly #catalog: Catalog;

  /**
   * ファイルの内容にアクセスするための元のファイルオブジェクトです。
   */
  readonly #file: globalThis.File | NodeFile;

  /**
   * ファイルが存在するバケットの名前です。
   */
  public readonly bucketName: v.InferOutput<typeof schemas.BucketName>;

  /**
   * バケット内のファイルパスです。
   */
  public readonly path: Path;

  /**
   * ファイルのチェックサム (MD5 ハッシュ値) です。
   */
  public readonly checksum: v.InferOutput<typeof schemas.Checksum>;

  /**
   * ファイルサイズ (バイト数) です。
   */
  public readonly size: v.InferOutput<typeof schemas.UnsignedInteger>;

  /**
   * ファイル形式です。
   */
  public readonly type: v.InferOutput<typeof schemas.MimeType>;

  /**
   * 最終更新日 (ミリ秒) です。
   */
  public readonly lastModified: number;

  /**
   * ユーザーが選択した祖先ディレクトリーを基準にしたファイルの相対パスです。
   * `webkitdirectory` 属性が設定された `input` 要素を通じて選択されたファイルにのみ存在します。
   */
  public readonly webkitRelativePath?: string;

  /**
   * `File` の新しいインスタンスを構築します。
   *
   * @param inp `File` を構築するための入力パラメーターです。
   */
  public constructor(inp: FileInput) {
    this.#catalog = inp.catalog;
    this.bucketName = inp.bucketName;
    this.path = inp.filePath;
    this.size = inp.fileSize;
    this.type = inp.mimeType;
    this.checksum = inp.checksum;
    this.lastModified = inp.lastModified;
    this.#file = inp.file;
    if ("webkitRelativePath" in inp.file) {
      this.webkitRelativePath = inp.file.webkitRelativePath;
    }
  }

  /**
   * ファイルの内容を `ArrayBuffer` で取得します。
   *
   * @returns `ArrayBuffer` 形式のファイルの内容です。
   */
  public async arrayBuffer(): Promise<ArrayBuffer> {
    return await this.#file.arrayBuffer();
  }

  /**
   * ファイルの内容を `Uint8Array` で取得します。
   *
   * @returns `Uint8Array` 形式のファイルの内容です。
   */
  public async bytes(): Promise<Uint8Array> {
    return await this.#file.bytes();
  }

  /**
   * ファイルの内容を `ReadableStream` で取得します。
   *
   * @returns `ReadableStream` 形式のファイルの内容です。
   */
  public stream(): ReadableStream<Uint8Array> {
    return this.#file.stream();
  }

  /**
   * ファイルの内容を文字列で取得します。
   *
   * @returns 文字列形式のファイルの内容です。
   */
  public async text(): Promise<string> {
    return await this.#file.text();
  }

  /**
   * このファイルのカタログから説明文を取得します。
   *
   * @returns ファイルの説明文です。説明文がない場合は `null` を返します。
   */
  public async getDescription(): Promise<string | null> {
    const out = await this.#catalog.readDescription({ filePath: this.path });
    return out.description;
  }

  /**
   * このファイルのカタログからメタデータを取得します。
   *
   * @returns ファイルのメタデータです。
   */
  public async getMetadata(): Promise<unknown> {
    const out = await this.#catalog.readMetadata({ filePath: this.path });
    return out.metadata;
  }

  /**
   * `File` のプロパティーを JSON 形式に変換します。主にテストやデバッグでの利用を想定しています。
   *
   * @returns JSON 形式の `File` です。
   */
  public toJSON(): FileJson {
    const json: FileJson = {
      path: this.path,
      size: this.size,
      type: this.type,
      checksum: this.checksum,
      bucketName: this.bucketName,
      lastModified: this.lastModified,
    };
    if (this.webkitRelativePath !== undefined) {
      json.webkitRelativePath = this.webkitRelativePath;
    }

    return json;
  }

  /**
   * `File` を `FileIdent` に変換します。
   *
   * @returns `FileIdent` です。
   */
  public toIdent(): FileIdent {
    return new FileIdent({
      filePath: this.path,
      bucketName: this.bucketName,
    });
  }
}
