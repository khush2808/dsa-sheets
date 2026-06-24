'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default function SheetPreview({ sheet, initialProblems }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(supabase ? 'Checking session' : 'Local preview');
  const [problems] = useState(initialProblems);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      setStatus(data.session?.user ? 'Signed in' : 'Signed out');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setStatus(session?.user ? 'Signed in' : 'Signed out');
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const completed = useMemo(() => 0, []);

  const signIn = async () => {
    const email = window.prompt('Email for magic link');
    if (!email || !supabase) return;
    setStatus('Sending magic link');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href }
    });
    setStatus(error ? 'Auth error' : 'Check your email');
  };

  return (
    <main className="next-shell">
      <header className="next-toolbar">
        <a href="/">All sheets</a>
        <div>
          <span>{status}</span>
          {user ? (
            <button type="button" onClick={() => supabase.auth.signOut()}>
              Sign out
            </button>
          ) : (
            <button type="button" onClick={signIn} disabled={!supabase}>
              Sign in
            </button>
          )}
        </div>
      </header>
      <section className="next-hero compact">
        <p>{sheet.kicker}</p>
        <h1>{sheet.title}</h1>
        <span>
          {completed}/{problems.length} preview problems completed
        </span>
      </section>
      <section className="next-problems">
        {problems.map((problem) => (
          <article key={problem.problem_id || problem.code || problem.problem_name}>
            <input type="checkbox" aria-label={`Mark ${problem.problem_name} complete`} />
            <div>
              <b>{problem.problem_name}</b>
              <span>{problem.difficulty}</span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
