export interface DiversityAxis {
  key: string;
  label: string;
  description?: string;
  min?: number;
  max?: number;
}

export type AxisCoordinate = Record<string, number>;

export interface Persona {
  id: string;
  summary: string;
  attributes: Record<string, string | number | boolean>;
}

export interface GenerationContext {
  domain: string;
  objective?: string;
  seed?: number;
}

export interface GenerationRequest {
  context: GenerationContext;
  axes: DiversityAxis[];
  count: number;
}
