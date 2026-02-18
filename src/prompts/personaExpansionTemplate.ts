import type { AxisCoordinate, DiversityAxis, GenerationContext } from '../types';

export function buildPersonaExpansionPrompt(input: {
  context: GenerationContext;
  axes: DiversityAxis[];
  coordinates: AxisCoordinate;
}): string {
  const axisLines = input.axes
    .map((axis) => `- ${axis.label} (${axis.key}): ${input.coordinates[axis.key]?.toFixed(3) ?? 'n/a'}`)
    .join('\n');

  return [
    `Domain: ${input.context.domain}`,
    input.context.objective ? `Objective: ${input.context.objective}` : undefined,
    'Generate a realistic persona matching these diversity coordinates:',
    axisLines,
  ]
    .filter(Boolean)
    .join('\n');
}
