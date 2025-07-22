/**
 * ログレベルです。
 */
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

/**
 * ログレベルです。
 */
export const LogLevel = {
  // NONE: 0,
  DEBUG: 1,
  INFO: 2,
  // WARN: 3,
  ERROR: 4,
  // QUIET: 5,
} as const;

/**
 * ログの内容です。
 */
export type LogEntry =
  | { level: typeof LogLevel.DEBUG; message: string }
  | { level: typeof LogLevel.INFO; message: string }
  | { level: typeof LogLevel.ERROR; message: string; reason: unknown };

/**
 * `ManagedOpfs` 用のロガーです。内部の諸情報や、ただちにアプリケーションを停止する必要は無いものの、記録しておくべきメッセージ
 * を通知する際に使用されます。
 */
export interface Logger {
  /**
   * ログを記録します。
   *
   * @param entry ログの内容です。
   */
  log(entry: LogEntry): void;
}
