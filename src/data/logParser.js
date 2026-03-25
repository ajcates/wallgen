import fs from 'fs/promises';

/**
 * Parses Tasker log lines into structured objects.
 * Format: TIME=HH.MM; BP=battery; FM=free memory; UP=uptime; PT=ping
 */
export const parseLogLine = line => {
  const match = line.match(
    /TIME=(\d+)\.(\d+).*BP=(\d+).*FM=(\d+).*UP=(\d+).*PT=(\d+)/
  );
  if (!match) return null;
  const [_, hh, mm, bp, fm, up, pt] = match.map(Number);
  return { hh, mm, bp, fm, up, pt };
};

export const loadLogs = async (logPath) => {
  try {
    const logContent = await fs.readFile(logPath, 'utf-8');
    return logContent.split('\n').map(parseLogLine).filter(Boolean);
  } catch (error) {
    console.error(`Error loading logs from ${logPath}:`, error.message);
    return [];
  }
};
