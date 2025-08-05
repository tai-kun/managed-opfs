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
 * 与えられた値の型名を取得します。
 *
 * @param input 型名を取得する値です。
 * @returns 取得した値の型名です。
 */
export default function getTypeName(input: unknown): TypeName {
  switch (true) {
    case input == null:
      return String(input) as TypeName;

    case typeof input === "object":
      return getConstructorName(input) as TypeName;

    case typeof input === "function":
      return getFuncName(input.constructor as Function) as TypeName;

    default:
      return typeof input as TypeName;
  }
}

/**
 * `Object.prototype.toString` メソッドを定数として保持しています。
 * このメソッドは、オブジェクトの文字列表現を取得するために使用されます。
 */
const toString = Object.prototype.toString;

/**
 * 関数名を取得するための正規表現です。
 * この正規表現は、関数宣言の文字列から関数名を抽出するために使用されます。
 */
const FUNCTION_NAME_REGEX = /^\s*function\s*([^\(\s]+)/;

/**
 * 関数から関数名を取得します。
 *
 * @param func 名前を取得する関数です。
 * @returns 取得した関数名です。
 */
function getFuncName(func: Function): string {
  return func.name || FUNCTION_NAME_REGEX.exec(func.toString())?.[1] || "Function";
}

/**
 * オブジェクトのコンストラクター名を取得します。
 *
 * @param obj コンストラクター名を取得するオブジェクトです。
 * @returns 取得したコンストラクター名です。
 */
function getConstructorName(obj: object): string {
  const name = toString.call(obj).slice(8, -1);
  return typeof obj.constructor === "function" && (name === "Object" || name === "Error")
    ? getFuncName(obj.constructor as Function)
    : name;
}
