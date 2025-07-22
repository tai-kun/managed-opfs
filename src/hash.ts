import { createMD5, md5 } from "hash-wasm";
import * as v from "valibot";
import * as schemas from "./schemas.js";

/**
 * ハッシュ値を計算するためのストリームです。
 */
export interface Hash {
  /**
   * ハッシュ値の計算に必要な内部データを更新します。
   *
   * @param data バイト列です。
   */
  update(data: Uint8Array): void;
  /**
   * `.update()` で渡された全てのデータのダイジェストをハッシュして計算します。
   *
   * @returns 16 進数の文字列です。
   */
  digest(): v.InferOutput<typeof schemas.Checksum>;
}

export default {
  /**
   * 渡されたデータのダイジェストをハッシュして計算します。
   *
   * @returns 16 進数の文字列です。
   */
  async digest(data: Uint8Array): Promise<v.InferOutput<typeof schemas.Checksum>> {
    return v.parse(schemas.Checksum, await md5(data));
  },
  /**
   * ハッシュ値を計算するためのストリームを作成します。
   *
   * @returns ハッシュ値を計算するためのストリームです。
   */
  async create(): Promise<Hash> {
    const md5 = await createMD5();
    const hash: Hash = {
      update(data: Uint8Array) {
        md5.update(data);
      },
      digest() {
        return v.parse(schemas.Checksum, md5.digest());
      },
    };

    return hash;
  },
};
