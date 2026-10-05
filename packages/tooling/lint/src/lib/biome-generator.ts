import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { buildBiomeConfig, type BiomeConfig } from './biome-config.js';
import { computeConfigHash, HashCache } from './config-hash.js';
import { DEFAULT_RULES_PATH, RulesLoader } from './rules-loader.js';

export type BiomeGeneratorOptions = {
    /** Принудительно перезаписать, даже если хеш не изменился. */
    force?: boolean;
    rulesPath?: string;
    workspaceRoot: string;
};

export type GenerateResult = {
    config: BiomeConfig;
    filePath: string;
    hash: string;
    /** Файл записан (хеш изменился, файла не было или `force`). */
    written: boolean;
};

export const BIOME_CONFIG_FILE = 'biome.json';

const TOOL = 'biome';

/** Генерирует `biome.json` в корне воркспейса из `rules.toml`, пропуская запись при неизменном хеше. */
export class BiomeGenerator {
    private readonly __biomeVersion: string;

    private readonly __options: Required<BiomeGeneratorOptions>;

    constructor(options: BiomeGeneratorOptions, biomeVersion: string = detectBiomeVersion(options.workspaceRoot)) {
        this.__options = { force: false, rulesPath: DEFAULT_RULES_PATH, ...options };
        this.__biomeVersion = biomeVersion;
    }

    public generate(): GenerateResult {
        const { force, rulesPath, workspaceRoot } = this.__options;
        const rulesToml = readFileSync(rulesPath, 'utf8');
        const rules = new RulesLoader(rulesPath).parse(rulesToml);
        const config = buildBiomeConfig(rules, this.__biomeVersion);
        const hash = computeConfigHash(rulesToml, { [TOOL]: this.__biomeVersion });
        const filePath = join(workspaceRoot, BIOME_CONFIG_FILE);
        const cache = new HashCache(workspaceRoot);

        const written = force || !existsSync(filePath) || !cache.isFresh(TOOL, hash);
        if (written) {
            writeFileSync(filePath, `${JSON.stringify(config, null, rules.format.indent)}\n`);
            cache.write(TOOL, hash);
        }
        return { config, filePath, hash, written };
    }
}

/** Версия установленного Biome: входит в хеш, чтобы обновление инструмента перегенерировало конфиг. */
export function detectBiomeVersion(workspaceRoot: string): string {
    const require = createRequire(join(workspaceRoot, 'package.json'));
    const packageJson = require('@biomejs/biome/package.json') as { version: string };
    return packageJson.version;
}
