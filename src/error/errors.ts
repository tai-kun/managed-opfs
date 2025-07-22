import getTypeName, { type TypeName } from "./get-type-name.js";

export type MopfsErrorOptions = "cause" extends keyof globalThis.Error
  ? Readonly<globalThis.ErrorOptions>
  : { readonly cause?: unknown };

export class MopfsError extends globalThis.Error {
  static {
    this.prototype.name = "MopfsError";
  }

  constructor(message: string, options?: MopfsErrorOptions | undefined) {
    super(message, options);

    if (!("cause" in this) && options && "cause" in options) {
      this.cause = options.cause; // polyfill
    }
  }
}

export class MopfsTypeError extends MopfsError {
  static {
    this.prototype.name = "MopfsTypeError";
  }

  public readonly expected: string;
  public readonly actual: TypeName;

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

export class MopfsFileNotFoundError extends MopfsError {
  static {
    this.prototype.name = "MopfsFileNotFoundError";
  }

  public readonly bucketName: string;
  public readonly filePath: string;

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

export class MopfsFileExistsError extends MopfsError {
  static {
    this.prototype.name = "MopfsFileExistsError";
  }

  public readonly bucketName: string;
  public readonly filePath: string;

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

export class MopfsAggregateError extends MopfsError {
  static {
    this.prototype.name = "MopfsAggregateError";
  }

  override cause: unknown[];

  constructor(
    errors: readonly unknown[],
    options?: Omit<MopfsErrorOptions, "cause"> | undefined,
  );

  constructor(
    message: string,
    errors: readonly unknown[],
    options?: Omit<MopfsErrorOptions, "cause"> | undefined,
  );

  constructor(
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
