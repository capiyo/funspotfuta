import { useState } from 'react';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';

export function MiniAvatar({ colors, label, uri }: {
  colors: ReturnType<typeof useFanColors>;
  label: string;
  uri?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  return <span className="mini-avatar" style={{
    width: 24, height: 24, borderRadius: 12, border: `1px solid ${colors.border}`,
    backgroundColor: colors.surfaceSunken, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', overflow: 'hidden', flex: '0 0 auto',
  }}>
    {uri && !failed
      ? <img src={uri} alt={label} onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : <span style={fanText('tag', colors, colors.primary)}>{(label || '?').charAt(0).toUpperCase()}</span>}
  </span>;
}
