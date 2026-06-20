# mcp-gateway

MCP (Model Context Protocol) server that exposes local agents as tools for Claude Code.

## Tools (19)

| Domain | Tools | Backend Agent |
|--------|-------|--------------|
| Quant | `quant_fundamental`, `quant_buy_advisory`, `quant_sell_advisory` | invest-quant |
| Trading | `trader_summary`, `trader_holdings`, `trader_trades` | auto-trader |
| News | `counter_perspective`, `counter_batch` | anti-echo-chamber |
| Reports | `report_generate`, `report_validate`, `report_list_templates` | report-builder |
| Robotics | `robot_design`, `robot_critic`, `robot_stress_test` | robot-modeler |
| Notion | `notion_portfolio_sync`, `notion_portfolio_update` | notion-portfolio |
| FreeCAD | `freecad_runtime_status`, `freecad_create_model`, `freecad_generate_drawing`, `freecad_inspect_model` | freecad-automation |

## Architecture

```
Claude Code ←─ stdio ─→ mcp-gateway (server.js)
                            ├─ tools/invest-quant.js    → REST :3003
                            ├─ tools/auto-trader.js     → REST :3001
                            ├─ tools/anti-echo-chamber.js → local
                            ├─ tools/report-builder.js  → local
                            ├─ tools/robot-modeler.js   → local
                            ├─ tools/notion-portfolio.js → Notion API
                            └─ tools/freecad-automation.js → FreeCADCmd + freecad-automation
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

Optional environment for FreeCAD:
```bash
export FREECAD_AUTOMATION_ROOT="/Users/jangtaeho/Documents/New/freecad-automation"
export FREECAD_OUTPUT_DIR="/Users/jangtaeho/Documents/New/freecad-automation/output"
export FREECAD_CMD="/Applications/FreeCAD.app/Contents/Resources/bin/FreeCADCmd"
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
