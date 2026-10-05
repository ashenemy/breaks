import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Хеши сгенерированных конфигов по инструментам: `.cache/lint/hash`. */
export type HashRecord = Record<string, string>;

export const HASH_FILE_RELATIVE = join('.cache', 'lint', 'hash');

/** SHA-256 от текста правил и версий инструментов: любое изменение требует перегенерации. */
export function computeConfigHash(rulesToml: string, toolVersions: Record<string, string>): string {
    const hash = createHash('sha256');
    hash.update(rulesToml);
    for (const [tool, version] of Object.entries(toolVersions).sort(([left], [right]) => left.localeCompare(right))) {
        hash.update(`\n${tool}@${version}`);
    }
    return hash.digest('hex');
}

/** Файл хешей: атомарная запись, чтение терпимо к отсутствию и повреждению. */
export class HashCache {
    private readonly __filePath: string;

    constructor(workspaceRoot: string) {
        this.__filePath = join(workspaceRoot, HASH_FILE_RELATIVE);
    }

    public get filePath(): string {
        return this.__filePath;
    }

    public read(): HashRecord {
        if (!existsSync(this.__filePath)) {
            return {};
        }
        try {
            const parsed: unknown = JSON.parse(readFileSync(this.__filePath, 'utf8'));
            return isHashRecord(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }

    public isFresh(tool: string, hash: string): boolean {
        return this.read()[tool] === hash;
    }

    public write(tool: string, hash: string): void {
        const record = { ...this.read(), [tool]: hash };
        mkdirSync(dirname(this.__filePath), { recursive: true });
        const tempPath = `${this.__filePath}.${process.pid}.tmp`;
        writeFileSync(tempPath, `${JSON.stringify(record, null, 4)}\n`);
        renameSync(tempPath, this.__filePath);
    }
}

function isHashRecord(value: unknown): value is HashRecord {
    return (
        typeof value === 'object' && value !== null && Object.values(value).every((item) => typeof item === 'string')
    );
}
