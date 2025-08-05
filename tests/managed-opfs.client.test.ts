import * as duckdb from "@duckdb/duckdb-wasm";
import eHworker from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import mvpWorker from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import duckdbWasmEh from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import duckdbWasm from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import { beforeAll, describe, test as vitest } from "vitest";
import {
  ConsoleLogger,
  type DuckdbBundle,
  type DuckdbLogger,
  type FileJson,
  type Logger,
  ManagedOpfs,
  VoidLogger,
} from "../src/index.js";
import jsonify from "../src/jsonify.js";

let duckdbBundle: DuckdbBundle;
let duckdbLogger: DuckdbLogger;
let mopfsLogger: Logger;

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
  mopfsLogger = __DEBUG__
    ? new ConsoleLogger()
    : new VoidLogger();
});

const test = vitest.extend<{
  mopfs: ManagedOpfs;
  mainDir: FileSystemDirectoryHandle;
}>({
  async mopfs({}, use) {
    const mopfs = new ManagedOpfs({
      bucketName: "test",
      duckdb: {
        bundle: duckdbBundle,
        logger: duckdbLogger,
      },
      logger: mopfsLogger,
      maxDescriptionSize: 128,
    });
    await mopfs.open();
    await use(mopfs);
    await mopfs.close();
    const fs = await window.navigator.storage.getDirectory();
    const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    for (let i = 0; i < 3; i++) {
      await fs.removeEntry("managed-opfs", { recursive: true }).catch(() => {});
      await sleep(500);
    }
  },
  async mainDir({}, use) {
    const fs = await window.navigator.storage.getDirectory();
    const opfs = await fs.getDirectoryHandle("managed-opfs");
    const bucket = await opfs.getDirectoryHandle("test");
    const mainDir = await bucket.getDirectoryHandle("main", { create: true });
    await use(mainDir);
  },
});

describe("writeFile, readFile", () => {
  test("ファイルを読み書きできる", async ({ expect, mopfs }) => {
    // 書き込み
    const ident = await mopfs.writeFile("file.txt", "test data");

    expect(jsonify(ident)).toEqual({
      bucketName: "test",
      filePath: "file.txt",
    });

    // 読み込み
    const file = await mopfs.readFile(ident.filePath);

    expect(jsonify(file)).toEqual({
      path: "file.txt",
      size: 9,
      type: "text/plain",
      checksum: expect.stringMatching(/^[0-9a-f]{32}$/),
      bucketName: "test",
      lastModified: expect.any(Number),
      webkitRelativePath: "",
    });
    await expect(file.text())
      .resolves
      .toBe("test data");
  });

  test("ファイル形式を指定して書き込める", async ({ expect, mopfs }) => {
    const ident = await mopfs.writeFile("file.txt", "test data", { mimeType: "image/png" });
    const file = await mopfs.readFile(ident.filePath);

    expect(jsonify<FileJson>(file).type).toBe("image/png");
    await expect(file.text())
      .resolves
      .toBe("test data");
  });

  test("すでに存在するパスに書き込もうとしてエラー", async ({ expect, mopfs }) => {
    const ident = await mopfs.writeFile("file.txt", "test data 1");

    await expect(mopfs.writeFile(ident.filePath, "test data 2", { mimeType: "image/png" }))
      .rejects
      .toThrow("File already exists: 'test:file.txt'");

    const file = await mopfs.readFile(ident.filePath);

    // 元のファイルに影響はない。
    expect(jsonify<FileJson>(file).type).toBe("text/plain");
    await expect(file.text())
      .resolves
      .toBe("test data 1");
  });
});
