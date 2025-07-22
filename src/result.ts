/**
 * 成功結果を表すオブジェクトです。
 *
 * @template TValue 結果の値の型
 */
export interface ResultOk<TValue = unknown> {
  /**
   * 成功したかどうかを表します。成功しています。
   */
  readonly ok: true;
  /**
   * 成功した結果の値です。このプロパティにアクセスできます。
   */
  readonly value: TValue;
  /**
   * 失敗した原因です。このプロパティは設定されていません。
   */
  readonly reason?: never;
  /**
   * 成功したならその値を返し、失敗したならその原因を投げる関数です。何も投げずに成功した結果の値を返します。
   */
  readonly unwrap: {
    /**
     * 成功したならその値を返し、失敗したならその原因を投げます。何も投げずに成功した結果の値を返します。
     *
     * @returns 成功した結果の値
     */
    (): TValue;
  };
}

/**
 * 失敗結果を表すオブジェクトです。
 */
export interface ResultErr {
  /**
   * 成功したかどうかを表します。失敗しています。
   */
  readonly ok: false;
  /**
   * 成功した結果の値です。このプロパティは設定されていません
   */
  readonly value?: never;
  /**
   * 失敗した原因です。このプロパティにアクセスできます。
   */
  readonly reason: unknown;
  /**
   * 失敗したならその原因を返し、成功したならその値を投げる関数です。失敗した原因を投げます。
   */
  readonly unwrap: {
    /**
     * 失敗したならその原因を返し、成功したならその値を投げます。失敗した原因を投げます。
     */
    (): never;
  };
}

/**
 * 結果を表すオブジェクトです。
 *
 * @template TValue 結果の値の型
 */
type Result<TValue = unknown> = ResultOk<TValue> | ResultErr;

/**
 * 結果を表すオブジェクトです。
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
  /**
   * (非)同期関数を実行し、その結果を `Result` オブジェクトとして返す関数です。
   */
  try: tryAsync,
};

export default Result;

/**
 * 成功した結果を表す `ResultOk` オブジェクトを作成します。
 *
 * @returns 成功した結果を表す `ResultOk` オブジェクト
 */
function createResultOk(): ResultOk<unknown>;

/**
 * 成功した結果を表す `ResultOk` オブジェクトを作成します。
 *
 * @template TValue 結果の値の型
 * @param value 成功した値
 * @returns 成功した結果を表す `ResultOk` オブジェクト
 */
function createResultOk<TValue>(value: TValue): ResultOk<TValue>;

/**
 * 成功した結果を表す `ResultOk` オブジェクトを作成します。
 *
 * @template TValue 結果の値の型
 * @param value 成功した値
 * @returns 成功した結果を表す `ResultOk` オブジェクト
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
 * @param reason 失敗した原因
 * @returns 失敗した結果を表す `ResultErr` オブジェクト
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

/**
 * (非)同期関数を実行し、その結果を `Result` オブジェクトとして返します。
 *
 * @template TValue 結果の値の型
 * @param fn 実行する同期関数
 * @returns 関数の実行結果を表す `Result` オブジェクト
 */
async function tryAsync<TValue>(fn: { (): PromiseLike<TValue> }): Promise<Result<TValue>> {
  try {
    return Result.ok(await fn());
  } catch (reason) {
    return Result.err(reason);
  }
}
