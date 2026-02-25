#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getConfig } from "./config/index.js";
import { registerTools } from "./server.js";
import { logger } from "./utils/logger.js";

async function main() {
  // Initialize config (sets log level, validates env)
  getConfig();

  const server = new McpServer({
    name: "gmeet-mcp",
    version: "0.1.0",
  });

  registerTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("gmeet-mcp server started on stdio");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
