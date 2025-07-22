import type BucketName from "./bucket-name.js";
import Path from "./path.js";

/**
 * `FileIdent` を構築するための入力パラメーターです。
 */
type FileIdentInput = Readonly<{
  /**
   * バケット名です。
   */
  bucketName: BucketName;
  /**
   * ファイルパスです。
   */
  filePath: Path;
}>;

/**
 * `FileIdent` はファイルの場所を示します。
 */
export default class FileIdent {
  /**
   * バケット名です。
   */
  public readonly bucketName: BucketName;
  /**
   * ファイルパスです。
   */
  public readonly filePath: Path;

  /**
   * FileIdent を構築します。
   *
   * @param inp `FileIdent` を構築するための入力パラメーターです。
   */
  public constructor(inp: FileIdentInput) {
    this.bucketName = inp.bucketName;
    this.filePath = inp.filePath;
  }

  /**
   * `FileIdent` をJSON 形式に変換します。
   *
   * @returns JSON 形式の `FileIdent` です。
   */
  public toJSON(): {
    bucketName: BucketName;
    filePath: Path;
  } {
    return {
      bucketName: this.bucketName,
      filePath: this.filePath,
    };
  }

  /**
   * `FileIdent` を文字列に変換します。
   *
   * @returns `FileIdent` の文字列表現です。
   */
  public toString(): `${BucketName}:${string}` {
    return `${this.bucketName}:${this.filePath.fullpath}`;
  }
}
