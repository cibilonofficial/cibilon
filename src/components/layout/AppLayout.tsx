import { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/store/AuthContext';
import { useData } from '@/store/DataContext';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { SearchPalette } from './SearchPalette';
import type { Role } from '@/types';

const COLLAPSE_KEY = 'cibilon.sidebar.collapsed';

export function AppLayout({ role }: { role: Role }) {
  const { user, loading: authLoading, logout } = useAuth();
  const { notifications, documents, payouts, applications, setAuditActor, loading, error, refresh } = useData();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Everything the session does from here is attributed to this user in the
  // audit trail.
  useEffect(() => {
    if (user) setAuditActor({ name: user.name, role: user.role });
  }, [user, setAuditActor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const advisorId = user?.id ?? '';

  const counts = useMemo(() => {
    const scopedApps = role === 'advisor'
      ? applications.filter((a) => a.advisorId === advisorId)
      : applications;
    const scopedIds = new Set(scopedApps.map((a) => a.id));
    return {
      notifications: notifications.filter((n) => n.audience === role && !n.read).length,
      pendingDocs: documents.filter(
        (d) =>
          scopedIds.has(d.applicationId) &&
          (role !== 'advisor'
            ? d.status === 'Under Verification' || d.status === 'Uploaded'
            : d.status === 'Pending' ||
              d.status === 'Re-upload Required' ||
              d.status === 'Rejected'),
      ).length,
      pendingPayouts: payouts.filter((p) => p.status !== 'Paid').length,
    };
  }, [applications, documents, notifications, payouts, role, advisorId]);

  if (authLoading) return <div className="flex min-h-dvh items-center justify-center text-sm text-slate-500">Restoring your session…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) {
    const home = user.role === 'admin'
      ? '/admin/dashboard'
      : user.role === 'staff'
        ? '/staff/applications'
        : '/app/dashboard';
    return <Navigate to={home} replace />;
  }

  const confirmLogout = async () => {
    setLogoutOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-dvh bg-slate-50">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 lg:block',
          collapsed ? 'w-[68px]' : 'w-64',
        )}
      >
        <Sidebar
          role={role}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          counts={counts}
          onLogout={() => setLogoutOpen(true)}
        />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-[17rem] max-w-[85vw] shadow-overlay animate-slide-in-right">
            <Sidebar
              role={role}
              collapsed={false}
              onToggleCollapse={() => undefined}
              counts={counts}
              onNavigate={() => setDrawerOpen(false)}
              onLogout={() => {
                setDrawerOpen(false);
                setLogoutOpen(true);
              }}
              mobile
            />
          </div>
        </div>
      )}

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col transition-[padding] duration-200',
          collapsed ? 'lg:pl-[68px]' : 'lg:pl-64',
        )}
      >
        <Topbar
          user={user}
          onOpenDrawer={() => setDrawerOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <main className="min-w-0 flex-1 px-3 py-5 sm:px-5 lg:px-7">
          <div className="mx-auto w-full max-w-[1400px]">
            {error && (
              <div className="mb-4 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <span>{error}</span>
                <button className="font-medium underline" onClick={() => void refresh()}>Retry</button>
              </div>
            )}
            {loading && <p className="mb-3 text-xs text-slate-400">Refreshing workspace data…</p>}
            <Outlet />
          </div>
        </main>
        <footer className="border-t border-slate-200 px-5 py-4 text-center text-xs text-slate-400">
          Cibilon Pvt. Ltd. · Advisor CRM
        </footer>
      </div>

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        role={role}
        advisorId={advisorId}
      />

      <ConfirmDialog
        open={logoutOpen}
        title="Sign out of Cibilon CRM?"
        message="You will need to sign in again to access your leads, applications and payouts."
        confirmLabel="Sign out"
        tone="danger"
        onConfirm={confirmLogout}
        onCancel={() => setLogoutOpen(false)}
      />
    </div>
  );
}
