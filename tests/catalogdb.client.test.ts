import * as duckdb from "@duckdb/duckdb-wasm";
import eHworker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdbWasmEh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import duckdbWasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import initLindera, { type Tokenizer, TokenizerBuilder } from "lindera-wasm-ipadic";
import linderaWasm from "lindera-wasm-ipadic/lindera_wasm_bg.wasm?url";
import superjson from "superjson";
import * as v from "valibot";
import { beforeAll, describe, test as vitest } from "vitest";
import Catalogdb, { type DuckdbBundle, type DuckdbLogger } from "../src/catalogdb.js";
import getEntityId from "../src/get-entity-id.js";
import { MopfsFileExistsError, MopfsFileNotFoundError, Path, schemas } from "../src/index.js";

let duckdbBundle: DuckdbBundle;
let duckdbLogger: DuckdbLogger;
// @ts-ignore
let jpnTokenizer: Tokenizer; // 現在未使用

beforeAll(async () => {
  // https://duckdb.org/docs/stable/clients/wasm/instantiation#vite
  duckdbBundle = await duckdb.selectBundle({
    mvp: {
      mainModule: duckdbWasm,
      mainWorker: mvpWorker,
    },
    eh: {
      mainModule: duckdbWasmEh,
      mainWorker: eHworker,
    },
  });
  duckdbLogger = __DEBUG__
    ? new duckdb.ConsoleLogger()
    : new duckdb.VoidLogger();
  await initLindera(linderaWasm);
  const builder = new TokenizerBuilder();
  builder.setDictionaryKind("ipadic");
  builder.setMode("normal");
  builder.appendCharacterFilter("unicode_normalize", { kind: "nfkc" });
  builder.appendTokenFilter("lowercase", {});
  builder.appendTokenFilter("japanese_compound_word", {
    kind: "ipadic",
    tags: ["名詞,数"],
    new_tag: "名詞,数",
  });
  jpnTokenizer = builder.build();
});

const test = vitest.extend<{
  catalog: Catalogdb;
}>({
  async catalog({}, use) {
    const catalog = new Catalogdb({
      logger: console,
      bucketName: asBucketName("test"),
      duckdb: {
        bundle: duckdbBundle,
        logger: duckdbLogger,
      },
      json: undefined,
      maxDescriptionSize: astMaxDescriptionSize(16),
      maxMetadataJsonSize: asMaxMetadataJsonSize(16),
      toFullTextSearchString: undefined,
    });
    await catalog.connect();
    await use(catalog);
    await catalog.disconnect();
    const fs = await window.navigator.storage.getDirectory();
    await fs.removeEntry("managed-opfs", { recursive: true }).catch(() => {});
  },
});

describe("file system", () => {
  test("storage-access の権限が granted である", async ({ expect }) => {
    const status = await window.navigator.permissions.query({ name: "storage-access" });

    expect(status.state).toBe("granted");
  });

  test("/managed-opfs/test/catalog.db が存在する", async ({ catalog, expect }) => {
    catalog; // `catalog` を取り出すことでセットアップされる。

    const fs = await window.navigator.storage.getDirectory();
    const opfs = await fs.getDirectoryHandle("managed-opfs");
    const bucket = await opfs.getDirectoryHandle("test");
    const keys = await Array.fromAsync(bucket.keys());
    keys.sort();

    expect(keys).toEqual([
      "catalog.db",
      "catalog.db.wal",
    ]);
  });
});

describe("create", () => {
  test("ファイルの付帯情報を作成できる", async ({ catalog, expect }) => {
    await expect(catalog.create({
      filePath: Path.parse("path/to/file.txt"),
      entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
  });

  test("重複するファイルパスでエラー", async ({ catalog, expect }) => {
    await expect(catalog.create({
      filePath: Path.parse("path/to/file.txt"),
      entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.create({
      filePath: Path.parse("path/to/file.txt"),
      entityId: asEntityId("e3079662-e79a-49b7-bc19-9c242909f52a"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: undefined,
      metadata: undefined,
    }))
      .rejects
      .toThrow(MopfsFileExistsError);
  });

  test("サイズ上限を超える説明文でエラー", async ({ catalog, expect }) => {
    await expect(catalog.create({
      filePath: Path.parse("path/to/file.txt"),
      entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: "foobarfoobarfoobar", // .length === 18 > 16
      metadata: undefined,
    }))
      .rejects
      .toThrow(v.ValiError);
    await expect(catalog.create({
      filePath: Path.parse("path/to/file.txt"),
      entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: "foobarfoobar", // .length === 12 * 2 = 24 > 16
      metadata: undefined,
    }))
      .rejects
      .toThrow(v.ValiError);
  });

  test("サイズ上限を超えるメタデータでエラー", async ({ catalog, expect }) => {
    await expect(catalog.create({
      filePath: Path.parse("path/to/file.txt"),
      entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: undefined,
      metadata: { key: 123456789 }, // '{"key":123456789}'.length === 17 > 16
    }))
      .rejects
      .toThrow(v.ValiError);
  });

  test("重複したエンティティでエラー", async ({ catalog, expect }) => {
    await expect(catalog.create({
      filePath: Path.parse("path/to/file.txt"),
      entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.create({
      filePath: Path.parse("path/to/file.mp4"),
      entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("video/mp4"),
      fileSize: asUint(128),
      description: undefined,
      metadata: undefined,
    }))
      .rejects
      .toThrowError(
        "Duplicate key \"entityid: e9922a1d-ad8d-46e2-ad7b-0a989fe31251\" violates unique constraint.",
      );
  });
});

describe("read", () => {
  test("ファイルの付帯情報を取得できる", async ({ catalog, expect }) => {
    const filePath = Path.parse("path/to/file.txt");

    await expect(catalog.create({
      filePath,
      entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.read({ filePath }))
      .resolves
      .toEqual({
        entityId: "e9922a1d-ad8d-46e2-ad7b-0a989fe31251",
        checksum: "0".repeat(32),
        mimeType: "text/plain",
        fileSize: 128,
        lastModified: expect.any(Number),
      });
  });

  test("存在しないファイルの付帯情報を取得しようとしてエラー", async ({ catalog, expect }) => {
    const filePath = Path.parse("path/to/file.txt");

    await expect(catalog.read({ filePath }))
      .rejects
      .toThrow(MopfsFileNotFoundError);
  });
});

describe("readDescription", () => {
  test("ファイルの説明文を取得できる", async ({ expect }) => {
    const catalog = new Catalogdb({
      logger: console,
      bucketName: asBucketName("test"),
      duckdb: {
        bundle: duckdbBundle,
        logger: duckdbLogger,
      },
      json: undefined,
      maxDescriptionSize: astMaxDescriptionSize(1024),
      maxMetadataJsonSize: asMaxMetadataJsonSize(1024),
      toFullTextSearchString: undefined,
    });
    await catalog.connect();
    await using stack = new AsyncDisposableStack();
    stack.defer(async () => {
      await catalog.disconnect();
      const fs = await window.navigator.storage.getDirectory();
      await fs.removeEntry("managed-opfs", { recursive: true }).catch(() => {});
    });

    // 説明文なし
    {
      const filePath = Path.parse("path/to/file.txt");

      await expect(catalog.create({
        filePath,
        entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
        checksum: asChecksum("0".repeat(32)),
        mimeType: asMimeType("text/plain"),
        fileSize: asUint(128),
        description: undefined,
        metadata: undefined,
      }))
        .resolves
        .toBeUndefined();
      await expect(catalog.readDescription({ filePath }))
        .resolves
        .toEqual({
          description: null,
        });
    }

    // 説明文あり
    {
      const filePath = Path.parse("path/to/file.mp4");

      await expect(catalog.create({
        filePath,
        entityId: asEntityId("e3079662-e79a-49b7-bc19-9c242909f52a"),
        checksum: asChecksum("0".repeat(32)),
        mimeType: asMimeType("video/mp4"),
        fileSize: asUint(128),
        description: "これは動画の説明文です。",
        metadata: undefined,
      }))
        .resolves
        .toBeUndefined();
      await expect(catalog.readDescription({ filePath }))
        .resolves
        .toEqual({
          description: "これは動画の説明文です。",
        });
    }
  });

  test("存在しないファイルの説明文を取得しようとしてエラー", async ({ catalog, expect }) => {
    const filePath = Path.parse("path/to/file.txt");

    await expect(catalog.readDescription({ filePath }))
      .rejects
      .toThrow(MopfsFileNotFoundError);
  });
});

describe("readMetadata", () => {
  test("ファイルのメタデータを読み込める", async ({ expect }) => {
    const catalog = new Catalogdb({
      logger: console,
      bucketName: asBucketName("test"),
      duckdb: {
        bundle: duckdbBundle,
        logger: duckdbLogger,
      },
      json: undefined,
      maxDescriptionSize: astMaxDescriptionSize(1024),
      maxMetadataJsonSize: asMaxMetadataJsonSize(1024),
      toFullTextSearchString: undefined,
    });
    await catalog.connect();
    await using stack = new AsyncDisposableStack();
    stack.defer(async () => {
      await catalog.disconnect();
      const fs = await window.navigator.storage.getDirectory();
      await fs.removeEntry("managed-opfs", { recursive: true }).catch(() => {});
    });

    // メタデータなし
    {
      const filePath = Path.parse("path/to/file.txt");

      await expect(catalog.create({
        filePath,
        entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
        checksum: asChecksum("0".repeat(32)),
        mimeType: asMimeType("text/plain"),
        fileSize: asUint(128),
        description: undefined,
        metadata: undefined,
      }))
        .resolves
        .toBeUndefined();
      await expect(catalog.readMetadata({ filePath }))
        .resolves
        .toEqual({
          metadata: null,
        });
    }

    // メタデータあり
    {
      const filePath = Path.parse("path/to/file.mp4");

      await expect(catalog.create({
        filePath,
        entityId: asEntityId("e3079662-e79a-49b7-bc19-9c242909f52a"),
        checksum: asChecksum("0".repeat(32)),
        mimeType: asMimeType("video/mp4"),
        fileSize: asUint(128),
        description: undefined,
        metadata: {
          key: "value",
          map: new Map([[1, 2]]),
          foo: {
            toJSON() {
              return "bar";
            },
          },
        },
      }))
        .resolves
        .toBeUndefined();
      await expect(catalog.readMetadata({ filePath }))
        .resolves
        .toEqual({
          metadata: {
            key: "value",
            map: {},
            foo: "bar",
          },
        });
    }
  });

  test("存在しないファイルのメタデータを取得しようとしてエラー", async ({ catalog, expect }) => {
    const filePath = Path.parse("path/to/file.txt");

    await expect(catalog.readMetadata({ filePath }))
      .rejects
      .toThrow(MopfsFileNotFoundError);
  });

  test("JSON のシリアライザー/デシリアライザーを指定できる", async ({ expect }) => {
    const catalog = new Catalogdb({
      logger: console,
      bucketName: asBucketName("test"),
      duckdb: {
        bundle: duckdbBundle,
        logger: duckdbLogger,
      },
      json: superjson,
      maxDescriptionSize: astMaxDescriptionSize(1024),
      maxMetadataJsonSize: asMaxMetadataJsonSize(1024),
      toFullTextSearchString: undefined,
    });
    await catalog.connect();
    await using stack = new AsyncDisposableStack();
    stack.defer(async () => {
      await catalog.disconnect();
      const fs = await window.navigator.storage.getDirectory();
      await fs.removeEntry("managed-opfs", { recursive: true }).catch(() => {});
    });

    const filePath = Path.parse("path/to/file.mp4");

    await expect(catalog.create({
      filePath,
      entityId: asEntityId("e3079662-e79a-49b7-bc19-9c242909f52a"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("video/mp4"),
      fileSize: asUint(128),
      description: undefined,
      metadata: {
        key: "value",
        map: new Map([[1, 2]]),
        foo: {
          toJSON() {
            return "bar";
          },
        },
      },
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.readMetadata({ filePath }))
      .resolves
      .toEqual({
        metadata: {
          key: "value",
          map: new Map([[1, 2]]),
          foo: "bar",
        },
      });
  });
});

describe("move", () => {
  test("ファイルを移動できる", async ({ catalog, expect }) => {
    const srcFilePath = Path.parse("path/to/file.txt");
    const dstFilePath = Path.parse("path/to/moved.txt");

    await expect(catalog.create({
      filePath: srcFilePath,
      entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.move({
      srcFilePath,
      dstFilePath,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.read({ filePath: srcFilePath }))
      .rejects
      .toThrow(MopfsFileNotFoundError);
    await expect(catalog.read({ filePath: dstFilePath }))
      .resolves
      .toEqual({
        entityId: "e9922a1d-ad8d-46e2-ad7b-0a989fe31251",
        checksum: "0".repeat(32),
        mimeType: "text/plain",
        fileSize: 128,
        lastModified: expect.any(Number),
      });
  });

  test("存在しないファイルを移動しようとしてエラー", async ({ catalog, expect }) => {
    const srcFilePath = Path.parse("path/to/file.txt");
    const dstFilePath = Path.parse("path/to/moved.txt");

    await expect(catalog.move({
      srcFilePath,
      dstFilePath,
    }))
      .rejects
      .toThrow(MopfsFileNotFoundError);
  });

  test("すでに存在するファイルパスへ移動しようとしてエラー", async ({ catalog, expect }) => {
    const srcFilePath = Path.parse("path/to/file.txt");
    const dstFilePath = Path.parse("path/to/moved.txt");

    await expect(catalog.create({
      filePath: dstFilePath,
      entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.move({
      srcFilePath,
      dstFilePath,
    }))
      .rejects
      .toThrow(MopfsFileNotFoundError);
  });
});

describe("copy", () => {
  test("ファイルをコピーできる", async ({ catalog, expect }) => {
    const srcFilePath = Path.parse("path/to/file.txt");
    const dstFilePath = Path.parse("path/to/copied.txt");

    await expect(catalog.create({
      filePath: srcFilePath,
      entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.copy({
      srcFilePath,
      dstFilePath,
      dstEntityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
    }))
      .rejects
      .toThrowError(
        "Duplicate key \"entityid: e9922a1d-ad8d-46e2-ad7b-0a989fe31251\" violates unique constraint.",
      );
    await expect(catalog.copy({
      srcFilePath,
      dstFilePath,
      dstEntityId: asEntityId("e3079662-e79a-49b7-bc19-9c242909f52a"),
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.read({ filePath: srcFilePath }))
      .resolves
      .toEqual({
        entityId: "e9922a1d-ad8d-46e2-ad7b-0a989fe31251",
        checksum: "0".repeat(32),
        mimeType: "text/plain",
        fileSize: 128,
        lastModified: expect.any(Number),
      });
    await expect(catalog.read({ filePath: dstFilePath }))
      .resolves
      .toEqual({
        entityId: "e3079662-e79a-49b7-bc19-9c242909f52a",
        checksum: "0".repeat(32),
        mimeType: "text/plain",
        fileSize: 128,
        lastModified: expect.any(Number),
      });
  });

  test("存在しないファイルをコピーしようとしてエラー", async ({ catalog, expect }) => {
    const srcFilePath = Path.parse("path/to/file.txt");
    const dstFilePath = Path.parse("path/to/copied.txt");

    await expect(catalog.copy({
      srcFilePath,
      dstFilePath,
      dstEntityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
    }))
      .rejects
      .toThrow(MopfsFileNotFoundError);
  });

  test("すでに存在するファイルへコピーしようとしてエラー", async ({ catalog, expect }) => {
    const srcFilePath = Path.parse("path/to/file.txt");
    const dstFilePath = Path.parse("path/to/copied.txt");

    await expect(catalog.create({
      filePath: srcFilePath,
      entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.create({
      filePath: dstFilePath,
      entityId: asEntityId("e3079662-e79a-49b7-bc19-9c242909f52a"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.copy({
      srcFilePath,
      dstFilePath,
      dstEntityId: asEntityId("2583336f-678e-4ca8-81a3-8c71f922c047"),
    }))
      .rejects
      .toThrow(MopfsFileExistsError);
  });
});

describe("update", () => {
  test("ファイルの付帯情報を更新できる", async ({ expect }) => {
    const catalog = new Catalogdb({
      logger: console,
      bucketName: asBucketName("test"),
      duckdb: {
        bundle: duckdbBundle,
        logger: duckdbLogger,
      },
      json: superjson,
      maxDescriptionSize: astMaxDescriptionSize(1024),
      maxMetadataJsonSize: asMaxMetadataJsonSize(1024),
      toFullTextSearchString: undefined,
    });
    await catalog.connect();
    await using stack = new AsyncDisposableStack();
    stack.defer(async () => {
      await catalog.disconnect();
      const fs = await window.navigator.storage.getDirectory();
      await fs.removeEntry("managed-opfs", { recursive: true }).catch(() => {});
    });

    const filePath = Path.parse("path/to/file.txt");

    await expect(catalog.create({
      filePath,
      entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: "old description",
      metadata: {
        old: "metadata",
      },
    }))
      .resolves
      .toBeUndefined();

    // checksum を更新
    await expect(catalog.update({
      filePath,
      checksum: asChecksum("1".repeat(32)),
      newEntityId: undefined,
      oldEntityId: undefined,
      mimeType: undefined,
      fileSize: undefined,
      description: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.read({ filePath }))
      .resolves
      .toMatchObject({
        checksum: "1".repeat(32),
      });

    // mimeType を更新
    await expect(catalog.update({
      filePath,
      mimeType: asMimeType("application/json"),
      newEntityId: undefined,
      oldEntityId: undefined,
      checksum: undefined,
      fileSize: undefined,
      description: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.read({ filePath }))
      .resolves
      .toMatchObject({
        mimeType: "application/json",
      });

    // fileSize を更新
    await expect(catalog.update({
      filePath,
      fileSize: asUint(256),
      newEntityId: undefined,
      oldEntityId: undefined,
      checksum: undefined,
      mimeType: undefined,
      description: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.read({ filePath }))
      .resolves
      .toMatchObject({
        fileSize: 256,
      });

    // description を更新
    await expect(catalog.update({
      filePath,
      description: "new description",
      newEntityId: undefined,
      oldEntityId: undefined,
      checksum: undefined,
      mimeType: undefined,
      fileSize: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.readDescription({ filePath }))
      .resolves
      .toEqual({
        description: "new description",
      });

    // metadata を更新
    await expect(catalog.update({
      filePath,
      metadata: {
        old: null,
        new: "metadata",
      },
      newEntityId: undefined,
      oldEntityId: undefined,
      checksum: undefined,
      mimeType: undefined,
      fileSize: undefined,
      description: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.readMetadata({ filePath }))
      .resolves
      .toEqual({
        metadata: {
          old: null,
          new: "metadata",
        },
      });

    // description を null に更新
    await expect(catalog.update({
      filePath,
      description: null,
      newEntityId: undefined,
      oldEntityId: undefined,
      checksum: undefined,
      mimeType: undefined,
      fileSize: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.readDescription({ filePath }))
      .resolves
      .toEqual({
        description: null,
      });

    // metadata を null に更新
    await expect(catalog.update({
      filePath,
      metadata: null,
      newEntityId: undefined,
      oldEntityId: undefined,
      checksum: undefined,
      mimeType: undefined,
      fileSize: undefined,
      description: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.readMetadata({ filePath }))
      .resolves
      .toEqual({
        metadata: null,
      });

    // checksum と fileSize を更新
    await expect(catalog.update({
      filePath,
      checksum: asChecksum("2".repeat(32)),
      fileSize: asUint(512),
      newEntityId: undefined,
      oldEntityId: undefined,
      mimeType: undefined,
      description: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.read({ filePath }))
      .resolves
      .toMatchObject({
        checksum: "2".repeat(32),
        fileSize: 512,
      });
  });
});

describe("delete", () => {
  test("ファイルの付帯情報を削除できる", async ({ catalog, expect }) => {
    const filePath = Path.parse("path/to/file.txt");

    await expect(catalog.create({
      filePath,
      entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.read({ filePath }))
      .resolves
      .toBeDefined();
    await expect(catalog.delete({ filePath }))
      .resolves
      .toBeUndefined();
    await expect(catalog.read({ filePath }))
      .rejects
      .toThrow(MopfsFileNotFoundError);
  });

  test("存在しないファイルを削除しようとしてエラー", async ({ catalog, expect }) => {
    const filePath = Path.parse("path/to/file.txt");

    await expect(catalog.delete({ filePath }))
      .rejects
      .toThrow(MopfsFileNotFoundError);
  });
});

describe("exists", () => {
  test("ファイルが存在する場合は true", async ({ catalog, expect }) => {
    const filePath = Path.parse("path/to/file.txt");

    await expect(catalog.create({
      filePath,
      entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect(catalog.exists({ filePath }))
      .resolves
      .toEqual({
        exists: true,
      });
  });

  test("ファイルが存在しない場合は false", async ({ catalog, expect }) => {
    const filePath = Path.parse("path/to/file.txt");

    await expect(catalog.exists({ filePath }))
      .resolves
      .toEqual({
        exists: false,
      });
  });

  test("ディレクトリが存在する場合は true", async ({ catalog, expect }) => {
    const filePath = Path.parse("path/to/file.txt");

    await expect(catalog.create({
      filePath,
      entityId: asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251"),
      checksum: asChecksum("0".repeat(32)),
      mimeType: asMimeType("text/plain"),
      fileSize: asUint(128),
      description: undefined,
      metadata: undefined,
    }))
      .resolves
      .toBeUndefined();
    await expect.soft(catalog.exists({ dirPath: [] }))
      .resolves
      .toEqual({
        exists: true,
      });
    await expect.soft(catalog.exists({ dirPath: ["path"] }))
      .resolves
      .toEqual({
        exists: true,
      });
    await expect.soft(catalog.exists({ dirPath: ["path", "to"] }))
      .resolves
      .toEqual({
        exists: true,
      });
  });

  test("ディレクトリが存在しない場合は false", async ({ catalog, expect }) => {
    await expect.soft(catalog.exists({ dirPath: [] }))
      .resolves
      .toEqual({
        exists: true,
      });
    await expect.soft(catalog.exists({ dirPath: ["path"] }))
      .resolves
      .toEqual({
        exists: false,
      });
    await expect.soft(catalog.exists({ dirPath: ["path", "to"] }))
      .resolves
      .toEqual({
        exists: false,
      });
  });
});

describe("stat", () => {
  test("パスのステータス情報を取得できる", async ({ catalog, expect }) => {
    const PATHS = [
      "file1.txt",
      "file1.txt/file2.txt",
      "a/file1.txt",
      "a/b/file1.txt",
    ];
    for (const path of PATHS) {
      await catalog.create({
        filePath: Path.parse(path),
        entityId: getEntityId(),
        checksum: asChecksum("0".repeat(32)),
        mimeType: asMimeType("text/plain"),
        fileSize: asUint(128),
        description: undefined,
        metadata: undefined,
      });
    }

    await expect.soft(catalog.stat({ path: Path.parse("file1.txt") }))
      .resolves
      .toEqual({
        isFile: true,
        isDirectory: true,
      });
    await expect.soft(catalog.stat({ path: Path.parse("a") }))
      .resolves
      .toEqual({
        isFile: false,
        isDirectory: true,
      });
    await expect.soft(catalog.stat({ path: Path.parse("a/file1.txt") }))
      .resolves
      .toEqual({
        isFile: true,
        isDirectory: false,
      });
    await expect.soft(catalog.stat({ path: Path.parse("a/b") }))
      .resolves
      .toEqual({
        isFile: false,
        isDirectory: true,
      });
    await expect.soft(catalog.stat({ path: Path.parse("a/b/file1.txt") }))
      .resolves
      .toEqual({
        isFile: true,
        isDirectory: false,
      });
  });
});

describe("search", () => {
  test("指定したディレクトリ直下の説明文を対象に全文検索できる", async ({ expect }) => {
    const catalog = new Catalogdb({
      logger: console,
      bucketName: asBucketName("test"),
      duckdb: {
        bundle: duckdbBundle,
        logger: duckdbLogger,
      },
      json: undefined,
      maxDescriptionSize: astMaxDescriptionSize(1024),
      maxMetadataJsonSize: asMaxMetadataJsonSize(1024),
      toFullTextSearchString: undefined,
    });
    await catalog.connect();
    await using stack = new AsyncDisposableStack();
    stack.defer(async () => {
      await catalog.disconnect();
      const fs = await window.navigator.storage.getDirectory();
      await fs.removeEntry("managed-opfs", { recursive: true }).catch(() => {});
    });

    const DOCS = {
      "path/file1.txt": "foo shallow",
      "path/to/file1.txt": "foo foo foo bar baz",
      "path/to/file2.txt": "foo foo bar bar",
      "path/to/file3.txt": "foo",
      "path/to/file4.txt": "qux",
      "path/to/file5.txt": undefined,
      "path/to/dir/file1.txt": "foo deep",
    };
    for (const [path, description] of Object.entries(DOCS)) {
      await expect(catalog.create({
        filePath: Path.parse(path),
        entityId: getEntityId(),
        checksum: asChecksum("0".repeat(32)),
        mimeType: asMimeType("text/plain"),
        fileSize: asUint(128),
        description,
        metadata: undefined,
      }))
        .resolves
        .toBeUndefined();
    }

    await expect(catalog.search({
      dirPath: ["path", "to"],
      query: "foo",
      limit: undefined,
      recursive: undefined,
      scoreThreshold: undefined,
    }))
      .resolves
      .toEqual([
        {
          filePath: expect.any(Path),
          description: "foo", // 完全一致
          searchScore: expect.any(Number),
        },
        {
          filePath: expect.any(Path),
          description: "foo foo foo bar baz", // 一致回数が多い
          searchScore: expect.any(Number),
        },
        {
          filePath: expect.any(Path),
          description: "foo foo bar bar", // 一致回数が少ない
          searchScore: expect.any(Number),
        },
      ]);
    await expect(catalog.search({
      dirPath: ["path", "to"],
      query: "foo",
      limit: asUint(1),
      recursive: undefined,
      scoreThreshold: undefined,
    }))
      .resolves
      .toEqual([
        {
          filePath: expect.any(Path),
          description: "foo", // 完全一致
          searchScore: expect.any(Number),
        },
      ]);
    await expect(catalog.search({
      dirPath: ["path", "to"],
      query: "bar",
      limit: undefined,
      recursive: undefined,
      scoreThreshold: undefined,
    }))
      .resolves
      .toEqual([
        {
          filePath: expect.any(Path),
          description: "foo foo bar bar", // 一致回数が多い
          searchScore: expect.any(Number),
        },
        {
          filePath: expect.any(Path),
          description: "foo foo foo bar baz", // 一致回数が少ない
          searchScore: expect.any(Number),
        },
      ]);
    await expect(catalog.search({
      dirPath: ["path"],
      query: "foo",
      limit: undefined,
      recursive: undefined,
      scoreThreshold: undefined,
    }))
      .resolves
      .toEqual([
        {
          filePath: expect.any(Path),
          description: "foo shallow",
          searchScore: expect.any(Number),
        },
      ]);
    await expect(catalog.search({
      dirPath: ["path", "to", "dir"],
      query: "foo",
      limit: undefined,
      recursive: undefined,
      scoreThreshold: undefined,
    }))
      .resolves
      .toEqual([
        {
          filePath: expect.any(Path),
          description: "foo deep",
          searchScore: expect.any(Number),
        },
      ]);
  });

  test("日本語で全文検索できる", async ({ expect }) => {
    const catalog = new Catalogdb({
      logger: console,
      bucketName: asBucketName("test"),
      duckdb: {
        bundle: duckdbBundle,
        logger: duckdbLogger,
      },
      json: undefined,
      maxDescriptionSize: astMaxDescriptionSize(1024),
      maxMetadataJsonSize: asMaxMetadataJsonSize(1024),
      toFullTextSearchString: undefined,
    });
    await catalog.connect();
    await using stack = new AsyncDisposableStack();
    stack.defer(async () => {
      await catalog.disconnect();
      const fs = await window.navigator.storage.getDirectory();
      await fs.removeEntry("managed-opfs", { recursive: true }).catch(() => {});
    });

    const DOCS = {
      "path/to/file1.txt": "これは日本語で書かれた説明文です",
      "path/to/file2.txt": "これは日本語で書かれた文字列です",
    };
    for (const [path, description] of Object.entries(DOCS)) {
      await catalog.create({
        filePath: Path.parse(path),
        entityId: getEntityId(),
        checksum: asChecksum("0".repeat(32)),
        mimeType: asMimeType("text/plain"),
        fileSize: asUint(128),
        description,
        metadata: undefined,
      });
    }

    await expect(catalog.search({
      dirPath: ["path", "to"],
      query: "説明",
      limit: undefined,
      recursive: undefined,
      scoreThreshold: undefined,
    }))
      .resolves
      .toEqual([
        {
          filePath: expect.any(Path),
          description: "これは日本語で書かれた説明文です",
          searchScore: expect.any(Number),
        },
      ]);
    await expect(catalog.search({
      dirPath: ["path", "to"],
      query: "字 説明",
      limit: undefined,
      recursive: undefined,
      scoreThreshold: undefined,
    }))
      .resolves
      .toEqual([
        {
          filePath: expect.any(Path),
          description: "これは日本語で書かれた説明文です",
          searchScore: expect.any(Number),
        },
        {
          filePath: expect.any(Path),
          description: "これは日本語で書かれた文字列です",
          searchScore: expect.any(Number),
        },
      ]);
    await expect(catalog.search({
      dirPath: ["path", "to"],
      query: "文字",
      limit: undefined,
      recursive: undefined,
      scoreThreshold: undefined,
    }))
      .resolves
      .toEqual([
        {
          filePath: expect.any(Path),
          description: "これは日本語で書かれた文字列です",
          searchScore: expect.any(Number),
        },
        {
          filePath: expect.any(Path),
          description: "これは日本語で書かれた説明文です",
          searchScore: expect.any(Number),
        },
      ]);
  });
});

describe("list", () => {
  test("ディレクトリとファイルをリストアップできる", async ({ catalog, expect }) => {
    const PATHS = [
      "file1.txt",
      "file1.txt/file2.txt",
      "a",
      "a/file1.txt",
      "a/b/file1.txt",
      "a/b/file2.txt",
      "a/d/file1.txt",
      "b/c/d/file1.txt",
    ];
    for (const path of PATHS) {
      await catalog.create({
        filePath: Path.parse(path),
        entityId: getEntityId(),
        checksum: asChecksum("0".repeat(32)),
        mimeType: asMimeType("text/plain"),
        fileSize: asUint(128),
        description: undefined,
        metadata: undefined,
      });
    }

    await expect.soft(catalog.list({
      dirPath: [],
      limit: undefined,
      offset: undefined,
      orderByName: undefined,
    }))
      .resolves
      .toEqual([
        {
          isFile: false,
          name: "a",
        },
        {
          isFile: false,
          name: "b",
        },
        {
          isFile: false,
          name: "file1.txt",
        },
        {
          isFile: true,
          name: "a",
        },
        {
          isFile: true,
          name: "file1.txt",
        },
      ]);
    await expect.soft(catalog.list({
      dirPath: ["a"],
      limit: undefined,
      offset: undefined,
      orderByName: undefined,
    }))
      .resolves
      .toEqual([
        {
          isFile: false,
          name: "b",
        },
        {
          isFile: false,
          name: "d",
        },
        {
          isFile: true,
          name: "file1.txt",
        },
      ]);
    await expect.soft(catalog.list({
      dirPath: ["a", "b"],
      limit: undefined,
      offset: undefined,
      orderByName: undefined,
    }))
      .resolves
      .toEqual([
        {
          isFile: true,
          name: "file1.txt",
        },
        {
          isFile: true,
          name: "file2.txt",
        },
      ]);
    await expect.soft(catalog.list({
      dirPath: ["b", "c"],
      limit: undefined,
      offset: undefined,
      orderByName: undefined,
    }))
      .resolves
      .toEqual([
        {
          isFile: false,
          name: "d",
        },
      ]);
  });
});

function asBucketName(name: string) {
  return v.parse(schemas.BucketName, name);
}

function astMaxDescriptionSize(size: number) {
  return v.parse(schemas.HalfUnsignedInteger, size);
}

function asMaxMetadataJsonSize(size: number) {
  return v.parse(schemas.UnsignedInteger, size);
}

function asEntityId(str: string) {
  return v.parse(schemas.EntityId, str);
}

function asChecksum(str: string) {
  return v.parse(schemas.Checksum, str);
}

function asMimeType(str: string) {
  return v.parse(schemas.MimeType, str);
}

function asUint(num: number) {
  return v.parse(schemas.UnsignedInteger, num);
}
