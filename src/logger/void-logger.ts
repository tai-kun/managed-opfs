import type { LogEntry, Logger } from "./logger-types.js";

/**
 * ログをどこにも記録せず、破棄するだけのロガーです。
 */
export default class VoidLogger implements Logger {
  log(_entry: LogEntry): void {}
}
