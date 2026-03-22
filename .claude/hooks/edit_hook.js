// PostToolUse hook: logs every Write/Edit/MultiEdit action
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '..', '..', 'claude-audit.log');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = data.tool_input?.file_path || 'unknown';
    const toolName = data.tool_name || 'Edit';
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${toolName}: ${filePath}\n`;
    fs.appendFileSync(logFile, entry);
  } catch (e) {
    // silently ignore parse errors
  }
  process.exit(0);
});
