import { readFileSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';

const DATA_DIR = process.env.AUTO_TRADER_DATA
  || '/home/taeho/auto-trader/data';

function readJson(filename) {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, filename), 'utf8'));
  } catch (e) {
    return null;
  }
}

export function register(server) {
  const txt = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
  const err = (msg) => ({ content: [{ type: 'text', text: msg }], isError: true });

  // 1) 포트폴리오 요약
  server.registerTool('trader_summary', {
    description: '자동매매 포트폴리오 요약 (보유수, 예수금, 평가액, 손익)',
    inputSchema: {}
  }, async () => {
    const data = readJson('portfolio.json');
    if (!data) return err('portfolio.json 없음. git pull 필요.');
    const s = data.summary || {};
    return txt({
      holdings: (data.holdings || []).length,
      deposit: s.totalDeposit,
      evaluation: s.totalEvaluation,
      profit: s.totalProfit,
      lastUpdated: data.lastUpdated
    });
  });

  // 2) 보유 종목 상세
  server.registerTool('trader_holdings', {
    description: '자동매매 보유 종목 상세 리스트',
    inputSchema: {}
  }, async () => {
    const data = readJson('portfolio.json');
    if (!data) return err('portfolio.json 없음. git pull 필요.');
    const items = data.holdings || [];
    return txt(items.map(h => ({
      code: h.code, name: h.name,
      qty: h.quantity, avgPrice: h.avgPrice,
      price: h.currentPrice, profit: h.profitRate
    })));
  });

  // 3) 최근 매매 기록
  server.registerTool('trader_trades', {
    description: '최근 매매 기록 조회',
    inputSchema: {
      limit: z.number().int().min(1).max(50).default(10).optional()
    }
  }, async ({ limit }) => {
    const trades = readJson('trades.json');
    if (!trades) return err('trades.json 없음. git pull 필요.');
    const arr = Array.isArray(trades) ? trades : [];
    return txt(arr.slice(-( limit || 10)).reverse());
  });
}
