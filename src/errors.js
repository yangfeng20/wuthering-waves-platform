/**
 * 通用平台错误。
 */
export class WavesError extends Error {
  /**
   * @param {string} message 错误消息。
   * @param {string} code 错误代码。
   * @param {object} details 附加信息。
   */
  constructor(message, code = 'WAVES_ERROR', details = {}) {
    super(message);
    this.name = 'WavesError';
    this.code = code;
    this.details = details;
  }
}

/**
 * API 请求错误。
 */
export class ApiError extends WavesError {
  /**
   * @param {string} message 错误消息。
   * @param {object} details 附加信息。
   */
  constructor(message, details = {}) {
    super(message, 'API_ERROR', details);
    this.name = 'ApiError';
  }
}

/**
 * 账号凭据错误。
 */
export class CredentialError extends WavesError {
  /**
   * @param {string} message 错误消息。
   * @param {object} details 附加信息。
   */
  constructor(message, details = {}) {
    super(message, 'CREDENTIAL_ERROR', details);
    this.name = 'CredentialError';
  }
}

/**
 * 将异常转换为不泄露 Token 的普通对象。
 * @param {unknown} error 原始异常。
 * @returns {object} 可序列化错误。
 */
export function serializeError(error) {
  if (error instanceof WavesError) {
    return { code: error.code, message: error.message, details: error.details };
  }
  return {
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : String(error),
  };
}
