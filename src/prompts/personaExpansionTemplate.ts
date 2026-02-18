import type { AxisCoordinate, DiversityAxis, GenerationContext } from '../types';

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function formatAxisLine(axis: DiversityAxis, coordinates: AxisCoordinate): string {
  const normalizedValue = coordinates[axis.key];
  const normalizedText = normalizedValue !== undefined ? normalizedValue.toFixed(3) : 'n/a';
  const descriptionText = axis.description ? ` - ${axis.description}` : '';

  const metadataParts: string[] = [`normalized=${normalizedText}`];

  if (axis.min !== undefined && axis.max !== undefined) {
    if (normalizedValue !== undefined) {
      const mappedValue = axis.min + normalizedValue * (axis.max - axis.min);
      metadataParts.push(
        `mapped=${formatNumber(mappedValue)} (range: ${formatNumber(axis.min)}..${formatNumber(axis.max)})`,
      );
    } else {
      metadataParts.push(`mapped=n/a (range: ${formatNumber(axis.min)}..${formatNumber(axis.max)})`);
    }
  } else if (axis.min !== undefined || axis.max !== undefined) {
    const partialRangeText = axis.min !== undefined ? `min=${formatNumber(axis.min)}` : `max=${formatNumber(axis.max!)}`;
    metadataParts.push(`mapped=omitted (incomplete range: ${partialRangeText})`);
  }

  return `- ${axis.label} (${axis.key}): ${metadataParts.join(', ')}${descriptionText}`;
}

export function buildPersonaExpansionPrompt(input: {
  context: GenerationContext;
  axes: DiversityAxis[];
  coordinates: AxisCoordinate;
}): string {
  const axisLines = input.axes.map((axis) => formatAxisLine(axis, input.coordinates)).join('\n');

  return [
    `Domain: ${input.context.domain}`,
    input.context.objective ? `Objective: ${input.context.objective}` : undefined,
    'Generate a realistic persona matching these diversity coordinates:',
    axisLines,
  ]
    .filter(Boolean)
    .join('\n');
}
