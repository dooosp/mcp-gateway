import { z } from 'zod';
import * as api from '../lib/invest-intel-client.js';

export function register(server) {
  const txt = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
  const err = (msg) => ({ content: [{ type: 'text', text: msg }], isError: true });

  // 1) 포트폴리오 요약
  server.registerTool('trader_summary', {
    description: '자동매매 포트폴리오 요약 (보유수, 예수금, 평가액, 손익)',
    inputSchema: {}
  }, async () => {
    try {
      const data = await api.getSummary();
      const p = data.portfolio || {};
      return txt({
        holdings: p.holdingsCount,
        deposit: p.totalDeposit,
        evaluation: p.totalEvaluation,
        profit: p.totalProfit,
        lastUpdated: p.lastUpdated,
      });
    } catch (e) { return err(e.message); }
  });

  // 2) 보유 종목 상세
  server.registerTool('trader_holdings', {
    description: '자동매매 보유 종목 상세 리스트',
    inputSchema: {}
  }, async () => {
    try {
      const data = await api.getHoldings();
      const items = data.holdings || [];
      return txt(items.map(h => ({
        code: h.code,
        name: h.name,
        qty: h.quantity,
        avgPrice: h.avgPrice,
        price: h.currentPrice,
        profit: h.profitRate,
      })));
    } catch (e) { return err(e.message); }
  });

  // 3) 최근 매매 기록
  server.registerTool('trader_trades', {
    description: '최근 매매 기록 조회',
    inputSchema: {
      limit: z.number().int().min(1).max(50).default(10).optional()
    }
  }, async ({ limit }) => {
    try {
      const data = await api.getTrades(limit || 10);
      const trades = data.trades || [];
      return txt(trades);
    } catch (e) { return err(e.message); }
  });
}
