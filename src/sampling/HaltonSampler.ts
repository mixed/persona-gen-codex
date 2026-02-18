import type { AxisCoordinate, DiversityAxis } from '../types';

const DEFAULT_BASES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];

export class HaltonSampler {
  public sample(axes: DiversityAxis[], count: number, seed?: number): AxisCoordinate[] {
    const offset = this.normalizeSeed(seed);

    return Array.from({ length: count }, (_, i) => {
      const index = i + 1 + offset;
      const coordinates: AxisCoordinate = {};

      axes.forEach((axis, axisIndex) => {
        const base = DEFAULT_BASES[axisIndex] ?? this.nextPrime(DEFAULT_BASES[DEFAULT_BASES.length - 1] + axisIndex);
        coordinates[axis.key] = this.halton(index, base);
      });

      return coordinates;
    });
  }

  private normalizeSeed(seed?: number): number {
    if (!Number.isFinite(seed)) {
      return 0;
    }

    return Math.max(0, Math.trunc(seed));
  }

  private halton(index: number, base: number): number {
    let f = 1;
    let result = 0;
    let i = index;

    while (i > 0) {
      f /= base;
      result += f * (i % base);
      i = Math.floor(i / base);
    }

    return result;
  }

  private nextPrime(start: number): number {
    let n = Math.max(2, start);

    while (!this.isPrime(n)) {
      n += 1;
    }

    return n;
  }

  private isPrime(n: number): boolean {
    if (n < 2) {
      return false;
    }
    for (let i = 2; i <= Math.sqrt(n); i += 1) {
      if (n % i === 0) {
        return false;
      }
    }
    return true;
  }
}
