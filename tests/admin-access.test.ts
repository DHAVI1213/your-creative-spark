import { expect, test } from 'bun:test';
import { canOpenAdmin } from '../src/lib/admin-access';

test('a client without the admin role is denied', () => {
  expect(canOpenAdmin(false, null)).toBe(false);
});
test('only a successful server-confirmed admin role grants access', () => {
  expect(canOpenAdmin(true, null)).toBe(true);
  expect(canOpenAdmin(null, null)).toBe(false);
  expect(canOpenAdmin(true, new Error('Role validation failed'))).toBe(false);
});