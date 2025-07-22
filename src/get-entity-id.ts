import * as v from "valibot";
import * as schemas from "./schemas.js";

/**
 * 実際に保存されるファイルの識別子を生成します。
 *
 * @returns 実際に保存されるファイルの識別子です。
 */
export default function getEntityId(): v.InferOutput<typeof schemas.EntityId> {
  return v.parse(schemas.EntityId, window.crypto.randomUUID());
}
