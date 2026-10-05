import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

import type { ConfigLayerInfo, EnvRecord, EnvValues } from '../@types/index.js';
import { ConfigError } from './config-error.js';

/**
 * Файл `.env` с локальными секретами (E00.03, требование 3). Читается в отдельный словарь и не экспортируется
 * в `process.env`; при слиянии переменные процесса сильнее файла.
 */
export class DotenvFile {
    private readonly __filePath: string;

    constructor(filePath: string) {
        this.__filePath = filePath;
    }

    public get filePath(): string {
        return this.__filePath;
    }

    public exists(): boolean {
        return existsSync(this.__filePath);
    }

    public info(): ConfigLayerInfo {
        return { name: 'dotenv', present: this.exists(), source: this.__filePath };
    }

    /** Переменные файла; отсутствующий файл даёт пустой словарь. */
    public read(): EnvValues {
        if (!this.exists()) {
            return {};
        }
        let content: string;
        try {
            content = readFileSync(this.__filePath, 'utf8');
        } catch (error) {
            throw new ConfigError([
                { message: `файл не прочитан: ${String(error)}`, path: '', source: this.__filePath },
            ]);
        }
        return mergeEnv({}, parseEnv(content));
    }
}

/** Объединяет `.env` и переменные процесса: процесс сильнее, неопределённые значения отбрасываются. */
export function mergeEnv(dotenv: EnvValues, processEnv: EnvRecord): EnvValues {
    const result: Record<string, string> = { ...dotenv };
    for (const [key, value] of Object.entries(processEnv)) {
        if (value !== undefined) {
            result[key] = value;
        }
    }
    return result;
}
