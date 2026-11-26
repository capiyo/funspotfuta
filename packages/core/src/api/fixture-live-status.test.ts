import { describe, expect, it } from 'vitest';
import { resolveFixtureIsLive } from './fixture-live-status';

describe('resolveFixtureIsLive', () => {
  it.each(['upcoming', 'soon', 'scheduled', 'not_started', 'postponed'])(
    'does not promote %s from a stale true is_live flag',
    (status) => {
      expect(resolveFixtureIsLive(status, true)).toBe(false);
    },
  );

  it.each(['live', 'in_play', 'first_half', 'second_half', 'half_time', 'extra_time', 'penalties'])(
    'recognizes provider-confirmed live status %s even when the cached flag is false',
    (status) => {
      expect(resolveFixtureIsLive(status, false)).toBe(true);
    },
  );

  it.each(['completed', 'finished', 'full_time', 'ft'])(
    'keeps finished status %s non-live even when the cached flag is true',
    (status) => {
      expect(resolveFixtureIsLive(status, true)).toBe(false);
    },
  );

  it('rejects provider live status when kickoff is still an hour away', () => {
    const kickoff = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(resolveFixtureIsLive('live', true, kickoff)).toBe(false);
  });

  it('accepts provider live status within the five-minute early-start tolerance', () => {
    const kickoff = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    expect(resolveFixtureIsLive('live', true, kickoff)).toBe(true);
  });

  it('uses the cached flag only when status is genuinely unspecified', () => {
    expect(resolveFixtureIsLive('', true)).toBe(true);
    expect(resolveFixtureIsLive('', false)).toBe(false);
  });
});
