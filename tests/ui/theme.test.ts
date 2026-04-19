import { describe, test, expect } from 'bun:test';
import { fmtMoney, fmtPrice, fmtDuration, fmtEpoch } from '../../src/ui/theme';

describe('fmtMoney', () => {
  test('positive values get a + sign', () => {
    expect(fmtMoney(1.5, 'USD')).toBe('+1.50 USD');
  });

  test('negative values get a - sign', () => {
    expect(fmtMoney(-1.5, 'USD')).toBe('-1.50 USD');
  });

  test('zero has no sign', () => {
    expect(fmtMoney(0, 'USD')).toBe('0.00 USD');
  });

  test('handles large numbers', () => {
    expect(fmtMoney(10086.37, 'USD')).toBe('+10086.37 USD');
  });

  test('NaN renders em-dash, not "NaN USD" (regression test)', () => {
    expect(fmtMoney(NaN, 'USD')).toBe('— USD');
  });

  test('Infinity renders em-dash', () => {
    expect(fmtMoney(Infinity, 'USD')).toBe('— USD');
    expect(fmtMoney(-Infinity, 'USD')).toBe('— USD');
  });

  test('undefined (via type abuse) renders em-dash', () => {
    expect(fmtMoney(undefined as unknown as number, 'USD')).toBe('— USD');
  });

  test('defaults to USD currency', () => {
    expect(fmtMoney(1)).toBe('+1.00 USD');
  });

  test('empty currency omits trailing space', () => {
    expect(fmtMoney(NaN, '')).toBe('—');
  });
});

describe('fmtPrice', () => {
  test('formats with default 3 digits', () => {
    expect(fmtPrice(1234.5678)).toBe('1234.568');
  });

  test('accepts digits param', () => {
    expect(fmtPrice(1234.5678, 2)).toBe('1234.57');
  });

  test('null renders em-dash', () => {
    expect(fmtPrice(null)).toBe('—');
  });

  test('NaN renders em-dash', () => {
    expect(fmtPrice(NaN)).toBe('—');
  });

  test('Infinity renders em-dash', () => {
    expect(fmtPrice(Infinity)).toBe('—');
  });
});

describe('fmtDuration', () => {
  test('seconds only', () => {
    expect(fmtDuration(5_000)).toBe('5s');
  });

  test('minutes + seconds', () => {
    expect(fmtDuration(65_000)).toBe('1m 5s');
  });

  test('hours + minutes + seconds', () => {
    expect(fmtDuration(3_725_000)).toBe('1h 2m 5s');
  });
});

describe('fmtEpoch', () => {
  test('zero/null epoch returns em-dash', () => {
    expect(fmtEpoch(0)).toBe('—');
    expect(fmtEpoch(null)).toBe('—');
  });

  test('positive epoch returns HH:MM:SS', () => {
    const out = fmtEpoch(1712345678);
    expect(out).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
