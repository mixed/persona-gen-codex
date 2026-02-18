import type { AxisCoordinate, DiversityAxis, GenerationContext, Persona } from '../types';

export interface LLMProvider {
  readonly name: string;

  generateAxes?(context: GenerationContext): Promise<DiversityAxis[]>;

  expandPersona(input: {
    context: GenerationContext;
    coordinates: AxisCoordinate;
    index: number;
  }): Promise<Persona>;
}
