---
date: 2026-01-31
tags: [#mcp, #agent-hub, #stdio, #token-optimization]
project: mcp-gateway
---

## 해결 문제 (Context)
- 17개 에이전트가 고립 운영 → Claude Code 대화에서 자연어로 호출 불가
- 1순위 3개 에이전트(invest-quant, auto-trader, anti-echo-chamber)를 MCP 도구로 래핑

## 최종 핵심 로직 (Solution)

### 아키텍처
```
Claude Code ←(stdio)→ mcp-gateway/server.js
                          ├─ invest-quant   → 직접 require() (서버 불필요)
                          ├─ auto-trader    → data/*.json 직접 읽기 (서버 불필요)
                          └─ anti-echo-chamber → 직접 require()
```

### 도구 목록 (8개)
| 도구명 | 에이전트 | 연결 방식 |
|--------|---------|----------|
| quant_fundamental | invest-quant | require → scoreFundamental() |
| quant_buy_advisory | invest-quant | require → adviseBuy() |
| quant_sell_advisory | invest-quant | require → adviseSell() |
| trader_summary | auto-trader | readFileSync → portfolio.json |
| trader_holdings | auto-trader | readFileSync → portfolio.json |
| trader_trades | auto-trader | readFileSync → trades.json |
| counter_perspective | anti-echo-chamber | require → generateCounterPerspective() |
| counter_batch | anti-echo-chamber | require → generateBatch() |

### 파일 구조
```
mcp-gateway/
├── server.js                  # McpServer + StdioServerTransport
├── tools/
│   ├── invest-quant.js        # 3 tools (createRequire)
│   ├── auto-trader.js         # 3 tools (readFileSync)
│   └── anti-echo-chamber.js   # 2 tools (createRequire)
├── package.json               # 의존성: @modelcontextprotocol/sdk, zod, dotenv
├── .env.example
└── .gitignore
```

### 환경변수 로드
```javascript
// server.js: 프로젝트 .env → ~/.secrets/.env 순서로 로드
config({ path: new URL('.env', import.meta.url).pathname });
config({ path: join(homedir(), '.secrets', '.env') });
```

## 핵심 통찰 (Learning & Decision)

- **Problem 1:** 초기 설계에서 HTTP 호출(axios) 방식 → 대상 서버 실행이 전제 조건
- **Decision 1:** HTTP 전면 제거. invest-quant는 모듈 직접 require(), auto-trader는 data/*.json 파일 직접 읽기로 변경. axios 의존성 삭제.
- **근거:** auto-trader는 GitHub Actions에서 매매 실행 → data/*.json을 git commit/push로 영속화. invest-quant는 Render 미배포 상태로 GitHub Actions에서 fallback 동작 중.

- **Problem 2:** CJS 모듈(invest-quant, anti-echo-chamber)을 ESM 프로젝트에서 로드
- **Decision 2:** `createRequire(import.meta.url)`로 CJS 모듈 호환 로드

- **Problem 3:** MCP 도구 스키마가 시스템 프롬프트 토큰 소비
- **Decision 3:** description 1~2문장 제한, 응답 정제(핵심 필드만 반환), 도구 9개 이하 유지

- **Problem 4:** settings.json에 mcpServers 필드 없음 (스키마 검증 실패)
- **Decision 4:** `claude mcp add --scope user` CLI로 등록 → ~/.claude.json에 저장

- **pr-review-agent 결과:** 보안6룰+성능6룰 전체 통과 (0건)

- **Next Step:**
  - invest-quant Render 배포 시 GitHub Actions 연동 검토
  - 2순위 에이전트 추가 (topdown-learner, pm-agent-system)
  - 백테스트 도구 추가 검토 (실행시간 문제 해결 후)
  - quant_risk_portfolio 도구 재추가 (KIS API 직접 호출 방식)
