/**
 * invest-intelligence-loop HTTP 클라이언트
 *
 * invest-intel 모노리스의 Express API를 호출하여
 * 퀀트/트레이더 데이터를 가져온다.
 *
 * 의존성: native fetch (Node 18+)
 */

const BASE_URL = process.env.INVEST_INTEL_URL || 'http://localhost:3000';
const MAX_RETRIES = 3;
const TIMEOUT_MS = 15_000;

/**
 * 재시도 + 타임아웃 포함 fetch 래퍼
 */
async function fetchWithRetry(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      clearTimeout(timer);

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        let parsed;
        try { parsed = JSON.parse(body); } catch { parsed = null; }
        const msg = parsed?.error || `HTTP ${res.status}: ${body.slice(0, 200)}`;
        throw new Error(msg);
      }

      return await res.json();
    } catch (err) {
      lastError = err;

      // AbortError → 타임아웃
      if (err.name === 'AbortError') {
        lastError = new Error(`타임아웃 (${TIMEOUT_MS}ms): ${url}`);
      }

      // 연결 거부 → 서버 미실행
      if (err.cause?.code === 'ECONNREFUSED') {
        throw new Error(
          `invest-intel 서버에 연결할 수 없습니다 (${BASE_URL}). 서버 실행 여부를 확인하세요.`
        );
      }

      // 마지막 시도가 아니면 대기 후 재시도
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(1000 * 2 ** (attempt - 1), 5000);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

// ─── Quant API ──────────────────────────────────

/**
 * 펀더멘털 점수 조회
 * GET /api/quant/fundamental/:stockCode
 */
export async function getFundamental(stockCode) {
  return fetchWithRetry(`/api/quant/fundamental/${stockCode}`);
}

/**
 * 매수 종합 자문
 * POST /api/quant/advisory/buy
 */
export async function adviseBuy({ stockCode, currentPrice, technicalScore }) {
  return fetchWithRetry('/api/quant/advisory/buy', {
    method: 'POST',
    body: JSON.stringify({ stockCode, currentPrice, technicalScore }),
  });
}

/**
 * 매도 종합 자문
 * POST /api/quant/advisory/sell
 */
export async function adviseSell({ stockCode, currentPrice, profitRate }) {
  return fetchWithRetry('/api/quant/advisory/sell', {
    method: 'POST',
    body: JSON.stringify({ stockCode, currentPrice, profitRate }),
  });
}

// ─── Trader API ─────────────────────────────────

/**
 * 포트폴리오 요약
 * GET /api/trader/summary
 */
export async function getSummary() {
  return fetchWithRetry('/api/trader/summary');
}

/**
 * 보유 종목 상세
 * GET /api/trader/holdings
 */
export async function getHoldings() {
  return fetchWithRetry('/api/trader/holdings');
}

/**
 * 최근 매매 기록
 * GET /api/trader/trades?limit=N
 */
export async function getTrades(limit = 10) {
  return fetchWithRetry(`/api/trader/trades?limit=${limit}`);
}
