#!/usr/bin/env node
declare const process: {
  argv: string[];
  exitCode?: number;
};

import { PersonaGenerator } from '../core/PersonaGenerator';
import type { LLMProvider } from '../providers/LLMProvider';
import type { GenerationRequest, Persona } from '../types';

class MockLLMProvider implements LLMProvider {
  public readonly name = 'mock';

  public async expandPersona(input: {
    context: GenerationRequest['context'];
    coordinates: Record<string, number>;
    index: number;
  }): Promise<Persona> {
    return {
      id: `persona-${input.index + 1}`,
      summary: `${input.context.domain} 사용자 페르소나`,
      attributes: input.coordinates,
    };
  }
}

async function main(): Promise<void> {
  const countArg = process.argv[2];
  const count = Number.parseInt(countArg ?? '3', 10);

  if (Number.isNaN(count) || count <= 0) {
    console.error('Usage: persona-gen [count]');
    process.exitCode = 1;
    return;
  }

  const generator = new PersonaGenerator(new MockLLMProvider());
  const personas = await generator.generate({
    context: { domain: 'sample-service' },
    axes: [
      { key: 'riskTolerance', label: 'Risk Tolerance' },
      { key: 'budgetSensitivity', label: 'Budget Sensitivity' },
    ],
    count,
  });

  console.log(JSON.stringify(personas, null, 2));
}

void main();
