import * as v from "valibot";
import type BucketName from "./bucket-name.js";
import type { DuckdbBundle, DuckdbLogger, Json, ToFullTextSearchString } from "./catalogdb.js";
import Catalogdb from "./catalogdb.js";
import { MopfsError, MopfsFileExistsError, MopfsFileNotFoundError } from "./error/errors.js";
import FileIdent from "./file-ident.js";
import File from "./file.js";
import getEntityId from "./get-entity-id.js";
import getMimeType from "./get-mime-type.js";
import hash from "./hash.js";
import type { Logger } from "./logger/logger-types.js";
import toConsoleLikeLogger, { type ConsoleLikeLogger } from "./logger/to-console-like-logger.js";
import VoidLogger from "./logger/void-logger.js";
import mutex from "./mutex.js";
import OverwritableFileStream from "./overwritable-file-stream.js";
import type Path from "./path.js";
import * as schemas from "./schemas.js";
import toUint8Array, { type Uint8ArraySource } from "./to-uint8-array.js";
import WritableFileStream from "./writable-file-stream.js";

/**
 * DuckDB 関連のオプションです。
 */
export type DuckdbOptions = Readonly<{
  /**
   * DuckDB の各種モジュールの情報です。
   */
  bundle: DuckdbBundle;

  /**
   * DuckDB のロガーです。
   *
   * @default new duckdb.VoidLogger()
   */
  logger?: DuckdbLogger | undefined;
}>;

/**
 * ファイルパスの型定義です。
 */
export type FilePathLike = string | Path;

/**
 * `ManagedOpfs` を構築するためのオプションです。
 */
export type ManagedOpfsOptions = Readonly<{
  /**
   * バケット名です。
   */
  bucketName: string;

  /**
   * DuckDB 関連のオプションです。
   */
  duckdb: DuckdbOptions;

  /**
   * JavaScript の値と JSON 文字列を相互変換するための関数群です。
   *
   * @default JSON
   */
  json?: Json | undefined;

  /**
   * ManagedOpfs のロガーです。
   */
  logger?: Logger | undefined;

  /**
   * ファイルの説明文の最大サイズ (バイト数) です。
   *
   * @default 100 KiB
   */
  maxDescriptionSize?: number | undefined;

  /**
   * ファイルのメタデータの最大サイズ (バイト数) です。
   * このサイズは、メタデータを `json.stringify` で変換したあとの文字列に対して計算されます。
   *
   * @default 100 KiB
   */
  maxMetadataJsonSize?: number | undefined;

  /**
   * ファイルの説明文を全文検索用の文字列に変換する関数です。
   *
   * @default s => s
   */
  toFullTextSearchString?: ToFullTextSearchString | undefined;
}>;

/**
 * ファイル書き込み時のオプションです。
 */
export type WriteFileOptions = Readonly<{
  /**
   * ファイル形式です。`undefined` の場合はファイルパスから自動判定されます。
   * 判定できない場合は "application/octet-stream" になります。
   */
  mimeType?: string | undefined;

  /**
   * ファイルの説明文です。
   *
   * @default null
   */
  description?: string | null | undefined;

  /**
   * ファイルのメタデータです。
   *
   * @default null
   */
  metadata?: unknown;
}>;

/**
 * 書き込みストリームのオプションです。
 */
export type CreateWritableOptions = Readonly<{
  /**
   * ファイル形式です。`undefined` の場合はファイルパスから自動判定されます。
   * 判定できない場合は "application/octet-stream" になります。
   */
  mimeType?: string | undefined;

  /**
   * ファイルの説明文です。
   *
   * @default null
   */
  description?: string | null | undefined;

  /**
   * ファイルのメタデータです。
   *
   * @default null
   */
  metadata?: unknown;
}>;

/**
 * ファイル上書き時のオプションです。
 */
export type OverwriteFileOptions = Readonly<{
  /**
   * ファイルの内容です。
   *
   * @default undefined
   */
  data?: Uint8ArraySource | undefined;

  /**
   * ファイル形式です。
   *
   * @default undefined
   */
  mimeType?: string | undefined;

  /**
   * ファイルの説明文です。
   *
   * @default undefined
   */
  description?: string | null | undefined;

  /**
   * ファイルのメタデータです。
   *
   * @default undefined
   */
  metadata?: unknown;
}>;

/**
 * 上書きストリームのオプションです。
 */
export type CreateOverwritableOptions = Readonly<{
  /**
   * ファイル形式です。
   *
   * @default undefined
   */
  mimeType?: string | undefined;

  /**
   * ファイルの説明文です。
   *
   * @default undefined
   */
  description?: string | null | undefined;

  /**
   * ファイルのメタデータです。
   *
   * @default undefined
   */
  metadata?: unknown;
}>;

/**
 * ファイルやディレクトリーを削除するためのオプションです。
 */
export type RemoveOptions = Readonly<{
  /**
   * `true` にすると、パスがディレクトリーだった場合、そのディレクトリー配下も全て削除します。
   *
   * @default false
   */
  recursive?: boolean | undefined;
}>;

/**
 * ファイルやディレクトリーを削除するためのオプションです。
 */
export type RemoveDirectoryOptions = Readonly<{
  /**
   * `true` にすると、そのディレクトリー配下も全て削除します。
   *
   * @default false
   */
  recursive?: boolean | undefined;
}>;

/**
 * ファイルやディレクトリーのステータス情報です。
 */
export type Stats = {
  /**
   * `true` なら指定したパスはファイルです。
   */
  isFile: boolean;

  /**
   * `true` なら指定したパスはディレクトリーです。
   */
  isDirectory: boolean;
};

/**
 * ファイルの説明文を対象に全文検索するためのオプションです。
 */
export type SearchFileOptions = Readonly<{
  /**
   * 検索結果の最大数です。
   *
   * @default 上限なし
   */
  limit?: number | undefined;

  /**
   * ディレクトリー内のファイルを再帰的に検索するなら `true`、しないなら `false` を指定します。
   *
   * @default false
   */
  recursive?: boolean | undefined;

  /**
   * 検索にヒットしたと判断するスコアのしきい値です。
   *
   * @default 0
   */
  scoreThreshold?: number | undefined;
}>;

/**
 * ファイルの説明文を対象に全文検索した結果です。
 */
export type SearchFileItem = {
  /**
   * バケット内のファイルパスです。
   */
  filePath: Path;

  /**
   * ファイルの説明文です。
   */
  description: string;

  /**
   * 検索スコアです。
   */
  searchScore: number;
};

/**
 * ディレクトリーまたはファイルをリストアップするためのオプションです。
 */
export type ListOptions = Readonly<{
  /**
   * 検索結果の最大数です。
   *
   * @default undefined (上限なし)
   */
  limit?: number | undefined;

  /**
   * 検索結果の開始位置です。
   *
   * @default 0
   */
  offset?: number | undefined;

  /**
   * ファイル名の並び順です。
   *
   * @default "ASC"
   */
  orderByName?: v.InferInput<typeof schemas.OrderType> | undefined;
}>;

/**
 * リストアップした結果です。
 */
export type ListItem = {
  /**
   * `true` ならファイルです。
   */
  isFile: boolean;

  /**
   * リストアイテムの名前です。
   */
  name: string;
};

/**
 * OPFS 上にファイルを保存するためのクラスです。
 */
export default class ManagedOpfs {
  /**
   * ログを記録する関数群です。
   */
  readonly #logger: ConsoleLikeLogger;

  /**
   * ファイルの付帯情報を管理するデータベースです。
   */
  readonly #catalog: Catalogdb;

  /**
   * バケット内のディレクトリーハンドラーです。
   */
  #bucket: Readonly<Record<"main", FileSystemDirectoryHandle>> | null;

  /**
   * バケット名です。
   */
  public readonly bucketName: BucketName;

  /**
   * `ManagedOpfs` の新しいインスタンスを構築します。
   *
   * @param options `ManagedOpfs` を構築するためのオプションです。
   */
  public constructor(options: ManagedOpfsOptions) {
    const {
      json,
      duckdb,
      logger = new VoidLogger(),
      bucketName,
      maxDescriptionSize,
      maxMetadataJsonSize,
      toFullTextSearchString,
    } = v.parse(ManagedOpfsOptionsSchema, options);
    this.bucketName = bucketName;
    this.#bucket = null;
    this.#logger = toConsoleLikeLogger(logger);
    this.#catalog = new Catalogdb({
      json,
      duckdb: {
        bundle: duckdb.bundle,
        logger: duckdb.logger,
      },
      logger: this.#logger,
      bucketName,
      maxDescriptionSize,
      maxMetadataJsonSize,
      toFullTextSearchString,
    });
  }

  /**
   * `ManagedOpfs` が利用可能かどうかを返します。
   */
  public get opened(): boolean {
    return this.#bucket !== null;
  }

  /**
   * ManagedOpfs の利用を開始します。
   * このメソッドは、OPFS のディレクトリーハンドラーを取得し、データベースに接続します。
   *
   * @throws 処理中にエラーが発生した場合、エラーを投げます。
   */
  @mutex
  public async open(): Promise<void> {
    if (this.#bucket) {
      return;
    }

    await this.#catalog.connect();
    try {
      const fs = await window.navigator.storage.getDirectory();
      const opfs = await fs.getDirectoryHandle("managed-opfs");
      const bucket = await opfs.getDirectoryHandle(this.bucketName);
      this.#bucket = {
        main: await bucket.getDirectoryHandle("main"),
      };
    } catch (ex) {
      try {
        await this.#catalog.disconnect();
      } catch (ex) {
        this.#logger.error("ManagedOpfs.open: Failed to disconnect catalog", ex);
      }

      throw ex;
    }
  }

  /**
   * ManagedOpfs の利用を終了します。
   * このメソッドは、データベースとの接続を切断し、ディレクトリーハンドラーをクリアします。
   *
   * @throws 処理中にエラーが発生した場合、エラーを投げます。
   */
  @mutex
  public async close(): Promise<void> {
    if (!this.#bucket) {
      return;
    }

    await this.#catalog.disconnect();
    this.#bucket = null;
  }

  /**
   * 指定したパスにファイルを書き込みます。
   *
   * @param path 書き込み先のファイルパスです。
   * @param data `Uint8Array` に変換できる値の型です。
   * @param options ファイル書き込み時のオプションです。
   * @returns ファイルの場所を示す `FileIdent` です。
   * @throws `ManagedOpfs` が開かれていない場合や処理中にエラーが発生した場合、エラーを投げます。
   */
  @mutex
  public async writeFile(
    path: FilePathLike,
    data: Uint8ArraySource,
    options: WriteFileOptions | undefined = {},
  ): Promise<FileIdent> {
    if (!this.#bucket) {
      throw new MopfsError("ManagedOpfs not open");
    }

    const filePath = v.parse(schemas.FilePathLike, path);
    const {
      metadata,
      mimeType,
      description,
    } = v.parse(WriteFileOptionsSchema, options);
    const view = toUint8Array(data);
    const checksum = await hash.digest(view);
    const fileSize = v.parse(schemas.UnsignedInteger, view.byteLength);

    const entityId = getEntityId();
    const fileHandle = await this.#bucket.main.getFileHandle(entityId, { create: true });
    const writer = await fileHandle.createWritable();
    try {
      await writer.write(view);
    } catch (ex) {
      try {
        await writer.abort();
      } catch (ex) {
        this.#logger.error("ManagedOpfs.writeFile: Failed to close writer", ex);
      }

      throw ex;
    }

    await writer.close();

    try {
      await this.#catalog.create({
        checksum,
        entityId,
        filePath,
        fileSize,
        metadata,
        mimeType,
        description,
      });
    } catch (ex) {
      try {
        await this.#bucket.main.removeEntry(entityId);
      } catch (ex) {
        this.#logger.error("ManagedOpfs.writeFile: Failed to remove entity file: " + entityId, ex);
      }

      throw ex;
    }

    return new FileIdent({
      filePath,
      bucketName: this.bucketName,
    });
  }

  /**
   * ファイルをストリームとして書き込むためのオブジェクトを作成します。
   *
   * @param path 書き込み先のファイルパスです。
   * @param options 書き込みストリームのオプションです。
   * @returns 書き込みストリームです。
   * @throws `ManagedOpfs` が開かれていない場合や処理中にエラーが発生した場合、エラーを投げます。
   */
  @mutex.readonly
  public async createWritable(
    path: FilePathLike,
    options: CreateWritableOptions | undefined = {},
  ): Promise<WritableFileStream> {
    if (!this.#bucket) {
      throw new MopfsError("ManagedOpfs not open");
    }

    const filePath = v.parse(schemas.FilePathLike, path);
    const {
      metadata = null,
      mimeType = getMimeType(filePath.basename),
      description = null,
    } = v.parse(CreateWritableOptionsSchema, options);
    const entityId = getEntityId();
    const fileHandle = await this.#bucket.main.getFileHandle(entityId, { create: true });
    let writer: FileSystemWritableFileStream;
    try {
      writer = await fileHandle.createWritable();
    } catch (ex) {
      try {
        await this.#bucket.main.removeEntry(entityId);
      } catch (ex) {
        this.#logger.error(
          "ManagedOpfs.createWritable: Failed to remove entity file: " + entityId,
          ex,
        );
      }

      throw ex;
    }

    return new WritableFileStream({
      hash: await hash.create(),
      logger: this.#logger,
      writer,
      catalog: this.#catalog,
      mainDir: this.#bucket.main,
      manager: this,
      entityId,
      filePath,
      metadata,
      mimeType,
      bucketName: this.bucketName,
      description,
    });
  }

  /**
   * 指定したパスのファイルを読み込みます。
   *
   * @param path ファイルパスです。
   * @returns ファイルです。
   * @throws `ManagedOpfs` が開かれていない場合やファイルが存在しない場合、エラーを投げます。
   */
  @mutex.readonly
  public async readFile(path: FilePathLike): Promise<File> {
    if (!this.#bucket) {
      throw new MopfsError("ManagedOpfs not open");
    }

    const filePath = v.parse(schemas.FilePathLike, path);
    const {
      checksum,
      entityId,
      fileSize,
      mimeType,
      lastModified,
    } = await this.#catalog.read({ filePath });
    let fileHandle: FileSystemFileHandle;
    try {
      fileHandle = await this.#bucket.main.getFileHandle(entityId, { create: false });
    } catch (ex) {
      if (ex instanceof DOMException && ex.name === "NotFoundError") {
        // 実際に保存されているファイルがないので、カタログから削除します。
        try {
          await this.#catalog.delete({ filePath });
        } catch (ex) {
          this.#logger.error(
            `ManagedOpfs.readFile: Failed to delete '${this.bucketName}:${filePath}' catalog`,
            ex,
          );
        }

        throw new MopfsFileExistsError(this.bucketName, filePath, { cause: ex });
      }

      throw ex;
    }

    return new File({
      file: await fileHandle.getFile(),
      catalog: this.#catalog,
      checksum,
      filePath,
      fileSize,
      mimeType,
      bucketName: this.bucketName,
      lastModified,
    });
  }

  /**
   * ファイルを移動します。
   *
   * @param sourceFilePath 移動元のファイルパスです。
   * @param destinationFilePath 移動先のファイルパスです。
   * @returns 移動先のファイルの場所を示す `FileIdent` です。
   * @throws `ManagedOpfs` が開かれていない場合や処理中にエラーが発生した場合、エラーを投げます。
   */
  @mutex
  public async moveFile(
    sourceFilePath: FilePathLike,
    destinationFilePath: FilePathLike,
  ): Promise<FileIdent> {
    if (!this.#bucket) {
      throw new MopfsError("ManagedOpfs not open");
    }

    const srcFilePath = v.parse(schemas.FilePathLike, sourceFilePath);
    const dstFilePath = v.parse(schemas.FilePathLike, destinationFilePath);
    await this.#catalog.move({
      srcFilePath,
      dstFilePath,
    });

    return new FileIdent({
      filePath: dstFilePath,
      bucketName: this.bucketName,
    });
  }

  /**
   * ファイルをコピーします。
   *
   * @param sourceFilePath コピー元のファイルパスです。
   * @param destinationFilePath コピー先のファイルパスです。
   * @returns コピー先のファイルの場所を示す `FileIdent` です。
   * @throws `ManagedOpfs` が開かれていない場合や処理中にエラーが発生した場合、エラーを投げます。
   */
  @mutex
  public async copyFile(
    sourceFilePath: FilePathLike,
    destinationFilePath: FilePathLike,
  ): Promise<FileIdent> {
    if (!this.#bucket) {
      throw new MopfsError("ManagedOpfs not open");
    }

    const srcFilePath = v.parse(schemas.FilePathLike, sourceFilePath);
    const dstFilePath = v.parse(schemas.FilePathLike, destinationFilePath);

    const { entityId: srcEntityId } = await this.#catalog.readEntityId({ filePath: srcFilePath });
    let srcHandle: FileSystemFileHandle;
    try {
      srcHandle = await this.#bucket.main.getFileHandle(srcEntityId, { create: false });
    } catch (ex) {
      if (ex instanceof DOMException && ex.name === "NotFoundError") {
        // 実際に保存されているファイルがないので、カタログから削除します。
        try {
          await this.#catalog.delete({ filePath: srcFilePath });
        } catch (ex) {
          this.#logger.error(
            `ManagedOpfs.readFile: Failed to delete '${this.bucketName}:${srcFilePath}' catalog`,
            ex,
          );
        }

        throw new MopfsFileExistsError(this.bucketName, srcFilePath, { cause: ex });
      }

      throw ex;
    }

    const srcFile = await srcHandle.getFile();
    const srcReader = srcFile.stream();

    const dstEntityId = getEntityId();
    const dstHandle = await this.#bucket.main.getFileHandle(dstEntityId, { create: true });
    const dstWriter = await dstHandle.createWritable();
    try {
      for await (const chunk of srcReader) {
        await dstWriter.write(chunk);
      }
    } catch (ex) {
      try {
        await dstWriter.abort();
      } catch (ex) {
        this.#logger.error("ManagedOpfs.copyFile: Failed to abort writer", ex);
      }

      throw ex;
    }

    await dstWriter.close();

    try {
      await this.#catalog.copy({
        srcFilePath,
        dstFilePath,
        dstEntityId,
      });
    } catch (ex) {
      try {
        await this.#bucket.main.removeEntry(dstEntityId);
      } catch (ex) {
        this.#logger.error(
          "ManagedOpfs.copyFile: Failed to remove entity file: " + dstEntityId,
          ex,
        );
      }

      throw ex;
    }

    return new FileIdent({
      filePath: dstFilePath,
      bucketName: this.bucketName,
    });
  }

  /**
   * ファイルを上書きします。
   *
   * @param path ファイルパスです。
   * @param options ファイル上書き時のオプションです。
   * @returns 上書きしたファイルの場所を示す `FileIdent` です。
   * @throws `ManagedOpfs` が開かれていない場合や処理中にエラーが発生した場合、エラーを投げます。
   */
  @mutex
  public async overwriteFile(
    path: FilePathLike,
    options: OverwriteFileOptions,
  ): Promise<FileIdent> {
    if (!this.#bucket) {
      throw new MopfsError("ManagedOpfs not open");
    }

    const filePath = v.parse(schemas.FilePathLike, path);
    const {
      data: view,
      metadata,
      mimeType,
      description,
    } = v.parse(OverwriteFileOptionsSchema, options);
    if (
      view === undefined
      && metadata === undefined
      && mimeType === undefined
      && description === undefined
    ) {
      return new FileIdent({
        filePath,
        bucketName: this.bucketName,
      });
    }

    if (!view) {
      await this.#catalog.update({
        checksum: undefined,
        filePath,
        fileSize: undefined,
        metadata,
        mimeType,
        description,
        newEntityId: undefined,
        oldEntityId: undefined,
      });

      return new FileIdent({
        filePath,
        bucketName: this.bucketName,
      });
    }

    const { entityId: oldEntityId } = await this.#catalog.readEntityId({ filePath });
    const newEntityId = getEntityId();
    const checksum = await hash.digest(view);
    const fileSize = v.parse(schemas.UnsignedInteger, view.byteLength);
    const handle = await this.#bucket.main.getFileHandle(newEntityId, { create: true });
    const writer = await handle.createWritable();
    try {
      await writer.write(view);
    } catch (ex) {
      try {
        await writer.abort(ex);
      } catch (ex) {
        this.#logger.error("ManagedOpfs.overwriteFile: Failed to abort writer", ex);
      }

      try {
        await this.#bucket.main.removeEntry(newEntityId);
      } catch (ex) {
        this.#logger.error("ManagedOpfs.overwriteFile: Failed to remove entity", ex);
      }

      throw ex;
    }

    try {
      await writer.close();
      await this.#catalog.update({
        checksum,
        filePath,
        fileSize,
        metadata,
        mimeType,
        description,
        newEntityId: newEntityId,
        oldEntityId: oldEntityId,
      });
    } catch (ex) {
      try {
        await this.#bucket.main.removeEntry(newEntityId);
      } catch (ex) {
        this.#logger.error("ManagedOpfs.overwriteFile: Failed to remove entity", ex);
      }

      throw ex;
    }

    try {
      await this.#bucket.main.removeEntry(oldEntityId);
    } catch (ex) {
      this.#logger.error("ManagedOpfs.overwriteFile: Failed to remove old entity", ex);
    }

    return new FileIdent({
      filePath,
      bucketName: this.bucketName,
    });
  }

  /**
   * ファイルを上書きするためのストリームを作成します。
   *
   * @param path 上書き先のファイルパスです。
   * @param options 上書きストリームのオプションです。
   * @returns 上書きストリームです。
   * @throws `ManagedOpfs` が開かれていない場合や処理中にエラーが発生した場合、エラーを投げます。
   */
  @mutex.readonly
  public async createOverwritable(
    path: FilePathLike,
    options: CreateOverwritableOptions | undefined = {},
  ): Promise<OverwritableFileStream> {
    if (!this.#bucket) {
      throw new MopfsError("ManagedOpfs not open");
    }

    const filePath = v.parse(schemas.FilePathLike, path);
    const {
      metadata,
      mimeType,
      description,
    } = v.parse(CreateOverwritableOptionsSchema, options);
    const {
      entityId: oldEntityId,
      mimeType: defaultMimeType,
      lastModified,
    } = await this.#catalog.read({ filePath });
    const hasher = await hash.create();
    const newEntityId = getEntityId();
    const fileHandle = await this.#bucket.main.getFileHandle(newEntityId, { create: true });
    let writer: FileSystemWritableFileStream;
    try {
      writer = await fileHandle.createWritable();
    } catch (ex) {
      try {
        await this.#bucket.main.removeEntry(newEntityId);
      } catch (ex) {
        this.#logger.error("ManagedOpfs.createWritable: Failed to remove entity", ex);
      }

      throw ex;
    }

    return new OverwritableFileStream({
      hash: hasher,
      logger: this.#logger,
      writer,
      catalog: this.#catalog,
      mainDir: this.#bucket.main,
      manager: this,
      filePath,
      metadata,
      mimeType: mimeType ?? defaultMimeType,
      bucketName: this.bucketName,
      description,
      newEntityId,
      oldEntityId,
      lastModified,
    });
  }

  // public async remove(
  //   filePath: FilePathLike,
  //   options?: RemoveOptions | undefined,
  // ): Promise<void>;
  // public async remove(
  //   dirPath: readonly string[],
  //   options?: RemoveOptions | undefined,
  // ): Promise<void>;
  // public async remove(
  //   path: FilePathLike | readonly string[],
  //   options?: RemoveOptions | undefined,
  // ): Promise<void>;
  // @mutex
  // public async remove(
  //   path: FilePathLike | readonly string[],
  //   options: RemoveOptions | undefined = {},
  // ): Promise<void> {
  //   if (!this.#bucket) {
  //     throw new MopfsError("ManagedOpfs not open");
  //   }
  // }

  /**
   * 指定したパスのファイルを削除します。
   *
   * @param filePath バケット内のファイルパスです。
   * @throws `ManagedOpfs` が開かれていない場合やファイルが存在しない場合、エラーを投げます。
   */
  @mutex
  public async removeFile(filePath: FilePathLike): Promise<void> {
    if (!this.#bucket) {
      throw new MopfsError("ManagedOpfs not open");
    }

    filePath = v.parse(schemas.FilePathLike, filePath);
    try {
      const { entityId } = await this.#catalog.readEntityId({ filePath });
      await this.#bucket.main.removeEntry(entityId);
    } catch (ex) {
      // 実際に保存されているエンティティーがなくても、カタログから削除します。
      try {
        await this.#catalog.delete({ filePath });
      } catch (ex) {
        this.#logger.error(
          `ManagedOpfs.removeFile: Failed to delete '${this.bucketName}:${filePath}' catalog`,
          ex,
        );
      }

      // 実際に保存されているエンティティーがない場合はカスタムエラーを投げます。
      if (ex instanceof DOMException && ex.name === "NotFoundError") {
        throw new MopfsFileExistsError(this.bucketName, filePath, { cause: ex });
      }

      // データベースにファイルの情報がない場合はここで MopfsFileExistsError が投げられます。
      throw ex;
    }

    // 実際に保存されているエンティティーが正常に削除されたので、カタログからも削除します。
    try {
      await this.#catalog.delete({ filePath });
    } catch (ex) {
      this.#logger.error(
        `ManagedOpfs.removeFile: Failed to delete '${this.bucketName}:${filePath}' catalog`,
        ex,
      );
    }
  }

  // @mutex
  // public async removeDirectory(
  //   dirPath: readonly string[],
  //   options: RemoveDirectoryOptions | undefined = {},
  // ): Promise<void> {
  //   if (!this.#bucket) {
  //     throw new MopfsError("ManagedOpfs not open");
  //   }
  // }

  /**
   * 指定したパスが存在するか確認します。
   *
   * @param filePath バケット内のファイルパスです。
   * @returns `true` なら存在します。
   */
  public async exists(filePath: FilePathLike): Promise<boolean>;

  /**
   * 指定したパスが存在するか確認します。
   *
   * @param dirPath バケット内のディレクトリーパスです。
   * @returns `true` なら存在します。
   */
  public async exists(dirPath: readonly string[]): Promise<boolean>;

  /**
   * 指定したパスが存在するか確認します。
   *
   * @param path バケット内のパスです。
   * @returns `true` なら存在します。
   * @throws `ManagedOpfs` が開かれていない場合や処理中にエラーが発生した場合、エラーを投げます。
   */
  public async exists(path: FilePathLike | readonly string[]): Promise<boolean>;

  @mutex.readonly
  public async exists(path: FilePathLike | readonly string[]): Promise<boolean> {
    if (!this.#bucket) {
      throw new MopfsError("ManagedOpfs not open");
    }

    if (Array.isArray(path)) {
      const out = await this.#catalog.exists({ dirPath: path });
      return out.exists;
    }

    const filePath = v.parse(schemas.FilePathLike, path);
    let entityId: v.InferOutput<typeof schemas.EntityId>;
    try {
      const out = await this.#catalog.readEntityId({ filePath });
      entityId = out.entityId;
    } catch (ex) {
      if (ex instanceof MopfsFileNotFoundError) {
        return false;
      }

      throw ex;
    }

    try {
      await this.#bucket.main.getFileHandle(entityId);
    } catch (ex) {
      if (ex instanceof DOMException && ex.name === "NotFoundError") {
        // 実際に保存されているファイルがないので、カタログから削除します。
        try {
          await this.#catalog.delete({ filePath });
        } catch (ex) {
          this.#logger.error(
            `ManagedOpfs.exists: Failed to delete '${this.bucketName}:${filePath}' catalog`,
            ex,
          );
        }

        return false;
      }

      throw ex;
    }

    return true;
  }

  /**
   * ファイルやディレクトリーのステータス情報を取得します。
   *
   * @param path バケット内のパスです。
   * @returns ファイルやディレクトリーのステータス情報です。
   * @throws `ManagedOpfs` が開かれていない場合や処理中にエラーが発生した場合、エラーを投げます。
   */
  @mutex.readonly
  public async stat(path: FilePathLike): Promise<Stats> {
    if (!this.#bucket) {
      throw new MopfsError("ManagedOpfs not open");
    }

    path = v.parse(schemas.FilePathLike, path);
    return await this.#catalog.stat({ path });
  }

  /**
   * ファイルの説明文を対象に全文検索します。
   *
   * @param dirPath バケット内のディレクトリーパスです。
   * @param query 検索クエリーです。
   * @param options ファイルの説明文を対象に全文検索するためのオプションです。
   * @returns ファイルの説明文を対象に全文検索した結果です。
   * @throws `ManagedOpfs` が開かれていない場合や処理中にエラーが発生した場合、エラーを投げます。
   */
  @mutex.readonly
  public async searchFile(
    dirPath: readonly string[],
    query: string,
    options: SearchFileOptions | undefined = {},
  ): Promise<SearchFileItem[]> {
    if (!this.#bucket) {
      throw new MopfsError("ManagedOpfs not open");
    }

    const {
      limit,
      recursive,
      scoreThreshold,
    } = v.parse(SearchOptionsSchema, options);
    const items = await this.#catalog.search({
      limit,
      query,
      dirPath,
      recursive,
      scoreThreshold,
    });

    return items;
  }

  /**
   * ディレクトリーまたはファイルをリストアップします。
   *
   * @param dirPath バケット内のディレクトリーパスです。
   * @param options ディレクトリーまたはファイルをリストアップするためのオプションです。
   * @returns リストアップした結果です。
   * @throws `ManagedOpfs` が開かれていない場合や処理中にエラーが発生した場合、エラーを投げます。
   */
  @mutex.readonly
  public async list(
    dirPath: readonly string[],
    options: ListOptions | undefined = {},
  ): Promise<ListItem[]> {
    if (!this.#bucket) {
      throw new MopfsError("ManagedOpfs not open");
    }

    const {
      limit,
      offset,
      orderByName,
    } = v.parse(ListOptionsSchema, options);
    const items = await this.#catalog.list({
      limit,
      offset,
      dirPath,
      orderByName,
    });

    return items;
  }
}

const ManagedOpfsOptionsSchema = v.object({
  // 必須
  duckdb: v.object({
    bundle: v.custom<DuckdbBundle>(x => typeof x === "object" && x !== null),
    logger: v.optional(
      v.custom<DuckdbLogger>(x => (
        ((typeof x === "object" && x !== null) || typeof x === "function")
        && ("log" in x && typeof x.log === "function")
      )),
    ),
  }),
  bucketName: schemas.BucketName,
  // 任意
  json: v.optional(
    v.custom<Json>(x => (
      ((typeof x === "object" && x !== null) || typeof x === "function")
      && ("parse" in x && typeof x.parse === "function")
      && ("stringify" in x && typeof x.stringify === "function")
    )),
  ),
  logger: v.optional(
    v.custom<Logger>(x => (
      ((typeof x === "object" && x !== null) || typeof x === "function")
      && ("log" in x && typeof x.log === "function")
    )),
  ),
  maxDescriptionSize: v.optional(
    schemas.HalfUnsignedInteger,
  ),
  maxMetadataJsonSize: v.optional(
    schemas.UnsignedInteger,
  ),
  toFullTextSearchString: v.optional(
    v.custom<ToFullTextSearchString>(x => typeof x === "function"),
  ),
});

const WriteFileOptionsSchema = v.object({
  metadata: v.optional(v.unknown()),
  mimeType: v.optional(schemas.MimeType),
  description: v.optional(v.nullable(v.string())),
});

const CreateWritableOptionsSchema = v.object({
  metadata: v.optional(v.unknown()),
  mimeType: v.optional(schemas.MimeType),
  description: v.optional(v.nullable(v.string())),
});

const OverwriteFileOptionsSchema = v.object({
  data: v.optional(v.pipe(v.custom<Uint8ArraySource>(() => true), v.transform(toUint8Array))),
  metadata: v.optional(v.unknown()),
  mimeType: v.optional(schemas.MimeType),
  description: v.optional(v.nullable(v.string())),
});

const CreateOverwritableOptionsSchema = v.object({
  metadata: v.optional(v.unknown()),
  mimeType: v.optional(schemas.MimeType),
  description: v.optional(v.nullable(v.string())),
});

const SearchOptionsSchema = v.object({
  limit: v.optional(schemas.UnsignedInteger),
  recursive: v.optional(v.boolean()),
  scoreThreshold: v.optional(v.number()),
});

const ListOptionsSchema = v.object({
  limit: v.optional(schemas.UnsignedInteger),
  offset: v.optional(schemas.UnsignedInteger),
  orderByName: v.optional(schemas.OrderType),
});
