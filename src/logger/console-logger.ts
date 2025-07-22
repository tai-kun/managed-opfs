import { type LogEntry, type Logger, LogLevel } from "./logger-types.js";

/**
 * ログを標準出力/標準エラーに記録するロガーです。
 */
export default class ConsoleLogger implements Logger {
  /**
   * ログレベルです。
   */
  public readonly level: LogLevel;

  /**
   * 記録するログレベルのしきい値です。
   *
   * @param level ログレベルです。
   */
  constructor(level: LogLevel | undefined = LogLevel.DEBUG) {
    this.level = level;
  }

  log(entry: LogEntry): void {
    if (entry.level < this.level) {
      return;
    }

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(entry.message, entry.reason);
        break;

      case LogLevel.INFO:
        console.info(entry.message);
        break;

      case LogLevel.DEBUG:
        console.debug(entry.message);
        break;

      default:
        entry satisfies never;
    }
  }
}
