# MCP Gateway - Implementation Plan

## 1. 개요

기존 에이전트(invest-quant, auto-trader, anti-echo-chamber 등)를 MCP 도구로 래핑하여
Claude Code 대화 안에서 자연어로 호출 가능하게 하는 stdio 기반 MCP 서버.

## 2. 아키텍처

```
Claude Code ←(stdio)→ mcp-gateway/server.js
                          ├─ invest-quant tools  → HTTP API (invest-intel :3000)
                          ├─ auto-trader tools   → HTTP API (invest-intel :3000)
                          ├─ anti-echo-chamber   → 직접 require() (news-scraper)
                          ├─ report-builder      → python CLI (report-builder)
                          ├─ notion-portfolio    → 직접 import() (notion-portfolio)
                          └─ robot-modeler       → python CLI (robot-modeler)
```

### 트랜스포트: stdio (로컬 프로세스)
- Claude Code가 `node server.js`를 spawn
- JSON-RPC over stdin/stdout

### R13 리팩토링 (2026-02)
invest-quant, auto-trader 도구를 직접 `require()`/`readFileSync()`에서
invest-intelligence-loop 모노리스의 HTTP API 호출로 전환.

**변경 전:** mcp-gateway → require() → invest-quant 로컬 모듈
**변경 후:** mcp-gateway → HTTP fetch → invest-intel Express API (:3000)

### 의존성
- `@modelcontextprotocol/sdk` (McpServer + StdioServerTransport)
- `zod` (입력 스키마 검증)
- `dotenv` (환경변수)
- **native fetch** (Node 18+, HTTP 클라이언트)

## 3. 도구 정의

### 3-1. invest-quant (3 tools) → HTTP API
| 도구명 | 입력 | API 엔드포인트 |
|--------|------|---------------|
| `quant_fundamental` | stockCode | GET /api/quant/fundamental/:stockCode |
| `quant_buy_advisory` | stockCode, currentPrice, technicalScore? | POST /api/quant/advisory/buy |
| `quant_sell_advisory` | stockCode, currentPrice?, profitRate? | POST /api/quant/advisory/sell |

### 3-2. auto-trader (3 tools) → HTTP API
| 도구명 | 입력 | API 엔드포인트 |
|--------|------|---------------|
| `trader_summary` | (없음) | GET /api/trader/summary |
| `trader_holdings` | (없음) | GET /api/trader/holdings |
| `trader_trades` | limit? | GET /api/trader/trades?limit=N |

### 3-3. anti-echo-chamber (2 tools) → 직접 require
| 도구명 | 입력 | 호출 방식 |
|--------|------|----------|
| `counter_perspective` | title, summary, category? | require() → news-scraper |
| `counter_batch` | news[], maxItems? | require() → news-scraper |

### 3-4. report-builder (3 tools) → python CLI
### 3-5. notion-portfolio (2 tools) → 직접 import
### 3-6. robot-modeler (3 tools) → python CLI

## 4. 디렉토리 구조

```
mcp-gateway/
├── server.js                  # MCP 서버 진입점 (stdio)
├── package.json
├── lib/
│   └── invest-intel-client.js # HTTP 클라이언트 (native fetch + retry)
├── tools/
│   ├── invest-quant.js        # 3 tools → HTTP API
│   ├── auto-trader.js         # 3 tools → HTTP API
│   ├── anti-echo-chamber.js   # 2 tools → require()
│   ├── report-builder.js      # 3 tools → python CLI
│   ├── notion-portfolio.js    # 2 tools → import()
│   └── robot-modeler.js       # 3 tools → python CLI
├── .env / .env.example
└── .gitignore
```

## 5. 환경변수

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `INVEST_INTEL_URL` | invest-intel 모노리스 API URL | http://localhost:3000 |
| `GEMINI_API_KEY` | anti-echo-chamber용 | (~/.secrets/.env) |

## 6. HTTP 클라이언트 설계 (lib/invest-intel-client.js)

- native fetch (Node 18+, 외부 의존성 없음)
- 재시도: 3회, exponential backoff (1s → 2s → 4s)
- 타임아웃: 15초 (AbortController)
- 연결 거부 시 즉시 실패 + 안내 메시지
- JSON 파싱 + 에러 메시지 추출

## 7. 에러 처리

| 상황 | 처리 |
|------|------|
| invest-intel 서버 미실행 | `isError: true` + "서버 연결 불가" 메시지 |
| API 응답 에러 (4xx/5xx) | 에러 메시지 추출 후 반환 |
| 타임아웃 (15초) | AbortController → 에러 메시지 반환 |
| 입력 검증 실패 | zod 검증 → MCP SDK 자동 에러 반환 |
