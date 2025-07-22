// @ts-check

import * as esbuild from "esbuild";
import { replace } from "esbuild-plugin-replace";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: false,
  options: {
    outDir: {
      type: "string",
    },
    platform: {
      type: "string",
    },
  },
});

await build(values);

/**
 * @typedef {object} BuildOptions
 * @property {string} [outDir="dist"] 出力先のデイレクトリ
 * @property {string} [platform="browser"] 動作環境
 */

/**
 * esbuild でビルドする。
 *
 * @param {BuildOptions} [options={}] ビルドオプション
 * @returns {Promise<void>}
 */
async function build(options = {}) {
  const {
    outDir = "dist",
    platform = "browser",
  } = options;
  await esbuild.build({
    // General

    platform: /** @type {esbuild.Platform} */ (platform),
    bundle: true,
    target: [
      "node22",
      "safari15",
    ],

    // Input

    entryPoints: await Array.fromAsync(
      fsp.glob(`src/**/*.{ts,tsx}`, {
        exclude: file => (
          file.endsWith(".d.ts")
          || file.endsWith(".test.ts")
          || file.endsWith(".test.tsx")
          || file.endsWith(".stories.tsx")
          || file.includes("/__snapshots__/")
          || file.includes("/__screenshots__/")
        ),
      }),
    ),

    // Output contents

    format: "esm",
    lineLimit: 100,

    // Output location

    write: true,
    outdir: outDir,
    outbase: "src",
    outExtension: {
      ".js": ".js",
    },

    // Transformation

    jsx: "automatic",

    // Source maps

    sourcemap: "linked",

    // Plugins

    plugins: [
      resolve(),
      replace({
        "__DEV__": "false",
      }),
    ],
  });
}

/**
 * @typedef {import("esbuild").Plugin} Plugin
 */

/**
 * import パスを解決する esbuild プラグイン
 *
 * @returns {Plugin}
 */
function resolve() {
  /** @type {Record<string, boolean>} */
  const accessCache = {};

  /**
   * 読み取り可能なファイルが存在するか確認する。
   *
   * @param {string} file 確認するファイルのパス
   * @returns {boolean} 読み取り可能なファイルが存在すれば `true`、どうでなければ `false`
   */
  function exists(file) {
    if (file in accessCache) {
      return /** @type {boolean} */ (accessCache[file]);
    }

    try {
      fs.accessSync(file, fs.constants.R_OK);
      return (accessCache[file] = fs.statSync(file).isFile());
    } catch {
      return (accessCache[file] = false);
    }
  }

  /** @type {Record<string, string | null>} */
  const builtPathCache = {};

  /**
   * ビルド後のファイルパスを取得する関数を作成する。
   *
   * @param {[string, string][]} resolvers import のパスと出力後のパスのペア
   * @returns {(resolveDir: string, file: string) => string | null}
   */
  function createGetBuiltPath(resolvers) {
    /**
     * ビルド後のファイルパスを取得する。
     *
     * @param {string} resolveDir 解決するディレクトリパス
     * @param {string} file ファイルパス
     * @returns {string | null}
     */
    return function getBuiltPath(resolveDir, file) {
      const filepath = path.resolve(resolveDir, file);

      if (filepath in builtPathCache) {
        return /** @type {string} */ (builtPathCache[filepath]);
      }

      const modpath = filepath.replace(/\.[jt]sx?$/, "");
      for (const [src, dst] of resolvers) {
        if (exists(modpath + src)) {
          return (builtPathCache[filepath] = modpath + dst);
        }
      }

      return (builtPathCache[filepath] = null);
    };
  }

  /**
   * ファイルパスを出力ファイルパスに変換する関数を作成する。
   *
   * @param {string} resolveDir 解決するディレクトリパス
   * @returns {(file: string) => string}
   */
  function createToOutFilePath(resolveDir) {
    /**
     * @param {string} file
     * @returns {string}
     */
    return function toOutFilePath(file) {
      file = path.normalize(path.relative(resolveDir + "/", file));

      if (!file.startsWith(".")) {
        file = `.${path.sep}${file}`;
      }

      return file;
    };
  }

  return {
    name: "esbuild-plugin-resolve",
    setup(build) {
      if (build.initialOptions.bundle !== true) {
        throw new Error("esbuild-plugin-resolve はバンドルモードでのみ動作します。");
      }

      const resolvers = Object.entries({
        ".ts": ".js",
        ".tsx": ".js",
        ".mts": ".mjs",
        ".cts": ".cjs",
        "/index.ts": "/index.js",
        "/index.tsx": "/index.js",
        "/index.mts": "/index.mjs",
        "/index.cts": "/index.cjs",
        ".js": ".js",
        ".jsx": ".js",
        ".mjs": ".mjs",
        ".cjs": ".cjs",
        "/index.js": "/index.js",
        "/index.jsx": "/index.js",
        "/index.mjs": "/index.mjs",
        "/index.cjs": "/index.cjs",
      });
      const getBuiltPath = createGetBuiltPath(resolvers);

      build.onResolve({ filter: /.*/ }, async args => {
        const { namespace, kind, path: pkg, resolveDir } = args;
        const toOutFilePath = createToOutFilePath(resolveDir);

        switch (true) {
          case namespace !== "file" || kind !== "import-statement":
            return null;

          case pkg.startsWith("."): {
            const builtPath = getBuiltPath(resolveDir, pkg);

            if (builtPath) {
              return {
                path: toOutFilePath(builtPath),
                external: true,
              };
            }

            return {
              errors: [
                {
                  text: `パッケージを解決できませんでした: ${pkg}`,
                },
              ],
            };
          }

          default:
            return {
              external: true,
            };
        }
      });
    },
  };
}
