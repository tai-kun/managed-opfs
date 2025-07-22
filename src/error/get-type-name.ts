/**
 * JavaScript 値の型名です。
 */
export type TypeName =
  | "null"
  | "undefined"
  | "number"
  | "bigint"
  | "string"
  | "boolean"
  | "boolean"
  | "symbol"
  | "symbol"
  | "Function"
  | "GeneratorFunction"
  | "AsyncGeneratorFunction"
  | "Promise"
  | "RegExp"
  | "Date"
  | "Array"
  | "Object"
  | "URL"
  | (string & {});

/**
 * 引数に与えられた値の型名を取得します。
 *
 * @param input 型名を取得する値です。
 * @returns 型名です。
 */
export default function getTypeName(input: unknown): TypeName {
  switch (true) {
    case input == null:
      return String(input);

    case typeof input === "object":
      return getConstructorName(input);

    case typeof input === "function":
      return getFuncName(input.constructor);

    default:
      return typeof input;
  }
}

const toString = Object.prototype.toString;
const FUNCTION_NAME_REGEX = /^\s*function\s*([^\(\s]+)/;

function getFuncName(func: Function): string {
  return func.name || FUNCTION_NAME_REGEX.exec(func.toString())?.[1] || "Function";
}

function getConstructorName(obj: object): string {
  const name = toString.call(obj).slice(8, -1);
  return typeof obj.constructor === "function" && (name === "Object" || name === "Error")
    ? getFuncName(obj.constructor)
    : name;
}
