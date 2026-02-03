import { config } from 'dotenv';
import { homedir } from 'os';
import { join } from 'path';

// 프로젝트 .env → ~/.secrets/.env 순서로 로드
config({ path: new URL('.env', import.meta.url).pathname });
config({ path: join(homedir(), '.secrets', '.env') });

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { register as registerQuant } from './tools/invest-quant.js';
import { register as registerTrader } from './tools/auto-trader.js';
import { register as registerEcho } from './tools/anti-echo-chamber.js';
import { register as registerReport } from './tools/report-builder.js';
import { register as registerNotion } from './tools/notion-portfolio.js';
import { register as registerRobot } from './tools/robot-modeler.js';

const server = new McpServer({
  name: 'mcp-gateway',
  version: '1.0.0'
});

registerQuant(server);
registerTrader(server);
registerEcho(server);
registerReport(server);
registerNotion(server);
registerRobot(server);

const transport = new StdioServerTransport();
await server.connect(transport);
