import { parse, type TomlTableWithoutBigInt } from 'smol-toml';

import type { ConfigTree } from '../@types/index.js';

/**
 * Настройки парсера: целые числа только как `number` (деньги хранятся в минимальных единицах и помещаются
 * в безопасный диапазон), небезопасные ключи (`__proto__`, `constructor`) отвергаются до слияния слоёв.
 */
const PARSE_OPTIONS = { integersAsBigInt: false, unsafeKeyBehaviour: 'throw' } as const;

/** Разбор TOML с настройками пакета; ошибки парсера пробрасываются как есть. */
export function parseToml(text: string): ConfigTree {
    const table: TomlTableWithoutBigInt = parse(text, PARSE_OPTIONS);
    return table;
}
