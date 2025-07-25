import { describe, test } from "vitest";
import { Path } from "../src/index.js";

describe("Path.parse", () => {
  test("有効なパスを解析できる", ({ expect }) => {
    const path = Path.parse("path/to/file.txt");

    expect(toPlainObject(path)).toEqual({
      fullpath: "path/to/file.txt",
      segments: ["path", "to", "file.txt"],
      dirname: "path/to",
      basename: "file.txt",
      filename: "file",
      extname: ".txt",
    });
  });

  test("空のパスを許可する", ({ expect }) => {
    const path = "";

    expect(toPlainObject(Path.parse(path))).toEqual({
      fullpath: "",
      segments: [""],
      dirname: "",
      basename: "",
      filename: "",
      extname: "",
    });
  });

  test("1024 文字を超えるパスはエラーを返す", ({ expect }) => {
    const longPath = "a".repeat(1025);
    expect(() => Path.parse(longPath))
      .toThrow("Invalid path: cannot be longer than 1024 bytes");
  });

  test("UTF-8 エンコード後に 1024 文字を超えるパスはエラーを返す", ({ expect }) => {
    const pathWithMultiByteChars = "あ".repeat(350); // 例えば 3 バイト文字を 350 個で 1050 バイトになる

    expect(pathWithMultiByteChars).toHaveLength(350);
    expect(() => Path.parse(pathWithMultiByteChars))
      .toThrow("Invalid path: cannot be longer than 1024 bytes");
  });

  test("スラッシュで始まるパスを許可する", ({ expect }) => {
    const path = "/path";

    expect(toPlainObject(Path.parse(path))).toEqual({
      fullpath: "/path",
      segments: ["", "path"],
      dirname: "",
      basename: "path",
      filename: "path",
      extname: "", // 拡張子がないので空文字
    });
  });

  test("スラッシュで終わるパスを許可する", ({ expect }) => {
    const path = "path/";

    expect(toPlainObject(Path.parse(path))).toEqual({
      fullpath: "path/",
      segments: ["path", ""],
      dirname: "path",
      basename: "",
      filename: "",
      extname: "",
    });
  });

  test("連続するスラッシュを許可する", ({ expect }) => {
    const path = "path//to/file.txt";

    expect(toPlainObject(Path.parse(path))).toEqual({
      fullpath: "path//to/file.txt",
      segments: ["path", "", "to", "file.txt"],
      dirname: "path//to",
      basename: "file.txt",
      filename: "file",
      extname: ".txt",
    });
  });

  test("シンプルなファイルパスを正しく解析する", ({ expect }) => {
    const path = "dir/file.txt";

    expect(toPlainObject(Path.parse(path))).toEqual({
      fullpath: "dir/file.txt",
      segments: ["dir", "file.txt"],
      dirname: "dir",
      basename: "file.txt",
      filename: "file",
      extname: ".txt",
    });
  });

  test("ルートディレクトリのファイルを正しく解析する", ({ expect }) => {
    const path = "file.txt";

    expect(toPlainObject(Path.parse(path))).toEqual({
      fullpath: "file.txt",
      segments: ["file.txt"],
      dirname: "", // ルートディレクトリなので空文字
      basename: "file.txt",
      filename: "file",
      extname: ".txt",
    });
  });

  test("拡張子がないファイルを正しく解析する", ({ expect }) => {
    const path = "dir/Makefile";

    expect(toPlainObject(Path.parse(path))).toEqual({
      fullpath: "dir/Makefile",
      segments: ["dir", "Makefile"],
      dirname: "dir",
      basename: "Makefile",
      filename: "Makefile",
      extname: "", // 拡張子がないので空文字
    });
  });

  test("ドットから始まるファイルを正しく解析する（隠しファイル）", ({ expect }) => {
    const path = "dir/.bashrc";

    expect(toPlainObject(Path.parse(path))).toEqual({
      fullpath: "dir/.bashrc",
      segments: ["dir", ".bashrc"],
      dirname: "dir",
      basename: ".bashrc",
      filename: ".bashrc", // ドットから始まるファイル名全体がファイル名となる
      extname: "", // 拡張子がないので空文字
    });
  });

  test("拡張子つきの隠しファイルを正しく解析する", ({ expect }) => {
    const path = "dir/.config.json";

    expect(toPlainObject(Path.parse(path))).toEqual({
      fullpath: "dir/.config.json",
      segments: ["dir", ".config.json"],
      dirname: "dir",
      basename: ".config.json",
      filename: ".config",
      extname: ".json",
    });
  });

  test("ディレクトリのみのパスを正しく解析する", ({ expect }) => {
    const path = "path/to/directory";

    expect(toPlainObject(Path.parse(path))).toEqual({
      fullpath: "path/to/directory",
      segments: ["path", "to", "directory"],
      dirname: "path/to",
      basename: "directory",
      filename: "directory",
      extname: "",
    });
  });

  test("複数階層のパスを正しく解析する", ({ expect }) => {
    const path = "level1/level2/level3/document.pdf";

    expect(toPlainObject(Path.parse(path))).toEqual({
      fullpath: "level1/level2/level3/document.pdf",
      segments: ["level1", "level2", "level3", "document.pdf"],
      dirname: "level1/level2/level3",
      basename: "document.pdf",
      filename: "document",
      extname: ".pdf",
    });
  });

  test("マルチバイト文字を含むパスを正しく解析する", ({ expect }) => {
    const path = "ディレクトリ/ファイル名.txt";

    expect(toPlainObject(Path.parse(path))).toEqual({
      fullpath: "ディレクトリ/ファイル名.txt",
      segments: ["ディレクトリ", "ファイル名.txt"],
      dirname: "ディレクトリ",
      basename: "ファイル名.txt",
      filename: "ファイル名",
      extname: ".txt",
    });
  });

  test("拡張子が複数のドットを持つファイルを正しく解析する", ({ expect }) => {
    const path = "archive.tar.gz";

    expect(toPlainObject(Path.parse(path))).toEqual({
      fullpath: "archive.tar.gz",
      segments: ["archive.tar.gz"],
      dirname: "",
      basename: "archive.tar.gz",
      filename: "archive.tar", // 最後のドットより前がファイル名
      extname: ".gz", // 最後のドット以降が拡張子
    });
  });
});

describe("Path.canParse", () => {
  test("有効なパスは true を返す", ({ expect }) => {
    expect(Path.canParse("path/to/file.txt")).toBe(true);
    expect(Path.canParse("")).toBe(true);
  });
});

describe("Path.safeParse", () => {
  test("有効なパスは ResultOk<Path> を返す", ({ expect }) => {
    const result = Path.safeParse("path/to/file.txt");

    expect(result.ok).toBe(true);
    expect(result.unwrap()).toBeInstanceOf(Path);

    const path = result.unwrap();

    expect(toPlainObject(path)).toEqual({
      fullpath: "path/to/file.txt",
      segments: ["path", "to", "file.txt"],
      dirname: "path/to",
      basename: "file.txt",
      filename: "file",
      extname: ".txt",
    });
  });
});

function toPlainObject(path: Path): Record<string, unknown> {
  return {
    fullpath: path.fullpath,
    segments: path.segments,
    dirname: path.dirname,
    basename: path.basename,
    filename: path.filename,
    extname: path.extname,
  };
}
