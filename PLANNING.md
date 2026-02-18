# Persona Generator 구현 계획서

> 논문: "Persona Generators: Generating Diverse Synthetic Personas at Scale" (Paglieri et al., 2026)
> 구현 형태: TypeScript 라이브러리 (API + CLI) + Markdown 출력

---

## 0. 논문 핵심 요약 (구현 문맥용)

이 섹션은 Claude Code가 구현 시 참조할 논문의 핵심 개념을 정리한 것이다.

### 0.1 풀고자 하는 문제

AI 시스템을 평가하려면 다양한 사용자 인구집단에서의 행동을 이해해야 한다. 그러나 실제 인간 데이터를 수집하는 것은 비용이 높고, 특히 아직 존재하지 않는 기술이나 미래 시나리오에서는 불가능하다. LLM에게 "다양한 페르소나를 만들어줘"라고 단순 요청하면 **mode collapse**가 발생한다 — 스테레오타입에 수렴하고, 극단적이거나 드문 특성 조합(long-tail)은 생성되지 않는다.

### 0.2 핵심 개념: Persona Generator

Persona Generator는 **임의의 맥락(context)을 입력받아 다양한 합성 페르소나 인구집단을 출력하는 함수**이다. 이 함수의 목표는 density matching(가장 흔한 유형 복제)이 아닌 **support coverage**(가능한 모든 유형 포괄)이다.

### 0.3 2-Stage 파이프라인 (구현의 핵심)

```
Stage 1: 다양성 공간 정의 + 샘플링
  Input:  짧은 컨텍스트 (예: "자율주행 초기 채택자")
  Step 1: LLM이 컨텍스트를 확장 (배경, 환경, 이해관계자 설명)
  Step 2: LLM이 관련 다양성 축(diversity axes) 추출
          예: [기술 숙련도, 위험 감수 성향, 나이, 운전 빈도, 장애 여부, ...]
          각 축은 continuous(0~1 연속) 또는 categorical(이산 카테고리)
  Step 3: 준-랜덤(quasi-random) 시퀀스로 N차원 공간에서 좌표 샘플링
          → 각 페르소나는 축 값의 조합 (예: 기술=0.82, 위험=0.15, ...)

Stage 2: 페르소나 확장
  Input:  컨텍스트 + 축 정의 + 한 사람의 좌표 조합
  Output: 풍부한 페르소나 설명 (이름, 성격, 동기, 행동 패턴 등)
  핵심:   "행동 지향적(action-oriented)" 서술이 "기억/배경 기반" 서술보다 우수
          → "이 사람은 새로운 기술을 접하면 먼저 리스크를 따진다"
          → (X) "이 사람은 어린 시절 보수적인 환경에서 자랐다"
```

### 0.4 Quasi-Random 샘플링이 핵심인 이유

논문에서 AlphaEvolve(진화 알고리즘)로 수백 가지 Generator 변이체를 경쟁시킨 결과:
- **100회차 이후 quasi-random Monte Carlo 계열만 생존** (순수 랜덤, 격자 기반 등은 탈락)
- Halton/Sobol 같은 저불일치(low-discrepancy) 수열이 공간을 가장 균일하게 커버
- 단순 `Math.random()`은 클러스터링이 발생하여 다양성 점수가 낮음

### 0.5 다양성 평가: 6가지 메트릭

모든 메트릭은 페르소나 좌표(또는 임베딩)를 N차원 공간의 점으로 보고 측정한다:

| 메트릭 | 최적화 방향 | 의미 |
|--------|------------|------|
| Coverage (Monte Carlo) | ↑ 높을수록 좋음 | 공간에 랜덤 포인트를 뿌렸을 때, 가까운 페르소나가 있는 비율 |
| Convex Hull Volume | ↑ 높을수록 좋음 | 점들이 감싸는 볼록 껍질의 부피 (공간 점유 범위) |
| Mean Pairwise Distance | ↑ 높을수록 좋음 | 모든 페르소나 쌍 간 평균 거리 (전체 퍼짐 정도) |
| Min Pairwise Distance | ↑ 높을수록 좋음 | 가장 가까운 두 페르소나 간 거리 (중복 방지) |
| Dispersion | ↓ 낮을수록 좋음 | 가장 큰 빈 영역의 반경 (커버 안 된 구멍 크기) |
| KL Divergence | ↓ 낮을수록 좋음 | 균등분포와의 차이 (편향 정도) |

### 0.6 AlphaEvolve 간소화 근거

논문의 AlphaEvolve는 Generator 코드 자체를 진화시키는 메타-최적화(수백 iteration, 수만 LLM 호출)이다. 우리는 논문이 발견한 최종 승자 패턴(quasi-random + action-oriented expansion)을 직접 구현하므로, 진화 과정은 불필요하다. 대신 생성 후 다양성 점수가 threshold 미만이면 1~3회 재시도하는 간소화 루프를 제공하고, `Optimizer` 인터페이스를 열어 두어 나중에 풀 구현으로 교체 가능하게 한다.

### 0.7 Concordia 프레임워크와의 관계

논문은 생성된 페르소나를 Concordia(Google DeepMind의 사회 시뮬레이션 프레임워크)에서 에이전트로 사용한다. 우리 구현에서는 Concordia 의존 없이 독립적으로 페르소나를 생성하고, 설문(questionnaire) 시뮬레이션으로 다양성을 검증하는 것까지를 범위로 한다.

---

## 1. 아키텍처 개요

```
┌─────────────────────────────────────────────────────┐
│                  PersonaGenerator                    │
│                  (메인 오케스트레이터)                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────┐   ┌──────────┐   ┌────────────────┐  │
│  │ LLM      │   │ Sampler  │   │ Diversity      │  │
│  │ Provider │   │ Engine   │   │ Evaluator      │  │
│  │ (교체가능) │   │ (준랜덤)  │   │ (6 metrics)    │  │
│  └────┬─────┘   └────┬─────┘   └───────┬────────┘  │
│       │              │                  │           │
│  ┌────┴─────┐   ┌────┴─────┐   ┌───────┴────────┐  │
│  │ OpenAI   │   │ Halton   │   │ Coverage       │  │
│  │ Anthropic│   │ Sobol    │   │ ConvexHull     │  │
│  │ Custom   │   │ Custom   │   │ Pairwise Dist  │  │
│  └──────────┘   └──────────┘   │ Dispersion     │  │
│                                │ KL Divergence  │  │
│                                └────────────────┘  │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ Output Renderer (Markdown / JSON)             │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 2. 디렉토리 구조

```
persona-generator/
├── src/
│   ├── index.ts                    # 라이브러리 진입점 (public API export)
│   ├── types.ts                    # 전체 타입 정의
│   │
│   ├── llm/                        # LLM Provider 추상화
│   │   ├── provider.ts             # LLMProvider 인터페이스
│   │   ├── openai.ts               # OpenAI 구현체
│   │   ├── anthropic.ts            # Anthropic 구현체 (확장용)
│   │   └── prompts.ts              # 프롬프트 템플릿 모음
│   │
│   ├── sampler/                    # Stage 1: 준랜덤 샘플링
│   │   ├── sampler.ts              # Sampler 인터페이스
│   │   ├── halton.ts               # Halton Sequence 구현
│   │   ├── sobol.ts                # Sobol Sequence 구현 (대안)
│   │   └── mapper.ts               # [0,1] → 의미론적 값 매핑
│   │
│   ├── generator/                  # 핵심 파이프라인
│   │   ├── context-expander.ts     # 컨텍스트 확장
│   │   ├── axis-extractor.ts       # 다양성 축 추출
│   │   ├── persona-expander.ts     # Stage 2: 좌표 → 페르소나 확장
│   │   └── pipeline.ts             # 전체 파이프라인 오케스트레이션
│   │
│   ├── evaluation/                 # 다양성 평가
│   │   ├── metrics.ts              # 6가지 메트릭 구현
│   │   ├── embedding.ts            # 텍스트 임베딩 (좌표 기반 + API 옵션)
│   │   └── questionnaire.ts        # 설문 생성 & 페르소나 응답
│   │
│   ├── evolution/                  # (Phase 2) AlphaEvolve 간소화
│   │   ├── optimizer.ts            # 재샘플링/프롬프트 튜닝 루프
│   │   └── mutator.ts              # 프롬프트 변이 생성
│   │
│   ├── cli/                        # CLI 진입점
│   │   ├── index.ts                # CLI 메인 (commander 기반)
│   │   ├── commands/
│   │   │   ├── generate.ts         # `persona-gen generate` 명령
│   │   │   ├── evaluate.ts         # `persona-gen evaluate` 명령
│   │   │   └── inspect.ts          # `persona-gen inspect` 명령
│   │   └── utils.ts                # CLI 헬퍼 (spinner, 색상 출력 등)
│   │
│   └── output/                     # 출력 렌더링
│       ├── markdown.ts             # Markdown 렌더러
│       └── json.ts                 # JSON 렌더러
│
├── tests/                          # 테스트 (미러 구조)
│   ├── unit/
│   │   ├── sampler/
│   │   │   ├── halton.test.ts      # Halton 수열 정확성
│   │   │   └── mapper.test.ts      # 값 매핑 정확성
│   │   ├── evaluation/
│   │   │   └── metrics.test.ts     # 6가지 메트릭 수학적 검증
│   │   ├── llm/
│   │   │   └── prompts.test.ts     # 프롬프트 빌더 출력 형식
│   │   └── output/
│   │       └── markdown.test.ts    # Markdown 렌더링 형식
│   ├── integration/
│   │   ├── pipeline.test.ts        # 파이프라인 end-to-end (mock LLM)
│   │   ├── openai-provider.test.ts # OpenAI 실제 호출 (선택적)
│   │   └── cli.test.ts             # CLI 명령어 통합 테스트
│   └── fixtures/
│       ├── sample-context.json     # 테스트용 컨텍스트 데이터
│       ├── sample-axes.json        # 테스트용 축 데이터
│       ├── sample-population.json  # 테스트용 생성 결과
│       └── mock-llm-responses.ts   # LLM 응답 mock 데이터
│
├── examples/
│   ├── basic-usage.ts              # 기본 사용 예시
│   ├── custom-axes.ts              # 커스텀 축 지정 예시
│   └── with-evaluation.ts          # 다양성 평가 포함 예시
│
├── package.json
├── tsconfig.json
├── vitest.config.ts                # 테스트 설정
└── README.md                       # 프로젝트 문서
```

---

## 3. 핵심 타입 설계 (`types.ts`)

```typescript
// === LLM Provider 추상화 ===
interface LLMProvider {
  name: string;
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<string>;
  embed?(texts: string[]): Promise<number[][]>;  // 선택적
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

// === 핵심 도메인 타입 ===
interface Context {
  description: string;          // 사용자 입력 (짧은 설명)
  expanded?: string;            // LLM이 확장한 상세 설명
  domain?: string;              // 자동 추출된 도메인
}

interface DiversityAxis {
  id: string;
  name: string;                 // 예: "기술 숙련도"
  description: string;          // 이 축이 왜 중요한지
  type: 'continuous' | 'categorical';
  // continuous: 0~1 범위, anchors로 의미 매핑
  anchors?: { value: number; label: string }[];
  // categorical: 가능한 값 목록
  categories?: string[];
}

interface PersonaCoordinate {
  axisId: string;
  rawValue: number;             // [0, 1] 범위의 quasi-random 값
  mappedValue: string;          // 의미론적 값 ("높은 신뢰도", "30대 초반" 등)
}

interface Persona {
  id: string;
  name: string;
  coordinates: PersonaCoordinate[];
  description: string;          // 풍부한 페르소나 서술
  traits: Record<string, string>;  // 구조화된 특성
  behaviorPatterns: string[];   // 행동 패턴 목록
}

interface Population {
  context: Context;
  axes: DiversityAxis[];
  personas: Persona[];
  metrics?: DiversityMetrics;
  generatedAt: string;
}

// === 다양성 메트릭 ===
interface DiversityMetrics {
  coverage: number;             // 0~1, Monte Carlo coverage
  convexHullVolume: number;     // 볼록 껍질 부피
  meanPairwiseDistance: number;  // 평균 쌍별 거리
  minPairwiseDistance: number;   // 최소 쌍별 거리
  dispersion: number;           // 최대 빈 영역 반경 (낮을수록 좋음)
  klDivergence: number;         // 균등분포와의 KL (낮을수록 좋음)
  overall: number;              // 가중 종합 점수
}

// === 설정 ===
interface GeneratorConfig {
  populationSize: number;       // 생성할 페르소나 수 (기본 25)
  numAxes?: number;             // 추출할 축 수 (기본 6)
  customAxes?: DiversityAxis[]; // 사용자 지정 축 (자동 추출 대체)
  samplerType?: 'halton' | 'sobol';
  evaluateAfter?: boolean;      // 생성 후 다양성 평가 실행 여부
  language?: string;            // 출력 언어 (기본 'en')
}
```

---

## 4. 모듈별 상세 구현 계획

### 4.1 LLM Provider (`llm/`)

**목표:** OpenAI를 기본으로 쓰되, 인터페이스 하나로 어떤 LLM이든 교체 가능

```typescript
// provider.ts - 인터페이스만 정의
export interface LLMProvider {
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<string>;
  chatJSON<T>(messages: ChatMessage[], options?: LLMOptions): Promise<T>;
  embed?(texts: string[]): Promise<number[][]>;
}

// openai.ts - 구현체
export class OpenAIProvider implements LLMProvider {
  constructor(config: { apiKey: string; model?: string }) {}
  // ...
}

// 다른 프로바이더 추가 시: 같은 인터페이스 구현만 하면 됨
```

**프롬프트 관리 (`prompts.ts`):**
- 각 단계별 프롬프트를 함수로 분리
- 프롬프트 내에 few-shot 예시 포함
- 언어 설정에 따라 프롬프트 변형 지원

주요 프롬프트 4개:
1. `buildContextExpansionPrompt(context)` — 컨텍스트 확장
2. `buildAxisExtractionPrompt(expandedContext, numAxes)` — 축 추출
3. `buildPersonaExpansionPrompt(context, axes, coordinates)` — 페르소나 생성
4. `buildQuestionnairePrompt(context, axes)` — 설문 문항 생성

---

### 4.2 Sampler Engine (`sampler/`)

**선택: Halton Sequence**

선택 이유:
- Sobol 대비 구현이 단순하고 디버깅이 쉬움
- 차원 수가 6~10 정도면 Halton과 Sobol의 품질 차이가 미미
- 소수(prime) 기반이라 차원 추가가 자유로움
- 수정/확장이 직관적

```typescript
// halton.ts
export class HaltonSampler implements Sampler {
  // 각 차원에 서로 다른 소수 base 사용 (2, 3, 5, 7, 11, ...)
  // n번째 샘플의 d번째 차원 = halton(n, primes[d])

  generate(numSamples: number, numDimensions: number): number[][] {
    // 반환: numSamples x numDimensions 배열, 각 값 [0, 1]
  }
}
```

**Mapper (`mapper.ts`):**
- `[0, 1]` 값을 축 타입에 따라 변환
- continuous: anchor point 사이 보간 → 자연어 레이블
- categorical: 균등 분할 → 카테고리 선택
- 이 매핑이 diversity에 직접 영향을 주므로, 커스터마이즈 가능하게 설계

---

### 4.3 Generator Pipeline (`generator/`)

**전체 흐름:**

```
사용자 입력 (짧은 컨텍스트)
       │
       ▼
[context-expander] ──LLM──▶ 확장된 컨텍스트
       │
       ▼
[axis-extractor] ──LLM──▶ DiversityAxis[] (5~10개)
       │                    (사용자가 커스텀 축을 줬으면 이 단계 스킵)
       ▼
[sampler] ──Halton──▶ PersonaCoordinate[][] (N명 × M축)
       │
       ▼
[mapper] ──규칙기반──▶ 각 좌표에 의미론적 레이블 부여
       │
       ▼
[persona-expander] ──LLM──▶ Persona[] (N명의 풍부한 페르소나)
       │
       ▼
[evaluator] ──수학──▶ DiversityMetrics
       │
       ▼
[renderer] ──────▶ Markdown 파일 출력
```

**context-expander.ts:**
- 입력: `"정신건강 챗봇 사용자"`
- 출력: 2~3 문단의 확장된 설명 (대상 인구, 환경, 동기, 우려사항 등)
- LLM 1회 호출

**axis-extractor.ts:**
- 입력: 확장된 컨텍스트
- 출력: JSON 구조의 DiversityAxis 배열
- LLM에게 JSON 포맷 강제 (structured output)
- 축 간 직교성(orthogonality) 검증 로직 포함
  - 의미적 유사도가 높은 축 쌍 감지 → 경고 또는 병합

**persona-expander.ts:**
- 입력: 컨텍스트 + 축 + 한 사람의 좌표 조합
- 출력: 풍부한 Persona 객체
- **핵심 설계 결정 (논문 발견 반영):**
  - 과거 기억/배경 스토리 위주가 아닌 **행동 지향적 서술** 유도
  - "이 사람은 ~할 때 ~하는 경향이 있다" 형식
  - "이 사람의 어린 시절은..." 형식은 피함
- 병렬 처리: N명을 동시에 요청 (Promise.all + rate limiting)

**pipeline.ts:**
- 위 모듈을 순서대로 호출하는 오케스트레이터
- 각 단계 사이 로깅, 에러 핸들링
- 중간 결과 캐싱 (같은 컨텍스트로 재생성 시 축 추출 재사용 가능)

---

### 4.4 Diversity Evaluation (`evaluation/`)

**임베딩 전략 (하이브리드):**

```
기본 모드 (좌표 기반, API 호출 없음):
  - 각 페르소나의 quasi-random 좌표를 그대로 사용
  - 장점: 빠르고 비용 없음, 결정론적
  - 단점: 페르소나 확장 과정에서의 실제 다양성을 반영 못함

고급 모드 (API 임베딩):
  - 페르소나 description을 LLM embedding API로 임베딩
  - OpenAI: text-embedding-3-small
  - 장점: 텍스트 수준의 실제 다양성 측정
  - 단점: 추가 API 비용
```

**추천:** 기본 모드로 시작. 좌표 기반 메트릭은 "샘플링 품질"을, API 임베딩 메트릭은 "생성 품질"을 측정하므로, 둘 다 의미가 있음. 설정으로 선택 가능하게.

**6가지 메트릭 구현:**

```typescript
// metrics.ts

// 1. Coverage (Monte Carlo)
// - 공간에 M개의 랜덤 테스트 포인트를 뿌림
// - 각 테스트 포인트에서 가장 가까운 페르소나까지 거리 < ε이면 "covered"
// - coverage = covered / M
function computeCoverage(
  points: number[][],
  epsilon: number,
  numTestPoints: number
): number

// 2. Convex Hull Volume
// - N차원 점들의 볼록 껍질 부피 계산
// - 차원이 높으면 (>5) QHull 알고리즘 필요
// - 경량 구현: 차원이 낮을 때 직접 계산, 높을 때 근사
function computeConvexHullVolume(points: number[][]): number

// 3. Mean Pairwise Distance
// - 모든 (i,j) 쌍의 유클리드 거리 평균
function computeMeanPairwiseDistance(points: number[][]): number

// 4. Min Pairwise Distance
// - 가장 가까운 두 점 사이 거리
function computeMinPairwiseDistance(points: number[][]): number

// 5. Dispersion
// - 공간 내 가장 먼 빈 지점의 반경
// - Monte Carlo 근사: 랜덤 포인트에서 가장 가까운 데이터 포인트까지
//   거리의 최댓값
function computeDispersion(points: number[][]): number

// 6. KL Divergence
// - 각 축별 히스토그램 vs 균등분포 비교
// - 축별 KL의 평균
function computeKLDivergence(points: number[][], numBins: number): number
```

**Convex Hull 구현 메모:**
- 순수 TypeScript로 구현 시: 2~3차원은 직접 가능, 고차원은 복잡
- 실용적 대안: `qhull.js` 같은 라이브러리 사용 또는 **PCA로 2~3차원 축소 후 계산**
- 좌표 기반 모드에서는 차원 = 축 수(6~10)이므로 PCA 축소가 합리적

---

### 4.5 Evolution/Optimizer (`evolution/`) — Phase 2

**간소화 버전 구현:**

```
생성 → 평가 → 점수가 threshold 미만이면:
  1. 프롬프트 변이: LLM에게 "이 프롬프트를 다양성이 높아지도록 수정해줘" 요청
  2. 재샘플링: 다른 Halton offset으로 새 좌표 생성
  3. 최대 2~3회 반복
  4. 가장 높은 점수의 결과 선택
```

**풀 구현으로 확장할 때의 인터페이스:**

```typescript
interface Optimizer {
  optimize(
    pipeline: Pipeline,
    config: GeneratorConfig,
    maxIterations: number
  ): Promise<Population>;
}

// 간소화: SimpleOptimizer (1~3회 재시도)
// 풀: EvolutionaryOptimizer (population 기반, 수백 회)
```

이 인터페이스가 동일하므로 나중에 풀 구현을 넣어도 호출 코드는 변경 없음.

---

### 4.6 Output Renderer (`output/`)

**Markdown 출력 구조:**

```markdown
# Persona Population Report

## Context
**원본:** {user_input}
**확장:** {expanded_context}

## Diversity Axes
| # | 축 이름 | 타입 | 설명 |
|---|---------|------|------|
| 1 | 기술 숙련도 | continuous | ... |
| 2 | 나이대 | categorical | ... |

## Generated Personas (N=25)

### Persona 1: {name}
**좌표:**
- 기술 숙련도: 높음 (0.82)
- 나이대: 40대 (0.55)
- ...

**설명:**
{rich_description}

**행동 패턴:**
- {pattern_1}
- {pattern_2}

---
### Persona 2: {name}
...

## Diversity Evaluation

| 메트릭 | 값 | 해석 |
|--------|-----|------|
| Coverage | 0.83 | 응답 공간의 83% 커버 |
| Convex Hull Volume | 0.71 | ... |
| Mean Pairwise Distance | 0.62 | ... |
| Min Pairwise Distance | 0.18 | ... |
| Dispersion | 0.12 | ... |
| KL Divergence | 0.04 | ... |
| **Overall** | **0.74** | ... |

## Coordinate Distribution
(축별 히스토그램을 ASCII art로 표현)

Axis: 기술 숙련도
[0.0-0.2] ████ (4)
[0.2-0.4] █████ (5)
[0.4-0.6] ██████ (6)
[0.6-0.8] █████ (5)
[0.8-1.0] █████ (5)
```

---

## 5. API 사용법 (최종 사용자 관점)

```typescript
import { PersonaGenerator, OpenAIProvider } from 'persona-generator';

// 1. Provider 생성 (교체 포인트)
const llm = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o',  // 또는 'gpt-4o-mini' 비용 절약
});

// 2. Generator 초기화
const generator = new PersonaGenerator(llm, {
  populationSize: 25,
  numAxes: 6,
  samplerType: 'halton',
  evaluateAfter: true,
  language: 'ko',
});

// 3. 기본 사용: 컨텍스트만 입력
const population = await generator.generate(
  '자율주행 자동차의 초기 채택자와 거부자'
);

// 4. Markdown 출력
const md = generator.toMarkdown(population);
fs.writeFileSync('personas.md', md);

// 5. 커스텀 축 지정
const population2 = await generator.generate(
  '원격 의료 서비스 사용자',
  {
    customAxes: [
      {
        id: 'tech-literacy',
        name: '디지털 리터러시',
        type: 'continuous',
        description: '기술 사용 능력',
        anchors: [
          { value: 0, label: '기술 기피' },
          { value: 0.5, label: '기본 사용자' },
          { value: 1, label: '얼리어답터' },
        ],
      },
      // ...더 많은 축
    ],
  }
);

// 6. 개별 단계 접근 (고급 사용)
const expanded = await generator.expandContext('정신건강 챗봇');
const axes = await generator.extractAxes(expanded);
const coords = generator.sample(25, axes.length);
const personas = await generator.expandPersonas(expanded, axes, coords);
const metrics = generator.evaluate(personas);
```

---

## 6. CLI 설계

### 6.1 CLI 명령어 체계

패키지 이름: `persona-gen` (bin 등록)

```bash
# 기본 생성 — 가장 많이 쓸 명령어
persona-gen generate "자율주행 자동차 초기 채택자" \
  --count 25 \
  --axes 6 \
  --model gpt-4o-mini \
  --output ./output/personas.md \
  --format md \
  --language ko \
  --evaluate

# JSON 출력
persona-gen generate "원격 의료 서비스 사용자" \
  --format json \
  --output ./output/personas.json

# 커스텀 축 파일 지정
persona-gen generate "정신건강 챗봇 사용자" \
  --axes-file ./my-axes.json \
  --count 30

# 기존 결과에 대해 다양성 평가만 실행
persona-gen evaluate ./output/personas.json

# 특정 페르소나 상세 조회 (생성된 JSON에서)
persona-gen inspect ./output/personas.json --id persona-3

# 도움말
persona-gen --help
persona-gen generate --help
```

### 6.2 CLI 옵션 상세

```
generate <context>
  필수:
    context                컨텍스트 설명 (문자열)

  옵션:
    -n, --count <number>   생성할 페르소나 수 (기본: 25)
    -a, --axes <number>    추출할 다양성 축 수 (기본: 6)
    --axes-file <path>     커스텀 축 정의 JSON 파일 경로
    -m, --model <string>   LLM 모델명 (기본: gpt-4o-mini)
    -p, --provider <name>  LLM 제공자 (기본: openai, 옵션: anthropic)
    -o, --output <path>    출력 파일 경로 (기본: ./personas-{timestamp}.md)
    -f, --format <type>    출력 형식: md | json | both (기본: md)
    -l, --language <lang>  출력 언어: en | ko (기본: en)
    -e, --evaluate         생성 후 다양성 평가 실행
    --sampler <type>       샘플러: halton | sobol (기본: halton)
    --concurrency <n>      LLM 병렬 호출 수 (기본: 5)
    --verbose              상세 진행 상황 출력
    --dry-run              LLM 호출 없이 샘플링 결과만 확인

evaluate <file>
  필수:
    file                   평가할 population JSON 파일 경로

  옵션:
    --embedding-mode <m>   coordinate | api (기본: coordinate)
    -o, --output <path>    평가 결과 출력 경로

inspect <file>
  필수:
    file                   population JSON 파일 경로

  옵션:
    --id <persona-id>      특정 페르소나 ID
    --summary              전체 요약만 출력
```

### 6.3 환경 변수

```bash
# .env 또는 환경 변수
OPENAI_API_KEY=sk-...           # OpenAI API 키 (필수)
ANTHROPIC_API_KEY=sk-ant-...    # Anthropic API 키 (선택)
PERSONA_GEN_MODEL=gpt-4o-mini   # 기본 모델 오버라이드
PERSONA_GEN_LANGUAGE=ko          # 기본 언어 오버라이드
```

### 6.4 CLI 진행 표시

```
$ persona-gen generate "자율주행 자동차 초기 채택자" -n 10 -e --verbose

🚀 Persona Generator v0.1.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Context: "자율주행 자동차 초기 채택자"
🤖 Model: gpt-4o-mini (OpenAI)
📊 Population size: 10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/4] Expanding context...                    ✓ (1.2s)
[2/4] Extracting diversity axes...            ✓ (2.1s)
       → 6 axes: 기술 숙련도, 위험 감수 성향, ...
[3/4] Generating personas...                  ████████░░ 8/10 (12.3s)
[3/4] Generating personas...                  ✓ 10/10 (15.4s)
[4/4] Evaluating diversity...                 ✓ (0.3s)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Diversity Metrics:
   Coverage:            0.83
   Convex Hull Volume:  0.71
   Mean Pairwise Dist:  0.62
   Min Pairwise Dist:   0.18
   Dispersion:          0.12
   KL Divergence:       0.04
   Overall:             0.74 ✓ Good

📁 Output: ./personas-20260218.md
✅ Done in 19.0s
```

### 6.5 사용할 CLI 라이브러리

| 라이브러리 | 용도 |
|-----------|------|
| `commander` | 명령어 파싱 |
| `ora` | 스피너/진행 표시 |
| `chalk` | 색상 출력 |
| `dotenv` | 환경 변수 로드 |

---

## 7. 개발 방법론: TDD (Test-Driven Development)

### 7.1 TDD 원칙 — 반드시 준수

**모든 모듈은 반드시 테스트를 먼저 작성한 후 구현한다.**

```
각 기능 구현 순서:
  1. 실패하는 테스트 작성 (Red)
  2. 테스트를 통과하는 최소 구현 (Green)
  3. 리팩토링 (Refactor)
  4. 커밋
```

### 7.2 테스트 도구

- **테스트 프레임워크:** `vitest` (Vite 기반, TypeScript 네이티브, 빠른 실행)
- **테스트 러너 설정:** `vitest.config.ts`
- **LLM 호출 테스트:** mock을 사용하여 실제 API 호출 없이 테스트
  - `tests/fixtures/mock-llm-responses.ts`에 미리 정의된 LLM 응답
  - integration 테스트에서만 선택적으로 실제 API 호출

### 7.3 테스트 카테고리별 전략

**Unit 테스트 (필수, LLM 호출 없음):**

```typescript
// tests/unit/sampler/halton.test.ts
describe('HaltonSampler', () => {
  it('should generate values in [0, 1] range', () => { ... });
  it('should produce deterministic sequences', () => { ... });
  it('should have low discrepancy for N=100, D=6', () => { ... });
  it('should use different prime bases per dimension', () => { ... });
});

// tests/unit/evaluation/metrics.test.ts
describe('DiversityMetrics', () => {
  it('should return coverage=1.0 for perfectly spread points', () => { ... });
  it('should return coverage≈0 for all-same points', () => { ... });
  it('should compute correct convex hull volume for known shape', () => { ... });
  it('should return minPairwiseDistance=0 for duplicate points', () => { ... });
  it('should return KL≈0 for uniform distribution', () => { ... });
});

// tests/unit/sampler/mapper.test.ts
describe('AxisMapper', () => {
  it('should map 0.0 to first anchor label', () => { ... });
  it('should map 1.0 to last anchor label', () => { ... });
  it('should map categorical axis to correct category', () => { ... });
});

// tests/unit/output/markdown.test.ts
describe('MarkdownRenderer', () => {
  it('should include context section', () => { ... });
  it('should render all personas', () => { ... });
  it('should include metrics table when evaluated', () => { ... });
});
```

**Integration 테스트 (mock LLM):**

```typescript
// tests/integration/pipeline.test.ts
describe('Pipeline (mock LLM)', () => {
  // MockLLMProvider가 미리 정의된 JSON 응답 반환
  it('should produce N personas for given context', () => { ... });
  it('should use custom axes when provided', () => { ... });
  it('should skip axis extraction when customAxes given', () => { ... });
  it('should include metrics when evaluateAfter=true', () => { ... });
});

// tests/integration/cli.test.ts
describe('CLI', () => {
  it('should output markdown file for generate command', () => { ... });
  it('should output json file with --format json', () => { ... });
  it('should show help for --help flag', () => { ... });
  it('should fail gracefully without API key', () => { ... });
});
```

**E2E 테스트 (실제 API, 선택적 실행):**

```typescript
// tests/integration/openai-provider.test.ts
// 환경 변수 RUN_E2E=true 일 때만 실행
describe.skipIf(!process.env.RUN_E2E)('OpenAI E2E', () => {
  it('should expand context with real API', () => { ... });
  it('should extract axes with real API', () => { ... });
});
```

### 7.4 테스트 Fixture 설계

`tests/fixtures/mock-llm-responses.ts`:

```typescript
export const MOCK_EXPANDED_CONTEXT = `자율주행 자동차의 초기 채택자는 다양한 배경을 가진다...`;

export const MOCK_EXTRACTED_AXES: DiversityAxis[] = [
  { id: 'tech-literacy', name: '기술 숙련도', type: 'continuous', ... },
  { id: 'risk-tolerance', name: '위험 감수 성향', type: 'continuous', ... },
  // ...6개
];

export const MOCK_PERSONA: Persona = {
  id: 'persona-1',
  name: 'Alex Chen',
  coordinates: [...],
  description: '...',
  traits: { ... },
  behaviorPatterns: ['...'],
};

export class MockLLMProvider implements LLMProvider {
  async chat(messages) {
    // messages 내용에 따라 적절한 mock 응답 반환
  }
}
```

### 7.5 커버리지 목표

| 모듈 | 커버리지 목표 | 비고 |
|------|-------------|------|
| `sampler/` | 95%+ | 순수 수학, 완전 테스트 가능 |
| `evaluation/metrics.ts` | 95%+ | 순수 수학, 완전 테스트 가능 |
| `output/` | 90%+ | 템플릿 렌더링 |
| `llm/prompts.ts` | 80%+ | 문자열 빌더 |
| `generator/` | 80%+ | mock LLM 기반 |
| `cli/` | 70%+ | 통합 테스트 |

---

## 8. 태스크 분해 및 PR 전략

### 8.1 브랜치 전략

```
main
  └── feat/task-01-project-setup
  └── feat/task-02-types-and-interfaces
  └── feat/task-03-halton-sampler
  └── feat/task-04-axis-mapper
  └── feat/task-05-llm-provider
  └── feat/task-06-prompts
  └── feat/task-07-context-expander
  └── feat/task-08-axis-extractor
  └── feat/task-09-persona-expander
  └── feat/task-10-pipeline
  └── feat/task-11-diversity-metrics
  └── feat/task-12-output-renderers
  └── feat/task-13-cli
  └── feat/task-14-optimizer
  └── feat/task-15-questionnaire
  └── feat/task-16-readme
```

### 8.2 태스크별 상세 — PR 내용 포함

---

#### Task 01: 프로젝트 초기 설정
**PR 제목:** `feat: initialize project with TypeScript, Vitest, and project structure`

**작업 내용:**
- `package.json` 생성 (name: `persona-gen`, bin 등록)
- `tsconfig.json` 설정 (strict mode, ES2022 target)
- `vitest.config.ts` 설정
- 디렉토리 스캐폴딩 (빈 폴더 + .gitkeep)
- `.env.example` 생성
- `.gitignore` 설정
- ESLint + Prettier 설정 (선택)

**PR 설명에 포함:**
- 선택한 Node.js / TypeScript 버전
- 주요 devDependency 목록과 선택 이유
- `npm test`, `npm run build` 동작 확인

**테스트:** `vitest` 실행 시 0 test, 0 fail 확인

---

#### Task 02: 타입 정의 + 인터페이스
**PR 제목:** `feat: define core types and interfaces`

**작업 내용:**
- `src/types.ts` — 모든 도메인 타입
- `src/llm/provider.ts` — `LLMProvider` 인터페이스
- `src/sampler/sampler.ts` — `Sampler` 인터페이스
- `tests/fixtures/mock-llm-responses.ts` — MockLLMProvider 기본 구현

**테스트 먼저:**
```typescript
// 타입이 올바르게 export 되는지 확인
it('should export all core types', () => { ... });
// MockLLMProvider가 LLMProvider 인터페이스를 만족하는지
it('MockLLMProvider should implement LLMProvider', () => { ... });
```

**PR 설명에 포함:**
- 주요 타입 다이어그램 또는 목록
- 설계 결정 사항 (예: `DiversityAxis.type`이 `continuous | categorical`인 이유)

---

#### Task 03: Halton Sequence 샘플러
**PR 제목:** `feat: implement Halton sequence quasi-random sampler`

**작업 내용:**
- `src/sampler/halton.ts`
- `tests/unit/sampler/halton.test.ts`

**테스트 먼저 (Red → Green):**
```typescript
describe('HaltonSampler', () => {
  it('should generate correct number of samples', () => {
    const sampler = new HaltonSampler();
    const points = sampler.generate(100, 6);
    expect(points).toHaveLength(100);
    expect(points[0]).toHaveLength(6);
  });

  it('should produce values strictly in (0, 1)', () => {
    const points = new HaltonSampler().generate(1000, 3);
    for (const p of points) {
      for (const v of p) {
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it('should be deterministic', () => {
    const s1 = new HaltonSampler().generate(50, 4);
    const s2 = new HaltonSampler().generate(50, 4);
    expect(s1).toEqual(s2);
  });

  it('should have better uniformity than Math.random', () => {
    // 각 [0,0.5) vs [0.5,1.0) 구간의 포인트 비율이 45~55%
    // Math.random은 이 범위에서 더 큰 편차 가능
  });

  it('should use distinct prime bases per dimension', () => {
    // 첫 차원 base=2, 둘째 base=3, ... 확인
  });
});
```

**PR 설명에 포함:**
- Halton Sequence 알고리즘 간단 설명
- 선택한 소수(prime) 목록
- 테스트 결과 스크린샷

---

#### Task 04: Axis Value Mapper
**PR 제목:** `feat: implement axis value mapper for coordinate-to-semantic conversion`

**작업 내용:**
- `src/sampler/mapper.ts`
- `tests/unit/sampler/mapper.test.ts`

**테스트 먼저:**
```typescript
describe('AxisMapper', () => {
  const continuousAxis = {
    type: 'continuous',
    anchors: [
      { value: 0, label: '매우 낮음' },
      { value: 0.5, label: '보통' },
      { value: 1, label: '매우 높음' },
    ]
  };

  it('should map 0.0 to first anchor', () => {
    expect(mapValue(0.0, continuousAxis)).toBe('매우 낮음');
  });

  it('should map 0.25 to interpolated label', () => {
    expect(mapValue(0.25, continuousAxis)).toContain('낮음');
  });

  it('should map categorical axis correctly', () => {
    const catAxis = { type: 'categorical', categories: ['A', 'B', 'C'] };
    expect(mapValue(0.0, catAxis)).toBe('A');
    expect(mapValue(0.5, catAxis)).toBe('B');
    expect(mapValue(0.99, catAxis)).toBe('C');
  });
});
```

---

#### Task 05: LLM Provider (OpenAI)
**PR 제목:** `feat: implement OpenAI LLM provider with swappable interface`

**작업 내용:**
- `src/llm/openai.ts`
- `tests/unit/llm/openai.test.ts` (mock HTTP)
- `tests/integration/openai-provider.test.ts` (E2E, 선택)

**테스트 먼저:**
```typescript
describe('OpenAIProvider', () => {
  it('should format messages correctly for API call', () => { ... });
  it('should parse response content from API result', () => { ... });
  it('should handle API errors gracefully', () => { ... });
  it('should respect temperature and maxTokens options', () => { ... });
  it('should parse JSON response when responseFormat=json', () => { ... });
});
```

**PR 설명에 포함:**
- 다른 Provider 추가 방법 가이드 (3줄 요약)
- rate limiting 전략

---

#### Task 06: 프롬프트 템플릿
**PR 제목:** `feat: implement prompt templates for context expansion, axis extraction, and persona generation`

**작업 내용:**
- `src/llm/prompts.ts`
- `tests/unit/llm/prompts.test.ts`

**테스트 먼저:**
```typescript
describe('Prompts', () => {
  it('buildContextExpansionPrompt should include context in user message', () => { ... });
  it('buildAxisExtractionPrompt should request JSON format', () => { ... });
  it('buildPersonaExpansionPrompt should include all coordinates', () => { ... });
  it('buildPersonaExpansionPrompt should instruct action-oriented style', () => {
    const prompt = buildPersonaExpansionPrompt(ctx, axes, coords);
    expect(prompt).toContain('action-oriented');
    expect(prompt).not.toContain('childhood memory');
  });
  it('should support language parameter', () => { ... });
});
```

---

#### Task 07: Context Expander
**PR 제목:** `feat: implement context expander module`

**작업 내용:**
- `src/generator/context-expander.ts`
- `tests/unit/generator/context-expander.test.ts` (mock LLM)

**테스트 먼저:**
```typescript
describe('ContextExpander', () => {
  it('should call LLM with context expansion prompt', () => { ... });
  it('should return expanded context string', () => { ... });
  it('should preserve original context in result', () => { ... });
});
```

---

#### Task 08: Axis Extractor
**PR 제목:** `feat: implement diversity axis extractor`

**작업 내용:**
- `src/generator/axis-extractor.ts`
- `tests/unit/generator/axis-extractor.test.ts` (mock LLM)

**테스트 먼저:**
```typescript
describe('AxisExtractor', () => {
  it('should extract requested number of axes', () => { ... });
  it('should return valid DiversityAxis objects', () => { ... });
  it('should generate unique IDs for each axis', () => { ... });
  it('should include anchors for continuous axes', () => { ... });
  it('should include categories for categorical axes', () => { ... });
  it('should handle LLM returning malformed JSON gracefully', () => { ... });
});
```

---

#### Task 09: Persona Expander
**PR 제목:** `feat: implement persona expander with parallel LLM calls`

**작업 내용:**
- `src/generator/persona-expander.ts`
- `tests/unit/generator/persona-expander.test.ts` (mock LLM)

**테스트 먼저:**
```typescript
describe('PersonaExpander', () => {
  it('should generate one persona per coordinate set', () => { ... });
  it('should include all coordinate values in persona', () => { ... });
  it('should produce unique names', () => { ... });
  it('should include behaviorPatterns array', () => { ... });
  it('should respect concurrency limit', () => { ... });
});
```

**PR 설명에 포함:**
- 병렬 호출 전략 (`Promise.all` + concurrency limit)
- 행동 지향적 서술 유도 방식

---

#### Task 10: Pipeline 오케스트레이터
**PR 제목:** `feat: implement end-to-end pipeline orchestrator`

**작업 내용:**
- `src/generator/pipeline.ts`
- `src/index.ts` (public API export)
- `tests/integration/pipeline.test.ts`

**테스트 먼저:**
```typescript
describe('Pipeline', () => {
  it('should produce complete Population from context string', () => { ... });
  it('should use custom axes when provided', () => { ... });
  it('should skip axis extraction when customAxes given', () => { ... });
  it('should attach metrics when evaluateAfter=true', () => { ... });
  it('should respect populationSize config', () => { ... });
});
```

**PR 설명에 포함:**
- 파이프라인 흐름도
- 에러 핸들링 전략

---

#### Task 11: 다양성 메트릭 (6종)
**PR 제목:** `feat: implement 6 diversity metrics (coverage, hull, pairwise, dispersion, KL)`

**작업 내용:**
- `src/evaluation/metrics.ts`
- `src/evaluation/embedding.ts`
- `tests/unit/evaluation/metrics.test.ts`

**테스트 먼저 (수학적 검증):**
```typescript
describe('DiversityMetrics', () => {
  // 알려진 값으로 검증
  const perfectGrid2D = [[0,0],[0,1],[1,0],[1,1],[0.5,0.5]];
  const allSame = [[0.5,0.5],[0.5,0.5],[0.5,0.5]];
  const twoPoints = [[0,0],[1,1]];

  describe('coverage', () => {
    it('perfect grid should have high coverage', () => { ... });
    it('all-same points should have near-zero coverage', () => { ... });
  });

  describe('convexHullVolume', () => {
    it('unit square corners should have volume ≈ 1.0', () => { ... });
    it('collinear points should have volume 0', () => { ... });
  });

  describe('meanPairwiseDistance', () => {
    it('two opposite corners of unit square should be sqrt(2)', () => { ... });
    it('all-same points should be 0', () => { ... });
  });

  describe('minPairwiseDistance', () => {
    it('should be 0 for duplicate points', () => { ... });
    it('should be positive for distinct points', () => { ... });
  });

  describe('dispersion', () => {
    it('perfect grid should have low dispersion', () => { ... });
    it('clustered points should have high dispersion', () => { ... });
  });

  describe('klDivergence', () => {
    it('uniform distribution should have KL ≈ 0', () => { ... });
    it('single-bin concentration should have high KL', () => { ... });
  });
});
```

**PR 설명에 포함:**
- 각 메트릭의 수학적 정의
- Convex Hull 구현 방식 (PCA 축소 여부)
- 좌표 기반 vs API 임베딩 모드 전환 방법

---

#### Task 12: Output 렌더러 (Markdown + JSON)
**PR 제목:** `feat: implement Markdown and JSON output renderers`

**작업 내용:**
- `src/output/markdown.ts`
- `src/output/json.ts`
- `tests/unit/output/markdown.test.ts`
- `tests/unit/output/json.test.ts`

**테스트 먼저:**
```typescript
describe('MarkdownRenderer', () => {
  it('should include # Persona Population Report header', () => { ... });
  it('should render context section with original and expanded', () => { ... });
  it('should render axes table', () => { ... });
  it('should render each persona as ### subsection', () => { ... });
  it('should render metrics table when metrics present', () => { ... });
  it('should render ASCII histogram for axis distribution', () => { ... });
});

describe('JSONRenderer', () => {
  it('should produce valid JSON string', () => { ... });
  it('should be parseable back to Population type', () => { ... });
});
```

---

#### Task 13: CLI 구현
**PR 제목:** `feat: implement CLI with generate, evaluate, and inspect commands`

**작업 내용:**
- `src/cli/index.ts`
- `src/cli/commands/generate.ts`
- `src/cli/commands/evaluate.ts`
- `src/cli/commands/inspect.ts`
- `src/cli/utils.ts`
- `tests/integration/cli.test.ts`
- `package.json` bin 필드 등록

**테스트 먼저:**
```typescript
describe('CLI', () => {
  it('should show help with --help', async () => {
    const result = await runCLI(['--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('persona-gen');
  });

  it('should fail without API key', async () => {
    const result = await runCLI(['generate', 'test context'], { env: {} });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('API key');
  });

  it('should generate markdown output file', async () => {
    // mock LLM 사용
    const result = await runCLI(['generate', 'test', '-o', tmpFile, '-n', '3']);
    expect(fs.existsSync(tmpFile)).toBe(true);
  });

  it('should generate json with --format json', async () => { ... });
  it('should run evaluation with -e flag', async () => { ... });
});
```

**PR 설명에 포함:**
- CLI 명령어 체계 요약
- 사용 예시 3가지
- 스크린샷 (진행 표시)

---

#### Task 14: 간소화 Optimizer
**PR 제목:** `feat: implement simplified diversity optimizer with retry loop`

**작업 내용:**
- `src/evolution/optimizer.ts`
- `src/evolution/mutator.ts`
- `tests/unit/evolution/optimizer.test.ts`

**테스트 먼저:**
```typescript
describe('SimpleOptimizer', () => {
  it('should return original if score above threshold', () => { ... });
  it('should retry up to maxRetries when score below threshold', () => { ... });
  it('should return best result among all attempts', () => { ... });
});
```

---

#### Task 15: 설문 시뮬레이션 (선택적)
**PR 제목:** `feat: implement questionnaire generation and persona response simulation`

**작업 내용:**
- `src/evaluation/questionnaire.ts`
- `tests/unit/evaluation/questionnaire.test.ts`

**테스트 먼저:**
```typescript
describe('Questionnaire', () => {
  it('should generate N questions for given context', () => { ... });
  it('should produce response for each persona', () => { ... });
  it('should return structured answers', () => { ... });
});
```

---

#### Task 16: README.md + Examples
**PR 제목:** `docs: add comprehensive README and usage examples`

**작업 내용:**
- `README.md` 생성 (아래 8.3 참조)
- `examples/basic-usage.ts`
- `examples/custom-axes.ts`
- `examples/with-evaluation.ts`

---

### 8.3 README.md 작성 가이드

README.md는 Task 16에서 마지막에 생성하며, 다음 섹션을 반드시 포함한다:

```markdown
# persona-gen

Brief: 논문 기반 설명 (1~2문장)

## Quick Start
- 설치, API 키 설정, 첫 실행 (3단계)

## CLI Usage
- generate / evaluate / inspect 명령어 + 주요 옵션
- 실행 예시 + 출력 예시

## Programmatic API
- TypeScript import → generate → output 예시
- 개별 단계 접근 예시

## Custom LLM Provider
- 인터페이스 설명 + 커스텀 provider 작성법 (코드 예시)

## Diversity Metrics
- 6가지 메트릭 각각의 의미와 최적 방향 테이블

## Architecture
- 파이프라인 흐름도
- 디렉토리 구조

## Configuration
- GeneratorConfig 옵션 전체 목록
- 환경 변수 목록

## Examples
- examples/ 폴더 내 파일별 설명

## Paper Reference
- 논문 인용 정보 + 핵심 컨셉 요약 (3~4줄)

## License
```

### 8.4 PR 작성 규칙

모든 PR은 다음 템플릿을 따른다:

```markdown
## 작업 요약
[이 PR에서 무엇을 구현했는지 1~3문장]

## 변경 사항
- 추가된 파일 목록
- 주요 구현 내용

## 테스트
- 추가된 테스트 수
- 테스트 실행 결과 (`npm test` 출력 요약)
- 커버리지 변화

## 설계 결정
[이 PR에서 내린 주요 설계 결정과 그 이유]

## 다음 단계
[이 PR 이후에 어떤 Task가 이어지는지]

## 체크리스트
- [ ] 테스트 먼저 작성 (TDD)
- [ ] 모든 테스트 통과
- [ ] 타입 에러 없음 (`tsc --noEmit`)
- [ ] 기존 테스트 깨지지 않음
```

### 8.5 태스크 의존성 그래프

```
Task 01 (프로젝트 설정)
  │
  ├── Task 02 (타입/인터페이스) ──┬── Task 03 (Halton)
  │                              ├── Task 04 (Mapper)
  │                              ├── Task 05 (OpenAI Provider)
  │                              └── Task 06 (프롬프트)
  │                                    │
  │                    ┌────────────────┤
  │                    │                │
  │              Task 07 (Context)  Task 08 (Axis)
  │                    │                │
  │                    └────────┬───────┘
  │                             │
  │                       Task 09 (Persona Expander)
  │                             │
  │                       Task 10 (Pipeline) ← Task 03, 04
  │                             │
  │              ┌──────────────┼──────────────┐
  │              │              │              │
  │        Task 11 (Metrics) Task 12 (Output) Task 13 (CLI)
  │              │                             │
  │        Task 14 (Optimizer)                 │
  │              │                             │
  │        Task 15 (Questionnaire)             │
  │              │                             │
  │              └──────────────┬──────────────┘
  │                             │
  │                       Task 16 (README)
  │
  └── [모든 Task 완료]
```

**병렬 가능 그룹:**
- Task 03 + 04 + 05 + 06 (기반 모듈, 서로 독립)
- Task 07 + 08 (둘 다 06에만 의존)
- Task 11 + 12 + 13 (10에 의존하지만 서로 독립)

---

## 9. 주요 설계 결정 요약

| 항목 | 결정 | 근거 |
|------|------|------|
| **LLM 추상화** | Strategy 패턴, `LLMProvider` 인터페이스 | 한 줄 교체로 OpenAI↔Anthropic↔로컬 모델 전환 |
| **Quasi-random** | Halton (기본), Sobol (대안) | 6~10차원에서 품질 동등, Halton이 구현·디버깅 용이 |
| **임베딩** | 좌표 기반 (기본) + API 임베딩 (옵션) | 비용 0 vs 정확도 트레이드오프를 사용자가 선택 |
| **AlphaEvolve** | 간소화 (재시도 루프), 인터페이스만 풀용으로 열어둠 | 풀 구현 시 API 비용 수십~수백 달러, 실용적이지 않음 |
| **출력** | Markdown (기본) + JSON (프로그래밍용) | 사람이 읽기 좋고 Git에서 diff 가능 |
| **언어** | TypeScript | 타입 안전성, npm 생태계, 프론트/백 공용 |
| **병렬 처리** | Promise.all + rate limiter | 25명 생성 시 API 호출 최적화 |
| **페르소나 스타일** | 행동 지향적 (논문 결론) | 기억/배경 기반 대비 다양성 점수 우수 |

---

## 10. API 비용 추정 (GPT-4o-mini 기준)

| 단계 | 호출 수 | 입력 토큰 (추정) | 출력 토큰 (추정) | 비용 |
|------|---------|-----------------|-----------------|------|
| Context Expansion | 1 | ~500 | ~800 | < $0.01 |
| Axis Extraction | 1 | ~1,200 | ~1,500 | < $0.01 |
| Persona Expansion (N=25) | 25 | ~1,000 × 25 | ~800 × 25 | ~$0.05 |
| Evaluation (설문, 옵션) | 25 × 10 | ~500 × 250 | ~200 × 250 | ~$0.10 |
| **총합 (기본)** | **27** | | | **~$0.07** |
| **총합 (설문 포함)** | **277** | | | **~$0.17** |

GPT-4o 사용 시 약 10~20배.

---

## 11. 확장 가능성

- **Anthropic Provider 추가:** `LLMProvider` 구현체 하나만 추가
- **로컬 모델 (Ollama 등):** 같은 인터페이스로 래핑
- **풀 AlphaEvolve:** `Optimizer` 인터페이스 구현체 교체
- **다국어:** 프롬프트 템플릿에 언어 매개변수 추가 (이미 설계에 포함)
- **웹 UI:** 이 라이브러리를 import해서 React/Next.js에서 호출
- **CI/CD 통합:** `persona-gen evaluate` 결과를 GitHub Actions에서 품질 게이트로 활용
- **Concordia 연동:** 생성된 페르소나 JSON을 Concordia agent context로 변환하는 어댑터
