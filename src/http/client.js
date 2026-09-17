import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import qs from 'qs';
import { ApiError } from '../errors.js';
import { logError } from '../log.js';

/**
 * 库街区 HTTP 客户端。
 */
export class HttpClient {
  /**
   * @param {object} config 项目配置。
   */
  constructor(config) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: config.timeout,
      headers: {
        source: 'ios',
        'user-agent': config.userAgent,
        'content-type': 'application/x-www-form-urlencoded',
      },
      validateStatus: () => true,
    });
    if (config.proxyUrl) {
      this.client.defaults.httpsAgent = new HttpsProxyAgent(config.proxyUrl);
      this.client.defaults.proxy = false;
    }
  }

  /**
   * 对临时网络错误进行有限重试。
   * @param {Function} operation 请求函数。
   * @param {string} url 请求地址。
   * @returns {Promise<unknown>} 请求结果。
   */
  async retry(operation, url) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const status = error?.details?.status;
        const clientError = Number.isInteger(status) && status >= 400 && status < 500;
        if (clientError || attempt === 2) break;
        await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
      }
    }
    if (lastError instanceof ApiError) throw lastError;
    logError(`请求接口失败: ${url}`, lastError instanceof Error ? lastError.message : lastError);
    throw new ApiError(`请求接口失败: ${url}`, { cause: lastError instanceof Error ? lastError.message : String(lastError) });
  }

  /**
   * 发送表单 POST 请求。
   * @param {string} url 请求地址。
   * @param {object|null} data 表单数据。
   * @param {object} headers 额外请求头。
   * @returns {Promise<object>} 响应 JSON。
   */
  async postForm(url, data = {}, headers = {}) {
    return this.retry(async () => {
      const response = await this.client.post(url, qs.stringify(data || {}), { headers });
      if (response.status < 200 || response.status >= 300) {
        throw new ApiError(`HTTP 请求失败: ${response.status}`, { url, status: response.status });
      }
      if (!response.data || typeof response.data !== 'object') {
        throw new ApiError('接口返回了无法解析的数据', { url });
      }
      return response.data;
    }, url);
  }

  /**
   * 发送普通 POST 请求。
   * @param {string} url 请求地址。
   * @param {object|null} data 请求体。
   * @param {object} headers 额外请求头。
   * @returns {Promise<unknown>} 响应数据。
   */
  async postJson(url, data = null, headers = {}) {
    return this.retry(async () => {
      const response = await this.client.post(url, data, {
        headers: { 'content-type': 'application/json', ...headers },
      });
      if (response.status < 200 || response.status >= 300) {
        throw new ApiError(`HTTP 请求失败: ${response.status}`, { url, status: response.status });
      }
      return response.data;
    }, url);
  }

  /**
   * 发送 GET 请求。
   * @param {string} url 请求地址。
   * @param {object} options 请求选项。
   * @returns {Promise<unknown>} 响应数据。
   */
  async get(url, options = {}) {
    return this.retry(async () => {
      const response = await this.client.get(url, options);
      if (response.status < 200 || response.status >= 300) {
        throw new ApiError(`HTTP 请求失败: ${response.status}`, { url, status: response.status });
      }
      return response.data;
    }, url);
  }
}
