import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'smol-toml';
import type { ZodError } from 'zod';

import type { LoadedRules, RulesConfig, RulesIssue } from '../@types/index.js';
import { RULES_SCHEMA } from './rules-schema.js';

/** Единственный ручной источник правил. */
export const DEFAULT_RULES_PATH: string = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'rules.toml');

/** Ошибка чтения или валидации `rules.toml` с перечнем проблем и путями в TOML. */
export class RulesConfigError extends Error {
    public readonly filePath: string;

    public readonly issues: readonly RulesIssue[];

    constructor(filePath: string, issues: readonly RulesIssue[]) {
        super(
            `Некорректный ${filePath}:\n${issues.map((issue) => `  - ${issue.path || '<корень>'}: ${issue.message}`).join('\n')}`,
        );
        this.name = 'RulesConfigError';
        this.filePath = filePath;
        this.issues = issues;
    }
}

/** Загрузчик `rules.toml`: TOML → валидация Zod → типизированная конфигурация с умолчаниями. */
export class RulesLoader {
    private readonly __filePath: string;

    constructor(filePath: string = DEFAULT_RULES_PATH) {
        this.__filePath = filePath;
    }

    public get filePath(): string {
        return this.__filePath;
    }

    public load(): LoadedRules {
        return { config: this.parse(this.__read()), filePath: this.__filePath };
    }

    public parse(toml: string): RulesConfig {
        let raw: unknown;
        try {
            raw = parse(toml);
        } catch (error) {
            const firstLine = (error as Error).message.replace(/\n[\s\S]*$/, '');
            throw new RulesConfigError(this.__filePath, [{ message: `синтаксис TOML: ${firstLine}`, path: '' }]);
        }
        const result = RULES_SCHEMA.safeParse(raw);
        if (!result.success) {
            throw new RulesConfigError(this.__filePath, toIssues(result.error));
        }
        return result.data;
    }

    private __read(): string {
        try {
            return readFileSync(this.__filePath, 'utf8');
        } catch (error) {
            throw new RulesConfigError(this.__filePath, [{ message: `файл не прочитан: ${String(error)}`, path: '' }]);
        }
    }
}

/** Разбирает TOML-текст правил (удобно для тестов и генераторов). */
export function parseRules(toml: string, filePath = '<inline>'): RulesConfig {
    return new RulesLoader(filePath).parse(toml);
}

/** Загружает `rules.toml` с диска. */
export function loadRules(filePath: string = DEFAULT_RULES_PATH): LoadedRules {
    return new RulesLoader(filePath).load();
}

function toIssues(error: ZodError): RulesIssue[] {
    return error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path.map((segment) => String(segment)).join('.'),
    }));
}
