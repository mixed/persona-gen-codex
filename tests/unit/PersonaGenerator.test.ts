import { describe, expect, it, vi } from 'vitest';
import { PersonaGenerator } from '../../src/core/PersonaGenerator';
import { HaltonSampler } from '../../src/sampling/HaltonSampler';
import type { LLMProvider } from '../../src/providers/LLMProvider';

describe('PersonaGenerator', () => {
  it('passes request.context.seed to the sampler', async () => {
    const sampler = new HaltonSampler();
    const sampleSpy = vi.spyOn(sampler, 'sample').mockReturnValue([{ x: 0.5 }]);
    const provider: LLMProvider = {
      name: 'mock-provider',
      expandPersona: vi.fn().mockResolvedValue({
        id: 'p-1',
        summary: 'persona',
        attributes: {},
      }),
    };

    const generator = new PersonaGenerator(provider, sampler);
    const request = {
      context: { domain: 'test', seed: 42 },
      axes: [{ key: 'x', label: 'X' }],
      count: 1,
    };

    await generator.generate(request);

    expect(sampleSpy).toHaveBeenCalledWith(request.axes, request.count, request.context.seed);
  });
});
