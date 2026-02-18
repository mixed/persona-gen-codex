# persona-gen-codex

TypeScript 기반 Persona Generator 라이브러리의 초기 스캐폴드입니다.

## 빠른 시작

### 1) 설치

```bash
npm install
```

### 2) 빌드

```bash
npm run build
```

### 3) 테스트

```bash
npm test
```

### 4) CLI 실행

```bash
npm run dev -- 3
```

또는 빌드 후:

```bash
npm run start -- 3
```

## 현재 포함된 모듈

- `src/core/PersonaGenerator.ts`: 생성 파이프라인 오케스트레이터 골격
- `src/providers/LLMProvider.ts`: 교체 가능한 LLM Provider 인터페이스
- `src/sampling/HaltonSampler.ts`: Stage 1 준랜덤 샘플링(Halton)
- `src/prompts/personaExpansionTemplate.ts`: Persona 확장 프롬프트 템플릿
- `src/cli/index.ts`: 최소 실행 가능한 CLI 엔트리포인트

## Seed 동작(재현성)

- `GenerationContext.seed`를 지정하면(소수점은 버림, 음수는 0으로 보정) `HaltonSampler`의 시작 인덱스가 seed 오프셋으로 결정됩니다.
- 동일한 입력(`axes`, `count`, `seed`)에는 동일한 샘플 좌표가 생성됩니다.
- `seed`가 다르면 다른 좌표 시퀀스를 사용합니다.
- 재현성 보장은 샘플링 단계에 한정됩니다. 최종 생성 결과는 연결된 LLM Provider의 비결정성 설정에 따라 달라질 수 있습니다.
