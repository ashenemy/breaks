import type { ConfigInfo } from '../@types/index.js';

/** Стартовая реализация: заменить реальным API пакета, сохранив структуру. */
export function configInfo(): ConfigInfo {
    return { name: 'config' };
}
