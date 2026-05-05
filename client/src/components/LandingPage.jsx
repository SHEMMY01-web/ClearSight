import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function LandingPage({ onAuthSuccess }) {
  const [authMode, setAuthMode] = useState('login'); // login | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setErrorMsg('');
    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Verification email sent! Please check your inbox.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthSuccess();
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col font-mono text-ink">
      {/* Header */}
      <header className="fixed w-full top-0 bg-paper/90 backdrop-blur-md border-b border-ink/10 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-ink rounded flex items-center justify-center">
              <span className="text-paper font-playfair font-bold text-xl">C</span>
            </div>
            <h1 className="font-playfair text-2xl font-black tracking-tight">ClearSight</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setAuthMode('login')} 
              className={`text-xs font-bold uppercase tracking-widest ${authMode === 'login' ? 'text-gold' : 'text-gray hover:text-ink'}`}
            >
              Log In
            </button>
            <button 
              onClick={() => setAuthMode('signup')} 
              className="btn-primary !py-2 !px-4 text-xs"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 pt-32 pb-24 grid lg:grid-cols-2 gap-16 items-center">
        
        {/* Left Column: Copy */}
        <div className="space-y-8 animate-fade-down">
          <div className="inline-block bg-ink text-paper text-[10px] uppercase font-bold tracking-widest px-3 py-1">
            Legal Intelligence Platform
          </div>
          
          <h2 className="font-playfair text-6xl md:text-7xl font-black leading-tight">
            See the risks <br/>
            <span className="text-gray italic font-light">before you sign.</span>
          </h2>
          
          <p className="text-lg text-gray max-w-lg leading-relaxed">
            Upload your contracts. Our AI immediately flags hidden liabilities, predatory clauses, and non-standard terms. Plain English summaries and financial foresight for founders and freelancers.
          </p>

          <div className="flex gap-4 pt-4">
            <div className="flex flex-col">
              <span className="font-playfair font-black text-3xl">10x</span>
              <span className="text-xs uppercase tracking-widest text-gray mt-1">Faster Review</span>
            </div>
            <div className="w-px bg-ink/10"></div>
            <div className="flex flex-col">
              <span className="font-playfair font-black text-3xl">₦0</span>
              <span className="text-xs uppercase tracking-widest text-gray mt-1">Lawyer Fees</span>
            </div>
          </div>
        </div>

        {/* Right Column: Auth Form */}
        <div className="card-premium max-w-md w-full mx-auto relative group">
          <div className="absolute inset-0 bg-gold/5 blur-xl group-hover:bg-gold/10 transition-colors duration-500 rounded-lg -z-10"></div>
          <div className="mb-8">
            <h3 className="font-playfair text-3xl font-black mb-2">
              {authMode === 'login' ? 'Welcome Back.' : 'Create Account.'}
            </h3>
            <p className="text-xs text-gray uppercase tracking-widest">
              {authMode === 'login' ? 'Access your legal vault' : 'Start protecting your business'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            {errorMsg && (
              <div className="bg-rust/10 text-rust p-3 text-xs font-bold border-l-2 border-rust">
                {errorMsg}
              </div>
            )}
            
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold mb-2">Email Address</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-transparent border-b border-ink/20 focus:border-ink pb-2 outline-none transition-colors text-sm"
                placeholder="you@company.com"
              />
            </div>
            
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold mb-2">Password</label>
              <input 
                type="password" 
                required 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-transparent border-b border-ink/20 focus:border-ink pb-2 outline-none transition-colors text-sm"
                placeholder="••••••••"
              />
            </div>

            <button 
              type="submit" 
              disabled={isAuthLoading}
              className="w-full btn-primary !py-4 mt-8 flex justify-between items-center group/btn disabled:opacity-50"
            >
              <span>{isAuthLoading ? 'Authenticating...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}</span>
              <span className="group-hover/btn:translate-x-1 transition-transform">→</span>
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              type="button"
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="text-[10px] uppercase font-bold tracking-widest text-gray hover:text-ink transition-colors"
            >
              {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Log in"}
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}
