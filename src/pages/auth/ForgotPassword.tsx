import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { apiRequest, errorMessage } from '@/lib/api';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter the email address registered against your DSA code.');
      return;
    }
    setError(undefined);
    setSending(true);
    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim() },
        skipRefresh: true,
      });
      setSent(true);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src="/cibilon-logo.png"
            alt="Cibilon — Better Credit. Better Opportunities."
            className="h-24 w-auto rounded-xl object-contain drop-shadow-sm"
          />
        </div>

        <div className="card-surface p-6">
          {sent ? (
            <div className="text-center">
              <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-money-50">
                <CheckCircle2 className="size-5 text-money-600" />
              </span>
              <h1 className="mt-4 text-lg font-semibold text-slate-900">Check your inbox</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                If <span className="font-medium text-slate-700">{email}</span> is registered with
                us, a password reset link is on its way. The link stays valid for 30 minutes.
              </p>
              <Button
                variant="secondary"
                fullWidth
                className="mt-6"
                onClick={() => {
                  setSent(false);
                  setEmail('');
                }}
              >
                Use a different email
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-slate-900">Reset your password</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                Enter your registered email address and we will send you a secure reset link.
              </p>
              <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
                <Input
                  label="Registered email"
                  type="email"
                  placeholder="advisor@ciblon.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={error}
                  prefix={<Mail className="size-4" />}
                />
                <Button type="submit" size="lg" fullWidth loading={sending}>
                  Send reset link
                </Button>
              </form>
            </>
          )}
        </div>

        <Link
          to="/login"
          className="mt-6 flex items-center justify-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
