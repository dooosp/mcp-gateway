import { z } from 'zod';

const NP_PATH = process.env.NOTION_PORTFOLIO_PATH || '/home/taeho/notion-portfolio';

const txt = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const err = (msg) => ({ content: [{ type: 'text', text: msg }], isError: true });

export function register(server) {

  server.registerTool('notion_portfolio_sync', {
    description: '프로젝트 포트폴리오를 Notion에 전체 동기화 (DB + 상세 + 요약)',
    inputSchema: {}
  }, async () => {
    try {
      const mod = await import(`${NP_PATH}/index.js`);
      const result = await mod.sync();
      return txt(result);
    } catch (e) {
      return err(e.message);
    }
  });

  server.registerTool('notion_portfolio_update', {
    description: '특정 프로젝트만 Notion에 업데이트',
    inputSchema: {
      projectName: z.string().describe('프로젝트명 (예: auto-trader)')
    }
  }, async ({ projectName }) => {
    try {
      const mod = await import(`${NP_PATH}/index.js`);
      const result = await mod.updateProject(projectName);
      return txt(result);
    } catch (e) {
      return err(e.message);
    }
  });
}
