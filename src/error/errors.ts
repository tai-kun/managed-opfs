import getTypeName, { type TypeName } from "./get-type-name.js";

/**
 * `globalThis.Error` の `options` 引数に `cause` プロパティーが存在するかどうかをチェックする型です。
 * 存在する場合は `globalThis.ErrorOptions` を、存在しない場合は `cause` プロパティーを独自に定義した型を使用します。
 */
export type MopfsErrorOptions = "cause" extends keyof globalThis.Error
  ? Readonly<globalThis.ErrorOptions>
  : { readonly cause?: unknown };

/**
 * Mopfs エラーの基底クラスです。
 */
export class MopfsError extends globalThis.Error {
  /**
   * クラスの静的初期化ブロックです。
   * プロトタイプの `name` プロパティーを "MopfsError" に設定します。
   */
  static {
    this.prototype.name = "MopfsError";
  }

  /**
   * `MopfsError` クラスの新しいインスタンスを初期化します。
   *
   * @param message エラーのメッセージです。
   * @param options `cause` プロパティーを含むオプションです。
   */
  public constructor(message: string, options?: MopfsErrorOptions | undefined) {
    super(message, options);

    if (!("cause" in this) && options && "cause" in options) {
      this.cause = options.cause; // polyfill
    }
  }
}

/**
 * 型が期待値と異なる場合に投げられるエラーです。
 */
export class MopfsTypeError extends MopfsError {
  /**
   * クラスの静的初期化ブロックです。
   * プロトタイプの `name` プロパティーを "MopfsTypeError" に設定します。
   */
  static {
    this.prototype.name = "MopfsTypeError";
  }

  /**
   * 期待される型です。
   */
  public readonly expected: string;

  /**
   * 実際に受け取った値の型です。
   */
  public readonly actual: TypeName;

  /**
   * `MopfsTypeError` クラスの新しいインスタンスを初期化します。
   *
   * @param expectedType 期待される型名、または型名の配列です。
   * @param actualValue 実際に受け取った値です。
   * @param options `cause` プロパティーを含むオプションです。
   */
  public constructor(
    expectedType: TypeName | readonly TypeName[],
    actualValue: unknown,
    options?: MopfsErrorOptions | undefined,
  ) {
    const expectedTypeString = Array.isArray(expectedType)
      ? expectedType.slice().sort().join(" | ")
      : String(expectedType);
    const actualType = getTypeName(actualValue);
    super(`Expected ${expectedTypeString}, but got ${actualType}`, options);
    this.expected = expectedTypeString;
    this.actual = actualType;
  }
}

/**
 * ファイルが見つからない場合に投げられるエラーです。
 */
export class MopfsFileNotFoundError extends MopfsError {
  /**
   * クラスの静的初期化ブロックです。
   * プロトタイプの `name` プロパティーを "MopfsFileNotFoundError" に設定します。
   */
  static {
    this.prototype.name = "MopfsFileNotFoundError";
  }

  /**
   * ファイルが存在するバケットの名前です。
   */
  public readonly bucketName: string;

  /**
   * ファイルのパスです。
   */
  public readonly filePath: string;

  /**
   * `MopfsFileNotFoundError` クラスの新しいインスタンスを初期化します。
   *
   * @param bucketName ファイルが存在するバケットの名前です。
   * @param filePath ファイルのパスです。
   * @param options `cause` プロパティーを含むオプションです。
   */
  public constructor(
    bucketName: string,
    filePath: string | Readonly<{ toString: () => string }>,
    options?: MopfsErrorOptions | undefined,
  ) {
    const filePathString = String(filePath);
    super(`File not found: '${bucketName}:${filePathString}'`, options);
    this.bucketName = bucketName;
    this.filePath = filePathString;
  }
}

/**
 * ファイルがすでに存在する場合に投げられるエラーです。
 */
export class MopfsFileExistsError extends MopfsError {
  /**
   * クラスの静的初期化ブロックです。
   * プロトタイプの `name` プロパティーを "MopfsFileExistsError" に設定します。
   */
  static {
    this.prototype.name = "MopfsFileExistsError";
  }

  /**
   * ファイルが存在するバケットの名前です。
   */
  public readonly bucketName: string;

  /**
   * ファイルのパスです。
   */
  public readonly filePath: string;

  /**
   * `MopfsFileExistsError` クラスの新しいインスタンスを初期化します。
   *
   * @param bucketName ファイルが存在するバケットの名前です。
   * @param filePath ファイルのパスです。
   * @param options `cause` プロパティーを含むオプションです。
   */
  public constructor(
    bucketName: string,
    filePath: string | Readonly<{ toString: () => string }>,
    options?: MopfsErrorOptions | undefined,
  ) {
    const filePathString = String(filePath);
    super(`File already exists: '${bucketName}:${filePathString}'`, options);
    this.bucketName = bucketName;
    this.filePath = filePathString;
  }
}

/**
 * 複数のエラーをまとめるために使用されるエラーです。
 */
export class MopfsAggregateError extends MopfsError {
  /**
   * クラスの静的初期化ブロックです。
   * プロトタイプの `name` プロパティーを "MopfsAggregateError" に設定します。
   */
  static {
    this.prototype.name = "MopfsAggregateError";
  }

  /**
   * 発生したエラーの配列です。
   */
  public override cause: unknown[];

  /**
   * `MopfsAggregateError` クラスの新しいインスタンスを初期化します。
   *
   * @param errors 発生したエラーの配列です。
   * @param options `cause` プロパティーを除くオプションです。
   */
  public constructor(
    errors: readonly unknown[],
    options?: Omit<MopfsErrorOptions, "cause"> | undefined,
  );

  /**
   * `MopfsAggregateError` クラスの新しいインスタンスを初期化します。
   *
   * @param message エラーのメッセージです。
   * @param errors 発生したエラーの配列です。
   * @param options `cause` プロパティーを除くオプションです。
   */
  public constructor(
    message: string,
    errors: readonly unknown[],
    options?: Omit<MopfsErrorOptions, "cause"> | undefined,
  );

  /**
   * `MopfsAggregateError` クラスのオーバーロードされたコンストラクターの実装です。
   */
  public constructor(
    ...args:
      | [
        errors: readonly unknown[],
        options?: Omit<MopfsErrorOptions, "cause"> | undefined,
      ]
      | [
        message: string,
        errors: readonly unknown[],
        options?: Omit<MopfsErrorOptions, "cause"> | undefined,
      ]
  ) {
    const [arg0, arg1, arg2] = args;
    const [errors, options] = Array.isArray(arg1) ? [arg1, undefined] : [[], arg2];
    const message = typeof arg0 === "string" ? arg0 : `${errors.length} error(s)`;
    super(message, options);
    this.cause = errors.slice();
  }
}

/**
 * バケット名の検証エラーです。
 */
export class MopfsInvalidBucketNameError extends MopfsError {
  /**
   * クラスの静的初期化ブロックです。
   * プロトタイプの `name` プロパティーを "MopfsInvalidBucketNameError" に設定します。
   */
  static {
    this.prototype.name = "MopfsInvalidBucketNameError";
  }

  /**
   * 検証したバケット名です。
   */
  public readonly bucketName: string;

  /**
   * `MopfsInvalidBucketNameError` クラスの新しいインスタンスを初期化します。
   *
   * @param message エラーのメッセージです。
   * @param path 検証したバケット名です。
   * @param options `cause` プロパティーを含むオプションです。
   */
  public constructor(message: string, bucketName: string, options?: MopfsErrorOptions | undefined) {
    super("Invalid bucket name: " + message, options);
    this.bucketName = bucketName;
  }
}

/**
 * パスの検証エラーです。
 */
export class MopfsInvalidPathError extends MopfsError {
  /**
   * クラスの静的初期化ブロックです。
   * プロトタイプの `name` プロパティーを "MopfsInvalidPathError" に設定します。
   */
  static {
    this.prototype.name = "MopfsInvalidPathError";
  }

  /**
   * 検証したパスです。
   */
  public readonly path: string;

  /**
   * `MopfsInvalidPathError` クラスの新しいインスタンスを初期化します。
   *
   * @param message エラーのメッセージです。
   * @param path 検証したパスです。
   * @param options `cause` プロパティーを含むオプションです。
   */
  public constructor(message: string, path: string, options?: MopfsErrorOptions | undefined) {
    super("Invalid path: " + message, options);
    this.path = path;
  }
}
