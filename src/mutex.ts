const QUEUE = Symbol.for("managed-opfs/mutex/QUEUE");

type QueueItemW = {
  readonly kind: "W";
  readonly start: () => void;
  readonly ready: Promise<void>;
  steps: (() => void)[];
};

type QueueItemR = {
  readonly kind: "R";
  readonly start: () => void;
  readonly ready: Promise<void>;
  count: number;
};

type QueueItem =
  | QueueItemW
  | QueueItemR;

interface AsyncClassMethod {
  (...args: any): PromiseLike<any>;
}

interface MutexClassMethod<TFunction extends AsyncClassMethod> {
  (this: any, ...args: Parameters<TFunction>): Promise<Awaited<ReturnType<TFunction>>>;
}

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
 * 1 つ以上のクラスメソッドを並行期処理するデコレーターです。`@mutex` と並行して実行されることはありません。
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

export default /* @__PURE__ */ Object.assign(mutex, { readonly: mutexReadonly });
