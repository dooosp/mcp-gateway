/**
 * system_health MCP 도구
 * invest-intel /health 호출 + 로컬 환경변수 체크
 */
import { z } from 'zod';

const INVEST_INTEL_URL = process.env.INVEST_INTEL_URL || 'http://localhost:3000';

export function register(server) {
  server.registerTool('system_health', {
    description: '시스템 헬스체크 (invest-intel + mcp-gateway 환경변수)',
    inputSchema: {}
  }, async () => {
    const checks = {};

    // 1) invest-intel /health
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${INVEST_INTEL_URL}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      checks.invest_intel = await res.json();
    } catch (e) {
      checks.invest_intel = { status: 'error', message: e.message };
    }

    // 2) 로컬 환경변수
    const envKeys = ['INVEST_INTEL_URL', 'GEMINI_API_KEY', 'DART_API_KEY'];
    checks.env = {};
    for (const key of envKeys) {
      checks.env[key] = process.env[key] ? 'set' : 'missing';
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(checks, null, 2) }]
    };
  });
}
