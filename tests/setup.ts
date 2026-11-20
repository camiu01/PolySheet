/** @file Browser-compatible unit-test environment with real IndexedDB semantics. */
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
Object.assign(globalThis, { TextEncoder, TextDecoder });
// Pin the unit-test locale so interface assertions stay stable regardless of the host language.
Object.defineProperty(globalThis.navigator, 'language', { value: 'it-IT', configurable: true });
Object.defineProperty(globalThis.navigator, 'languages', { value: ['it-IT', 'it'], configurable: true });
afterEach(cleanup);
