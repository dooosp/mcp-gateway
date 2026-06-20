import { z } from 'zod';
import * as api from '../lib/invest-intel-client.js';

const STOCK_CODE = z.string().regex(/^\d{6}$/).describe('6자리 종목코드');
const DECISION = z.enum(['PASS', 'REJECT']).optional();

export function register(server) {
  const txt = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
  const err = (msg) => ({ content: [{ type: 'text', text: msg }], isError: true });

  server.registerTool('graham_gate_readiness', {
    description: 'Graham Gate 운영 준비 상태 확인(DART/KIS 환경, DB, valueSnapshot 계약)',
    inputSchema: {},
  }, async () => {
    try {
      const data = await api.getGrahamReadiness();
      return txt(data);
    } catch (e) {
      return err(e.message);
    }
  });

  server.registerTool('graham_gate_snapshots', {
    description: 'Graham Gate valueSnapshot 감사 기록 조회',
    inputSchema: {
      stockCode: STOCK_CODE.optional(),
      decision: DECISION,
      source: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20).optional(),
    },
  }, async ({ stockCode, decision, source, limit }) => {
    try {
      const data = await api.getValueSnapshots({ stockCode, decision, source, limit });
      return txt({
        count: data.count,
        snapshots: (data.snapshots || []).map((item) => ({
          id: item.id,
          stockCode: item.stockCode,
          stockName: item.stockName,
          source: item.source,
          decision: item.decision,
          gateStatus: item.gateStatus,
          createdAt: item.createdAt,
          rejectionReasons: item.snapshot?.rejectionReasons || [],
        })),
        updatedAt: data.updatedAt,
      });
    } catch (e) {
      return err(e.message);
    }
  });

  server.registerTool('graham_gate_summary', {
    description: 'Graham Gate pass rate, 거절 사유, 기준별 pass/fail 요약',
    inputSchema: {
      stockCode: STOCK_CODE.optional(),
      days: z.number().int().min(1).max(3650).optional(),
    },
  }, async ({ stockCode, days }) => {
    try {
      const data = await api.getValueSnapshotSummary({ stockCode, days });
      return txt(data);
    } catch (e) {
      return err(e.message);
    }
  });

  server.registerTool('graham_gate_export', {
    description: 'Graham Gate valueSnapshot export payload 생성(value-snapshots.json 소비자용)',
    inputSchema: {
      stockCode: STOCK_CODE.optional(),
      decision: DECISION,
      source: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(500).optional(),
    },
  }, async ({ stockCode, decision, source, limit }) => {
    try {
      const data = await api.exportValueSnapshots({ stockCode, decision, source, limit });
      return txt(data);
    } catch (e) {
      return err(e.message);
    }
  });
}
