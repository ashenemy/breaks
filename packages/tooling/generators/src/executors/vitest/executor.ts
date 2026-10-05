import type { ExecutorContext } from '@nx/devkit';

import type { VitestExecutorSchema } from '../../@types';
import { VitestRunner } from '../../lib/vitest-runner';

/** Точка входа executor-а `@market/tooling:vitest` (цель `test` сгенерированных проектов). */
export async function vitestExecutor(options: VitestExecutorSchema, context: ExecutorContext): Promise<{ success: boolean }> {
    return new VitestRunner().execute(options, context);
}
