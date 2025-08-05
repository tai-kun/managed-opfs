import { createMD5, md5 } from "hash-wasm";
import * as v from "valibot";
import * as schemas from "./schemas.js";

/**
 * ハッシュ値を計算するためのストリームインターフェースです。
 */
export interface Hash {
  /**
   * ハッシュ値の計算に必要な内部データを更新します。
   *
   * @param data 追加するバイト列です。
   */
  update(data: Uint8Array): void;

  /**
   * `.update()` で渡されたすべてのデータのダイジェストをハッシュして計算し、16 進数文字列を返します。
   *
   * @returns 計算されたハッシュ値の 16 進数文字列です。
   */
  digest(): v.InferOutput<typeof schemas.Checksum>;
}

/**
 * ハッシュ値の計算に関連するユーティリティーオブジェクトです。
 */
export default {
  /**
   * 渡されたデータの MD5 ダイジェストをハッシュして計算します。
   *
   * @param data ハッシュ値を計算する対象のバイト列です。
   * @returns 計算されたハッシュ値の 16 進数文字列です。
   */
  async digest(data: Uint8Array): Promise<v.InferOutput<typeof schemas.Checksum>> {
    return v.parse(schemas.Checksum, await md5(data));
  },

  /**
   * ハッシュ値を計算するためのストリームを作成します。
   *
   * @returns ハッシュ値を計算するための `Hash` インターフェースを実装したストリームです。
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
