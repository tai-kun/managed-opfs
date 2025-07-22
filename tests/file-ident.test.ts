import { test } from "vitest";
import { type BucketName, FileIdent, Path } from "../src/index.js";

const bucketName = "my-bucket" as BucketName;

test("constructor() はプロパティに正しく値を設定すする", ({ expect }) => {
  const path = new Path("x/y/z.png");
  const fileIdent = new FileIdent({ bucketName, filePath: path });

  expect(fileIdent.bucketName).toBe("my-bucket");
  expect(fileIdent.filePath).toBe(path);
});

test("toJSON() は正しい JSON オブジェクトを返す", ({ expect }) => {
  const path = new Path("dir/file.txt");
  const fileIdent = new FileIdent({ bucketName, filePath: path });

  expect(fileIdent.toJSON()).toEqual({
    bucketName: "my-bucket",
    filePath: path,
  });
  expect(JSON.parse(JSON.stringify(fileIdent))).toEqual({
    bucketName: "my-bucket",
    filePath: "dir/file.txt",
  });
});

test("toString() は 'バケット名:ファイルパス' の形式で返す", ({ expect }) => {
  const path = new Path("a/b/c.txt");
  const fileIdent = new FileIdent({ bucketName, filePath: path });

  expect(`${fileIdent}`).toBe("my-bucket:a/b/c.txt");
});
