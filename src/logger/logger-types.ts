/**
 * ログレベルの型定義です。
 */
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

/**
 * ログレベルを定義する定数です。
 */
export const LogLevel = {
  // DEBUG: 1,
  // 開発時のデバッグ情報
  DEBUG: 1,
  // INFO: 2,
  // 処理の進捗情報
  INFO: 2,
  // WARN: 3,
  // 警告メッセージ
  // WARN: 3,
  // ERROR: 4,
  // 予期せぬエラー
  ERROR: 4,
  // QUIET: 5,
} as const;

/**
 * ログの内容を定義する型です。
 */
export type LogEntry =
  | { level: typeof LogLevel.DEBUG; message: string }
  | { level: typeof LogLevel.INFO; message: string }
  | { level: typeof LogLevel.ERROR; message: string; reason: unknown };

/**
 * `ManagedOpfs` で使用されるロガーのインターフェースです。
 * 内部情報や、ただちにアプリケーションを停止する必要はないものの、記録しておくべきメッセージを通知する際に使用されます。
 */
export interface Logger {
  /**
   * 指定されたログレベルとメッセージでログを記録します。
   *
   * @param entry ログの内容です。
   */
  log(entry: LogEntry): void;
}
