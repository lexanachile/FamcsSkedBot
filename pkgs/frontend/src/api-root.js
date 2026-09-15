const hostname = globalThis.location?.hostname;
export const API_ROOT = ['localhost', '127.0.0.1'].includes(hostname)
  ? 'http://127.0.0.1:8787/api'
  : hostname === 'famcs.online' ? 'https://famcs.online/api' : 'https://famcsschedulebot.yarashsei.workers.dev/api';
