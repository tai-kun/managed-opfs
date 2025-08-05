const QUEUE = Symbol.for("managed-opfs/mutex/QUEUE");

/**
 * 書き込み操作のキューアイテムを表す型です。
 */
type QueueItemW = {
  /**
   * キューの種類の識別子です。
   */
  readonly kind: "W";

  /**
   * キュー内の次のアイテムの実行を開始する関数です。
   */
  readonly start: () => void;

  /**
   * 実行準備ができたことを示すプロミスです。
   */
  readonly ready: Promise<void>;

  /**
   * 順番に実行されるステップの配列です。
   */
  steps: (() => void)[];
};

/**
 * 読み取り操作のキューアイテムを表す型です。
 */
type QueueItemR = {
  /**
   * キューの種類の識別子です。
   */
  readonly kind: "R";

  /**
   * キュー内の次のアイテムの実行を開始する関数です。
   */
  readonly start: () => void;

  /**
   * 実行準備ができたことを示すプロミスです。
   */
  readonly ready: Promise<void>;

  /**
   * 同時に実行されている読み取り操作の数です。
   */
  count: number;
};

/**
 * キューアイテムの型です。
 */
type QueueItem =
  | QueueItemW
  | QueueItemR;

/**
 * 非同期クラスメソッドの型です。
 */
interface AsyncClassMethod {
  (...args: any): PromiseLike<any>;
}

/**
 * デコレートされたクラスメソッドの型です。
 */
interface MutexClassMethod<TFunction extends AsyncClassMethod> {
  (this: any, ...args: Parameters<TFunction>): Promise<Awaited<ReturnType<TFunction>>>;
}

/**
 * Stage 3 のクラスメソッドデコレーターをサポートしているか検証します。
 *
 * @param context デコレーターのコンテキストです。
 * @throws Stage 3 のデコレーターをサポートしていない場合にエラーを投げます。
 */
function assertStage3ClassMethodDecoratorSupport(
  context: unknown,
): asserts context is ClassMethodDecoratorContext {
  if (
    context
    && typeof context === "object"
    && "addInitializer" in context
    && typeof context.addInitializer !== "function"
  ) {
    throw new Error("Requires Stage 3 decorator support.");
  }
}

/**
 * デコレートされたクラスのインスタンスに、キューを初期化します。
 */
function initializeInstance(this: any): void {
  if (!Array.isArray(this[QUEUE])) {
    Object.defineProperty(this, QUEUE, {
      value: [],
    });
  }
}

/**
 * 1 つ以上のクラスメソッドを同時実行性 1 で非同期処理するデコレーターです。
 */
function mutex<TFunction extends AsyncClassMethod>(
  method: TFunction,
  context: unknown,
): MutexClassMethod<TFunction> {
  assertStage3ClassMethodDecoratorSupport(context);
  context.addInitializer(initializeInstance);

  return function mutexClassMethod(...args) {
    const queue: QueueItem[] = this[QUEUE];
    const latestItem = queue[queue.length - 1];
    let writableItem: QueueItemW;
    if (latestItem == null) {
      writableItem = {
        kind: "W",
        start() {},
        ready: Promise.resolve(),
        steps: [],
      };
      queue.push(writableItem);
    } else if (latestItem.kind === "R") {
      const {
        promise,
        resolve,
      } = Promise.withResolvers<void>();
      writableItem = {
        kind: "W",
        start: resolve,
        ready: promise,
        steps: [],
      };
      queue.push(writableItem);
    } else {
      writableItem = latestItem;
    }

    function next(): void {
      const step = writableItem.steps.shift();
      if (step) {
        step();
      } else {
        queue.shift();
        queue[0]?.start();
      }
    }

    let stepPromise: Promise<void>;
    if (writableItem.steps.length === 0) {
      // steps が空の場合は後続のタスクが下の条件に入ることができるように next を追加します。
      // また、2 回連続で next を呼び出されるため、後続のステップを実行することができます。
      stepPromise = Promise.resolve();
      writableItem.steps.push(next);
    } else {
      const {
        promise,
        resolve,
      } = Promise.withResolvers<void>();
      stepPromise = promise;
      writableItem.steps.push(resolve);
    }

    return writableItem.ready
      .then(() => stepPromise)
      .then(() => method.apply(this, args))
      .finally(next);
  };
}

/**
 * 1 つ以上のクラスメソッドを並行して処理するデコレーターです。`@mutex` と並行して実行されることはありません。
 */
function mutexReadonly<TFunction extends AsyncClassMethod>(
  method: TFunction,
  context: unknown,
): MutexClassMethod<TFunction> {
  assertStage3ClassMethodDecoratorSupport(context);
  context.addInitializer(initializeInstance);

  return function mutexReadonlyClassMethod(...args) {
    const queue: QueueItem[] = this[QUEUE];
    const latestItem = queue[queue.length - 1];
    let readonlyItem: QueueItemR;
    if (latestItem == null) {
      readonlyItem = {
        kind: "R",
        start() {},
        ready: Promise.resolve(),
        count: 0,
      };
      queue.push(readonlyItem);
    } else if (latestItem.kind === "W") {
      const {
        promise,
        resolve,
      } = Promise.withResolvers<void>();
      readonlyItem = {
        kind: "R",
        start: resolve,
        ready: promise,
        count: 0,
      };
      queue.push(readonlyItem);
    } else {
      readonlyItem = latestItem;
    }

    function next(): void {
      readonlyItem.count -= 1;
      if (readonlyItem.count === 0) {
        queue.shift();
        queue[0]?.start();
      }
    }

    readonlyItem.count += 1;

    return readonlyItem.ready
      .then(() => method.apply(this, args))
      .finally(next);
  };
}

/**
 * デコレーターのメイン関数です。`mutex` デコレーターと `mutex.readonly` デコレーターを提供します。
 */
export default /* @__PURE__ */ Object.assign(mutex, { readonly: mutexReadonly });
