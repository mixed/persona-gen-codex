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

  it('does not reuse bases when axes exceed 10', () => {
    const sampler = new HaltonSampler();
    const axes = Array.from({ length: 12 }, (_, i) => ({
      key: `axis${i}`,
      label: `Axis ${i}`,
    }));

    const [point] = sampler.sample(axes, 1);
    const values = Object.values(point);

    expect(new Set(values).size).toBe(values.length);
    expect(point.axis10).toBe(1 / 31);
    expect(point.axis11).toBe(1 / 37);
  });

  it('keeps extended axis-base mapping stable across repeated sampling', () => {
    const sampler = new HaltonSampler();
    const axes = Array.from({ length: 12 }, (_, i) => ({
      key: `axis${i}`,
      label: `Axis ${i}`,
    }));

    const [firstPoint] = sampler.sample(axes, 1);
    const [secondPoint] = sampler.sample(axes, 1);

    expect(secondPoint.axis10).toBe(firstPoint.axis10);
    expect(secondPoint.axis11).toBe(firstPoint.axis11);
  });
});
