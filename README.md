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
