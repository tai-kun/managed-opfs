import othMimeTypes from "mime/types/other.js";
import stdMimeTypes from "mime/types/standard.js";
import * as v from "valibot";
import Bucket from "./bucket-name.js";
import Path from "./path.js";

/**
 * バケット名の valibot スキーマです。
 */
export const BucketName = v.pipe(
  v.string(),
  v.transform(s => Bucket.parse(s) as string),
  v.brand("BucketName"),
);

/**
 * 実際に保存されるファイルの識別子 (UUID) の valibot スキーマです。
 */
export const EntityId = v.pipe(v.string(), v.uuid(), v.brand("EntityId"));

/**
 * ファイルパスになれる値の valibot スキーマです。
 */
export const FilePathLike = v.union([
  v.pipe(v.string(), v.transform(s => new Path(s))),
  v.pipe(v.instance(Path), v.transform(p => p.clone())),
]);

/**
 * ファイルのチェックサム (MD5 ハッシュ値) の valibot スキーマです。
 */
export const Checksum = v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/), v.brand("Checksum"));

/**
 * MIME タイプの valibot スキーマです。
 */
export const MimeType = v.pipe(
  v.union([
    ...Object.keys(stdMimeTypes).map(ct => v.literal(ct)),
    ...Object.keys(othMimeTypes).map(ct => v.literal(ct)),
  ]),
  v.brand("ContentType"),
);

/**
 * 0 以上かつ JavaScript における安全な整数の最大値 (9_007_199_254_740_991) 以下の valibot スキーマです。
 */
export const UnsignedInteger = v.pipe(
  v.number(),
  v.safeInteger(),
  v.minValue(0),
  v.brand("UnsignedInteger"),
);

/**
 * 0 以上かつ JavaScript における安全な整数の最大値の半分 (4_503_599_627_370_495) 以下の valibot スキーマです。
 */
export const HalfUnsignedInteger = v.pipe(
  UnsignedInteger,
  v.maxValue((Number.MAX_SAFE_INTEGER / 2) as v.InferOutput<typeof UnsignedInteger>),
  v.brand("HalfUnsignedInteger"),
);

/**
 * サイズ (バイト数) が制限された文字列の型です。
 */
export type SizeLimitedString = v.InferOutput<ReturnType<typeof newSizeLimitedString>>;

/**
 * サイズ (バイト数) が制限された文字列用の valibot スキーマを作成します。
 *
 * @param limit 上限 (バイト数)
 * @returns サイズ (バイト数) が制限された文字列用の valibot スキーマ
 */
export function newSizeLimitedString(limit: v.InferOutput<typeof UnsignedInteger>) {
  return v.pipe(
    v.string(),
    v.maxLength(Math.floor(limit / 2)),
    v.brand("SizeLimitedString"),
  );
}

/**
 * 並び順を表す文字列の valibot スキーマです。
 */
export const OrderType = v.pipe(
  v.union([
    v.literal("asc"),
    v.literal("ASC"),
    v.literal("desc"),
    v.literal("DESC"),
  ]),
  v.transform(toUpperCase),
  v.brand("OrderType"),
);

/**
 * 文字列を全て大文字にします。
 *
 * @template T 大文字にする文字列の型
 * @param s 大文字にする文字列
 * @returns 大文字になった文字列
 */
function toUpperCase<const T extends string>(s: T): Uppercase<T> {
  return s.toUpperCase() as Uppercase<T>;
}
