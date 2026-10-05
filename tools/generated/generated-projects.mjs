/**
 * Проверка «проект создан генератором» (эпик E00.01, раздел 2).
 *
 * Генераторы воркспейса (и официальные генераторы Nx, которыми созданы сами плагины) записывают в
 * `project.json` → `metadata.generator` имя вида `@scope/collection:generator`. Проект без такого
 * маркера собран вручную и не проходит CI.
 */

const GENERATOR_MARKER = /^@?[a-z0-9][\w./-]*:[a-z0-9][\w-]*$/i;

/**
 * @typedef {{ name: string; data?: { root?: string; metadata?: { generator?: unknown } } }} GraphNode
 * @typedef {{ name: string; root: string }} ProjectRef
 */

/**
 * Возвращает проекты графа Nx без корректного маркера генератора, отсортированные по имени.
 * @param {Record<string, GraphNode>} nodes узлы `graph.nodes` из `nx graph --file=<json>`
 * @returns {ProjectRef[]}
 */
export function findProjectsWithoutGenerator(nodes) {
    return Object.values(nodes)
        .filter((node) => !isGeneratorMarker(node.data?.metadata?.generator))
        .map((node) => ({ name: node.name, root: node.data?.root ?? '' }))
        .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isGeneratorMarker(value) {
    return typeof value === 'string' && GENERATOR_MARKER.test(value);
}

/**
 * Человекочитаемый отчёт для CI.
 * @param {ProjectRef[]} missing
 * @param {number} total
 * @returns {string}
 */
export function formatReport(missing, total) {
    if (missing.length === 0) {
        return `Все проекты (${total}) созданы генераторами: маркер metadata.generator найден.`;
    }
    const lines = missing.map((project) => `  - ${project.name} (${project.root})`);
    return [
        `Проекты без маркера генератора (${missing.length} из ${total}):`,
        ...lines,
        'Создавайте проекты генераторами: nx g @market/tooling:<generator> (docs/epics/E00.01-monorepo-nx.md).',
    ].join('\n');
}
