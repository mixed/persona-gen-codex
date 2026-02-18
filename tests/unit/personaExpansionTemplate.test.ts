import { describe, expect, it } from 'vitest';
import { buildPersonaExpansionPrompt } from '../../src/prompts/personaExpansionTemplate';

describe('buildPersonaExpansionPrompt', () => {
  it('includes descriptions and mapped values when min/max are both present', () => {
    const prompt = buildPersonaExpansionPrompt({
      context: { domain: 'healthcare' },
      axes: [{ key: 'income', label: 'Income', description: '연 소득 수준', min: 0, max: 100 }],
      coordinates: { income: 0.25 },
    });

    expect(prompt).toContain(
      '- Income (income): normalized=0.250, mapped=25 (range: 0..100) - 연 소득 수준',
    );
  });

  it('omits mapped value and shows incomplete range when only min or max exists', () => {
    const prompt = buildPersonaExpansionPrompt({
      context: { domain: 'retail' },
      axes: [
        { key: 'spend', label: 'Spending', min: 10 },
        { key: 'risk', label: 'Risk', max: 5 },
      ],
      coordinates: { spend: 0.5, risk: 0.75 },
    });

    expect(prompt).toContain(
      '- Spending (spend): normalized=0.500, mapped=omitted (incomplete range: min=10)',
    );
    expect(prompt).toContain('- Risk (risk): normalized=0.750, mapped=omitted (incomplete range: max=5)');
  });

  it('shows n/a when coordinate is missing even if range exists', () => {
    const prompt = buildPersonaExpansionPrompt({
      context: { domain: 'education' },
      axes: [{ key: 'age', label: 'Age', min: 18, max: 65 }],
      coordinates: {},
    });

    expect(prompt).toContain('- Age (age): normalized=n/a, mapped=n/a (range: 18..65)');
  });

  it('prints only normalized when range metadata is absent', () => {
    const prompt = buildPersonaExpansionPrompt({
      context: { domain: 'finance' },
      axes: [{ key: 'stability', label: 'Stability', description: '리스크 성향' }],
      coordinates: { stability: 0.125 },
    });

    expect(prompt).toContain('- Stability (stability): normalized=0.125 - 리스크 성향');
  });
});
