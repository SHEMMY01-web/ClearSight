import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import './LandingPage.css';

export default function LandingPage({ onAuthSuccess }) {
  const [showAuthModal, setShowAuthModal] = useState(false);
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
        setShowAuthModal(false);
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

  const openAuth = (mode) => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  return (
    <>
      {/* ── HERO ── */}
      <section className="hero">
        <nav className="hero-nav">
          <div className="logo-mark">
            <div className="logo-icon"></div>
            <div className="logo-text">Clear<span>Sight</span></div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hero-tag hidden md:block mr-4">Nigeria · LegalTech · SMB</div>
            <button
              onClick={() => openAuth('login')}
              className="text-[10px] font-bold uppercase tracking-widest text-paper/80 hover:text-gold transition-colors"
            >
              Log In
            </button>
            <button
              onClick={() => openAuth('signup')}
              className="bg-gold text-ink px-4 py-2 font-syne font-bold uppercase tracking-widest text-[10px] transition-all hover:bg-gold-light"
            >
              Sign Up
            </button>
          </div>
        </nav>

        <div className="hero-center">
          <div className="hero-eyebrow">Brand Identity Document</div>
          <h1 className="hero-headline">Legal <em>clarity</em> for every Nigerian business.</h1>
          <p className="hero-sub">ClearSight is AI-powered legal document reviewer for Nigerian SMBs. Draft, review, and
            understand contracts.</p>
          <div className="hero-cta">
            <button onClick={() => openAuth('signup')} className="btn-primary" style={{ padding: '0.85rem 2rem', border: 'none', background: 'var(--gold)', color: 'var(--ink)' }}>Start Analysis</button>
            <a href="#what" className="btn-ex">Explore the Brand →</a>
          </div>
        </div>
      </section>

      {/* ── WHAT ── */}
      <section className="landing-section what-section" id="what">
        <div className="what-left">
          <div className="section-label-custom">What ClearSight Does</div>
          <h2 className="section-title">Your AI legal <em>co-pilot</em> — built for Nigeria.</h2>
          <p className="what-body">ClearSight gives Nigerian SMBs three things they've never had access to: the ability to
            generate legally sound contracts in seconds, an AI that reads the fine print so you don't have to, and a
            community intelligence layer that shows what other businesses flagged as predatory.</p>
          <p className="what-body">We are not a law firm. We are the infrastructure that puts legal power back in the hands of
            the people running this economy.</p>
        </div>
        <div className="what-right">
          <div className="feature-card">
            <div className="feature-card-num">01 · Draft</div>
            <div className="feature-card-title">Contract Generation</div>
            <div className="feature-card-desc">Generate NDAs, service agreements, employment letters, and supplier contracts
              grounded in CAMA 2020 and Nigerian law — in seconds, not days.</div>
          </div>
          <div className="feature-card">
            <div className="feature-card-num">02 · Review</div>
            <div className="feature-card-title">AI Clause Analysis</div>
            <div className="feature-card-desc">Upload any contract — digital or scanned paper. ClearSight flags high-risk
              clauses in plain English using an Advocate-Critic AI debate model.</div>
          </div>
          <div className="feature-card">
            <div className="feature-card-num">03 · Trust</div>
            <div className="feature-card-title">Community Trust Index</div>
            <div className="feature-card-desc">A live database of clauses Nigerian businesses have flagged as unfair, predatory,
              or deceptive — crowdsourced intelligence that gets smarter over time.</div>
          </div>
        </div>
      </section>

      {/* ── HOW ── */}
      <section className="landing-section how-section" id="how">
        <div className="section-label-custom">How It Works</div>
        <h2 className="section-title">Powered by advanced AI. <em>Grounded in Nigerian law.</em></h2>

        <div className="how-grid">
          <div className="how-step">
            <div className="how-step-num">01</div>
            <div className="how-step-title">Upload or Generate</div>
            <div className="how-step-desc">Upload a scanned paper contract, a PDF, or a photo. Or select a contract type and let
              ClearSight generate a template from scratch — localized to your industry and jurisdiction.</div>
            <div className="how-step-tag">OCR · Vision AI · Template Engine</div>
          </div>
          <div className="how-step">
            <div className="how-step-num">02</div>
            <div className="how-step-title">Advocate-Critic Analysis</div>
            <div className="how-step-desc">Two AI agents debate every high-risk clause. The Advocate finds the commercial
              upside. The Critic surfaces the legal trap. You see both sides — then decide.</div>
            <div className="how-step-tag">Agentic RAG · Chain-of-Thought</div>
          </div>
          <div className="how-step">
            <div className="how-step-num">03</div>
            <div className="how-step-title">Plain English Report</div>
            <div className="how-step-desc">Receive a risk-scored summary — no legalese. Every flagged clause explained with its
              risk level, what it means for your business, and a recommended action.</div>
            <div className="how-step-tag">Risk Scoring · PDF Export</div>
          </div>
          <div className="how-step">
            <div className="how-step-num">04</div>
            <div className="how-step-title">Nigerian Law Grounding</div>
            <div className="how-step-desc">All analysis runs against a curated RAG knowledge base of CAMA 2020, the Evidence
              Act, CAC guidelines, and Nigerian case law — not generic US/UK legal advice.</div>
            <div className="how-step-tag">Advanced RAG · Hybrid Search</div>
          </div>
          <div className="how-step">
            <div className="how-step-num">05</div>
            <div className="how-step-title">Community Intelligence</div>
            <div className="how-step-desc">Flag a clause as predatory. See if others flagged the same clause from the same
              company. The Trust Index aggregates this into a public ethics rating per organization.</div>
            <div className="how-step-tag">Trust Index · Crowd Intelligence</div>
          </div>
          <div className="how-step">
            <div className="how-step-num">06</div>
            <div className="how-step-title">Human-in-the-Loop</div>
            <div className="how-step-desc">ClearSight handles 97–99% of the analysis. For complex decisions, it escalates to a
              vetted human consultant. AI does the heavy lifting; humans make final calls.</div>
            <div className="how-step-tag">Hybrid Intelligence · Escalation</div>
          </div>
        </div>
      </section>

      {/* ── WHY ── */}
      <section className="landing-section why-section" id="why">
        <div className="why-left">
          <div className="section-label-custom">Why ClearSight Exists</div>
          <h2 className="section-title">A legal system built for <em>the few</em> — we're changing that.</h2>
          <blockquote className="why-quote">"A Lagos tailor signs a supplier agreement. Hidden inside: an indemnity clause that
            makes her liable for the supplier's losses. She finds out when it's too late."</blockquote>
          <p className="why-body">This happens every day across Nigeria. Not because SMB owners are careless — but because legal
            counsel costs ₦50,000–₦500,000 per engagement. For a market trader, a freelance developer, a growing logistics
            startup — that's not an option.</p>
          <p className="why-body" style={{ marginTop: '1rem' }}>ClearSight exists because 40 million Nigerian businesses deserve the
            same legal protection that only corporations and wealthy individuals have had access to. We are democratizing
            legal intelligence — not replacing lawyers, but giving every SMB a fighting chance before they sign.</p>
        </div>
        <div className="why-right">
          <div className="why-stat">
            <div className="why-stat-num">40M+</div>
            <div className="why-stat-text">
              <strong>SMBs in Nigeria</strong>
              Registered with CAC or operating informally — nearly all without any legal support infrastructure.
            </div>
          </div>
          <div className="why-stat">
            <div className="why-stat-num">0</div>
            <div className="why-stat-text">
              <strong>Serious local competitors</strong>
              DIYlaw focuses on incorporation only. LegalNaija is an attorney marketplace. No one owns AI-powered contract
              analysis for Nigerian SMBs.
            </div>
          </div>
          <div className="why-stat">
            <div className="why-stat-num">₦0</div>
            <div className="why-stat-text">
              <strong>Legal budget for most SMBs</strong>
              The vast majority of Nigerian small businesses have no budget for ongoing legal support — they sign and hope
              for the best.
            </div>
          </div>
          <div className="why-stat">
            <div className="why-stat-num">97%</div>
            <div className="why-stat-text">
              <strong>Target AI accuracy</strong>
              ClearSight's human-in-the-loop model targets 97–99% accuracy — doing the heavy lifting so consultants and
              users can make confident decisions fast.
            </div>
          </div>
        </div>
      </section>

      {/* ── WHO ── */}
      <section className="landing-section who-section" id="who">
        <div className="section-label-custom">Who ClearSight Serves</div>
        <h2 className="section-title">Built for the <em>backbone</em> of the Nigerian economy.</h2>

        <div className="who-grid">
          <div className="who-card" data-icon="🧵">
            <div className="who-card-type">Primary User</div>
            <div className="who-card-title">The Founder / SMB Owner</div>
            <div className="who-card-desc">Lagos tailor, Abuja tech startup, Port Harcourt logistics company. Growing fast,
              signing contracts regularly, no legal team.</div>
            <div className="who-card-pain">"I signed it because I had to. I didn't understand half of it."</div>
          </div>
          <div className="who-card" data-icon="💻">
            <div className="who-card-type">Primary User</div>
            <div className="who-card-title">The Freelancer / Creative</div>
            <div className="who-card-desc">Nigerian developers, designers, and consultants signing client contracts — often with
              IP traps, unlimited liability clauses, and unpaid scope creep provisions baked in.</div>
            <div className="who-card-pain">"The client owned everything I built. I had no idea."</div>
          </div>
          <div className="who-card" data-icon="🏪">
            <div className="who-card-type">Secondary User</div>
            <div className="who-card-title">The Market Trader / Supplier</div>
            <div className="who-card-desc">Informal economy operators entering supplier or distribution agreements, often with
              larger corporates who have legal teams on their side of the table.</div>
            <div className="who-card-pain">"They had a lawyer. I had a pen and a prayer."</div>
          </div>
          <div className="who-card" data-icon="⚖️">
            <div className="who-card-type">Partner Channel</div>
            <div className="who-card-title">The Human Consultant</div>
            <div className="who-card-desc">Legal professionals and business advisors who use ClearSight as a force multiplier —
              handling more clients with AI doing the first 97% of the analysis work.</div>
            <div className="who-card-pain">"I can only take 10 clients. With ClearSight, I can serve 50."</div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="landing-footer">
        <div>
          <div className="footer-logo">Clear<span>Sight</span></div>
          <div className="footer-tagline" style={{ marginTop: '0.5rem' }}>Nigeria · Legal AI Infrastructure</div>
        </div>
        <div className="footer-mission">
          Democratizing legal access for 40 million Nigerian SMBs — one contract at a time.
        </div>
      </footer>

      {/* ── AUTH MODAL ── */}
      {showAuthModal && (
        <div className="auth-modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div
            className="card-premium max-w-md w-full mx-auto relative group bg-paper border-none"
            onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
            style={{
              backgroundColor: 'var(--cream)',
              borderRadius: '8px',
              padding: '3rem 2rem',
              color: 'var(--ink)',
              fontFamily: 'var(--font-mono)'
            }}
          >
            <div className="absolute inset-0 bg-gold/5 blur-xl rounded-lg -z-10 pointer-events-none"></div>

            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-gray hover:text-ink text-xl"
            >
              ×
            </button>

            <div className="mb-8 text-center">
              <div className="w-12 h-12 mx-auto mb-4 border-2 border-gold rounded-full flex items-center justify-center relative">
                <div className="w-4 h-4 bg-gold rounded-full animate-pulse"></div>
              </div>
              <h3 className="font-playfair text-3xl font-black mb-2" style={{ color: 'var(--ink)' }}>
                {authMode === 'login' ? 'Welcome Back.' : 'Create Account.'}
              </h3>
              <p className="text-xs text-gray uppercase tracking-widest">
                {authMode === 'login' ? 'Access your legal vault' : 'Start protecting your business'}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-6">
              {errorMsg && (
                <div className="bg-rust/10 text-rust p-3 text-[10px] uppercase font-bold border-l-2 border-rust tracking-widest">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold mb-2 text-gray">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-transparent border-b border-ink/20 focus:border-ink pb-2 outline-none transition-colors text-sm text-ink"
                  placeholder="founder@startup.com.ng"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest font-bold mb-2 text-gray">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-transparent border-b border-ink/20 focus:border-ink pb-2 outline-none transition-colors text-sm text-ink"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isAuthLoading}
                className="w-full flex justify-center items-center py-4 mt-8 transition-transform bg-gold text-ink font-syne font-bold uppercase tracking-widest text-[11px]"
                style={{ background: 'var(--gold)', color: 'var(--ink)', border: 'none' }}
              >
                <span>{isAuthLoading ? 'Authenticating...' : (authMode === 'login' ? 'Sign In →' : 'Create Account →')}</span>
              </button>
            </form>

            <div className="mt-8 text-center pt-6 border-t border-ink/10">
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                className="text-[10px] uppercase font-bold tracking-widest text-gray hover:text-gold transition-colors"
              >
                {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Log in"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
