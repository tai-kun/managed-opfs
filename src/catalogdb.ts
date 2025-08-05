import {
  AsyncDuckDB,
  type AsyncDuckDBConnection,
  DuckDBAccessMode,
  type DuckDBBundle,
  type Logger as DuclDBLogger,
  VoidLogger,
} from "@duckdb/duckdb-wasm";
import type { Table } from "apache-arrow";
import sql, { join, raw, type Sql } from "sql-template-tag";
import * as v from "valibot";
import BucketName from "./bucket-name.js";
import { MopfsFileExistsError, MopfsFileNotFoundError } from "./error/errors.js";
import getMimeType from "./get-mime-type.js";
import jsonify from "./jsonify.js";
import type { ConsoleLikeLogger } from "./logger/to-console-like-logger.js";
import mutex from "./mutex.js";
import Path from "./path.js";
import * as schemas from "./schemas.js";

/**
 * DuckDB の各種モジュールの情報です。
 */
export type DuckdbBundle = DuckDBBundle;

/**
 * DuckDB のロガーのインターフェースです。
 */
export interface DuckdbLogger extends DuclDBLogger {}

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
  logger: DuckdbLogger | undefined;
}>;

/**
 * ファイルの説明文を全文検索用の文字列に変換する関数です。
 */
export interface ToFullTextSearchString {
  /**
   * ファイルの説明文を全文検索用の文字列に変換します。
   * 全文検索用の文字列のサイズの上限は `maxDescriptionSize` の 2 倍です。
   *
   * @param description ファイルの説明文です。
   * @returns 全文検索用の文字列です。
   */
  (description: schemas.SizeLimitedString): string | PromiseLike<string>;
}

/**
 * JSON 文字列を JavaScript の値に変換する関数です。
 */
export interface JsonParse {
  /**
   * JSON 文字列を JavaScript の値に変換します。
   *
   * @param text 変換される JSON 文字列です。
   * @returns 変換された JavaScript 値です。
   */
  (text: string): unknown;
}

/**
 * JavaScript の値を JSON 文字列に変換する関数です。
 */
export interface JsonStringify {
  /**
   * JavaScript の値を JSON 文字列に変換します。
   *
   * @param value 変換される JavaScript 値です。
   * @returns 変換された JSON 文字列です。
   */
  (value: unknown): string;
}

/**
 * JavaScript の値と JSON 文字列を相互変換するための関数群です。
 */
export interface Json {
  /**
   * JSON 文字列を JavaScript の値に変換する関数です。
   */
  readonly parse: JsonParse;

  /**
   * JavaScript の値を JSON 文字列に変換する関数です。
   */
  readonly stringify: JsonStringify;
}

/**
 * `Catalogdb` を構築するための入力パラメーターです。
 */
type CatalogdbInput = Readonly<{
  /**
   * ログを記録する関数群です。
   */
  logger: ConsoleLikeLogger;

  /**
   * バケット名です。
   */
  bucketName: BucketName;

  /**
   * DuckDB 関連のオプションです。
   */
  duckdb: DuckdbOptions;

  /**
   * JavaScript の値と JSON 文字列を相互変換するための関数群です。
   *
   * @default JSON
   */
  json: Json | undefined;

  /**
   * ファイルの説明文の最大サイズ (バイト数) です。
   *
   * @default 100 KiB
   */
  maxDescriptionSize: v.InferOutput<typeof schemas.HalfUnsignedInteger> | undefined;

  /**
   * ファイルのメタデータの最大サイズ (バイト数) です。
   * このサイズは、メタデータを `json.stringify` で変換したあとの文字列に対して計算されます。
   *
   * @default 100 KiB
   */
  maxMetadataJsonSize: v.InferOutput<typeof schemas.UnsignedInteger> | undefined;

  /**
   * ファイルの説明文を全文検索用の文字列に変換する関数です。
   *
   * @default s => s
   */
  toFullTextSearchString: ToFullTextSearchString | undefined;
}>;

/**
 * ファイルの付帯情報を作成するための入力パラメーターです。
 */
type CreateInput = Readonly<{
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
}>;

/**
 * ファイルの付帯情報を取得するための入力パラメーターです。
 */
type ReadInput = Readonly<{
  /**
   * バケット内のファイルパスです。
   */
  filePath: Path;
}>;

/**
 * ファイルの付帯情報を取得した結果です。
 */
type ReadOutput = {
  /**
   * 実際に保存されるファイルの識別子です。
   */
  entityId: v.InferOutput<typeof schemas.EntityId>;

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
};

/**
 * 実際に保存されているファイルの識別子を取得するための入力パラメーターです。
 */
type ReadEntityIdInput = Readonly<{
  /**
   * バケット内のファイルパスです。
   */
  filePath: Path;
}>;

/**
 * 実際に保存されているファイルの識別子の取得した結果です。
 */
type ReadEntityIdOutput = {
  /**
   * 実際に保存されているファイルの識別子です。
   */
  entityId: v.InferOutput<typeof schemas.EntityId>;
};

/**
 * ファイルの説明文を取得するための入力パラメーターです。
 */
type ReadDescriptionInput = Readonly<{
  /**
   * バケット内のファイルパスです。
   */
  filePath: Path;
}>;

/**
 * ファイルの説明文を取得した結果です。
 */
type ReadDescriptionOutput = {
  /**
   * ファイルの説明文です。
   */
  description: string | null;
};

/**
 * ファイルのメタデータを取得するための入力パラメーターです。
 */
type ReadMetadataInput = Readonly<{
  /**
   * バケット内のファイルパスです。
   */
  filePath: Path;
}>;

/**
 * ファイルのメタデータを取得した結果です。
 */
type ReadMetadataOutput = {
  /**
   * ファイルのメタデータです。
   */
  metadata: unknown;
};

/**
 * ファイルの付帯情報を移動するための入力パラメーターです。
 */
type MoveInput = Readonly<{
  /**
   * バケット内の移動元のファイルパスです。
   */
  srcFilePath: Path;

  /**
   * バケット内の移動先のファイルパスです。
   */
  dstFilePath: Path;
}>;

/**
 * ファイルの付帯情報をコピーするための入力パラメーターです。
 */
type CopyInput = Readonly<{
  /**
   * バケット内のコピー元のファイルパスです。
   */
  srcFilePath: Path;

  /**
   * バケット内のコピー先のファイルパスです。
   */
  dstFilePath: Path;

  /**
   * 実際に保存されているファイルの識別子です。
   */
  dstEntityId: v.InferOutput<typeof schemas.EntityId>;
}>;

/**
 * ファイルの付帯情報を更新するための入力パラメーターです。
 */
type UpdateInput = Readonly<{
  /**
   * バケット内のファイルパスです。
   */
  filePath: Path;

  /**
   * 新しいファイルの識別子です。
   */
  newEntityId: v.InferOutput<typeof schemas.EntityId> | undefined;

  /**
   * 古いファイルの識別子です。
   */
  oldEntityId: v.InferOutput<typeof schemas.EntityId> | undefined;

  /**
   * ファイルのチェックサム (MD5 ハッシュ値) です。
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
}>;

/**
 * ファイルの付帯情報を削除するための入力パラメーターです。
 */
type DeleteInput = Readonly<{
  /**
   * バケット内のファイルパスです。
   */
  filePath: Path;
}>;

/**
 * パスが存在するか確認するための入力パラメーターです。
 */
type ExistsInput = Readonly<
  {
    /**
     * バケット内のディレクトリーパスです。
     */
    dirPath: readonly string[];
  } | {
    /**
     * バケット内のファイルパスです。
     */
    filePath: Path;
  }
>;

/**
 * パスが存在するか確認した結果です。
 */
type ExistsOutput = {
  /**
   * ファイルの付帯情報が存在すれば `true` です。
   */
  exists: boolean;
};

/**
 * ファイルやディレクトリーのステータス情報を取得するための入力パラメーターです。
 */
type StatInput = Readonly<{
  /**
   * バケット内のパスです。
   */
  path: Path;
}>;

/**
 * ファイルやディレクトリーのステータス情報を取得した結果です。
 */
type StatOutput = {
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
 * ファイルの説明文を対象に全文検索するための入力パラメーターです。
 */
type SearchInput = Readonly<{
  /**
   * ディレクトリーパスです。
   */
  dirPath: readonly string[];

  /**
   * 検索クエリーです。
   */
  query: string;

  /**
   * 検索結果の最大数です。
   *
   * @default 上限なし
   */
  limit: v.InferOutput<typeof schemas.UnsignedInteger> | undefined;

  /**
   * ディレクトリー内のファイルを再帰的に検索するなら `true`、しないなら `false` を指定します。
   *
   * @default false
   */
  recursive: boolean | undefined;

  /**
   * 検索にヒットしたと判断するスコアのしきい値です。
   *
   * @default 0
   */
  scoreThreshold: number | undefined;
}>;

/**
 * ファイルの説明文を対象に全文検索した結果です。
 */
type SearchOutput = {
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
 * ディレクトリーまたはファイルをリストアップするための入力パラメーターです。
 */
type ListInput = Readonly<{
  /**
   * ディレクトリーパスです。
   */
  dirPath: readonly string[];

  /**
   * 検索結果の最大数です。
   *
   * @default 上限なし
   */
  limit: v.InferOutput<typeof schemas.UnsignedInteger> | undefined;

  /**
   * 検索結果の開始位置です。
   *
   * @default 0
   */
  offset: v.InferOutput<typeof schemas.UnsignedInteger> | undefined;

  /**
   * ファイル名の並び順です。
   *
   * @default "ASC"
   */
  orderByName: v.InferOutput<typeof schemas.OrderType> | undefined;
}>;

/**
 * ディレクトリーまたはファイルをリストアップした結果です。
 */
type ListOutput = {
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
 * ファイルの付帯情報を管理するクラスです。
 */
export default class Catalogdb {
  /**
   * ログを記録する関数群です。
   */
  #logger: ConsoleLikeLogger;

  /**
   * バケット名です。
   */
  readonly #bucketName: v.InferOutput<typeof schemas.BucketName>;

  /**
   * DuckDB の各種モジュールの情報です。
   */
  readonly #duckdbOpts: Readonly<{
    /**
     * DuckDB の各種モジュールの情報です。
     */
    bundle: DuckdbBundle;

    /**
     * DuckDB のロガーです。
     */
    logger: DuckdbLogger;
  }>;

  /**
   * ファイルの説明文を全文検索用の文字列に変換する関数です。
   */
  readonly #toFtsStr: (descRaw: string) => Promise<string>;

  /**
   * JavaScript の値と JSON 文字列を相互変換するためのユーティリティーです。
   */
  readonly #metaJson: Json;

  /**
   * DuckDB のインスタンスです。
   */
  #db: AsyncDuckDB | null;

  /**
   * DuckDB のコネクションです。
   */
  #conn: AsyncDuckDBConnection | null;

  /**
   * `Catalogdb` の新しいインスタンスを構築します。
   *
   * @param inp 初期化するための入力パラメーターです。
   */
  public constructor(inp: CatalogdbInput) {
    const KiB = 1024;
    const {
      json = JSON as Json,
      duckdb,
      logger,
      bucketName,
      maxDescriptionSize = (100 * KiB) as v.InferOutput<typeof schemas.UnsignedInteger>,
      maxMetadataJsonSize = (100 * KiB) as v.InferOutput<typeof schemas.UnsignedInteger>,
      toFullTextSearchString = (desc: string) => desc,
    } = inp;
    const descRawSchema = schemas.newSizeLimitedString(maxDescriptionSize);
    // 全文検索用の文字列のサイズの上限は `maxDescriptionSize` の 2 倍までとしておきます。
    const maxFtsStrSize = v.parse(schemas.UnsignedInteger, maxDescriptionSize * 2);
    const ftsStrSchema = schemas.newSizeLimitedString(maxFtsStrSize);
    const metaJsSchema = schemas.newSizeLimitedString(maxMetadataJsonSize);
    const parseDescRaw = v.parser(descRawSchema);
    const parseFtsStr = v.parser(ftsStrSchema);
    const parseMetaJs = v.parser(metaJsSchema);

    this.#logger = logger;
    this.#bucketName = bucketName;
    this.#duckdbOpts = {
      bundle: duckdb.bundle,
      logger: duckdb.logger ?? new VoidLogger(),
    };
    this.#toFtsStr = async function toFtsStr(s) {
      return parseFtsStr(await toFullTextSearchString(parseDescRaw(s)));
    };
    this.#metaJson = {
      parse(s) {
        return json.parse(s);
      },
      stringify(o) {
        return parseMetaJs(json.stringify(o));
      },
    };
    this.#db = null;
    this.#conn = null;
  }

  /**
   * SQL クエリーを実行し、結果を返します。
   *
   * @param sql 実行する SQL クエリーです。
   * @returns クエリーの実行結果を Apache Arrow の `Table` 形式で返します。
   */
  async #query(sql: string | Sql): Promise<Table> {
    if (!this.#conn) {
      throw new Error("Not connected");
    }

    if (typeof sql === "string") {
      return await this.#conn.query(sql);
    }

    if (sql.values.length === 0) {
      return await this.#conn.query(sql.text);
    }

    const stmt = await this.#conn.prepare(sql.text);
    try {
      const rows = await stmt.query(...sql.values);
      return rows;
    } finally {
      await stmt.close();
    }
  }

  /**
   * DuckDB の変更内容をファイルに同期します。
   */
  async #flush(): Promise<void> {
    try {
      await this.#query("CHECKPOINT");
    } catch (ex) {
      this.#logger.error("Catalogdb.flush: Failed to synchronize data in WAL to database file", ex);
    }
  }

  /**
   * DuckDB データベースに接続します。
   */
  @mutex
  public async connect(): Promise<void> {
    if (!this.#db) {
      // ディレクトリーの準備
      {
        const fs = await window.navigator.storage.getDirectory();
        const opfs = await fs.getDirectoryHandle("managed-opfs", { create: true });
        await opfs.getDirectoryHandle(this.#bucketName, { create: true });
      }
      // データベースの初期化
      {
        const {
          logger,
          bundle: {
            mainModule,
            mainWorker,
            pthreadWorker,
          },
        } = this.#duckdbOpts;
        const db = new AsyncDuckDB(logger, new Worker(mainWorker!));
        await db.instantiate(mainModule, pthreadWorker);
        await db.open({
          path: `opfs://managed-opfs/${this.#bucketName}/catalog.db`,
          accessMode: DuckDBAccessMode.READ_WRITE,
        });
        this.#db = db;
      }
    }

    // 接続の確立とマイグレーション
    if (!this.#conn) {
      this.#conn = await this.#db.connect();
      await this.#query(sql`
        CREATE TABLE IF NOT EXISTS file_v0 (
          fullpath TEXT   NOT NULL PRIMARY KEY,
          path_seg TEXT[] NOT NULL,
          entityid UUID   NOT NULL,
          hash_md5 TEXT   NOT NULL,
          mime_typ TEXT   NOT NULL,
          cont_len BIGINT NOT NULL,
          last_mod BIGINT NOT NULL,
          desc_raw TEXT,
          desc_fts TEXT,
          meta_js  JSON
        );
      `);
      await this.#query(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS file_v0__entityid__idx ON file_v0 (entityid);
      `);
      await this.#flush();
    }
  }

  /**
   * データベースを切断します。
   */
  @mutex
  public async disconnect(): Promise<void> {
    if (this.#conn) {
      await this.#conn.query("CHECKPOINT;");
      await this.#conn.close();
      this.#conn = null; // 上記の処理をリトライできるように最後に null 設定
    }

    if (this.#db) {
      await this.#db.terminate();
      this.#db = null; // 上記の処理をリトライできるように最後に null 設定
    }
  }

  /**
   * ファイルの付帯情報を作成します。
   *
   * @param inp ファイルの付帯情報を作成するための入力パラメーターです。
   */
  @mutex
  public async create(inp: CreateInput): Promise<void> {
    const {
      checksum,
      entityId,
      filePath,
      fileSize: contLen,
      metadata = null,
      mimeType: mimeTyp = getMimeType(filePath.basename),
      description: descRaw = null,
    } = inp;
    const descFts = descRaw === null ? null : await this.#toFtsStr(descRaw);
    const metaJs = metadata === null ? null : this.#metaJson.stringify(metadata);
    try {
      await this.#query(sql`
        INSERT INTO file_v0 (
          fullpath,
          path_seg,
          entityid,
          hash_md5,
          mime_typ,
          cont_len,
          last_mod,
          desc_raw,
          desc_fts,
          meta_js
        ) VALUES (
          ${filePath.fullpath},
          ARRAY[${join(filePath.segments, ",")}],
          ${entityId},
          ${checksum},
          ${mimeTyp},
          ${contLen},
          ${Date.now()},
          ${descRaw},
          ${descFts},
          ${metaJs}
        );
      `);
    } catch (ex) {
      if (ex instanceof Error) {
        const msg = String(ex.message);
        if (msg.startsWith(`Constraint Error: Duplicate key "fullpath: `)) {
          throw new MopfsFileExistsError(this.#bucketName, filePath, { cause: ex });
        }
      }

      throw ex;
    }

    await this.#flush();
  }

  /**
   * ファイルの付帯情報を取得します。
   *
   * @param inp ファイルの付帯情報を取得するための入力パラメーターです。
   * @returns ファイルの付帯情報を取得した結果です。
   * @throws ファイルが見つからない場合は `MopfsFileNotFoundError` を投げます。
   */
  @mutex.readonly
  public async read(inp: ReadInput): Promise<ReadOutput> {
    const { filePath } = inp;
    const rows = await this.#query(sql`
      SELECT
        entityid,
        hash_md5,
        mime_typ,
        cont_len,
        last_mod
      FROM
        file_v0
      WHERE
        fullpath = ${filePath.fullpath};
    `);
    const row = rows.at(0);
    if (row === null) {
      throw new MopfsFileNotFoundError(this.#bucketName, filePath);
    }

    const {
      entityid: entityId,
      hash_md5: checksum,
      mime_typ: mimeType,
      cont_len: fileSize,
      last_mod: lastModified,
    } = jsonify<{
      entityid: v.InferOutput<typeof schemas.EntityId>;
      hash_md5: v.InferOutput<typeof schemas.Checksum>;
      mime_typ: v.InferOutput<typeof schemas.MimeType>;
      cont_len: v.InferOutput<typeof schemas.UnsignedInteger>;
      last_mod: v.InferOutput<typeof schemas.UnsignedInteger>;
    }>(row);

    return {
      entityId,
      checksum,
      mimeType,
      fileSize,
      lastModified,
    };
  }

  /**
   * 実際に保存されているファイルの識別子を取得します。
   *
   * @param inp 実際に保存されているファイルの識別子を取得するための入力パラメーターです。
   * @returns 実際に保存されているファイルの識別子の取得した結果です。
   * @throws ファイルが見つからない場合は `MopfsFileNotFoundError` を投げます。
   */
  @mutex.readonly
  public async readEntityId(inp: ReadEntityIdInput): Promise<ReadEntityIdOutput> {
    const { filePath } = inp;
    const rows = await this.#query(sql`
      SELECT
        entityid
      FROM
        file_v0
      WHERE
        fullpath = ${filePath.fullpath};
    `);
    const row = rows.at(0);
    if (row === null) {
      throw new MopfsFileNotFoundError(this.#bucketName, filePath);
    }

    const {
      entityid: entityId,
    } = jsonify<{ entityid: v.InferOutput<typeof schemas.EntityId> }>(row);

    return { entityId };
  }

  /**
   * ファイルの説明文を取得します。
   *
   * @param inp ファイルの説明文を取得するための入力パラメーターです。
   * @returns ファイルの説明文を取得した結果です。
   * @throws ファイルが見つからない場合は `MopfsFileNotFoundError` を投げます。
   */
  @mutex.readonly
  public async readDescription(inp: ReadDescriptionInput): Promise<ReadDescriptionOutput> {
    const { filePath } = inp;
    const rows = await this.#query(sql`
      SELECT
        desc_raw
      FROM
        file_v0
      WHERE
        fullpath = ${filePath.fullpath};
    `);
    const row = rows.at(0);
    if (row === null) {
      throw new MopfsFileNotFoundError(this.#bucketName, filePath);
    }

    const {
      desc_raw: description,
    } = jsonify<{ desc_raw: string | null }>(row);

    return { description };
  }

  /**
   * ファイルのメタデータを取得します。
   *
   * @param inp ファイルのメタデータを取得するための入力パラメーターです。
   * @returns ファイルのメタデータを取得した結果です。
   * @throws ファイルが見つからない場合は `MopfsFileNotFoundError` を投げます。
   */
  @mutex.readonly
  public async readMetadata(inp: ReadMetadataInput): Promise<ReadMetadataOutput> {
    const { filePath } = inp;
    const rows = await this.#query(sql`
      SELECT
        meta_js
      FROM
        file_v0
      WHERE
        fullpath = ${filePath.fullpath};
    `);
    const row = rows.at(0);
    if (row === null) {
      throw new MopfsFileNotFoundError(this.#bucketName, filePath);
    }

    const {
      meta_js: metaJs,
    } = jsonify<{ meta_js: string | null }>(row);
    if (metaJs === null) {
      return { metadata: null };
    }

    return {
      metadata: this.#metaJson.parse(metaJs),
    };
  }

  /**
   * ファイルの付帯情報を移動します。
   *
   * @param inp ファイルの付帯情報を移動するための入力パラメーターです。
   * @throws 移動元ファイルが見つからない場合は `MopfsFileNotFoundError` を、移動先ファイルがすでに存在する場合は `MopfsFileExistsError` を投げます。
   */
  @mutex
  public async move(inp: MoveInput): Promise<void> {
    const {
      srcFilePath,
      dstFilePath,
    } = inp;
    let rows: Table;
    try {
      rows = await this.#query(sql`
        UPDATE
          file_v0
        SET
          fullpath = ${dstFilePath.fullpath},
          path_seg = ARRAY[${join(dstFilePath.segments, ",")}]
        WHERE
          fullpath = ${srcFilePath.fullpath};
      `);
    } catch (ex) {
      if (ex instanceof Error) {
        const msg = String(ex.message);
        if (msg.startsWith(`Constraint Error: Duplicate key "fullpath: `)) {
          throw new MopfsFileExistsError(this.#bucketName, dstFilePath, { cause: ex });
        }
      }

      throw ex;
    }

    const {
      Count: count,
    } = jsonify<{ Count: number }>(rows.at(0));
    if (count === 0) {
      throw new MopfsFileNotFoundError(this.#bucketName, srcFilePath);
    }

    await this.#flush();
  }

  /**
   * ファイルの付帯情報をコピーします。
   *
   * @param inp ファイルの付帯情報をコピーするための入力パラメーターです。
   * @throws コピー元ファイルが見つからない場合は `MopfsFileNotFoundError` を、コピー先ファイルがすでに存在する場合は `MopfsFileExistsError` を投げます。
   */
  @mutex
  public async copy(inp: CopyInput): Promise<void> {
    const {
      srcFilePath,
      dstFilePath,
      dstEntityId,
    } = inp;
    let rows: Table;
    try {
      rows = await this.#query(sql`
        INSERT INTO file_v0 (
          fullpath,
          path_seg,
          entityid,
          hash_md5,
          mime_typ,
          cont_len,
          last_mod,
          desc_raw,
          desc_fts,
          meta_js
        )
        SELECT
          ${dstFilePath.fullpath},
          ARRAY[${join(dstFilePath.segments, ",")}],
          ${dstEntityId},
          hash_md5,
          mime_typ,
          cont_len,
          last_mod,
          desc_raw,
          desc_fts,
          meta_js
        FROM
          file_v0
        WHERE
          fullpath = ${srcFilePath.fullpath};
      `);
    } catch (ex) {
      if (ex instanceof Error) {
        const msg = String(ex.message);
        if (msg.startsWith(`Constraint Error: Duplicate key "fullpath: `)) {
          throw new MopfsFileExistsError(this.#bucketName, dstFilePath, { cause: ex });
        }
      }

      throw ex;
    }

    const {
      Count: count,
    } = jsonify<{ Count: number }>(rows.at(0));
    if (count === 0) {
      throw new MopfsFileNotFoundError(this.#bucketName, srcFilePath);
    }

    await this.#flush();
  }

  /**
   * ファイルの付帯情報を更新します。
   *
   * @param inp ファイルの付帯情報を更新するための入力パラメーターです。
   * @throws ファイルが見つからない場合は `MopfsFileNotFoundError` を投げます。
   */
  @mutex
  public async update(inp: UpdateInput): Promise<void> {
    const {
      checksum,
      filePath,
      fileSize: contLen,
      metadata,
      mimeType: mimeTyp,
      description: descRaw,
      newEntityId,
      oldEntityId,
    } = inp;
    if (
      checksum === undefined
      && contLen === undefined
      && metadata === undefined
      && mimeTyp === undefined
      && descRaw === undefined
      && newEntityId === undefined
      && oldEntityId === undefined
    ) {
      const rows = await this.#query(sql`
        SELECT
          COUNT(*) AS "Count"
        FROM
          file_v0
        WHERE
          fullpath = ${filePath.fullpath};`);
      const {
        Count: count,
      } = jsonify<{ Count: number }>(rows.at(0));
      if (count === 0) {
        throw new MopfsFileNotFoundError(this.#bucketName, filePath);
      }

      return;
    }

    const stmt: Sql[] = [];
    stmt.push(sql`
      UPDATE
        file_v0
      SET
        last_mod = ${Date.now()}`);

    if (newEntityId !== undefined) {
      stmt.push(sql`,
        entityid = ${newEntityId}`);
    }

    if (checksum !== undefined) {
      stmt.push(sql`,
        hash_md5 = ${checksum}`);
    }

    if (mimeTyp !== undefined) {
      stmt.push(sql`,
        mime_typ = ${mimeTyp}`);
    }

    if (contLen !== undefined) {
      stmt.push(sql`,
        cont_len = ${contLen}`);
    }

    if (descRaw !== undefined) {
      if (descRaw === null) {
        stmt.push(sql`,
        desc_raw = NULL,
        desc_fts = NULL`);
      } else {
        const descFts = await this.#toFtsStr(descRaw);
        stmt.push(sql`,
        desc_raw = ${descRaw},
        desc_fts = ${descFts}`);
      }
    }

    if (metadata !== undefined) {
      if (metadata === null) {
        stmt.push(sql`,
        meta_js = NULL`);
      } else {
        const metaJs = this.#metaJson.stringify(metadata);
        stmt.push(sql`,
        meta_js = ${metaJs}`);
      }
    }

    stmt.push(sql`
      WHERE
        fullpath = ${filePath.fullpath}
    `);
    if (oldEntityId !== undefined) {
      stmt.push(sql`
        AND entityid = ${oldEntityId}`);
    }

    const rows = await this.#query(join(stmt, ""));
    const {
      Count: count,
    } = jsonify<{ Count: number }>(rows.at(0));
    if (count === 0) {
      throw new MopfsFileNotFoundError(this.#bucketName, filePath);
    }

    await this.#flush();
  }

  /**
   * ファイルの付帯情報を削除します。
   *
   * @param inp ファイルの付帯情報を削除するための入力パラメーターです。
   * @throws ファイルが見つからない場合は `MopfsFileNotFoundError` を投げます。
   */
  @mutex
  public async delete(inp: DeleteInput): Promise<void> {
    const { filePath } = inp;
    const rows = await this.#query(sql`
      DELETE FROM
        file_v0
      WHERE
        fullpath = ${filePath.fullpath};
    `);
    const {
      Count: count,
    } = jsonify<{ Count: number }>(rows.at(0));
    if (count === 0) {
      throw new MopfsFileNotFoundError(this.#bucketName, filePath);
    }

    await this.#flush();
  }

  /**
   * パスが存在するか確認します。
   *
   * @param inp パスが存在するか確認するための入力パラメーターです。
   * @returns パスが存在するか確認した結果です。
   */
  @mutex.readonly
  public async exists(inp: ExistsInput): Promise<ExistsOutput> {
    if ("filePath" in inp) {
      const { filePath } = inp;
      const rows = await this.#query(sql`
        SELECT
          1
        FROM
          file_v0
        WHERE
          fullpath = ${filePath.fullpath}
      `);

      return {
        exists: rows.numRows === 1,
      };
    }

    const { dirPath } = inp;
    if (dirPath.length === 0) {
      return {
        exists: true,
      };
    }

    const stmt: Sql[] = [];
    stmt.push(sql`
      SELECT
        1
      FROM
        file_v0
      WHERE
        array_length(path_seg, 1) > ${dirPath.length}`);
    for (let i = 0; i < dirPath.length; i++) {
      stmt.push(sql`
        AND path_seg[${raw((i + 1).toString(10))}] = ${dirPath[i]}`);
    }
    stmt.push(sql`
      LIMIT
        1`);
    const rows = await this.#query(join(stmt, ""));

    return {
      exists: rows.numRows === 1,
    };
  }

  /**
   * ファイルやディレクトリーのステータス情報を取得します。
   *
   * @param inp ファイルやディレクトリーのステータス情報を取得するための入力パラメーターです。
   * @returns ファイルやディレクトリーのステータス情報を取得した結果です。
   */
  @mutex.readonly
  public async stat(inp: StatInput): Promise<StatOutput> {
    const { path } = inp;
    const {
      fullpath: filePath,
      segments: dirPath,
    } = path;
    const stmt: Sql[] = [];
    stmt.push(sql`
      SELECT
      (
        SELECT
          1
        FROM
          file_v0
        WHERE
          fullpath = ${filePath}
      ) AS is_file`);
    stmt.push(sql`,
      (
        SELECT
          1
        FROM
          file_v0
        WHERE
          array_length(path_seg, 1) > ${dirPath.length}`);
    for (let i = 0; i < dirPath.length; i++) {
      stmt.push(sql`
          AND path_seg[${raw((i + 1).toString(10))}] = ${dirPath[i]}`);
    }

    stmt.push(sql`
        LIMIT
          1
      ) AS is_directory`);
    const rows = await this.#query(join(stmt, ""));
    const {
      is_file: isFile,
      is_directory: isDirectory,
    } = jsonify<{
      is_file: 1 | null;
      is_directory: 1 | null;
    }>(rows.at(0));

    return {
      isFile: !!isFile,
      isDirectory: !!isDirectory,
    };
  }

  /**
   * ファイルの説明文を対象に全文検索します。
   *
   * @param inp ファイルの説明文を対象に全文検索するための入力パラメーターです。
   * @returns 検索結果です。
   */
  @mutex // インデックスを作成するために .readonly はつけられない。
  public async search(inp: SearchInput): Promise<SearchOutput[]> {
    const {
      query,
      limit,
      dirPath,
      recursive = false,
      scoreThreshold = 0,
    } = inp;
    // 検索前にインデックスを更新します。
    // ドキュメント:
    // https://duckdb.org/docs/stable/core_extensions/full_text_search.html#pragma-create_fts_index
    await this.#query(sql`
      PRAGMA create_fts_index(
        file_v0, fullpath, desc_fts,
        stemmer       = 'none',
        stopwords     = 'none',
        ignore        = '',
        strip_accents = false,
        lower         = false,
        overwrite     = true
      );
    `);
    const op = recursive ? raw(">=") : raw("=");
    const fstQuery = await this.#toFtsStr(query);
    const stmt: Sql[] = [];
    stmt.push(sql`
      SELECT
        fullpath,
        desc_raw,
        fts_main_file_v0.match_bm25(fullpath, ${fstQuery}) AS search_score
      FROM
        file_v0
      WHERE
        array_length(path_seg, 1) ${op} ${dirPath.length + 1}`);
    for (let i = 0; i < dirPath.length; i++) {
      stmt.push(sql`
        AND path_seg[${raw((i + 1).toString(10))}] = ${dirPath[i]}`);
    }
    stmt.push(sql`
        AND search_score IS NOT NULL
        AND search_score >= ${scoreThreshold}
      ORDER BY
        search_score DESC`);
    if (limit !== undefined) {
      stmt.push(sql`
      LIMIT
        ${limit}`);
    }

    const out: SearchOutput[] = [];
    const rows = await this.#query(join(stmt, ""));
    for (const row of rows) {
      const {
        fullpath,
        desc_raw: description,
        search_score: searchScore,
      } = jsonify<{
        fullpath: string;
        desc_raw: string;
        search_score: number;
      }>(row);
      out.push({
        filePath: new Path(fullpath),
        description,
        searchScore,
      });
    }

    return out;
  }

  /**
   * ディレクトリーまたはファイルをリストアップします。
   *
   * @param inp ディレクトリーまたはファイルをリストアップするための入力パラメーターです。
   * @returns リストアップした結果です。
   */
  @mutex.readonly
  public async list(inp: ListInput): Promise<ListOutput[]> {
    const {
      limit,
      offset = 0,
      dirPath,
      orderByName = "ASC",
    } = inp;
    const stmt: Sql[] = [];
    const nameIdxSql = raw((dirPath.length + 1).toString(10));
    const pathSegLenSql = raw((dirPath.length + 1).toString(10));
    stmt.push(sql`
      SELECT
        DISTINCT
        path_seg[${nameIdxSql}] AS name,
        array_length(path_seg, 1) = ${pathSegLenSql} AS is_file
      FROM
        file_v0
      WHERE
        array_length(path_seg, 1) >= ${pathSegLenSql}`);
    for (let i = 0; i < dirPath.length; i++) {
      stmt.push(sql`
        AND path_seg[${raw((i + 1).toString(10))}] = ${dirPath[i]}`);
    }

    stmt.push(sql`
      ORDER BY
        is_file ASC,
        name ${raw(orderByName)}`);
    // ページネーションを適用します。
    if (limit !== undefined && limit > 0) {
      stmt.push(sql`
      LIMIT
        ${limit}`);
    }
    if (offset > 0) {
      stmt.push(sql`
      OFFSET
        ${offset}`);
    }

    const out: ListOutput[] = [];
    const rows = await this.#query(join(stmt, ""));
    for (const row of rows) {
      const {
        name,
        is_file: isFile,
      } = jsonify<{ is_file: boolean; name: string }>(row);
      out.push({
        name,
        isFile,
      });
    }

    return out;
  }
}
