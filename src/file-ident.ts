import type BucketName from "./bucket-name.js";
import Path from "./path.js";

/**
 * `FileIdent` を構築するための入力パラメーターです。
 */
type FileIdentInput = Readonly<{
  /**
   * ファイルが存在するバケットの名前です。
   */
  bucketName: BucketName;

  /**
   * ファイルへのパスです。
   */
  filePath: Path;
}>;

/**
 * `FileIdent` の JSON シリアライズされた形式を表す型です。
 */
export type FileIdentJson = {
  bucketName: BucketName;
  filePath: Path;
};

/**
 * `FileIdent` の文字列表現を表す型です。
 * `bucketName:filePath` の形式です。
 */
export type FileIdentString = `${BucketName}:${string}`;

/**
 * `FileIdent` は、バケット名とファイルパスの組み合わせでファイルの場所を特定するクラスです。
 */
export default class FileIdent {
  /**
   * ファイルが存在するバケットの名前です。
   */
  public readonly bucketName: BucketName;

  /**
   * ファイルへのパスです。
   */
  public readonly filePath: Path;

  /**
   * `FileIdent` の新しいインスタンスを構築します。
   *
   * @param inp `FileIdent` を構築するための入力パラメーターです。
   */
  public constructor(inp: FileIdentInput) {
    this.bucketName = inp.bucketName;
    this.filePath = inp.filePath;
  }

  /**
   * `JSON.stringify` で使用される、オブジェクトの文字列表現を返します。
   *
   * @returns JSON 形式の `FileIdent` です。
   */
  public toJSON(): FileIdentJson {
    return {
      filePath: this.filePath,
      bucketName: this.bucketName,
    };
  }

  /**
   * オブジェクトの文字列表現を返します。
   *
   * @returns `bucketName:filePath` の形式で、`FileIdent` の文字列表現を返します。
   */
  public toString(): FileIdentString {
    return `${this.bucketName}:${this.filePath.fullpath}`;
  }
}
