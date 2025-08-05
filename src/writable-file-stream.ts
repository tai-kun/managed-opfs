import * as v from "valibot";
import { MopfsError } from "./error/errors.js";
import FileIdent from "./file-ident.js";
import type { Hash } from "./hash.js";
import mutex from "./mutex.js";
import Path from "./path.js";
import * as schemas from "./schemas.js";
import toUint8Array, { type Uint8ArraySource } from "./to-uint8-array.js";

/**
 * ファイルに関する説明文とメタデータの操作を定義するインターフェースです。
 * このインターフェースは、`File` クラスが依存するカタログデータベースの抽象化を提供します。
 */
interface Catalog {
  /**
   * ファイルの付帯情報を作成します。
   *
   * @param options ファイルの付帯情報を作成するための入力パラメーターです。
   */
  create(
    options: {
      /**
       * バケット内のファイルパスです。
       */
      filePath: Path;

      /**
       * 実際に保存されるファイルの識別子です。
       */
      entityId: v.InferOutput<typeof schemas.EntityId>;

      /**
       * ファイルのチェックサム (MD5 ハッシュ値) です。
       */
      checksum: v.InferOutput<typeof schemas.Checksum>;

      /**
       * ファイル形式です。`undefined` の場合はファイルパスから自動判定されます。
       */
      mimeType: v.InferOutput<typeof schemas.MimeType> | undefined;

      /**
       * ファイルサイズ (バイト数) です。
       */
      fileSize: v.InferOutput<typeof schemas.UnsignedInteger>;

      /**
       * ファイルの説明文です。
       *
       * @default null
       */
      description: string | null | undefined;

      /**
       * ファイルのメタデータです。
       *
       * @default null
       */
      metadata: unknown;
    },
  ): Promise<void>;
}

/**
 * `ManagedOpfs` のインターフェースです。
 */
interface Manager {
  /**
   * `ManagedOpfs` が利用可能かどうかを返します。
   */
  get opened(): boolean;
}

/**
 * ログを記録する関数群のインターフェースです。
 */
interface Logger {
  /**
   * エラーメッセージを記録します。
   *
   * @param message エラーメッセージです。
   * @param reason エラーの原因です。
   */
  error(message: string, reason: unknown): void;
}

/**
 * ファイルを書き込むストリームのインターフェースです。
 */
interface Writer {
  /**
   * チャンクデータを書き込みます。
   *
   * @param chunk チャンクデータです。
   */
  write(chunk: Uint8Array): Promise<void>;

  /**
   * ストリームを終了します。
   */
  close(): Promise<void>;

  /**
   * ストリームを中断します。
   *
   * @param reason 中断の理由です。
   */
  abort(reason?: unknown): Promise<void>;
}

/**
 * OPFS のディレクトリーハンドラーのインターフェースです。
 */
interface MainDirHandle {
  /**
   * ディレクトリー直下から指定のアイテムを削除します。
   *
   * @param name 削除するアイテムの名前です。
   */
  removeEntry(name: string): Promise<void>;
}

/**
 * `WritableFileStream` を構築するための入力パラメーターです。
 */
type WritableFileStreamInput = Readonly<{
  /**
   * カタログデータベースです。
   */
  catalog: Catalog;

  /**
   * `ManagedOpfs` です。
   */
  manager: Manager;

  /**
   * ログを記録する関数群です。
   */
  logger: Logger;

  /**
   * 書き込み先のディレクトリーハンドラーです。
   */
  mainDir: MainDirHandle;

  /**
   * 実際に保存されるファイルの識別子です。
   */
  entityId: v.InferOutput<typeof schemas.EntityId>;

  /**
   * ファイルの書き込みストリームです。
   */
  writer: Writer;

  /**
   * ハッシュ値を計算するためのストリームです。
   */
  hash: Hash;

  /**
   * バケット名です。
   */
  bucketName: v.InferOutput<typeof schemas.BucketName>;

  /**
   * バケット内のファイルパスです。
   */
  filePath: Path;

  /**
   * ファイル形式です。
   */
  mimeType: v.InferOutput<typeof schemas.MimeType>;

  /**
   * ファイルの説明文です。
   */
  description: string | null;

  /**
   * ファイルのメタデータです。
   */
  metadata: unknown;
}>;

/**
 * `WritableFileStream` の JSON 表現です。
 */
export type WritableFileStreamJson = {
  /**
   * バケット名です。
   */
  bucketName: v.InferOutput<typeof schemas.BucketName>;

  /**
   * バケット内のファイルパスです。
   */
  filePath: Path;

  /**
   * ファイルサイズ (バイト数) です。
   */
  fileSize: v.InferOutput<typeof schemas.UnsignedInteger>;

  /**
   * ファイル形式です。
   */
  fileType: v.InferOutput<typeof schemas.MimeType>;

  /**
   * ファイルの説明文です。
   */
  fileDescription: string | null;

  /**
   * ファイルのメタデータです。
   */
  fileMetadata: unknown;
};

/**
 * ファイルにデータを書き込むためのストリームクラスです。
 */
export default class WritableFileStream {
  /**
   * カタログデータベースです。
   */
  #catalog: Catalog;

  /**
   * `ManagedOpfs` のインスタンスです。
   */
  #manager: Manager;

  /**
   * ログを記録する関数群です。
   */
  #logger: Logger;

  /**
   * 書き込み先のディレクトリーハンドラーです。
   */
  #mainDir: MainDirHandle;

  /**
   * 実際に保存されるファイルの識別子です。
   */
  #entityId: v.InferOutput<typeof schemas.EntityId>;

  /**
   * ファイルの書き込みストリームです。
   */
  #writer: Writer;

  /**
   * ハッシュ値を計算するためのストリームです。
   */
  #hash: Hash;

  /**
   * ファイルサイズです。
   */
  #size: v.InferOutput<typeof schemas.UnsignedInteger>;

  /**
   * ファイル形式です。
   */
  #type: v.InferOutput<typeof schemas.MimeType>;

  /**
   * ストリームが閉じているかどうかを示します。
   */
  #closed: boolean;

  /**
   * このストリームが属するバケット名です。
   */
  public readonly bucketName: v.InferOutput<typeof schemas.BucketName>;

  /**
   * このストリームが書き込む先のバケット内のファイルパスです。
   */
  public readonly filePath: Path;

  /**
   * ファイルの説明文です。
   */
  public fileDescription: string | null;

  /**
   * ファイルのメタデータです。
   */
  public fileMetadata: unknown;

  /**
   * `WritableFileStream` の新しいインスタンスを構築します。
   *
   * @param inp `WritableFileStream` を構築するための入力パラメーターです。
   */
  public constructor(inp: WritableFileStreamInput) {
    this.#catalog = inp.catalog;
    this.#manager = inp.manager;
    this.#logger = inp.logger;
    this.#mainDir = inp.mainDir;
    this.#entityId = inp.entityId;
    this.#writer = inp.writer;
    this.#hash = inp.hash;
    this.#size = 0 as v.InferOutput<typeof schemas.UnsignedInteger>;
    this.#type = inp.mimeType;
    this.#closed = false;
    this.bucketName = inp.bucketName;
    this.filePath = inp.filePath;
    this.fileDescription = inp.description;
    this.fileMetadata = inp.metadata;
  }

  /**
   * 書き込まれたファイルのサイズ (バイト数) を取得します。
   */
  get fileSize(): v.InferOutput<typeof schemas.UnsignedInteger> {
    return this.#size;
  }

  /**
   * 書き込まれたファイルの形式 (MIME タイプ) を取得します。
   */
  get fileType(): v.InferOutput<typeof schemas.MimeType> {
    return this.#type;
  }

  /**
   * 書き込まれたファイルの形式 (MIME タイプ) を設定します。
   *
   * @param value 設定する MIME タイプです。
   */
  set fileType(value: string) {
    this.#type = v.parse(schemas.MimeType, value);
  }

  /**
   * ストリームにチャンクデータを書き込みます。
   *
   * @param chunk `Uint8Array` に変換できるチャンクデータです。
   * @throws `ManagedOpfs` が開かれていない場合は、エラーを投げます。
   */
  @mutex
  public async write(chunk: Uint8ArraySource): Promise<void> {
    if (!this.#manager.opened) {
      // カタログに記録できないので、ファイルを書き込まずに中断します。
      try {
        await this.#writer.abort(
          "Failed to write to WritableFileStream: ManagedOpfs not open: stream closed",
        );
      } catch (ex) {
        this.#logger.error("WritableFileStream.write: Failed to abort WritableFileStream", ex);
      }

      // 書き込みを中断したので、新しいエンティティーを破棄します。
      try {
        await this.#mainDir.removeEntry(this.#entityId);
      } catch (ex) {
        this.#logger.error(
          "WritableFileStream.write: Failed to remove entity file: " + this.#entityId,
          ex,
        );
      }

      throw new MopfsError("Failed to write to WritableFileStream: ManagedOpfs not open");
    }

    const view = toUint8Array(chunk);
    if (view.byteLength === 0) {
      return;
    }

    const size = v.parse(schemas.UnsignedInteger, this.#size + view.byteLength);
    await this.#writer.write(view);
    this.#size = size;
    this.#hash.update(view);
  }

  /**
   * ストリームを終了します。これにより、ファイルデータと付帯情報が永続化されます。
   *
   * @throws `ManagedOpfs` が開かれていない場合やストリームがすでに閉じられている場合は、エラーを投げます。
   */
  @mutex
  public async close(): Promise<void> {
    if (!this.#manager.opened) {
      // カタログに記録できないので、ファイルを書き込まずに中断します。
      try {
        await this.#writer.abort(
          "Failed to close WritableFileStream: ManagedOpfs not open: stream closed",
        );
      } catch (ex) {
        this.#logger.error("WritableFileStream.close: Failed to abort WritableFileStream", ex);
      }

      // 書き込みを中断したので、新しいエンティティーを破棄します。
      try {
        await this.#mainDir.removeEntry(this.#entityId);
      } catch (ex) {
        this.#logger.error(
          "WritableFileStream.close: Failed to remove entity file: " + this.#entityId,
          ex,
        );
      }

      throw new MopfsError("Failed to close WritableFileStream: ManagedOpfs not open");
    }

    if (this.#closed) {
      // 後ろの処理でエラーを投げるとエンティティーが削除されてしまうため、
      // すでにストリームが閉じられている場合はここでエラーを投げます。
      throw new MopfsError("Failed to close WritableFileStream: stream closed");
    }

    try {
      await this.#writer.close(); // 書き込みます。
      await this.#catalog.create({
        checksum: this.#hash.digest(),
        entityId: this.#entityId,
        filePath: this.filePath,
        fileSize: this.#size,
        metadata: this.fileMetadata,
        mimeType: this.#type,
        description: this.fileDescription,
      });
    } catch (ex) {
      // 書き込みに失敗したので、新しいエンティティーを破棄します。
      try {
        await this.#mainDir.removeEntry(this.#entityId);
      } catch (ex) {
        this.#logger.error(
          "WritableFileStream.close: Failed to remove entity file: " + this.#entityId,
          ex,
        );
      }

      throw ex;
    } finally {
      this.#closed = true;
    }
  }

  /**
   * ストリームを中断します。
   *
   * @param reason 中断の理由です。
   * @throws ストリームがすでに閉じられている場合は、エラーを投げます。
   */
  @mutex
  public async abort(reason?: unknown): Promise<void> {
    if (this.#closed) {
      // 後ろの処理でエラーを投げるとエンティティーが削除されてしまうため、
      // すでにストリームが閉じられている場合はここでエラーを投げます。
      throw new MopfsError("Failed to abort WritableFileStream: stream closed");
    }

    try {
      await this.#writer.abort(reason);
    } finally {
      this.#closed = true;
      // 書き込みを中断したので、新しいエンティティーを破棄します。
      try {
        await this.#mainDir.removeEntry(this.#entityId);
      } catch (ex) {
        this.#logger.error(
          "WritableFileStream.abort: Failed to remove entity file: " + this.#entityId,
          ex,
        );
      }
    }
  }

  /**
   * `WritableFileStream` を JSON 形式に変換します。これは主にテストやデバッグ目的で使用されます。
   *
   * @returns JSON 形式の `WritableFileStream` のデータです。
   */
  public toJSON(): WritableFileStreamJson {
    const json: WritableFileStreamJson = {
      filePath: this.filePath,
      fileSize: this.#size,
      fileType: this.#type,
      bucketName: this.bucketName,
      fileMetadata: this.fileMetadata,
      fileDescription: this.fileDescription,
    };

    return json;
  }

  /**
   * `WritableFileStream` の内容を `FileIdent` に変換します。
   *
   * @returns `FileIdent` の新しいインスタンスです。
   */
  public toIdent(): FileIdent {
    return new FileIdent({
      filePath: this.filePath,
      bucketName: this.bucketName,
    });
  }
}
