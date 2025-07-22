import type { File as NodeFile } from "node:buffer";
import * as v from "valibot";
import type Catalogdb from "./catalogdb.js";
import FileIdent from "./file-ident.js";
import Path from "./path.js";
import * as schemas from "./schemas.js";

/**
 * `File` を構築するための入力パラメーターです。
 */
type FileInput = Readonly<{
  /**
   * カタログデータベースです。
   */
  catalog: Catalogdb;
  /**
   * JavaScript のファイルオブジェクトです。
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

export type FileJson = {
  /**
   * バケット名です。
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
   * `webkitdirectory` 属性が設定された `input` 要素において、ユーザーが選択したディレクトリーに対するファイルのパスです。
   */
  webkitRelativePath?: string;
};

export default class File {
  /**
   * カタログデータベース
   */
  readonly #catalog: Catalogdb;
  /**
   * JavaScript のファイルオブジェクト
   */
  readonly #file: globalThis.File | NodeFile;
  /**
   * バケット名です。
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
   * ユーザーが選択した祖先ディレクトリーを基準にしたファイルのパスを含む文字列
   */
  public readonly webkitRelativePath?: string;

  /**
   * `File` を構築します。
   *
   * @param inp `File` を構築するための入力パラメーターです。`
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
   * ファイルの説明文を取得します。
   *
   * @returns ファイルの説明文です。
   */
  public async getDescription(): Promise<string | null> {
    const out = await this.#catalog.readDescription({ filePath: this.path });
    return out.description;
  }

  /**
   * ファイルのメタデータを取得します。
   *
   * @returns ファイルのメタデータです。
   */
  public async getMetadata(): Promise<unknown> {
    const out = await this.#catalog.readMetadata({ filePath: this.path });
    return out.metadata;
  }

  /**
   * `File` を JSON 形式にします。これは主にテスト/プリントデバッグ用です。
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
