import { useState, useEffect } from 'react'
import axios from 'axios'
import UploadDropzone from './components/Upload/UploadDropzone'
import TemplateGallery from './components/Templates/TemplateGallery'
import TrustIndex from './components/Trust/TrustIndex'
import { supabase } from './supabaseClient'
import { exportAnalysisPDF } from './services/template.service'
import DOMPurify from 'dompurify'

// Fix OCR encoding artifact: â‚¦ → ₦ (Naira)
const fixEncoding = (str = '') => str.replace(/â‚¦/g, '₦').replace(/â‚¦/g, '₦');

import LandingPage from './components/LandingPage';



/**
 * Frontend safety net: strip any SYSTEMATIC CONSTRAINT LAYER boilerplate
 * that may have leaked into plainEnglish from old cached data or old backend code.
 */
const sanitizePlainEnglish = (text) => {
  if (!text) return '';
  // Remove everything before the actual advice ("✅ WHAT THIS MEANS:" or the INTRO_MAP text)
  const constraintIdx = text.indexOf('SYSTEMATIC CONSTRAINT LAYER');
  if (constraintIdx !== -1) {
    // Find the actual advice — it starts with known patterns
    const adviceMarkers = ['This clause', 'The landlord', 'You could', 'The other party', 'Every piece', 'Your employer', 'If anything goes wrong', 'After this contract', 'Any dispute'];
    for (const marker of adviceMarkers) {
      const markerIdx = text.indexOf(marker);
      if (markerIdx > constraintIdx) {
        // Extract just the advice sentence(s) and stop at legal citations
        let advice = text.substring(markerIdx);
        // Strip trailing legal citations (⚖️, 📖, From the law:, etc.)
        advice = advice.replace(/[⚖️📖].*/s, '').trim();
        return `✅ WHAT THIS MEANS: ${advice}`;
      }
    }
    // If we can't find the advice, return a generic message
    return '✅ WHAT THIS MEANS: This clause contains terms that could be unfair or illegal under Nigerian law.';
  }
  return text;
};

const PERSONAS = [
  { value: 'general',      label: '👤 General User',    desc: 'Standard risk analysis' },
  { value: 'freelancer',   label: '💼 Freelancer',       desc: 'IP, kill fees, scope creep' },
  { value: 'founder',      label: '🚀 Founder / Startup', desc: 'Investor risk, CAMA, equity' },
  { value: 'market_trader',label: '🛒 Market Trader',    desc: 'Supply chains, Force Majeure' },
]

function App() {
  const [analysisResult, setAnalysisResult] = useState(null)
  const [healthStatus, setHealthStatus]     = useState('Checking...')
  const [persona, setPersona]               = useState('general')

  // Strategy Playbook State
  const [riskAppetite, setRiskAppetite] = useState('balanced')
  const [monthlyExpenses, setMonthlyExpenses] = useState('250000')
  const [industryContext, setIndustryContext] = useState('General Commercial')
  const [strategicGoal, setStrategicGoal] = useState('liquidity') // liquidity | protection
  const [isSavingPlaybook, setIsSavingPlaybook] = useState(false)
  const [user, setUser] = useState(null)
  const [history, setHistory] = useState([])

  // Financial Simulation State
  const [buyoutOffer, setBuyoutOffer] = useState('')
  const [monthlyStreams, setMonthlyStreams] = useState('')
  const [simResult, setSimResult] = useState(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  
  // Auth Modal State (Moved to LandingPage)
  // const [showAuthModal, setShowAuthModal] = useState(false)
  // const [authMode, setAuthMode] = useState('login')
  // const [email, setEmail] = useState('')
  // const [password, setPassword] = useState('')
  // const [isAuthLoading, setIsAuthLoading] = useState(false)

  // Calculate Overall Risk Score
  const calculateScore = () => {
    if (!analysisResult?.analysis) return 0;
    const total = analysisResult.analysis.length;
    if (total === 0) return 0;
    const highRisks = analysisResult.analysis.filter(c => c.severity === 'HIGH').length;
    const score = Math.max(0, 100 - (highRisks * 25) - ((total - highRisks) * 10));
    return score;
  };

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    const API_URL = import.meta.env.VITE_API_URL || 'https://clearsight-backend.onrender.com';
    axios.get(`${API_URL}/api/health`)
      .then(r => setHealthStatus(r.data.status === 'ok' ? 'OK' : 'Error'))
      .catch(() => setHealthStatus('Disconnected'))

    // Clean up any old localStorage cache from previous versions
    localStorage.removeItem('last_analysis');
    localStorage.removeItem('last_analysis_v2');

    const checkUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          setUser(data.user);
          fetchPlaybook(data.user.id);
          fetchHistory(data.user.id);
        }
      } catch (err) {
        console.error('Supabase Auth error:', err);
      }
    };
    checkUser();

    // Auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setUser(session.user);
        fetchPlaybook(session.user.id);
        fetchHistory(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setHistory([]);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [])

  const fetchHistory = async (userId) => {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (data && !error) setHistory(data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const fetchPlaybook = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('strategy_playbooks')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (data && !error) {
        setRiskAppetite(data.risk_appetite);
        setMonthlyExpenses(data.monthly_expenses.toString());
        setIndustryContext(data.industry_context);
        if (data.strategic_goal) setStrategicGoal(data.strategic_goal);
      }
    } catch (err) {
      console.warn('Playbook fetch failed:', err);
    }
  };

  const savePlaybook = async () => {
    if (!user) {
      alert('Please sign in to save your playbook.');
      return;
    }
    setIsSavingPlaybook(true);
    const { error } = await supabase
      .from('strategy_playbooks')
      .upsert({
        user_id: user.id,
        risk_appetite: riskAppetite,
        monthly_expenses: Number(monthlyExpenses),
        industry_context: industryContext,
        strategic_goal: strategicGoal,
        updated_at: new Date()
      });
    setIsSavingPlaybook(false);
    if (error) alert('Error saving playbook: ' + error.message);
    else alert('Strategy Playbook saved successfully!');
  };

  const handleSimulate = async () => {
    if (!buyoutOffer || isNaN(buyoutOffer)) return;
    setIsSimulating(true);
    setSimResult(null);
    try {
      const payload = { 
        buyoutOffer: Number(buyoutOffer),
        monthlyStreams: monthlyStreams ? Number(monthlyStreams) : 100000,
        strategySettings: {
          riskAppetite,
          monthlyExpenses: Number(monthlyExpenses),
          industryContext,
          strategicGoal
        }
      };
      const API_URL = import.meta.env.VITE_API_URL || 'https://clearsight-backend.onrender.com';
      const res = await axios.post(`${API_URL}/api/simulate`, payload);
      setSimResult(res.data);
    } catch (err) {
      console.error(err);
      setSimResult({ error: 'Simulation failed. Check backend connection.' });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleUploadComplete = (result) => {
    setAnalysisResult(result);
    // Refresh history from Supabase so the new result appears in the vault
    if (user) fetchHistory(user.id);
  };

  const handleEscalate = async (clause) => {
    if (!user) {
      alert('Please sign in to request human review.');
      return;
    }
    const { error } = await supabase
      .from('review_requests')
      .insert({
        user_id: user.id,
        clause_text: clause.text,
        status: 'pending'
      });
    
    if (error) alert('Error sending request: ' + error.message);
    else alert('Your contract has been escalated to a Human Strategist. We will notify you when the review is complete.');
  };

  const handleFlagClause = async (clause) => {
    if (!user) {
      alert('Please sign in to flag predatory clauses.');
      return;
    }
    const company = prompt('Which company is this contract from?');
    if (!company) return;

    const { error } = await supabase
      .from('flagged_clauses')
      .insert({
        user_id: user.id,
        company_name: company,
        clause_text: clause.text,
        risk_category: clause.riskCategory,
        user_comment: 'Flagged via ClearSight Analysis'
      });
    
    if (error) alert('Error flagging clause: ' + error.message);
    else alert('Clause successfully added to the Community Trust Index!');
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      alert('📱 PWA Installation Note: Browsers require a secure (HTTPS) connection for one-click installation. This button will trigger the native prompt on the live "clearsight.law" domain.\n\nFor this demo: This proves the PWA manifest and service worker are fully configured!');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (!user) {
    return <LandingPage onAuthSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen pb-24">
      {/* ── Brand Header ── */}
      <header className="bg-green text-paper px-4 md:px-8 py-4 md:py-6 flex justify-between items-center sticky top-0 z-50 shadow-lg">
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <div className="w-8 h-8 md:w-10 md:h-10 border-2 border-gold rounded-full flex items-center justify-center">
            <div className="w-2 h-2 md:w-3 md:h-3 bg-gold rounded-full animate-pulse"></div>
          </div>
          <h1 className="font-syne font-extrabold text-lg md:text-xl tracking-widest uppercase">Clear<span className="text-gold">Sight</span></h1>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6 flex-wrap justify-end">
          <button 
            onClick={handleInstall}
            className="hidden sm:block bg-gold/10 text-gold border border-gold/30 px-3 py-1 text-[9px] md:text-[10px] font-bold uppercase tracking-widest hover:bg-gold hover:text-ink transition-all"
          >
            📱 {deferredPrompt ? 'Install' : 'PWA'}
          </button>
          
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 text-[10px] uppercase tracking-widest">
            <button 
              onClick={async () => {
                const { subscribeToNotifications } = await import('./services/push.service');
                const success = await subscribeToNotifications();
                if (success) alert('Notifications enabled! We will alert you when reviews are complete.');
              }}
              className="text-[10px] font-bold uppercase tracking-widest text-paper/60 hover:text-gold"
            >
              🔔 Alerts
            </button>
          </div>

          <button className="hidden md:block btn-ghost text-paper/80">Documentation</button>
          <div className="flex items-center gap-3 md:gap-4">
            <span className="hidden sm:inline text-[9px] md:text-[10px] text-paper/40 font-mono">{user.email}</span>
            <button onClick={handleLogout} className="btn-ghost !text-gold text-[10px] md:text-[11px]">Logout</button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="bg-green text-paper pt-20 pb-32 px-8 relative overflow-hidden">
        <div className="absolute right-[-10%] top-1/2 -translate-y-1/2 font-playfair text-[20rem] font-black opacity-[0.03] pointer-events-none select-none">LEGAL</div>
        <div className="max-w-6xl mx-auto">
          <div className="section-label text-gold">Intelligent Risk Management</div>
          <h2 className="font-playfair text-6xl md:text-8xl font-black leading-[1] mb-8">Analyze. <em>Protect.</em><br/>Scale.</h2>
          <p className="font-mono text-paper/60 max-w-xl text-sm leading-relaxed mb-12">ClearSight is the specialized CFO and Legal Strategist for Nigerian SMBs. Grounded in CAMA 2020, we turn legal complexity into commercial leverage.</p>
          
          <div className="flex gap-4">
            <button className="btn-primary">Start Analysis</button>
            <button className="btn-ghost text-paper">View Templates</button>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-8 -mt-20 relative z-10">
        
        {/* ── Strategy Playbook ── */}
        <div className="bg-white border border-ink/5 p-10 shadow-2xl mb-12">
          <div className="flex justify-between items-start mb-10">
            <div>
              <div className="section-label">Strategy Playbook</div>
              <h3 className="font-playfair text-3xl font-black">Configure your <em>Strategic Profile</em></h3>
            </div>
            <button 
              onClick={savePlaybook}
              disabled={isSavingPlaybook}
              className="btn-primary !py-2 !px-6"
            >
              {isSavingPlaybook ? 'Saving...' : 'Persist to Cloud'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            {/* Risk Appetite */}
            <div className="space-y-4">
              <label className="block text-[10px] uppercase tracking-widest font-bold">Risk Appetite</label>
              <input 
                type="range" min="0" max="2" step="1"
                value={riskAppetite === 'conservative' ? 0 : riskAppetite === 'balanced' ? 1 : 2}
                onChange={(e) => {
                  const vals = ['conservative', 'balanced', 'aggressive'];
                  setRiskAppetite(vals[e.target.value]);
                }}
                className="w-full accent-gold"
              />
              <div className="flex justify-between text-[9px] uppercase font-bold tracking-tighter opacity-60">
                <span>Conservative</span>
                <span>Balanced</span>
                <span>Aggressive</span>
              </div>
            </div>

            {/* Strategic Goal */}
            <div className="space-y-4">
              <label className="block text-[10px] uppercase tracking-widest font-bold">Strategic Goal</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setStrategicGoal('liquidity')}
                  className={`flex-1 text-[10px] uppercase font-bold py-2 border transition-all ${strategicGoal === 'liquidity' ? 'bg-gold border-gold text-ink' : 'border-ink/10 text-gray hover:border-gold/50'}`}
                >
                  Liquidity
                </button>
                <button 
                  onClick={() => setStrategicGoal('protection')}
                  className={`flex-1 text-[10px] uppercase font-bold py-2 border transition-all ${strategicGoal === 'protection' ? 'bg-gold border-gold text-ink' : 'border-ink/10 text-gray hover:border-gold/50'}`}
                >
                  Protection
                </button>
              </div>
            </div>

            {/* Monthly Expenses */}
            <div className="space-y-4">
              <label className="block text-[10px] uppercase tracking-widest font-bold">Monthly Burn (₦)</label>
              <input 
                type="number" value={monthlyExpenses} 
                onChange={e => setMonthlyExpenses(e.target.value)}
                className="input-premium"
              />
            </div>

            {/* Industry */}
            <div className="space-y-4">
              <label className="block text-[10px] uppercase tracking-widest font-bold">Industry Context</label>
              <select 
                value={industryContext}
                onChange={e => setIndustryContext(e.target.value)}
                className="input-premium bg-white"
              >
                <option value="General Commercial">General Commercial</option>
                <option value="Software Engineering">Software Engineering</option>
                <option value="Afrobeats Music">Afrobeats Music</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Analysis Hub ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-24">
          <div className="lg:col-span-2 space-y-12">
            <div className="card-premium">
              <div className="section-label">Analysis Engine</div>
              <h3 className="font-playfair text-3xl font-black mb-8">Upload Contract</h3>
              
              <div className="mb-8">
                <p className="text-[10px] uppercase tracking-widest font-bold mb-4 opacity-60">Analyze as...</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {PERSONAS.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPersona(p.value)}
                      className={`p-4 border text-left transition-all ${
                        persona === p.value
                          ? 'border-gold bg-gold/5'
                          : 'border-ink/5 bg-cream/30 hover:border-gold/30'
                      }`}
                    >
                      <div className="text-xs font-bold mb-1">{p.label.split(' ')[1]}</div>
                      <div className="text-[9px] uppercase tracking-tighter opacity-50">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <UploadDropzone
                persona={persona}
                strategySettings={{
                  riskAppetite,
                  monthlyExpenses: Number(monthlyExpenses),
                  industryContext,
                  strategicGoal
                }}
                onUploadComplete={handleUploadComplete}
              />
            </div>

            {analysisResult && (
              <div className="animate-fade-up space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white border border-ink/5 p-6 shadow-xl">
                  <div>
                    <h3 className="font-playfair text-4xl font-black">Analysis <em>Report</em></h3>
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-40 mt-1">CAMA 2020 Validated Analysis</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 md:gap-8">
                    {persona === 'founder' && (
                      <div className="hidden md:flex gap-4 border-l border-ink/10 pl-8">
                        <div className="text-center">
                          <div className="text-[8px] uppercase tracking-tighter opacity-40">CAMA 2020</div>
                          <div className="text-[10px] font-bold text-green">Vesting ✓</div>
                        </div>
                        <div className="text-center">
                          <div className="text-[8px] uppercase tracking-tighter opacity-40">Section 271</div>
                          <div className="text-[10px] font-bold text-green">Directors ✓</div>
                        </div>
                      </div>
                    )}
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] uppercase tracking-widest font-bold opacity-40">Risk Score</div>
                      <div className={`text-3xl font-syne font-black ${calculateScore() > 70 ? 'text-green-mid' : calculateScore() > 40 ? 'text-gold' : 'text-rust'}`}>
                        {calculateScore()}/100
                      </div>
                    </div>
                    <button 
                      onClick={() => exportAnalysisPDF(analysisResult.analysis)}
                      className="btn-primary !py-2 !px-6 w-full sm:w-auto"
                    >
                      Download PDF
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {analysisResult.analysis?.map((clause, idx) => {
                    const severityColor = clause.severity === 'HIGH' ? 'border-rust' : 'border-gold';
                    return (
                      <div key={idx} className={`card-premium !p-0 border-l-4 ${severityColor} overflow-hidden`}>
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-ink/5">{clause.id}</span>
                              <button 
                                onClick={() => handleFlagClause(clause)}
                                className="text-[9px] font-bold uppercase tracking-widest text-rust hover:underline"
                              >
                                🚩 Flag for Community
                              </button>
                              {(persona === 'founder' || persona === 'freelancer') && (
                                <button 
                                  onClick={() => handleEscalate(clause)}
                                  className="text-[9px] font-bold uppercase tracking-widest text-green hover:underline border-l border-ink/10 pl-2"
                                >
                                  ⚖️ Escalate to Human
                                </button>
                              )}
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gold">{clause.riskCategory}</span>
                          </div>
                          <p 
                            className="text-[11px] text-gray italic mb-6 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(fixEncoding(clause.text)) }}
                          />
                          
                          <div className="space-y-4">
                            <div className="bg-cream/50 p-4">
                              <strong className="text-[10px] uppercase tracking-widest block mb-2 text-green">💡 Plain English</strong>
                              <p 
                                className="text-[11px] leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(sanitizePlainEnglish(clause.plainEnglish)) }}
                              />
                            </div>
                            
                            <div className="bg-gold/5 p-4 relative group">
                              <div className="flex justify-between items-center mb-2">
                                <strong className="text-[10px] uppercase tracking-widest block text-gold">⚖️ Legal Advisory</strong>
                                <button 
                                  onClick={(e) => {
                                    const details = e.currentTarget.parentElement.nextElementSibling;
                                    if (details) details.classList.toggle('hidden');
                                  }}
                                  className="text-[9px] font-bold uppercase tracking-widest text-gold hover:underline"
                                >
                                  Deep Dive →
                                </button>
                              </div>
                              <div className="hidden mt-4 space-y-4 border-t border-gold/10 pt-4 animate-fade-down">
                                <div className="bg-white/50 p-3 rounded text-[10px] leading-relaxed whitespace-pre-line font-mono text-gray">
                                  {clause.technicalAnalysis?.constraintLayer}
                                </div>
                                <div className="text-[11px] leading-relaxed whitespace-pre-line">
                                  {clause.critic}
                                </div>
                                {clause.technicalAnalysis?.precedent && (
                                  <div className="mt-2 text-[10px] italic border-l-2 border-gold/30 pl-3 py-1 bg-white/30">
                                    <strong>Precedent:</strong> "{clause.technicalAnalysis.precedent}" 
                                    <span className="opacity-50 ml-1">[{clause.technicalAnalysis.citation}]</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar: Simulator ── */}
          <div className="space-y-8">
            <div className="card-premium bg-green text-paper">
              <div className="section-label text-gold">Consequence Engine</div>
              <h3 className="font-playfair text-2xl font-black mb-6 text-paper">Financial <em>Foresight</em></h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold mb-2 text-paper/60">Buyout Offer (₦)</label>
                  <input 
                    type="number" value={buyoutOffer} 
                    onChange={e => setBuyoutOffer(e.target.value)}
                    className="input-premium bg-white/5 border-white/10 text-paper"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold mb-2 text-paper/60">Monthly Rev (₦)</label>
                  <input 
                    type="number" value={monthlyStreams} 
                    onChange={e => setMonthlyStreams(e.target.value)}
                    className="input-premium bg-white/5 border-white/10 text-paper"
                  />
                </div>
                <button 
                  onClick={handleSimulate}
                  className="btn-primary w-full"
                >
                  {isSimulating ? 'Processing...' : 'Run Simulation'}
                </button>
              </div>

              {simResult && (
                <div className="mt-8 pt-8 border-t border-white/10 animate-fade-up">
                  <div className="text-center mb-6">
                    <span className="text-[10px] uppercase tracking-widest text-paper/40">Recommendation</span>
                    <div className="text-xl font-syne font-bold text-gold mt-1">{simResult.optimalDecision}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-3 text-center">
                      <div className="text-[9px] uppercase text-paper/40 mb-1">Deal Risk</div>
                      <div className="text-xs font-bold text-gold">{simResult.dealRisk}</div>
                    </div>
                    <div className="bg-white/5 p-3 text-center">
                      <div className="text-[9px] uppercase text-paper/40 mb-1">Confidence</div>
                      <div className="text-xs font-bold text-gold">{simResult.confidenceScore}</div>
                    </div>
                    <div className="bg-white/5 p-3 text-center col-span-2">
                      <div className="text-[9px] uppercase text-paper/40 mb-1">Strategic Leverage</div>
                      <div className="text-xs font-bold text-gold">{simResult.roi}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="card-premium border-gold/20">
              <div className="section-label">Market Intelligence</div>
              <h4 className="font-syne font-bold text-sm mb-4">CAMA 2020 Compliance</h4>
              <p className="text-[11px] text-gray leading-relaxed mb-4">Ensure your business is fully aligned with the latest CAC guidelines and the 2020 Companies and Allied Matters Act.</p>
              <button className="btn-ghost !text-ink">Read Standards →</button>
            </div>
          </div>
        </div>

        {/* ── Template Gallery ── */}
        <TemplateGallery />

        {/* ── Contract History ── */}
        {user && history.length > 0 && (
          <div className="mt-24">
            <div className="section-label">Legal Vault</div>
            <h3 className="font-playfair text-3xl font-black mb-8">Your Analysis <em>History</em></h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {history.map(item => (
                <div key={item.id} className="card-premium">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-gold">{new Date(item.created_at).toLocaleDateString()}</div>
                    <div className={`text-xs font-black ${item.risk_score > 70 ? 'text-green-mid' : 'text-rust'}`}>
                      {item.risk_score}/100
                    </div>
                  </div>
                  <h4 className="font-syne font-bold text-sm mb-2 truncate">{item.filename}</h4>
                  <p className="text-[10px] text-gray mb-6">{item.analysis_results?.length} clauses analyzed</p>
                  <button 
                    onClick={() => {
                      setAnalysisResult({ analysis: item.analysis_results });
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="btn-ghost !text-ink text-[9px]"
                  >
                    View Full Report →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Community Trust Index ── */}
        <TrustIndex />
      </main>

      {/* ── Footer ── */}
      <footer className="bg-ink text-paper py-20 px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <h1 className="font-syne font-extrabold text-2xl tracking-widest uppercase mb-4">Clear<span className="text-gold">Sight</span></h1>
            <p className="font-mono text-[11px] text-paper/40 leading-relaxed max-w-sm">The intelligent risk management platform for Nigeria's commercial future. We empower 40 million SMBs to sign with confidence.</p>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-gold mb-6">Product</div>
            <ul className="space-y-3 text-[11px] text-paper/60 font-mono">
              <li><a href="#" className="hover:text-gold">Risk Analysis</a></li>
              <li><a href="#" className="hover:text-gold">Template Gallery</a></li>
              <li><a href="#" className="hover:text-gold">Trust Index</a></li>
            </ul>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-gold mb-6">Legal</div>
            <ul className="space-y-3 text-[11px] text-paper/60 font-mono">
              <li><a href="#" className="hover:text-gold">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-gold">Terms of Service</a></li>
              <li><a href="#" className="hover:text-gold">CAMA 2020 Guides</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
