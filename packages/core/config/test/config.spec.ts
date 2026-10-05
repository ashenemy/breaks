import { describe, expect, it } from 'vitest';

import { configInfo } from '../src/index.js';

describe('configInfo', () => {
    it('возвращает имя пакета', () => {
        expect(configInfo()).toEqual({ name: 'config' });
    });
});
