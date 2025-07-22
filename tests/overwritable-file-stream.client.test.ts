import * as duckdb from "@duckdb/duckdb-wasm";
import eHworker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdbWasmEh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import duckdbWasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import * as v from "valibot";
import { beforeAll, test as vitest } from "vitest";
import Catalogdb, { type DuckdbBundle, type DuckdbLogger } from "../src/catalogdb.js";
import {
  hash,
  MopfsFileNotFoundError,
  OverwritableFileStream,
  Path,
  schemas,
} from "../src/index.js";
import jsonify from "../src/jsonify.js";

let duckdbBundle: DuckdbBundle;
let duckdbLogger: DuckdbLogger;

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
});

const test = vitest.extend<{
  catalog: Catalogdb;
  bucket: Readonly<Record<"main", FileSystemDirectoryHandle>>;
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
      maxDescriptionSize: asMaxDescriptionSize(16),
      maxMetadataJsonSize: asMaxMetadataJsonSize(16),
      toFullTextSearchString: undefined,
    });
    await catalog.connect();
    await use(catalog);
    await catalog.disconnect();
    const fs = await window.navigator.storage.getDirectory();
    await fs.removeEntry("managed-opfs", { recursive: true }).catch(() => {});
  },
  async bucket({}, use) {
    const fs = await window.navigator.storage.getDirectory();
    const mopfs = await fs.getDirectoryHandle("managed-opfs", { create: true });
    const bucket = await mopfs.getDirectoryHandle("test", { create: true });
    await use({
      main: await bucket.getDirectoryHandle("main", { create: true }),
    });
    await fs.removeEntry("managed-opfs", { recursive: true }).catch(() => {});
  },
});

test("いくつかのチャンクデータに分けて書き込める", async ({ bucket, catalog, expect }) => {
  const oldEntityId = asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251");
  {
    await bucket.main.getFileHandle(oldEntityId, { create: true });
    await catalog.create({
      checksum: asChecksum("0".repeat(32)),
      entityId: oldEntityId,
      filePath: new Path("path/to/file.txt"),
      fileSize: asUint(0),
      metadata: undefined,
      mimeType: asMimeType("text/plain"),
      description: undefined,
    });
  }

  const newEntityId = asEntityId("e3079662-e79a-49b7-bc19-9c242909f52a");
  const handle = await bucket.main.getFileHandle(newEntityId, { create: true });
  const writer = new OverwritableFileStream({
    hash: await hash.create(),
    logger: console,
    writer: await handle.createWritable(),
    catalog,
    mainDir: bucket.main,
    manager: { opened: true },
    newEntityId,
    oldEntityId,
    filePath: new Path("path/to/file.txt"),
    metadata: null,
    mimeType: asMimeType("text/plain"),
    bucketName: asBucketName("test"),
    description: null,
    lastModified: 0,
  });

  await expect(Array.fromAsync(bucket.main.keys()))
    .resolves
    .toContain(oldEntityId);
  await expect(Array.fromAsync(bucket.main.keys()))
    .resolves
    .not
    .toContain(oldEntityId + ".crswap");
  await expect(Array.fromAsync(bucket.main.keys()))
    .resolves
    .toContain(newEntityId);
  await expect(Array.fromAsync(bucket.main.keys()))
    .resolves
    .toContain(newEntityId + ".crswap");
  expect(jsonify(writer)).toEqual({
    bucketName: "test",
    filePath: "path/to/file.txt",
    fileSize: 0,
    fileType: "text/plain",
    fileDescription: null,
    fileMetadata: null,
  });

  await writer.write("Hello, ");

  expect(jsonify(writer)).toEqual({
    bucketName: "test",
    filePath: "path/to/file.txt",
    fileSize: 7,
    fileType: "text/plain",
    fileDescription: null,
    fileMetadata: null,
  });

  await writer.write("世界!");

  expect(jsonify(writer)).toEqual({
    bucketName: "test",
    filePath: "path/to/file.txt",
    fileSize: 14,
    fileType: "text/plain",
    fileDescription: null,
    fileMetadata: null,
  });

  await writer.close();

  await expect(Array.fromAsync(bucket.main.keys()))
    .resolves
    .not
    .toContain(oldEntityId);
  await expect(Array.fromAsync(bucket.main.keys()))
    .resolves
    .not
    .toContain(oldEntityId + ".crswap");
  await expect(Array.fromAsync(bucket.main.keys()))
    .resolves
    .toContain(newEntityId);
  await expect(Array.fromAsync(bucket.main.keys()))
    .resolves
    .not
    .toContain(newEntityId + ".crswap");

  const file = await handle.getFile();

  await expect(file.text())
    .resolves
    .toBe("Hello, 世界!");
});

test("存在しないファイルを上書きしようとしてエラー", async ({ bucket, catalog, expect }) => {
  const oldEntityId = asEntityId("e9922a1d-ad8d-46e2-ad7b-0a989fe31251");
  const newEntityId = asEntityId("e3079662-e79a-49b7-bc19-9c242909f52a");
  const handle = await bucket.main.getFileHandle(newEntityId, { create: true });
  const writer = new OverwritableFileStream({
    hash: await hash.create(),
    logger: console,
    writer: await handle.createWritable(),
    catalog,
    mainDir: bucket.main,
    manager: { opened: true },
    newEntityId,
    oldEntityId,
    filePath: new Path("path/to/file.txt"),
    metadata: null,
    mimeType: asMimeType("text/plain"),
    bucketName: asBucketName("test"),
    description: null,
    lastModified: 0,
  });

  await expect(Array.fromAsync(bucket.main.keys()))
    .resolves
    .toContain(newEntityId);
  await expect(Array.fromAsync(bucket.main.keys()))
    .resolves
    .toContain(newEntityId + ".crswap");
  await expect(writer.close())
    .rejects
    .toThrow(MopfsFileNotFoundError);
  await expect(Array.fromAsync(bucket.main.keys()))
    .resolves
    .not
    .toContain(newEntityId);
  await expect(Array.fromAsync(bucket.main.keys()))
    .resolves
    .not
    .toContain(newEntityId + ".crswap");
});

function asBucketName(name: string) {
  return v.parse(schemas.BucketName, name);
}

function asMaxDescriptionSize(size: number) {
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
