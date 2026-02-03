# mcp-gateway

MCP (Model Context Protocol) server that exposes local agents as tools for Claude Code.

## Tools (15)

| Domain | Tools | Backend Agent |
|--------|-------|--------------|
| Quant | `quant_fundamental`, `quant_buy_advisory`, `quant_sell_advisory` | invest-quant |
| Trading | `trader_summary`, `trader_holdings`, `trader_trades` | auto-trader |
| News | `counter_perspective`, `counter_batch` | anti-echo-chamber |
| Reports | `report_generate`, `report_validate`, `report_list_templates` | report-builder |
| Robotics | `robot_design`, `robot_critic`, `robot_stress_test` | robot-modeler |
| Notion | `notion_portfolio_sync`, `notion_portfolio_update` | notion-portfolio |

## Architecture

```
Claude Code ←─ stdio ─→ mcp-gateway (server.js)
                            ├─ tools/invest-quant.js    → REST :3003
                            ├─ tools/auto-trader.js     → REST :3001
                            ├─ tools/anti-echo-chamber.js → local
                            ├─ tools/report-builder.js  → local
                            ├─ tools/robot-modeler.js   → local
                            └─ tools/notion-portfolio.js → Notion API
```

## Stack

- **Runtime**: Node.js
- **Protocol**: MCP SDK (stdio transport)
- **Validation**: Zod schema for all tool inputs

## Setup

```bash
cp .env.example .env
npm install
npm start              # Start MCP server (stdio)
```

Add to Claude Code config:
```json
{
  "mcpServers": {
    "mcp-gateway": {
      "command": "node",
      "args": ["/path/to/mcp-gateway/server.js"]
    }
  }
}
```
