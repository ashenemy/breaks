import type { CommitsRules } from '../@types/index.js';
import { projectRootOf } from './project-roots.js';

export type CommitValidationInput = {
    message: string;
    /** Корни проектов Nx (`findProjectRoots`). */
    projectRoots: readonly string[];
    rules: CommitsRules;
    /** Файлы коммита относительно корня воркспейса. */
    stagedFiles: readonly string[];
};

export type CommitValidationResult = {
    errors: string[];
    scope?: string;
    type?: string;
    valid: boolean;
};

const SUBJECT_PATTERN = /^(\S+) ([a-z]+): ([a-z]+)\/([a-z0-9/_-]+): (.+)$/u;

/** Регулярное выражение формата первой строки, собранное из `[commits]` (для документации и хуков). */
export function buildSubjectRegex(rules: CommitsRules): RegExp {
    const pairs = Object.entries(rules.types)
        .map(([type, icon]) => `${escapeRegex(icon)} ${type}`)
        .join('|');
    return new RegExp(
        `^(${pairs}): (${rules['root-scopes'].join('|')})/[a-z0-9/_-]+: .{1,${rules['subject-max']}}$`,
        'u',
    );
}

/** Проверяет сообщение коммита: формат, пара иконка-тип, трейлеры задачи, один проект Nx. */
export function validateCommitMessage(input: CommitValidationInput): CommitValidationResult {
    const { message, projectRoots, rules, stagedFiles } = input;
    const errors: string[] = [];
    const lines = message.replace(/\r\n?/g, '\n').split('\n');
    const subject = lines[0] ?? '';
    const body = lines.slice(1).join('\n');

    const match = SUBJECT_PATTERN.exec(subject);
    if (!match) {
        errors.push(
            `Первая строка должна быть вида "<иконка> <тип>: <rootScope>/<moduleScope>: <сообщение>", получено: "${subject}"`,
        );
        return { errors, valid: false };
    }
    const [, icon, type, rootScope, moduleScope, text] = match as unknown as [
        string,
        string,
        string,
        string,
        string,
        string,
    ];
    const expectedIcon = rules.types[type];
    if (expectedIcon === undefined) {
        errors.push(`Неизвестный тип коммита "${type}"; допустимые: ${Object.keys(rules.types).join(', ')}`);
    } else if (icon !== expectedIcon) {
        errors.push(`Иконка "${icon}" не соответствует типу "${type}": ожидается "${expectedIcon}"`);
    }
    if (!rules['root-scopes'].includes(rootScope)) {
        errors.push(`rootScope "${rootScope}" не из списка: ${rules['root-scopes'].join(', ')}`);
    }
    if (text.length > rules['subject-max']) {
        errors.push(`Сообщение длиннее ${rules['subject-max']} символов`);
    }
    if (!new RegExp(`^${escapeRegex(rules['task-trailer'])}: \\S+`, 'm').test(body)) {
        errors.push(`В теле нет строки "${rules['task-trailer']}: <id>"`);
    }
    if (!new RegExp(`^${escapeRegex(rules['substep-trailer'])}: \\d+`, 'm').test(body)) {
        errors.push(`В теле нет строки "${rules['substep-trailer']}: <n>"`);
    }

    const scope = `${rootScope}/${moduleScope}`;
    const projects = new Set<string>();
    let hasRootFiles = false;
    for (const file of stagedFiles) {
        const root = projectRootOf(file, projectRoots);
        if (root === null) {
            hasRootFiles = true;
        } else {
            projects.add(root);
        }
    }
    if (projects.size > 1) {
        errors.push(`Коммит затрагивает несколько проектов: ${[...projects].sort().join(', ')}; разделите его`);
    } else if (projects.size === 1) {
        const [projectRoot] = [...projects] as [string];
        if (hasRootFiles) {
            errors.push(
                `Коммит смешивает файлы проекта ${projectRoot} и корневые файлы; корневые файлы коммитятся отдельно со scope root/...`,
            );
        }
        if (rootScope === 'root') {
            errors.push(`Файлы проекта ${projectRoot} требуют scope "${projectRoot}", а не "root/..."`);
        } else if (scope !== projectRoot) {
            errors.push(`Scope "${scope}" не совпадает с корнем проекта "${projectRoot}"`);
        }
    } else if (hasRootFiles && rootScope !== 'root') {
        errors.push(`Корневые файлы допустимы только со scope root/..., получено "${scope}"`);
    }

    return { errors, scope, type, valid: errors.length === 0 };
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
