import { Inject } from '@nestjs/common';

import type { ModuleConfigToken } from './define-module-config.js';

/** Внедряет проверенный раздел модуля: `constructor(@InjectModuleConfig(CATALOG) config: ModuleConfig<typeof CATALOG>)`. */
export function InjectModuleConfig(token: ModuleConfigToken): ParameterDecorator & PropertyDecorator {
    return Inject(token.injectionToken);
}
