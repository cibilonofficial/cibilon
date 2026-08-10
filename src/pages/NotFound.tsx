import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LogoMark } from '@/components/layout/Logo';
import { useAuth } from '@/store/AuthContext';

export function NotFound() {
  const { user } = useAuth();
  const home = user ? (user.role === 'admin' ? '/admin/dashboard' : '/app/dashboard') : '/login';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-5 text-center">
      <LogoMark className="size-11" />
      <p className="mt-6 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Compass className="size-3.5" />
        Error 404
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        We couldn’t find that page
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
        The link may be out of date, or the record was moved. Head back to your dashboard and try
        again from there.
      </p>
      <Link to={home} className="mt-6">
        <Button>Back to dashboard</Button>
      </Link>
    </div>
  );
}
