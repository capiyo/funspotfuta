import { describe, expect, it } from 'vitest';
import { isDemoMemberName } from './channels-service';

describe('isDemoMemberName', () => {
  it.each(['guest_john', ' Guest_John ', '@guest_john', '@@GUEST_JOHN', 'mary_ochieng', '@Mary_Ochieng'])(
    'recognizes demo account handle %s',
    (username) => {
      expect(isDemoMemberName(username)).toBe(true);
    },
  );

  it.each(['guest', 'john_guest', 'real_supporter', ''])(
    'does not classify ordinary username %s as a demo account',
    (username) => {
      expect(isDemoMemberName(username)).toBe(false);
    },
  );

  it('rejects non-string values', () => {
    expect(isDemoMemberName(null)).toBe(false);
    expect(isDemoMemberName(undefined)).toBe(false);
    expect(isDemoMemberName({ username: 'guest_john' })).toBe(false);
  });
});
