import { Env } from '../types';

export class KVCache {
  constructor(private env: Env) {}
  
  async get<T>(key: string): Promise<T | null> {
    const value = await this.env.CACHE.get(key, 'text');
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }
  
  async set(key: string, value: any, expirationTtl?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    await this.env.CACHE.put(key, serialized, {
      expirationTtl: expirationTtl || 3600
    });
  }
  
  async delete(key: string): Promise<void> {
    await this.env.CACHE.delete(key);
  }
  
  async list(prefix: string): Promise<string[]> {
    const result = await this.env.CACHE.list({ prefix });
    return result.keys.map(k => k.name);
  }
}