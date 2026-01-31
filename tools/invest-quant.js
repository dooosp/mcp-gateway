import { z } from 'zod';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const IQ_PATH = process.env.INVEST_QUANT_PATH
  || '/home/taeho/invest-quant';

const STOCK_CODE = z.string().regex(/^\d{6}$/).describe('6자리 종목코드');

export function register(server) {
  let scorer, advisory;
  try {
    scorer = require(`${IQ_PATH}/modules/fundamental/fundamental-scorer`);
    advisory = require(`${IQ_PATH}/modules/integration/advisory-engine`);
  } catch (e) {
    console.error(`[mcp-gateway] invest-quant 로드 실패: ${e.message}`);
    return;
  }

  const txt = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
  const err = (msg) => ({ content: [{ type: 'text', text: msg }], isError: true });

  // 1) 펀더멘털 점수
  server.registerTool('quant_fundamental', {
    description: '종목 펀더멘털 점수 조회 (DART 기반)',
    inputSchema: { stockCode: STOCK_CODE }
  }, async ({ stockCode }) => {
    try {
      const d = await scorer.scoreFundamental(stockCode);
      if (!d.available) return err('펀더멘털 데이터 없음');
      const b = d.breakdown || {};
      return txt({ score: d.score, valuation: b.valuation, profitability: b.profitability, stability: b.stability, growth: b.growth });
    } catch (e) { return err(e.message); }
  });

  // 2) 매수 자문
  server.registerTool('quant_buy_advisory', {
    description: '매수 종합 자문 (펀더멘털+기술+리스크)',
    inputSchema: {
      stockCode: STOCK_CODE,
      currentPrice: z.number().positive(),
      technicalScore: z.number().min(0).max(100).optional()
    }
  }, async ({ stockCode, currentPrice, technicalScore }) => {
    try {
      const d = await advisory.adviseBuy({ stockCode, currentPrice, technicalScore });
      return txt({ approved: d.approved, confidence: d.confidence, positionSize: d.positionSize, reasons: d.reasons });
    } catch (e) { return err(e.message); }
  });

  // 3) 매도 자문
  server.registerTool('quant_sell_advisory', {
    description: '매도 종합 자문',
    inputSchema: {
      stockCode: STOCK_CODE,
      currentPrice: z.number().positive().optional(),
      profitRate: z.number().optional()
    }
  }, async ({ stockCode, currentPrice, profitRate }) => {
    try {
      const d = await advisory.adviseSell({ stockCode, currentPrice, profitRate });
      return txt({ approved: d.approved, reason: d.reason, reasons: d.reasons });
    } catch (e) { return err(e.message); }
  });
}
