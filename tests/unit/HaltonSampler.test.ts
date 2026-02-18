import { describe, expect, it } from 'vitest';
import { HaltonSampler } from '../../src/sampling/HaltonSampler';

describe('HaltonSampler', () => {
  it('generates deterministic low-discrepancy coordinates', () => {
    const sampler = new HaltonSampler();
    const axes = [
      { key: 'x', label: 'X' },
      { key: 'y', label: 'Y' },
    ];

    const points = sampler.sample(axes, 3);

    expect(points).toEqual([
      { x: 0.5, y: 1 / 3 },
      { x: 0.25, y: 2 / 3 },
      { x: 0.75, y: 1 / 9 },
    ]);
  });

  it('returns the same samples for the same seed', () => {
    const sampler = new HaltonSampler();
    const axes = [
      { key: 'x', label: 'X' },
      { key: 'y', label: 'Y' },
    ];

    expect(sampler.sample(axes, 4, 7)).toEqual(sampler.sample(axes, 4, 7));
  });

  it('returns different samples for different seeds', () => {
    const sampler = new HaltonSampler();
    const axes = [
      { key: 'x', label: 'X' },
      { key: 'y', label: 'Y' },
    ];

    expect(sampler.sample(axes, 4, 1)).not.toEqual(sampler.sample(axes, 4, 2));
  });
});
