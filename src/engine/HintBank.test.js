import { describe, it, expect } from 'vitest';
import { HintBank, MAX_HINTS, REGEN_MS } from './HintBank.js';

describe('HintBank', () => {
  it('starts full, and an old save without hints starts full too', () => {
    expect(new HintBank().charges).toBe(MAX_HINTS);
    expect(HintBank.fromSave(undefined, 0).charges).toBe(MAX_HINTS);
  });

  it('spends charges until empty', () => {
    const bank = new HintBank();
    for (let i = 0; i < MAX_HINTS; i++) expect(bank.spend(0)).toBe(true);
    expect(bank.charges).toBe(0);
    expect(bank.spend(0)).toBe(false);
  });

  it('regenerates one charge every 10 minutes', () => {
    const bank = new HintBank();
    bank.spend(0);
    expect(bank.msUntilNext(0)).toBe(REGEN_MS);
    expect(bank.tick(REGEN_MS - 1)).toBe(0);
    expect(bank.tick(REGEN_MS)).toBe(1);
    expect(bank.charges).toBe(MAX_HINTS);
    expect(bank.msUntilNext(REGEN_MS)).toBe(0);
  });

  it('catches up on time away, but never above the cap', () => {
    const bank = new HintBank();
    bank.spend(0);
    bank.spend(0);
    bank.spend(0);
    const saved = bank.toSave();
    const later = HintBank.fromSave(saved, 25 * 60_000);
    expect(later.charges).toBe(2);
    expect(later.msUntilNext(25 * 60_000)).toBe(5 * 60_000);
    expect(HintBank.fromSave(saved, 3 * 60 * 60_000).charges).toBe(MAX_HINTS);
  });

  it('earns a hint every 3 discoveries', () => {
    const bank = new HintBank({ charges: 0, regenAt: REGEN_MS });
    expect(bank.onDiscovery(0)).toBe(false);
    expect(bank.onDiscovery(0)).toBe(false);
    expect(bank.discoveriesToNext).toBe(1);
    expect(bank.onDiscovery(0)).toBe(true);
    expect(bank.charges).toBe(1);
    expect(bank.discoveriesToNext).toBe(3);
  });

  it('does not earn above the cap, but keeps the progress for later', () => {
    const bank = new HintBank();
    bank.onDiscovery(0);
    bank.onDiscovery(0);
    expect(bank.onDiscovery(0)).toBe(false);
    expect(bank.onDiscovery(0)).toBe(false);
    expect(bank.charges).toBe(MAX_HINTS);
    bank.spend(0);
    expect(bank.discoveriesToNext).toBe(1);
    expect(bank.onDiscovery(0)).toBe(true);
    expect(bank.charges).toBe(MAX_HINTS);
  });
});
