import { describe, expect, it } from 'vitest';

import { asUuid, normalizeIdArgs } from './uuid-ids';

describe('asUuid', () => {
  it('keeps a value that already is a UUID', () => {
    const id = '018f0000-0000-7000-8000-000000000001';
    expect(asUuid(id)).toBe(id);
  });

  it('converts an old id the same way the migration does', () => {
    expect(asUuid('cmvgko0yn001wtmi8iw7q5v12')).toBe(
      '66413c06-c4d1-538f-8607-592904c2f580'
    );
  });

  it('is deterministic and distinguishes different ids', () => {
    expect(asUuid('jti-1')).toBe(asUuid('jti-1'));
    expect(asUuid('jti-1')).not.toBe(asUuid('jti-2'));
  });
});

describe('normalizeIdArgs', () => {
  it('converts the forced id on writes to the single-use tables', () => {
    const args = {
      data: { id: 'jti-1', expiresAt: new Date('2026-11-22T00:00:00Z') },
    };
    expect(normalizeIdArgs('OauthClientAssertion', 'create', args)).toEqual({
      data: { ...args.data, id: asUuid('jti-1') },
    });
    expect(normalizeIdArgs('Verification', 'create', args)).toEqual({
      data: { ...args.data, id: asUuid('jti-1') },
    });
  });

  it('converts the forced id in where clauses (replay detection)', () => {
    const args = { where: { id: { equals: 'jti-1' } } };
    expect(normalizeIdArgs('OauthClientAssertion', 'findFirst', args)).toEqual({
      where: { id: { equals: asUuid('jti-1') } },
    });
  });

  it('leaves other models untouched', () => {
    const args = { data: { id: 'jti-1' } };
    expect(normalizeIdArgs('User', 'create', args)).toBe(args);
  });
});
