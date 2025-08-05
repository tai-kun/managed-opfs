import { type Logger, LogLevel } from "./logger-types.js";

/**
 * `console` のようにログを記録できる関数群のインターフェースです。
 */
export interface ConsoleLikeLogger {
  /**
   * デバッグメッセージを記録します。
   *
   * @param message デバッグメッセージです。
   */
  debug(message: string): void;

  /**
   * 諸情報を記録します。
   *
   * @param message 諸情報です。
   */
  info(message: string): void;

  /**
   * エラーメッセージを記録します。
   *
   * @param message エラーメッセージです。
   * @param reason エラーの原因です。
   */
  error(message: string, reason: unknown): void;
}

/**
 * ロガーを `console` のようなインターフェースに変換します。
 *
 * @param logger ロガーです。
 * @returns `console` のようにログを記録できる関数群です。
 */
export default function toConsoleLikeLogger(logger: Logger): ConsoleLikeLogger {
  return {
    info(message: string): void {
      logger.log({
        level: LogLevel.INFO,
        message,
      });
    },
    debug(message: string): void {
      logger.log({
        level: LogLevel.DEBUG,
        message,
      });
    },
    error(message: string, reason: unknown): void {
      logger.log({
        level: LogLevel.ERROR,
        reason,
        message,
      });
    },
  };
}
