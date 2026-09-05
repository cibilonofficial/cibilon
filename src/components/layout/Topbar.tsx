import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Menu, Search, Settings, UserRound } from 'lucide-react';
import { cn, relativeTime } from '@/lib/utils';
import { Avatar } from '@/components/ui/Misc';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import type { AuthUser } from '@/types';

interface TopbarProps {
  user: AuthUser;
  onOpenDrawer: () => void;
  onOpenSearch: () => void;
}

export function Topbar({ user, onOpenDrawer, onOpenSearch }: TopbarProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { notifications, markNotificationRead, profile } = useData();
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const base = user.role === 'admin' ? '/admin' : user.role === 'staff' ? '/staff' : '/app';
  const mine = notifications.filter((n) => n.audience === user.role);
  const unread = mine.filter((n) => !n.read);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/90 px-3 backdrop-blur sm:gap-3 sm:px-5">
      <button
        type="button"
        onClick={onOpenDrawer}
        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-sm text-slate-400 transition-colors hover:border-slate-300 hover:bg-white sm:max-w-md"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Search applications, customers, payouts…</span>
        <kbd className="ml-auto hidden shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[10px] font-medium text-slate-400 sm:block">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <div ref={bellRef} className="relative">
          <button
            type="button"
            onClick={() => setBellOpen((v) => !v)}
            className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
            aria-label={`Notifications (${unread.length} unread)`}
          >
            <Bell className="size-5" />
            {unread.length > 0 && (
              <span className="tnum absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                {unread.length > 9 ? '9+' : unread.length}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-12 z-40 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-overlay animate-slide-up">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Notifications</p>
                <span className="text-xs text-slate-500">{unread.length} unread</span>
              </div>
              <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {mine.slice(0, 6).map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        markNotificationRead(n.id);
                        setBellOpen(false);
                        if (n.applicationId) navigate(`${base}/applications/${n.applicationId}`);
                        else navigate(`${base}/notifications`);
                      }}
                      className={cn(
                        'flex w-full gap-2.5 px-4 py-3 text-left transition-colors hover:bg-slate-50',
                        !n.read && 'bg-brand-50/40',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-1.5 size-1.5 shrink-0 rounded-full',
                          n.read ? 'bg-transparent' : 'bg-brand-600',
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-slate-800">
                          {n.title}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-slate-500">
                          {n.body}
                        </span>
                        <span className="mt-1 block text-[11px] text-slate-400">
                          {relativeTime(n.at)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {mine.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-slate-400">
                    You’re all caught up.
                  </li>
                )}
              </ul>
              <Link
                to={`${base}/notifications`}
                onClick={() => setBellOpen(false)}
                className="block border-t border-slate-200 px-4 py-2.5 text-center text-[13px] font-medium text-brand-700 transition-colors hover:bg-slate-50"
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg p-1 pr-1.5 transition-colors hover:bg-slate-100"
          >
            <Avatar
              name={user.name}
              color={user.avatarColor}
              src={user.role === 'advisor' ? profile.photo : null}
            />
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block truncate text-[13px] font-medium leading-tight text-slate-800">
                {user.name}
              </span>
              <span className="block truncate text-[11px] leading-tight text-slate-500">
                {user.code}
              </span>
            </span>
            <ChevronDown className="hidden size-4 text-slate-400 sm:block" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-12 z-40 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-overlay animate-slide-up">
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
                <p className="mt-1.5 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                  {user.role === 'admin' ? 'Super Admin' : user.role === 'staff' ? 'Operations Staff' : 'Financial Advisor'}
                </p>
              </div>
              {user.role !== 'staff' && <div className="p-1.5">
                <Link
                  to={`${base}/profile`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <UserRound className="size-4 text-slate-400" />
                  My profile
                </Link>
                <Link
                  to={`${base}/profile`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <Settings className="size-4 text-slate-400" />
                  Account settings
                </Link>
              </div>}
              <div className="border-t border-slate-200 p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                    navigate('/login', { replace: true });
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
