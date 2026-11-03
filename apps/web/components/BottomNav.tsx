import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Newspaper, Plus } from 'lucide-react';

const TABS = [
  { href: '/', label: 'Chats', Icon: MessageCircle },
  { href: '/#feed', label: 'Feed', Icon: Newspaper },
] as const;

export function BottomNav({ onAddPressed }: { onAddPressed?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  return <nav aria-label="Primary navigation" className="border-t border-gray-800/50 bg-black/95">
    <div className="flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {TABS.map(({href,label,Icon}) => {
        const selected = href === '/' ? location.pathname === '/' : location.hash === '#feed';
        return <button key={href} aria-current={selected ? 'page' : undefined} onClick={() => href === '/' ? navigate('/') : document.getElementById('feed')?.scrollIntoView({behavior:'smooth'})} className="flex flex-col items-center gap-1">
          <Icon size={24} color={selected ? '#10B981' : '#4b5563'} />
          <span className={`text-[10px] ${selected ? 'text-funspot-green' : 'text-gray-600'}`}>{label}</span>
        </button>;
      })}
      <button aria-label="Create post" onClick={onAddPressed} className="flex h-12 w-12 items-center justify-center rounded-full shadow-[0_0_16px_2px_rgba(16,185,129,0.3)]" style={{background:'linear-gradient(135deg, #10B981, #059669)'}}><Plus size={24} color="white" /></button>
    </div>
  </nav>;
}
