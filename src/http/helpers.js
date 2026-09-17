import { ApiError } from '../errors.js';

/**
 * 尝试解析接口中可能是 JSON 字符串的数据。
 * @param {unknown} value 原始值。
 * @returns {unknown} 解析后的值。
 */
export function parseData(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * 读取接口消息。
 * @param {object} response 接口响应。
 * @returns {string} 消息。
 */
export function responseMessage(response) {
  return response?.msg || response?.message || response?.data?.msg || '接口返回失败';
}

/**
 * 校验接口业务状态码。
 * @param {object} response 接口响应。
 * @param {number[]} accepted 接受的状态码。
 * @param {string} operation 操作名称。
 * @returns {object} 原始响应。
 */
export function assertCode(response, accepted, operation) {
  if (!accepted.includes(response?.code)) {
    throw new ApiError(`${operation}失败: ${responseMessage(response)}`, {
      operation,
      code: response?.code,
      response,
    });
  }
  return response;
}

/**
 * 生成库街区设备码。
 * @returns {string} 设备码。
 */
export function randomDeviceCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 40 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
