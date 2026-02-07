export type BasicJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

function providerLabel(provider?: string | null) {
  const p = String(provider || '').trim();
  if (!p) return '';
  return `（${p}）`;
}

export function basicStatusText(status: BasicJobStatus, provider?: string | null) {
  switch (status) {
    case 'queued':
      return '順番待ち…';
    case 'running':
      return `生成中…${providerLabel(provider)}`;
    case 'succeeded':
      return '仕上げ中…';
    case 'failed':
      return '失敗しました';
    default:
      return '進行中…';
  }
}
