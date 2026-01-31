# MCP Gateway - Implementation Plan

## 1. 개요

기존 에이전트(invest-quant, auto-trader, anti-echo-chamber)를 MCP 도구로 래핑하여
Claude Code 대화 안에서 자연어로 호출 가능하게 하는 stdio 기반 MCP 서버.

## 2. 아키텍처

```
Claude Code ←(stdio)→ mcp-gateway/server.js
                          ├─ invest-quant tools  → 직접 require() (서버 불필요)
                          ├─ auto-trader tools   → data/*.json 직접 읽기 (서버 불필요)
                          └─ anti-echo-chamber   → 직접 require()
```

### 트랜스포트: stdio (로컬 프로세스)
- Claude Code가 `node server.js`를 spawn
- JSON-RPC over stdin/stdout

### 의존성
- `@modelcontextprotocol/sdk` (McpServer + StdioServerTransport)
- `zod` (입력 스키마 검증)
- `dotenv` (환경변수)
- **HTTP 서버 의존성 없음** (axios 제거)

## 3. 도구 정의 (1순위 3개 에이전트 → 9개 도구)

### 3-1. invest-quant (4 tools)

| 도구명 | 입력 | 호출 대상 | 반환 요약 |
|--------|------|----------|----------|
| `quant_fundamental` | stockCode (6자리) | GET /api/fundamental/:stockCode | 점수, 밸류에이션, 수익성, 안정성, 성장성 |
| `quant_buy_advisory` | stockCode, currentPrice, technicalScore?, holdings? | POST /api/advisory/buy | approved, confidence, positionSize, reasons |
| `quant_sell_advisory` | stockCode, currentPrice?, profitRate? | POST /api/advisory/sell | approved, shouldSell, reason |
| `quant_risk_portfolio` | holdings[] | POST /api/risk/portfolio | VaR, correlation, concentration(HHI) |

> `backtest`는 실행시간이 길어 1차 제외. 추후 추가.

### 3-2. auto-trader (3 tools)

| 도구명 | 입력 | 호출 대상 | 반환 요약 |
|--------|------|----------|----------|
| `trader_summary` | (없음) | GET /api/summary | 보유종목수, 예수금, 총평가액, 손익 |
| `trader_holdings` | (없음) | GET /api/holdings | 보유 종목 상세 리스트 |
| `trader_status` | (없음) | GET /api/status | 장 상태, 환경, 시스템 상태 |

> 지표 계산(indicators.js)은 직접 require 대신 대시보드 API 활용.
> 매매 실행(trade)은 안전상 MCP 도구에서 제외.

### 3-3. anti-echo-chamber (2 tools)

| 도구명 | 입력 | 호출 대상 | 반환 요약 |
|--------|------|----------|----------|
| `counter_perspective` | title, summary, category? | require() → generateCounterPerspective | counterArguments[], alternativeViewpoint |
| `counter_batch` | newsArray[], maxItems? | require() → generateBatch | perspectives[] |

> 직접 모듈 import (HTTP 서버 없음). Gemini API 키 필요.

## 4. 디렉토리 구조

```
mcp-gateway/
├── package.json
├── server.js                  # MCP 서버 진입점 (stdio)
├── tools/
│   ├── invest-quant.js        # 4 tools 등록
│   ├── auto-trader.js         # 3 tools 등록
│   └── anti-echo-chamber.js   # 2 tools 등록
├── lib/
│   └── http-client.js         # axios 래퍼 (타임아웃, 에러정제)
├── .env.example
└── .gitignore
```

## 5. 환경변수

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `INVEST_QUANT_URL` | invest-quant 서버 주소 | http://localhost:3003 |
| `INVEST_QUANT_API_KEY` | invest-quant 인증키 | (필수) |
| `AUTO_TRADER_URL` | auto-trader 대시보드 주소 | http://localhost:3001 |
| `GEMINI_API_KEY` | anti-echo-chamber용 | (필수) |

## 6. Claude Code 설정 (등록)

`~/.claude/settings.json`에 추가:
```json
{
  "mcpServers": {
    "mcp-gateway": {
      "command": "node",
      "args": ["/home/taeho/mcp-gateway/server.js"],
      "env": {}
    }
  }
}
```

> 환경변수는 .env에서 dotenv로 로드하므로 settings.json env는 비워둠.

## 7. 에러 처리 전략

| 상황 | 처리 |
|------|------|
| 대상 서버 미실행 | `isError: true` + "서버 미실행" 메시지 반환 |
| API 키 누락 | 서버 시작 시 console.error + 해당 도구 비활성화 |
| 타임아웃 (10초) | axios timeout → 에러 메시지 반환 |
| 입력 검증 실패 | zod 검증 → MCP SDK가 자동 에러 반환 |

## 8. 토큰 효율 설계

- **응답 정제:** 각 도구가 원본 JSON 전체가 아닌 핵심 필드만 추출하여 반환
- **도구 수 제한:** 9개 도구 (스키마 토큰 ~2K 예상, 수용 가능)
- **설명 간결화:** description은 1~2문장으로 제한

## 9. 구현 순서

| 단계 | 파일 | 내용 |
|------|------|------|
| 1 | package.json, .gitignore, .env.example | 프로젝트 초기화 |
| 2 | lib/http-client.js | axios 래퍼 (10초 타임아웃, 에러 정제) |
| 3 | tools/invest-quant.js | 4 도구 등록 |
| 4 | tools/auto-trader.js | 3 도구 등록 |
| 5 | tools/anti-echo-chamber.js | 2 도구 등록 |
| 6 | server.js | McpServer + stdio + 도구 로드 |
| 7 | settings.json 수정 | Claude Code에 MCP 서버 등록 |
| 8 | 수동 테스트 | Claude Code 재시작 후 도구 호출 확인 |

## 10. Phase 3 자가 비판

### 취약점 및 대응

| 취약점 | 심각도 | 대응 |
|--------|--------|------|
| invest-quant/auto-trader 미실행 시 도구 무용 | 중 | 에러 메시지로 "서버 시작 필요" 안내 |
| anti-echo-chamber require 경로 하드코딩 | 하 | 환경변수 `ANTI_ECHO_PATH`로 설정 가능하게 |
| Gemini API 호출 비용 | 중 | counter_batch의 maxItems 기본값 3으로 제한 |
| 매매 실행 도구 부재 | 의도적 | 안전 원칙. 조회/분석만 노출 |
| 도구 9개 → 스키마 토큰 소비 | 하 | 현재 수용 가능. 15개 초과 시 분할 검토 |
| stdio 프로세스 크래시 | 하 | Claude Code가 자동 재spawn |
| API 키가 .env에만 있어 서버 환경 불가 | 하 | 현재 로컬 전용. 원격 필요 시 HTTP transport 추가 |

### 미포함 (의도적 제외)
- **백테스트 도구**: 실행시간 수초~수십초, 1차에서 제외
- **매매 실행**: 안전 원칙 (MCP에서 주문 실행은 위험)
- **topdown-learner, pm-agent**: 2순위, 1차 이후 추가
- **HTTP transport**: 현재 로컬 전용 충분
