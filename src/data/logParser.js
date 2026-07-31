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
  return { hh, mm, bp, fm, up, pt, raw: line };
};

export const loadLogs = async (logPath) => {
  try {
    const logContent = await fs.readFile(logPath, 'utf-8');
    return logContent.split('\n').map(parseLogLine).filter(Boolean);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Error loading logs from ${logPath}:`, error.message);
    }
    return [];
  }
};

export const parsePartialEvent = (eventStr) => {
  const base = generateSyntheticLogs(1)[0];
  const parts = eventStr.split(';');
  parts.forEach(part => {
    const [key, val] = part.split('=').map(s => s.trim());
    if (key === 'TIME') {
      const [hh, mm] = val.split('.').map(Number);
      base.hh = hh;
      base.mm = mm;
    } else if (key === 'BP') base.bp = Number(val);
    else if (key === 'FM') base.fm = Number(val);
    else if (key === 'UP') base.up = Number(val);
    else if (key === 'PT') base.pt = Number(val);
  });
  base.raw = eventStr;
  return base;
};
export const generateSyntheticLogs = (count = 50) => {
  return Array.from({ length: count }, (_, i) => ({
    hh: Math.floor((i / count) * 24) % 24,
    mm: (i * 7) % 60,
    bp: Math.max(0, 100 - Math.floor((i / count) * 100)),
    fm: 40 + Math.floor(Math.sin(i * 0.5) * 20 + 20),
    up: i * 3600,
    pt: 20 + Math.floor(Math.random() * 180),
    raw: `TIME=${String(Math.floor((i / count) * 24) % 24).padStart(2, '0')}.${String((i * 7) % 60).padStart(2, '0')}; BP=${Math.max(0, 100 - Math.floor((i / count) * 100))}; FM=${40 + Math.floor(Math.sin(i * 0.5) * 20 + 20)}; UP=${i * 3600}; PT=${20 + Math.floor(Math.random() * 180)}`
  }));
};
