const MUTEX_QUEUE = /* @__PURE__ */ Symbol.for("managed-opfs/mutex/MUTEX_QUEUE");

/**
 * 1 つ以上のクラスメソッドを同時実行性 1 で非同期処理するデコレーターです。
 */
export default function mutex<TMethod extends (...args: any) => PromiseLike<any>>(
  method: TMethod,
  context: ClassMethodDecoratorContext,
): (
  this: any,
  ...args: Parameters<TMethod>
) => Promise<Awaited<ReturnType<TMethod>>> {
  if (
    context
    && typeof context === "object"
    && typeof context.addInitializer !== "function"
  ) {
    throw new Error("Requires Stage 3 decorator support.");
  }

  context.addInitializer(function(this: any) {
    if (!this[MUTEX_QUEUE]) {
      Object.defineProperty(this, MUTEX_QUEUE, { value: [] });
    }
  });

  return function mutexWrapper(...args) {
    let queue: (() => void)[] = this[MUTEX_QUEUE],
      promise: Promise<void>,
      resolve: () => void,
      dequeue = () => {
        queue.shift()?.();
      };

    if (queue.length > 0) {
      ({ promise, resolve } = Promise.withResolvers<void>());
      queue.push(resolve);
    } else {
      promise = Promise.resolve();
      // キューが空の場合は後続のタスクが上の条件に入ることができるように queue に dequeue を追加します。
      // dequeue は Promise の解決後にも呼び出されますが、2 回連続で dequeue を呼び出すことで、
      // 後続のタスクを実行することができます。
      queue.push(dequeue);
    }

    return promise
      .then(() => method.apply(this, args))
      .finally(dequeue);
  };
}
