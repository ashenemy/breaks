import type { z } from 'zod';

import type { RULES_SCHEMA } from '../lib/rules-schema.js';

/** Конфигурация правил кода, выведенная из Zod-схемы `rules.toml` (единственный ручной источник). */
export type RulesConfig = z.infer<typeof RULES_SCHEMA>;

/** Сырые данные TOML до валидации. */
export type RawRules = z.input<typeof RULES_SCHEMA>;

export type FormatRules = RulesConfig['format'];
export type NamingRules = RulesConfig['naming'];
export type MembersRules = RulesConfig['members'];
export type ImportsRules = RulesConfig['imports'];
export type TypesRules = RulesConfig['types'];
export type AngularRules = RulesConfig['angular'];
export type I18nRules = RulesConfig['i18n'];
export type BoundariesRules = RulesConfig['boundaries'];
export type BoundaryConstraint = BoundariesRules['constraints'][number];
export type CommitsRules = RulesConfig['commits'];
export type OverlapRules = RulesConfig['overlap'];
export type PlatformOverrides = RulesConfig['platforms'];

/** Одна ошибка валидации: путь в TOML и сообщение. */
export type RulesIssue = {
    message: string;
    path: string;
};

/** Результат загрузки конфига. */
export type LoadedRules = {
    config: RulesConfig;
    filePath: string;
};
