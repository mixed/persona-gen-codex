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


## 축 메타데이터가 프롬프트에 반영되는 방식

`DiversityAxis`에 `description`, `min`, `max`를 주면 프롬프트의 축 라인에 함께 반영됩니다.

- `description`이 있으면 축 이름 뒤에 설명이 붙습니다.
- `min`/`max`가 모두 있으면 정규화 좌표(`0~1`)를 실제 범위 값으로 역매핑해 함께 출력합니다.
- `min` 또는 `max` 중 하나만 있으면 역매핑은 생략하고, 불완전 범위를 명시합니다.

예시:

```ts
const axes = [
  { key: 'income', label: 'Income', description: '연 소득 수준', min: 0, max: 100 },
  { key: 'spend', label: 'Spending', min: 10 },
];

const coordinates = { income: 0.25, spend: 0.5 };
```

프롬프트 축 라인 출력 예:

```text
- Income (income): normalized=0.250, mapped=25 (range: 0..100) - 연 소득 수준
- Spending (spend): normalized=0.500, mapped=omitted (incomplete range: min=10)
```
