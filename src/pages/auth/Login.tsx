import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input } from '@/components/ui/Field';
import { LogoMark } from '@/components/layout/Logo';
import { useAuth } from '@/store/AuthContext';

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});

  const homeFor = (role: 'admin' | 'advisor' | 'staff') =>
    role === 'admin' ? '/admin/dashboard' : role === 'staff' ? '/staff/applications' : '/app/dashboard';

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errors: typeof fieldErrors = {};
    if (!identifier.trim()) errors.identifier = 'Enter your registered email or mobile number.';
    if (!password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    setError(null);
    const result = await login(identifier, password, remember);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    const target = (location.state as { from?: string } | null)?.from;
    navigate(target ?? homeFor(result.role ?? 'advisor'), {
      replace: true,
    });
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden flex-col justify-between bg-brand-950 px-12 py-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative flex items-center gap-3">
          <LogoMark className="bg-white/10 ring-1 ring-white/15" />
          <div>
            <p className="text-[15px] font-semibold leading-tight">
              Cibilon
            </p>
            <p className="text-[11px] leading-tight text-white/50">Advisor CRM</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            One workspace for every loan file you source.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65">
            Submit leads, upload KYC, track processing stage by stage and see exactly what you have
            earned — without a single follow-up call to the ops desk.
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-8">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-white/45">Partner DSAs</dt>
              <dd className="tnum mt-1 text-2xl font-semibold">2,400+</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-white/45">Disbursed</dt>
              <dd className="tnum mt-1 text-2xl font-semibold">₹840Cr</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-white/45">Lenders</dt>
              <dd className="tnum mt-1 text-2xl font-semibold">38</dd>
            </div>
          </dl>
        </div>

        <ul className="relative flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/50">
          <li className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" /> 256-bit encrypted
          </li>
          <li className="flex items-center gap-1.5">
            <Users className="size-3.5" /> RBI-compliant DSA network
          </li>
          <li className="flex items-center gap-1.5">
            <TrendingUp className="size-3.5" /> Real-time payout tracking
          </li>
        </ul>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center bg-white px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark />
            <div>
              <p className="text-[15px] font-semibold leading-tight text-slate-900">
                Cibilon
              </p>
              <p className="text-[11px] leading-tight text-slate-400">Advisor CRM</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Advisor sign in</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Use the credentials issued by your Cibilon relationship manager.
          </p>

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
              <p className="text-[13px] leading-snug text-rose-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <Input
              label="Email or mobile number"
              type="text"
              autoComplete="username"
              placeholder="advisor@ciblon.in"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              error={fieldErrors.identifier}
              prefix={<Mail className="size-4" />}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              prefix={<Lock className="size-4" />}
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-slate-400 transition-colors hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              }
            />

            <div className="flex items-center justify-between">
              <Checkbox
                label="Remember me"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <Link
                to="/forgot-password"
                className="text-[13px] font-medium text-brand-700 hover:text-brand-900 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={submitting}
              iconRight={<ArrowRight className="size-4" />}
            >
              {submitting ? 'Signing in…' : 'Login'}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs leading-relaxed text-slate-400">
            Access is restricted to empanelled Cibilon partners. Contact your relationship manager to
            have an account issued.
          </p>
        </div>
      </main>
    </div>
  );
}
