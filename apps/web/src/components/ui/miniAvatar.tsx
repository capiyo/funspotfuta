import { useState } from 'react';
import { useProfileAvatar } from '@funspot/core';
import { useFanColors } from '@/theme/use-fan-colors';
import { fanText } from '@/theme/use-fan-typography';

export function MiniAvatar({ colors, label, uri, userId }: {
  colors: ReturnType<typeof useFanColors>;
  label: string;
  userId?: string;
  uri?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const { authToken } = useAuth();
  const profileAvatar = useProfileAvatar(userId, authToken);
  const imageUri = profileAvatar ?? uri ?? `https://i.pravatar.cc/150?u=${encodeURIComponent(userId ?? label ?? 'guest')}`;
  return <span className="mini-avatar" style={{
    width: 24, height: 24, borderRadius: 12, border: `1px solid ${colors.border}`,
    backgroundColor: colors.surfaceSunken, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', overflow: 'hidden', flex: '0 0 auto',
  }}>
    {imageUri && !failed
      ? <img src={imageUri} alt={label} onError={() => setFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : <span style={fanText('tag', colors, colors.primary)}>{(label || '?').charAt(0).toUpperCase()}</span>}
  </span>;
}
