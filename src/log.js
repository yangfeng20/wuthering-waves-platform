/**
 * 向 stderr 输出调试日志。MCP stdio 的 stdout 只能传输协议消息。
 * @param {string} message 日志消息。
 * @param {unknown} details 附加信息。
 * @returns {void}
 */
export function logInfo(message, details) {
  if (details === undefined) {
    console.error(`[wuthering-waves-platform] ${message}`);
    return;
  }
  console.error(`[wuthering-waves-platform] ${message}`, details);
}

/**
 * 向 stderr 输出错误日志。
 * @param {string} message 日志消息。
 * @param {unknown} details 附加信息。
 * @returns {void}
 */
export function logError(message, details) {
  console.error(`[wuthering-waves-platform] ${message}`, details ?? '');
}
