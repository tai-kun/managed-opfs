import * as v from "valibot";
import { MopfsError } from "./error/errors.js";
import FileIdent from "./file-ident.js";
import type { Hash } from "./hash.js";
import mutex from "./mutex.js";
import Path from "./path.js";
import * as schemas from "./schemas.js";
import toUint8Array, { type Uint8ArraySource } from "./to-uint8-array.js";

/**
 * `Catalogdb` のインターフェースです。
 */
interface Catalog {
  /**
   * ファイルの付帯情報を更新します。
   *
   * @param options ファイルの付帯情報を更新するための入力パラメーターです。
   */
  update(
    options: {
      /**
       * バケット内のファイルパスです。
       */
      filePath: Path;
      /**
       * 実際に保存されているファイルの識別子です。
       */
      newEntityId: v.InferOutput<typeof schemas.EntityId> | undefined;
      /**
       * 実際に保存されていたファイルの識別子です。
       */
      oldEntityId: v.InferOutput<typeof schemas.EntityId> | undefined;
      /**
       * ファイルのチェックサム (MD5 ハッシュ値)
       */
      checksum: v.InferOutput<typeof schemas.Checksum> | undefined;
      /**
       * ファイル形式です。
       */
      mimeType: v.InferOutput<typeof schemas.MimeType> | undefined;
      /**
       * ファイルサイズ (バイト数) です。
       */
      fileSize: v.InferOutput<typeof schemas.UnsignedInteger> | undefined;
      /**
       * ファイルの説明文です。
       */
      description: string | null | undefined;
      /**
       * ファイルのメタデータです。
       */
      metadata: unknown | undefined;
    },
  ): Promise<void>;
}

/**
 * `ManagedOpfs` のインターフェースです。
 */
interface Manager {
  /**
   * `true` なら `ManagedOpfs` が利用可能です。
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
 * OPFS のディレクトリハンドラーのインターフェースです。
 */
interface MainDirHandle {
  /**
   * ディレクトリ直下から指定のアイテムを削除します。
   *
   * @param name 削除するアイテムです。
   */
  removeEntry(name: string): Promise<void>;
}

/**
 * `OverwritableFileStream` を構築するための入力パラメーターです。
 */
type OverwritableFileStreamInput = Readonly<{
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
   * 書き込み先のディレクトリハンドラーです。
   */
  mainDir: MainDirHandle;
  /**
   * 実際に保存されるファイルの識別子です。
   */
  newEntityId: v.InferOutput<typeof schemas.EntityId>;
  /**
   * 保存されていたファイルの識別子です。
   */
  oldEntityId: v.InferOutput<typeof schemas.EntityId>;
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
  description: string | null | undefined;
  /**
   * ファイルのメタデータです。
   */
  metadata: unknown | undefined;
  /**
   * 最終更新日 (ミリ秒) です。
   */
  lastModified: number;
}>;

/**
 * `OverwritableFileStream` の JSON 表現です。
 */
export type OverwritableFileStreamJson = {
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
  fileDescription?: string | null;
  /**
   * ファイルのメタデータです。
   */
  fileMetadata?: unknown;
};

export default class OverwritableFileStream {
  /**
   * カタログデータベース
   */
  #catalog: Catalog;
  /**
   * `ManagedOpfs`
   */
  #manager: Manager;
  /**
   * ログを記録する関数群
   */
  #logger: Logger;
  /**
   * 書き込み先のディレクトリハンドラー
   */
  #mainDir: MainDirHandle;
  /**
   * 実際に保存されるファイルの識別子
   */
  #newEntityId: v.InferOutput<typeof schemas.EntityId>;
  /**
   * 保存されていたファイルの識別子
   */
  #oldEntityId: v.InferOutput<typeof schemas.EntityId>;
  /**
   * `true` なら entityId を更新する
   */
  #updateEntityId: boolean;
  /**
   * ファイルの書き込みストリーム
   */
  #writer: Writer;
  /**
   * ハッシュ値を計算するためのストリーム
   */
  #hash: Hash;
  /**
   * ファイルサイズ
   */
  #size: v.InferOutput<typeof schemas.UnsignedInteger>;
  /**
   * ファイル形式
   */
  #type: v.InferOutput<typeof schemas.MimeType>;
  /**
   * ストリームが閉じているかどうか
   */
  #closed: boolean;
  /**
   * バケット名です。
   */
  public readonly bucketName: v.InferOutput<typeof schemas.BucketName>;
  /**
   * バケット内のファイルパスです。
   */
  public readonly filePath: Path;
  /**
   * ファイルの説明文です。
   */
  public fileDescription: string | null | undefined;
  /**
   * ファイルのメタデータです。
   */
  public fileMetadata: unknown | undefined;
  /**
   * 最終更新日 (ミリ秒) です。
   */
  public readonly lastModified: number;

  /**
   * `OverwritableFileStream` を構築します。
   *
   * @param inp `OverwritableFileStream` を構築するための入力パラメーターです。
   */
  public constructor(inp: OverwritableFileStreamInput) {
    this.#catalog = inp.catalog;
    this.#manager = inp.manager;
    this.#logger = inp.logger;
    this.#mainDir = inp.mainDir;
    this.#newEntityId = inp.newEntityId;
    this.#oldEntityId = inp.oldEntityId;
    this.#updateEntityId = false;
    this.#writer = inp.writer;
    this.#hash = inp.hash;
    this.#size = 0 as v.InferOutput<typeof schemas.UnsignedInteger>;
    this.#type = inp.mimeType;
    this.#closed = false;
    this.bucketName = inp.bucketName;
    this.filePath = inp.filePath;
    this.fileDescription = inp.description;
    this.fileMetadata = inp.metadata;
    this.lastModified = inp.lastModified;
  }

  /**
   * ファイルサイズです。
   */
  get fileSize(): v.InferOutput<typeof schemas.UnsignedInteger> {
    return this.#size;
  }

  /**
   * ファイル形式です。
   */
  get fileType(): v.InferOutput<typeof schemas.MimeType> {
    return this.#type;
  }

  /**
   * ファイル形式です。
   */
  set fileType(value: string) {
    this.#type = v.parse(schemas.MimeType, value);
  }

  /**
   * ストリームにチャンクデータを書き込みます。
   *
   * @param chunk `Uint8Array` になれるチャンクデータです。
   */
  @mutex
  public async write(chunk: Uint8ArraySource): Promise<void> {
    if (!this.#manager.opened) {
      // カタログに記録できないので、ファイルを書き込まずに中断します。
      try {
        await this.#writer.abort(
          "Failed to write to OverwritableFileStream: ManagedOpfs not open: stream closed",
        );
      } catch (ex) {
        this.#logger.error(
          "OverwritableFileStream.write: Failed to abort OverwritableFileStream",
          ex,
        );
      }

      // 書き込みを中断したので、新しいエンティティを破棄します。
      try {
        await this.#mainDir.removeEntry(this.#newEntityId);
      } catch (ex) {
        this.#logger.error(
          "OverwritableFileStream.write: Failed to remove new entity file: " + this.#newEntityId,
          ex,
        );
      }

      throw new MopfsError("Failed to write to OverwritableFileStream: ManagedOpfs not open");
    }

    // 一度でも書き込み処理が行われれば、データも更新します。
    this.#updateEntityId = true;

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
   * ストリームを終了します。
   */
  @mutex
  public async close(): Promise<void> {
    if (!this.#manager.opened) {
      // カタログに記録できないので、ファイルを書き込まずに中断します。
      try {
        await this.#writer.abort(
          "Failed to close OverwritableFileStream: ManagedOpfs not open: stream closed",
        );
      } catch (ex) {
        this.#logger.error(
          "OverwritableFileStream.close: Failed to abort OverwritableFileStream",
          ex,
        );
      }

      // 書き込みを中断したので、新しいエンティティを破棄します。
      try {
        await this.#mainDir.removeEntry(this.#newEntityId);
      } catch (ex) {
        this.#logger.error(
          "OverwritableFileStream.close: Failed to remove new entity file: " + this.#newEntityId,
          ex,
        );
      }

      throw new MopfsError("Failed to close OverwritableFileStream: ManagedOpfs not open");
    }

    if (this.#closed) {
      // 後ろの処理でエラーを投げるとエンティティが削除されてしまうため、
      // すでにストリームが閉じられている場合はここでエラーを投げます。
      throw new MopfsError("Failed to close OverwritableFileStream: stream closed");
    }

    if (this.#updateEntityId) {
      try {
        await this.#writer.close(); // 書き込みます。
        await this.#catalog.update({
          checksum: this.#hash.digest(),
          filePath: this.filePath,
          fileSize: this.#size,
          metadata: this.fileMetadata,
          mimeType: this.#type,
          description: this.fileDescription,
          newEntityId: this.#newEntityId,
          oldEntityId: this.#oldEntityId,
        });
      } catch (ex) {
        // 書き込みに失敗したので、新しいエンティティを破棄します。
        try {
          await this.#mainDir.removeEntry(this.#newEntityId);
        } catch (ex) {
          this.#logger.error(
            "OverwritableFileStream.close: Failed to remove new entity file: " + this.#newEntityId,
            ex,
          );
        }

        throw ex;
      } finally {
        this.#closed = true;
      }

      // 新しいエンティティの書き込みとデータベースの更新が正常に終わり古いエンティティは不要なので削除します。
      try {
        await this.#mainDir.removeEntry(this.#oldEntityId);
      } catch (ex) {
        this.#logger.error(
          "OverwritableFileStream.close: Failed to remove old entity file: " + this.#oldEntityId,
          ex,
        );
      }
    } else {
      try {
        await this.#catalog.update({
          checksum: undefined,
          filePath: this.filePath,
          fileSize: undefined,
          metadata: this.fileMetadata,
          mimeType: this.#type,
          description: this.fileDescription,
          newEntityId: undefined,
          oldEntityId: undefined,
        });
      } finally {
        this.#closed = true;
        // 新しいエンティティへの書き込みは一度もなく不要になったので削除します。
        try {
          await this.#writer.abort();
          await this.#mainDir.removeEntry(this.#newEntityId);
        } catch (ex) {
          this.#logger.error(
            "OverwritableFileStream.close: Failed to remove new entity file: " + this.#newEntityId,
            ex,
          );
        }
      }
    }
  }

  /**
   * ストリームを中断します。
   *
   * @param reason 中断の理由です。
   */
  @mutex
  public async abort(reason?: unknown): Promise<void> {
    if (this.#closed) {
      // 後ろの処理でエラーを投げるとエンティティが削除されてしまうため、
      // すでにストリームが閉じられている場合はここでエラーを投げます。
      throw new MopfsError("Failed to abort OverwritableFileStream: stream closed");
    }

    try {
      await this.#writer.abort(reason);
    } finally {
      this.#closed = true;
      // 書き込みを中断したので、新しいエンティティを破棄します。
      try {
        await this.#mainDir.removeEntry(this.#newEntityId);
      } catch (ex) {
        this.#logger.error(
          "OverwritableFileStream.abort: Failed to remove new entity file: " + this.#newEntityId,
          ex,
        );
      }
    }
  }

  /**
   * `OverwritableFileStream` を JSON 形式にします。これは主にテスト/プリントデバッグ用です。
   *
   * @returns JSON 形式の `OverwritableFileStream` です。
   */
  public toJSON(): OverwritableFileStreamJson {
    const json: OverwritableFileStreamJson = {
      filePath: this.filePath,
      fileSize: this.#size,
      fileType: this.#type,
      bucketName: this.bucketName,
    };
    if (this.fileDescription !== undefined) {
      json.fileDescription = this.fileDescription;
    }
    if (this.fileMetadata !== undefined) {
      json.fileMetadata = this.fileMetadata;
    }

    return json;
  }

  /**
   * `OverwritableFileStream` を `FileIdent` に変換します。
   *
   * @returns `FileIdent` です。
   */
  public toIdent(): FileIdent {
    return new FileIdent({
      filePath: this.filePath,
      bucketName: this.bucketName,
    });
  }
}
