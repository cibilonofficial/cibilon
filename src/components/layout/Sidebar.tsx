import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight, LogOut, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Wordmark } from './Logo';
import { navFor } from './navigation';
import type { Role } from '@/types';

export interface SidebarCounts {
  notifications: number;
  pendingDocs: number;
  pendingPayouts: number;
}

interface SidebarProps {
  role: Role;
  collapsed: boolean;
  onToggleCollapse: () => void;
  counts: SidebarCounts;
  onNavigate?: () => void;
  onLogout: () => void;
  /** Rendered inside the mobile drawer, adds a close button. */
  mobile?: boolean;
}

export function Sidebar({
  role,
  collapsed,
  onToggleCollapse,
  counts,
  onNavigate,
  onLogout,
  mobile = false,
}: SidebarProps) {
  const navigate = useNavigate();
  const groups = navFor(role);
  const isCollapsed = collapsed && !mobile;

  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-slate-200 px-4',
          isCollapsed ? 'justify-center px-2' : 'justify-between',
        )}
      >
        <button
          type="button"
          onClick={() => {
            navigate(role === 'admin' ? '/admin/dashboard' : '/app/dashboard');
            onNavigate?.();
          }}
          className="min-w-0 rounded-lg text-left"
        >
          <Wordmark
            compact={isCollapsed}
            subtitle={role === 'admin' ? 'Operations Console' : 'Advisor CRM'}
          />
        </button>
        {mobile && (
          <button
            type="button"
            onClick={onNavigate}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group, gi) => (
          <div key={group.label ?? `group-${gi}`} className={cn(gi > 0 && 'mt-5')}>
            {group.label && !isCollapsed && (
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const count = item.badge ? counts[item.badge] : 0;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onNavigate}
                      title={isCollapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                          isCollapsed && 'justify-center px-0',
                          isActive
                            ? 'bg-brand-50 text-brand-900'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon
                            className={cn(
                              'size-[18px] shrink-0',
                              isActive ? 'text-brand-700' : 'text-slate-400 group-hover:text-slate-600',
                            )}
                          />
                          {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                          {!isCollapsed && count > 0 && (
                            <span
                              className={cn(
                                'tnum rounded px-1.5 py-0.5 text-[11px] font-semibold',
                                isActive
                                  ? 'bg-brand-700 text-white'
                                  : 'bg-slate-200 text-slate-600',
                              )}
                            >
                              {count}
                            </span>
                          )}
                          {isCollapsed && count > 0 && (
                            <span className="absolute right-2 size-1.5 rounded-full bg-brand-600" />
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-slate-200 p-3">
        <button
          type="button"
          onClick={onLogout}
          title={isCollapsed ? 'Logout' : undefined}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700',
            isCollapsed && 'justify-center px-0',
          )}
        >
          <LogOut className="size-[18px] shrink-0 text-slate-400" />
          {!isCollapsed && 'Logout'}
        </button>

        {!mobile && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              'mt-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100',
              isCollapsed && 'justify-center px-0',
            )}
          >
            {isCollapsed ? (
              <ChevronsRight className="size-[18px] shrink-0 text-slate-400" />
            ) : (
              <>
                <ChevronsLeft className="size-[18px] shrink-0 text-slate-400" />
                Collapse
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
