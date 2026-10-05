import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import type { GenerateResult } from './biome-generator.js';
import { computeConfigHash, HashCache } from './config-hash.js';
import { buildEslintConfig, type EslintFeatures } from './eslint-config.js';
import { DEFAULT_RULES_PATH, RulesLoader } from './rules-loader.js';

export type EslintGeneratorOptions = {
    features?: Partial<EslintFeatures>;
    force?: boolean;
    rulesPath?: string;
    workspaceRoot: string;
};

export type EslintGenerateResult = Omit<GenerateResult, 'config'> & { content: string };

export const ESLINT_CONFIG_FILE = 'eslint.config.mjs';

const TOOL = 'eslint';

/** Пакеты, версии которых входят в хеш: обновление любого перегенерирует конфиг. */
const HASHED_PACKAGES = ['eslint', '@nx/eslint-plugin', 'typescript-eslint', 'angular-eslint'];

/** Генерирует `eslint.config.mjs` в корне воркспейса из `rules.toml`, пропуская запись при неизменном хеше. */
export class EslintGenerator {
    private readonly __features: EslintFeatures;

    private readonly __options: Required<Omit<EslintGeneratorOptions, 'features'>>;

    private readonly __versions: Record<string, string>;

    constructor(
        options: EslintGeneratorOptions,
        versions: Record<string, string> = detectToolVersions(options.workspaceRoot),
    ) {
        const { features, ...rest } = options;
        this.__options = { force: false, rulesPath: DEFAULT_RULES_PATH, ...rest };
        this.__versions = versions;
        this.__features = { angular: 'angular-eslint' in versions, ...features };
    }

    public generate(): EslintGenerateResult {
        const { force, rulesPath, workspaceRoot } = this.__options;
        const rulesToml = readFileSync(rulesPath, 'utf8');
        const rules = new RulesLoader(rulesPath).parse(rulesToml);
        const content = buildEslintConfig(rules, this.__features);
        const hash = computeConfigHash(rulesToml, {
            ...this.__versions,
            'features.angular': String(this.__features.angular),
        });
        const filePath = join(workspaceRoot, ESLINT_CONFIG_FILE);
        const cache = new HashCache(workspaceRoot);

        const written = force || !existsSync(filePath) || !cache.isFresh(TOOL, hash);
        if (written) {
            writeFileSync(filePath, content);
            cache.write(TOOL, hash);
        }
        return { content, filePath, hash, written };
    }
}

/** Версии установленных инструментов ESLint; отсутствующие (например, angular-eslint до E00.11) пропускаются. */
export function detectToolVersions(workspaceRoot: string): Record<string, string> {
    const require = createRequire(join(workspaceRoot, 'package.json'));
    const versions: Record<string, string> = {};
    for (const name of HASHED_PACKAGES) {
        try {
            versions[name] = (require(`${name}/package.json`) as { version: string }).version;
        } catch {
            // пакет не установлен: соответствующие блоки конфига не генерируются
        }
    }
    return versions;
}
