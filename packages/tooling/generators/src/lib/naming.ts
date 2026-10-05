import type { ProjectTags } from '../@types';
import { KEBAB_CASE } from './constants';

/** Проверяет, что значение в kebab-case; иначе бросает понятную ошибку. */
export function assertKebabCase(value: string, label: string): void {
    if (!KEBAB_CASE.test(value)) {
        throw new Error(`${label} должно быть в kebab-case (буквы, цифры, дефисы): получено "${value}"`);
    }
}

/** Собирает три обязательных тега проекта в каноническом порядке. */
export function buildTags(tags: ProjectTags): string[] {
    return [`scope:${tags.scope}`, `type:${tags.type}`, `platform:${tags.platform}`];
}
