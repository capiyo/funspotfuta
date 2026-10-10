import { useLocation, useNavigate } from 'react-router-dom';
import { Home, TrendingUp, Plus, MessageCircle, User } from 'lucide-react';

const TABS = [
  { href: '/home', label: 'Home', Icon: Home },
  { href: '/trending', label: 'Trending', Icon: TrendingUp },
] as const;

const TABS_RIGHT = [
  { href: '/chat', label: 'Chat', Icon: MessageCircle },
  { href: '/profile', label: 'Profile', Icon: User },
] as const;

export function BottomNav({ onAddPressed }: { onAddPressed?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();

  const NavItem = ({ href, label, Icon }: { href: string; label: string; Icon: typeof Home }) => {
    const isSelected = location.pathname === href;
    return (
      <button onClick={() => navigate(href)} className="flex flex-col items-center gap-1">
        <Icon size={24} color={isSelected ? '#10B981' : '#4b5563'} />
        <span className={`text-[10px] ${isSelected ? 'text-funspot-green' : 'text-gray-600'}`}>{label}</span>
      </button>
    );
  };

  return (
    <div className="border-t border-gray-800/50 bg-black/95">
      <div className="flex items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {TABS.map((t) => <NavItem key={t.href} {...t} />)}
        <button
          onClick={onAddPressed}
          className="flex h-12 w-12 items-center justify-center rounded-full shadow-[0_0_16px_2px_rgba(16,185,129,0.3)]"
          style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
        >
          <Plus size={24} color="white" />
        </button>
        {TABS_RIGHT.map((t) => <NavItem key={t.href} {...t} />)}
      </div>
    </div>
  );
}
