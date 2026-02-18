import type { LLMProvider } from '../providers/LLMProvider';
import { HaltonSampler } from '../sampling/HaltonSampler';
import type { GenerationRequest, Persona } from '../types';

export class PersonaGenerator {
  constructor(
    private readonly provider: LLMProvider,
    private readonly sampler: HaltonSampler = new HaltonSampler(),
  ) {}

  public async generate(request: GenerationRequest): Promise<Persona[]> {
    const coordinates = this.sampler.sample(request.axes, request.count);

    return Promise.all(
      coordinates.map((point, index) =>
        this.provider.expandPersona({
          context: request.context,
          coordinates: point,
          index,
        }),
      ),
    );
  }
}
