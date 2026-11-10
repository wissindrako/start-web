import { describe, expect, it } from 'vitest';

import { parseList } from './oauth-lists';

describe('parseList', () => {
  it('reads the JSON text Better Auth wrote on MySQL', () => {
    expect(parseList('["openid","profile"]')).toEqual(['openid', 'profile']);
  });

  it('keeps an empty list as an empty list ("nothing allowed")', () => {
    expect(parseList('[]')).toEqual([]);
  });

  it('reads an empty column as null ("use the defaults")', () => {
    expect(parseList(null)).toBeNull();
    expect(parseList(undefined)).toBeNull();
    expect(parseList('')).toBeNull();
  });

  it('reads older comma separated values', () => {
    expect(parseList('openid, profile')).toEqual(['openid', 'profile']);
  });

  it('passes lists through', () => {
    expect(parseList(['a', 'b'])).toEqual(['a', 'b']);
  });
});
