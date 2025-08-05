/**
 * 成功結果を表すオブジェクトです。
 *
 * @template TValue 結果の値の型です。
 */
export interface ResultOk<TValue = unknown> {
  /**
   * 成功したかどうかを表します。`true` の場合、成功です。
   */
  readonly ok: true;

  /**
   * 成功した結果の値です。このプロパティーにアクセスできます。
   */
  readonly value: TValue;

  /**
   * 失敗した原因です。`ok` が `true` のため、このプロパティーは存在しません。
   */
  readonly reason?: never;

  /**
   * 成功したならその値を返し、失敗したならその原因を投げる関数です。
   */
  readonly unwrap: {
    /**
     * 成功したならその値を返し、失敗したならその原因を投げます。このオブジェクトは成功を表すため、何も投げずに成功した結果の値を返します。
     *
     * @returns 成功した結果の値です。
     */
    (): TValue;
  };
}

/**
 * 失敗結果を表すオブジェクトです。
 */
export interface ResultErr {
  /**
   * 成功したかどうかを表します。`false` の場合、失敗です。
   */
  readonly ok: false;

  /**
   * 成功した結果の値です。`ok` が `false` のため、このプロパティーは存在しません。
   */
  readonly value?: never;

  /**
   * 失敗した原因です。このプロパティーにアクセスできます。
   */
  readonly reason: unknown;

  /**
   * 成功したならその値を返し、失敗したならその原因を投げる関数です。
   */
  readonly unwrap: {
    /**
     * 成功したならその値を返し、失敗したならその原因を投げます。このオブジェクトは失敗を表すため、失敗した原因を投げます。
     */
    (): never;
  };
}

/**
 * 成功または失敗のいずれかの結果を表す型です。
 *
 * @template TValue 結果の値の型です。
 */
type Result<TValue = unknown> = ResultOk<TValue> | ResultErr;

/**
 * 成功または失敗の結果を作成するためのユーティリティーオブジェクトです。
 */
const Result = {
  /**
   * 成功した結果を表す `ResultOk` オブジェクトを作成する関数です。
   */
  ok: createResultOk,

  /**
   * 失敗した結果を表す `ResultErr` オブジェクトを作成する関数です。
   */
  err: createResultErr,
};

export default Result;

/**
 * 成功した結果を表す `ResultOk` オブジェクトを作成します。
 *
 * @returns 成功した結果を表す `ResultOk` オブジェクトです。
 */
function createResultOk(): ResultOk<unknown>;

/**
 * 成功した結果を表す `ResultOk` オブジェクトを作成します。
 *
 * @template TValue 結果の値の型です。
 * @param value 成功した値です。
 * @returns 成功した結果を表す `ResultOk` オブジェクトです。
 */
function createResultOk<TValue>(value: TValue): ResultOk<TValue>;

/**
 * 成功した結果を表す `ResultOk` オブジェクトを作成します。
 *
 * @template TValue 結果の値の型です。
 * @param value 成功した値です。
 * @returns 成功した結果を表す `ResultOk` オブジェクトです。
 */
function createResultOk<TValue>(value?: TValue): ResultOk<TValue | undefined>;

function createResultOk(value?: unknown): ResultOk<unknown> {
  return {
    ok: true,
    value,
    unwrap() {
      return this.value;
    },
  };
}

/**
 * 失敗した結果を表す `ResultErr` オブジェクトを作成します。
 *
 * @param reason 失敗した原因です。
 * @returns 失敗した結果を表す `ResultErr` オブジェクトです。
 */
function createResultErr(reason: unknown): ResultErr {
  return {
    ok: false,
    reason,
    unwrap() {
      throw this.reason;
    },
  };
}
