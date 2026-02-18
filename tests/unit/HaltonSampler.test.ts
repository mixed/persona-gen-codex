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
});
