import { describe, it, expect } from 'vitest';
import { addPlayTime, formatPlayTime, MAX_STEP_MS } from './PlayClock.js';

describe('addPlayTime', () => {
  it('adds each frame', () => {
    expect(addPlayTime(1000, 16)).toBe(1016);
  });

  it('caps a long gap so time away does not count', () => {
    expect(addPlayTime(0, 60_000)).toBe(MAX_STEP_MS);
  });

  it('ignores negative or missing deltas', () => {
    expect(addPlayTime(500, -20)).toBe(500);
    expect(addPlayTime(500, undefined)).toBe(500);
  });
});

describe('formatPlayTime', () => {
  it('shows minutes and seconds under an hour', () => {
    expect(formatPlayTime(0)).toBe('0:00');
    expect(formatPlayTime(245_900)).toBe('4:05');
  });

  it('adds hours from an hour up', () => {
    expect(formatPlayTime(3_725_000)).toBe('1:02:05');
  });
});
