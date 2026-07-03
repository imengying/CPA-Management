/**
 * API 密钥管理
 */

import { apiClient } from './client';

export const apiKeysApi = {
  async list(): Promise<string[]> {
    const data = await apiClient.get<Record<string, unknown>>('/api-keys');
    const keys = data['api-keys'];
    return Array.isArray(keys) ? keys.map((key) => String(key)) : [];
  },
};
