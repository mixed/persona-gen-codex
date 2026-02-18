import type { AxisCoordinate, DiversityAxis } from '../types';

const DEFAULT_BASES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];

export class HaltonSampler {
  private readonly extendedBases: number[] = [];

  public sample(axes: DiversityAxis[], count: number): AxisCoordinate[] {
    return Array.from({ length: count }, (_, i) => {
      const index = i + 1;
      const coordinates: AxisCoordinate = {};

      axes.forEach((axis, axisIndex) => {
        const base = this.getBaseForAxis(axisIndex);
        coordinates[axis.key] = this.halton(index, base);
      });

      return coordinates;
    });
  }

  private getBaseForAxis(axisIndex: number): number {
    if (axisIndex < DEFAULT_BASES.length) {
      return DEFAULT_BASES[axisIndex];
    }

    const extendedIndex = axisIndex - DEFAULT_BASES.length;

    while (this.extendedBases.length <= extendedIndex) {
      const previousBase =
        this.extendedBases[this.extendedBases.length - 1] ?? DEFAULT_BASES[DEFAULT_BASES.length - 1];
      this.extendedBases.push(this.nextPrime(previousBase + 1));
    }

    return this.extendedBases[extendedIndex];
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
