import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  BriefcaseBusiness,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input } from '@/components/ui/Field';
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
  const [signInType, setSignInType] = useState<'advisor' | 'staff'>('advisor');

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
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50/70 via-white to-money-50/50 px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute -left-28 -top-28 size-80 rounded-full bg-brand-200/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 -right-24 size-96 rounded-full bg-money-100/45 blur-3xl" />
      <div className="w-full max-w-[420px]">
        {/* Cibilon Logo above the login card */}
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src="/cibilon-logo.png"
            alt="Cibilon — Better Credit. Better Opportunities."
            className="h-28 w-auto object-contain sm:h-32"
          />
        </div>

        {/* Centered Login Card */}
        <div className="relative rounded-3xl border border-white/90 bg-white/88 p-6 shadow-overlay ring-1 ring-slate-200/70 backdrop-blur-xl sm:p-8">
          <div
            className="mb-6 grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1.5"
            aria-label="Choose sign in type"
          >
            <button
              type="button"
              onClick={() => {
                setSignInType('advisor');
                setError(null);
              }}
              aria-pressed={signInType === 'advisor'}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all ${
                signInType === 'advisor'
                  ? 'bg-white text-brand-900 shadow-card ring-1 ring-slate-200'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
              }`}
            >
              <UserRound className="size-4" />
              Advisor
            </button>
            <button
              type="button"
              onClick={() => {
                setSignInType('staff');
                setError(null);
              }}
              aria-pressed={signInType === 'staff'}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all ${
                signInType === 'staff'
                  ? 'bg-white text-brand-900 shadow-card ring-1 ring-slate-200'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
              }`}
            >
              <BriefcaseBusiness className="size-4" />
              Staff
            </button>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {signInType === 'advisor' ? 'Advisor sign in' : 'Staff sign in'}
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              {signInType === 'advisor'
                ? 'Use the credentials issued by your Cibilon relationship manager.'
                : 'Use the credentials issued by your Cibilon administrator.'}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3"
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
              placeholder={signInType === 'advisor' ? 'advisor@cibilon.in' : 'staff@cibilon.in'}
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
                className="text-[13px] font-medium text-brand-700 transition-colors hover:text-brand-900 hover:underline"
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
              {submitting
                ? 'Signing in…'
                : `Sign in as ${signInType === 'advisor' ? 'advisor' : 'staff'}`}
            </Button>
          </form>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center">
          <p className="text-xs leading-relaxed text-slate-400">
            Access is restricted to empanelled Cibilon partners. Contact your relationship manager to
            have an account issued.
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            256-bit encrypted · RBI-compliant DSA platform
          </p>
        </div>
      </div>
    </div>
  );
}
