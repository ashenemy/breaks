import { existsSync, readFileSync } from 'node:fs';

import type { ConfigLayerInfo, ConfigLayerName, ConfigTree, TomlLayerResult } from '../@types/index.js';
import { ConfigError } from './config-error.js';
import { parseToml } from './toml.js';

/** Один файл слоя `config/<name>.toml`: отсутствие файла даёт пустое дерево, ошибка разбора — `ConfigError`. */
export class TomlLayer {
    private readonly __filePath: string;

    private readonly __name: ConfigLayerName;

    /** Разбирает текст TOML; `source` подставляется в сообщение об ошибке. */
    public static parse(toml: string, source: string): ConfigTree {
        try {
            return parseToml(toml);
        } catch (error) {
            const firstLine = (error as Error).message.replace(/\n[\s\S]*$/, '');
            throw new ConfigError([{ message: `разбор TOML: ${firstLine}`, path: '', source }]);
        }
    }

    constructor(name: ConfigLayerName, filePath: string) {
        this.__name = name;
        this.__filePath = filePath;
    }

    public get filePath(): string {
        return this.__filePath;
    }

    public get name(): ConfigLayerName {
        return this.__name;
    }

    public exists(): boolean {
        return existsSync(this.__filePath);
    }

    public load(): TomlLayerResult {
        const present = this.exists();
        const info: ConfigLayerInfo = { name: this.__name, present, source: this.__filePath };
        return { info, tree: present ? TomlLayer.parse(this.__read(), this.__filePath) : {} };
    }

    private __read(): string {
        try {
            return readFileSync(this.__filePath, 'utf8');
        } catch (error) {
            throw new ConfigError([
                { message: `файл не прочитан: ${String(error)}`, path: '', source: this.__filePath },
            ]);
        }
    }
}
