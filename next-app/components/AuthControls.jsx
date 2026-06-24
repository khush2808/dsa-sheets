'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export const authRedirectUrl = () => `${window.location.origin}${window.location.pathname}`;

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.43Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.51c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.75-5.58-4.11H3.07v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.42 13.9a6 6 0 0 1 0-3.8V7.51H3.07a10 10 0 0 0 0 8.98l3.35-2.59Z" />
      <path fill="#EA4335" d="M12 5.98c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.93 5.51l3.35 2.59C7.2 7.73 9.4 5.98 12 5.98Z" />
    </svg>
  );
}

export function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.19-3.37-1.19-.45-1.15-1.1-1.45-1.1-1.45-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.9.83.1-.64.35-1.08.64-1.33-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.45 9.45 0 0 1 12 6.02c.85 0 1.7.11 2.5.34 1.9-1.29 2.74-1.02 2.74-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.86V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"
      />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 21a8 8 0 0 0-16 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      <circle cx="12" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function ProviderButton({ provider, onClick, disabled }) {
  const label = provider === 'google' ? 'Google' : 'GitHub';
  return (
    <button className="provider-button" type="button" onClick={onClick} disabled={disabled}>
      <span className="provider-icon">{provider === 'google' ? <GoogleIcon /> : <GitHubIcon />}</span>
      <span>{label}</span>
    </button>
  );
}

export function LandingAuth() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email');
  const [status, setStatus] = useState(supabase ? 'Checking session' : 'Local only');

  useEffect(() => {
    if (!supabase) return;
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user || null);
      setStatus(data.session?.user ? 'Signed in' : 'Ready');
    };
    loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setStatus(session?.user ? 'Signed in' : 'Ready');
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const sendCode = async (event) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !supabase) return;
    setStatus('Sending code');
    const { error } = await supabase.auth.signInWithOtp({ email: trimmedEmail, options: { emailRedirectTo: authRedirectUrl() } });
    if (error) {
      setStatus('Could not send code');
      return;
    }
    setStep('code');
    setStatus('Code sent');
  };

  const verifyCode = async (event) => {
    event.preventDefault();
    const token = otp.replace(/\D/g, '');
    if (!email.trim() || token.length < 6 || !supabase) return;
    setStatus('Verifying');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    setStatus(error ? 'Invalid code' : 'Signed in');
  };

  const signInWithProvider = async (provider) => {
    if (!supabase) return;
    setStatus(`Opening ${provider}`);
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: authRedirectUrl() } });
    if (error) setStatus(`Could not open ${provider}`);
  };

  const signOut = async () => {
    if (!supabase) return;
    setStatus('Signing out');
    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatus('Could not sign out');
      return;
    }
    setUser(null);
    setStatus('Ready');
  };

  return (
    <div className="landing-auth">
      {user ? (
        <div className="landing-auth-user">
          <span className="auth-avatar">
            <UserIcon />
          </span>
          <span>{user.email}</span>
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      ) : (
        <details className="landing-auth-menu">
          <summary>
            <span className="auth-avatar">
              <UserIcon />
            </span>
            <span>Sign in</span>
          </summary>
          <div className="landing-auth-card">
            <div>
              <b>Save progress</b>
              <p>Use a 6-digit email code or continue with a provider.</p>
            </div>
            <form className="auth-code-form" onSubmit={step === 'code' ? verifyCode : sendCode}>
              <label htmlFor="landingAuthEmail">Email</label>
              <input
                id="landingAuthEmail"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={!supabase}
              />
              {step === 'code' ? (
                <>
                  <label htmlFor="landingAuthCode">Code</label>
                  <input
                    id="landingAuthCode"
                    className="otp-input"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="123456"
                    autoComplete="one-time-code"
                    disabled={!supabase}
                  />
                </>
              ) : null}
              <button type="submit" disabled={!supabase || !email.trim() || (step === 'code' && otp.length < 6)}>
                {step === 'code' ? 'Verify code' : 'Send code'}
              </button>
            </form>
            <div className="auth-provider-row">
              <ProviderButton provider="google" onClick={() => signInWithProvider('google')} disabled={!supabase} />
              <ProviderButton provider="github" onClick={() => signInWithProvider('github')} disabled={!supabase} />
            </div>
            <p className="auth-status">{status}</p>
          </div>
        </details>
      )}
    </div>
  );
}
