// PreToolUse hook: logs every file Read action
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
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] READ: ${filePath}\n`;
    fs.appendFileSync(logFile, entry);
  } catch (e) {
    // silently ignore parse errors
  }
  process.exit(0);
});
