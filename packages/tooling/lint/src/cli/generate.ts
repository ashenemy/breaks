import { BiomeGenerator } from '../lib/biome-generator.js';
import { EslintGenerator } from '../lib/eslint-generator.js';

/** Генерация biome.json и eslint.config.mjs в корне воркспейса (postinstall и перед запуском раннера). */
const workspaceRoot = process.cwd();
const biome = new BiomeGenerator({ workspaceRoot }).generate();
const eslint = new EslintGenerator({ workspaceRoot }).generate();
console.log(
    `Конфиги линтинга: biome.json ${biome.written ? 'записан' : 'актуален'}, eslint.config.mjs ${eslint.written ? 'записан' : 'актуален'}.`,
);
