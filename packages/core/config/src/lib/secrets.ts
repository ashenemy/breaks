import type { ConfigIssue, ConfigTree } from '../@types/index.js';
import { ConfigError } from './config-error.js';
import { DEFAULT_ENV_PREFIX, envVariableFor } from './env-overrides.js';
import { isConfigTree } from './merge.js';

/** Слова, по которым ключ считается секретом (E00.03, требование 3). */
export const SECRET_KEY_WORDS: readonly string[] = ['secret', 'password', 'token', 'key'];

/** Чем заменяется значение секрета в логах и ответах API (E00.03, требование 8). */
export const SECRET_MASK = '***';

/** Секреты найдены в файлах TOML: `paths` — пути в дереве, значения в сообщении не раскрываются. */
export class ConfigSecretError extends ConfigError {
    public readonly paths: readonly string[];

    constructor(issues: readonly ConfigIssue[]) {
        super(issues, 'Секреты в TOML запрещены, задайте их через переменные окружения');
        this.name = 'ConfigSecretError';
        this.paths = issues.map((issue) => issue.path);
    }
}

/**
 * Политика секретов: ключ — секрет, если его последнее слово (camelCase, snake_case или kebab-case, допускается
 * множественное число) входит в список слов. `apiKey`, `dbPassword`, `accessToken`, `clientSecret`, `secrets` —
 * секреты; `tokenTtl`, `passwordMinLength`, `keyPrefix`, `accessKeyId` — нет (описывают секрет, а не хранят его).
 */
export class SecretPolicy {
    private readonly __mask: string;

    private readonly __words: ReadonlySet<string>;

    constructor(words: readonly string[] = SECRET_KEY_WORDS, mask: string = SECRET_MASK) {
        this.__words = new Set(words.map((word) => word.toLowerCase()));
        this.__mask = mask;
    }

    public get mask(): string {
        return this.__mask;
    }

    public isSecretKey(key: string): boolean {
        const lastWord = key
            .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
            .toLowerCase()
            .split(/[_-]+/)
            .filter((word) => word !== '')
            .at(-1);
        if (lastWord === undefined) {
            return false;
        }
        return this.__words.has(lastWord) || (lastWord.endsWith('s') && this.__words.has(lastWord.slice(0, -1)));
    }

    /** Пути (через точку) всех секретных ключей дерева, включая вложенные таблицы и таблицы с секретным именем. */
    public findSecretPaths(tree: ConfigTree, prefix: readonly string[] = []): string[] {
        const paths: string[] = [];
        for (const [key, value] of Object.entries(tree)) {
            const path = [...prefix, key];
            if (this.isSecretKey(key)) {
                paths.push(path.join('.'));
            } else if (isConfigTree(value)) {
                paths.push(...this.findSecretPaths(value, path));
            }
        }
        return paths;
    }

    /** Копия значения, где всё под секретными ключами заменено маской; вход не изменяется. */
    public maskSecrets<T>(value: T): T {
        return this.__maskValue(value, false) as T;
    }

    /** Бросает `ConfigSecretError`, если в дереве слоя TOML есть секретные ключи; подсказывает имя переменной. */
    public assertNoSecrets(tree: ConfigTree, source: string, envPrefix: string = DEFAULT_ENV_PREFIX): void {
        const issues: ConfigIssue[] = this.findSecretPaths(tree).map((path) => ({
            message: `секрет в TOML запрещён: удалите ключ и задайте переменную ${envVariableFor(path.split('.'), envPrefix)}`,
            path,
            source,
        }));
        if (issues.length > 0) {
            throw new ConfigSecretError(issues);
        }
    }

    private __maskValue(value: unknown, secret: boolean): unknown {
        if (Array.isArray(value)) {
            return value.map((item) => this.__maskValue(item, secret));
        }
        if (isConfigTree(value)) {
            return Object.fromEntries(
                Object.entries(value).map(([key, item]) => [
                    key,
                    this.__maskValue(item, secret || this.isSecretKey(key)),
                ]),
            );
        }
        return secret ? this.__mask : value;
    }
}

/** Политика по умолчанию: слова из эпика и маска `***`. */
export const DEFAULT_SECRET_POLICY = new SecretPolicy();

/** Копия значения с замаскированными секретами по политике по умолчанию: для логов и ответов API. */
export function maskSecrets<T>(value: T): T {
    return DEFAULT_SECRET_POLICY.maskSecrets(value);
}

/** Проверка ключа по политике по умолчанию. */
export function isSecretKey(key: string): boolean {
    return DEFAULT_SECRET_POLICY.isSecretKey(key);
}
