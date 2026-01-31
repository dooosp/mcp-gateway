import { z } from 'zod';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ANTI_ECHO_PATH = process.env.ANTI_ECHO_PATH
  || '/home/taeho/news-scraper/lib/anti-echo-chamber';

export function register(server) {
  let mod;
  try {
    mod = require(ANTI_ECHO_PATH);
    if (process.env.GEMINI_API_KEY) mod.initialize(process.env.GEMINI_API_KEY);
  } catch (e) {
    console.error(`[mcp-gateway] anti-echo-chamber 로드 실패: ${e.message}`);
    return;
  }

  const txt = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
  const err = (msg) => ({ content: [{ type: 'text', text: msg }], isError: true });

  // 1) 단일 반대 관점
  server.registerTool('counter_perspective', {
    description: '뉴스 반대 관점 생성 (Gemini)',
    inputSchema: {
      title: z.string().describe('뉴스 제목'),
      summary: z.string().describe('뉴스 요약'),
      category: z.enum(['domestic', 'global']).optional()
    }
  }, async ({ title, summary, category }) => {
    try {
      const r = await mod.generateCounterPerspective({ title, summary, category });
      if (!r.success) return err(r.error || '생성 실패');
      return txt({
        claim: r.originalClaim,
        counterArguments: r.counterArguments,
        alternative: r.alternativeViewpoint
      });
    } catch (e) { return err(e.message); }
  });

  // 2) 배치 반대 관점
  server.registerTool('counter_batch', {
    description: '여러 뉴스 반대 관점 배치 생성',
    inputSchema: {
      news: z.array(z.object({
        title: z.string(),
        summary: z.string(),
        category: z.enum(['domestic', 'global']).optional()
      })).min(1).max(10),
      maxItems: z.number().int().min(1).max(5).default(3).optional()
    }
  }, async ({ news, maxItems }) => {
    try {
      const results = await mod.generateBatch(news, { maxItems: maxItems || 3 });
      const filtered = results.filter(r => r.success).map(r => ({
        title: r.originalTitle,
        claim: r.originalClaim,
        counterArguments: r.counterArguments,
        alternative: r.alternativeViewpoint
      }));
      return txt(filtered);
    } catch (e) { return err(e.message); }
  });
}
