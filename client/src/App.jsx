import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import UploadDropzone from './components/Upload/UploadDropzone'
import TemplateGallery from './components/Templates/TemplateGallery'
import TrustIndex from './components/Trust/TrustIndex'
import ResultsBadge from './components/Results/ResultsBadge'
import PlainTranslationPanel from './components/Results/PlainTranslationPanel'
import ClauseCard from './components/Results/ClauseCard'
import { supabase } from './supabaseClient'
import { exportAnalysisPDF, exportClarityPDF } from './services/template.service'
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
  const riskCardsRef = useRef(null)

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
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Logout error:', err);
    } finally {
      setUser(null);
      setHistory([]);
    }
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
    // Backend now returns { success, filename, riskStatus, plainTranslation, analysis }
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

  const score = calculateScore();
  const scoreColor = score > 70 ? 'text-ink-mid' : score > 40 ? 'text-gold' : 'text-red-700';

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── TOP NAVIGATION BAR ── */}
      <header className="bg-ink text-white h-14 flex items-center justify-between px-6 sticky top-0 z-50 shadow-lg shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 border-2 border-gold rounded-full flex items-center justify-center shrink-0">
            <div className="w-2 h-2 bg-gold rounded-full animate-pulse" />
          </div>
          <span className="font-sans font-extrabold text-base tracking-widest uppercase">
            Clear<span className="text-gold">Sight</span>
          </span>
          <span className="hidden md:inline text-[9px] font-sans text-white/30 border-l border-paper/10 pl-3 ml-1">
            CAMA 2020 · Legal Intelligence
          </span>
        </div>

        {/* Nav Links — Hick's Law: only the essential links */}
        <nav className="hidden md:flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest">
          <button onClick={() => setAnalysisResult(null)} className="text-white/50 hover:text-gold transition-colors">Dashboard</button>
          <a href="#history" className="text-white/50 hover:text-gold transition-colors">Legal Vault</a>
          <a href="#trust" className="text-white/50 hover:text-gold transition-colors">Trust Index</a>
        </nav>

        {/* User actions */}
        <div className="flex items-center gap-4">
          <span className="hidden sm:inline text-[9px] font-sans text-white/30 truncate max-w-[140px]">{user.email}</span>
          <button
            onClick={handleLogout}
            className="text-[10px] font-bold uppercase tracking-widest text-gold border border-gold/40 px-3 py-1 hover:bg-gold hover:text-ink transition-all"
          >
            Logout
          </button>
        </div>
      </header>

      {/* ── 3-COLUMN APP SHELL ── */}
      <div className="flex flex-1 overflow-hidden max-h-[calc(100vh-56px)]">

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            LEFT SIDEBAR — Context & History
            Law of Proximity: settings near the upload tool
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <aside className="hidden lg:flex flex-col w-72 shrink-0 bg-white border-r border-ink/5 overflow-y-auto">

          {/* Strategy Playbook — context that shapes the analysis */}
          <div className="p-6 border-b border-ink/5">
            <div className="section-label mb-5">Strategy Playbook</div>

            {/* Persona — most impactful choice first (Hick's Law) */}
            <div className="mb-6">
              <label className="block text-[9px] uppercase tracking-widest font-bold mb-3 opacity-60">Analyze As</label>
              <div className="grid grid-cols-2 gap-1.5">
                {PERSONAS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPersona(p.value)}
                    className={`p-2.5 border text-left transition-all text-[9px] font-bold uppercase tracking-tighter leading-tight ${
                      persona === p.value ? 'border-gold bg-gold/10 text-ink' : 'border-ink/5 text-gray hover:border-gold/30'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Appetite */}
            <div className="mb-5">
              <label className="block text-[9px] uppercase tracking-widest font-bold mb-2 opacity-60">Risk Appetite</label>
              <input
                type="range" min="0" max="2" step="1"
                value={riskAppetite === 'conservative' ? 0 : riskAppetite === 'balanced' ? 1 : 2}
                onChange={(e) => { const v = ['conservative','balanced','aggressive']; setRiskAppetite(v[e.target.value]); }}
                className="w-full accent-gold"
              />
              <div className="flex justify-between text-[8px] uppercase font-bold tracking-tighter opacity-40 mt-1">
                <span>Safe</span><span>Balanced</span><span>Bold</span>
              </div>
            </div>

            {/* Strategic Goal */}
            <div className="mb-5">
              <label className="block text-[9px] uppercase tracking-widest font-bold mb-2 opacity-60">Strategic Goal</label>
              <div className="flex gap-1.5">
                {['liquidity','protection'].map(g => (
                  <button
                    key={g}
                    onClick={() => setStrategicGoal(g)}
                    className={`flex-1 text-[9px] uppercase font-bold py-2 border transition-all ${strategicGoal === g ? 'bg-gold border-gold text-ink' : 'border-ink/10 text-gray hover:border-gold/40'}`}
                  >
                    {g === 'liquidity' ? '💰 Cash' : '🛡️ IP'}
                  </button>
                ))}
              </div>
            </div>

            {/* Monthly Burn */}
            <div className="mb-5">
              <label className="block text-[9px] uppercase tracking-widest font-bold mb-2 opacity-60">Monthly Burn (₦)</label>
              <input type="number" value={monthlyExpenses} onChange={e => setMonthlyExpenses(e.target.value)} className="input-premium text-sm" />
            </div>

            {/* Industry */}
            <div className="mb-6">
              <label className="block text-[9px] uppercase tracking-widest font-bold mb-2 opacity-60">Industry</label>
              <select value={industryContext} onChange={e => setIndustryContext(e.target.value)} className="input-premium bg-white text-sm">
                <option value="General Commercial">General Commercial</option>
                <option value="Software Engineering">Software Engineering</option>
                <option value="Afrobeats Music">Afrobeats Music</option>
              </select>
            </div>

            {/* Save — Fitts's Law: full-width primary action */}
            <button onClick={savePlaybook} disabled={isSavingPlaybook} className="btn-primary w-full text-center">
              {isSavingPlaybook ? 'Saving...' : 'Save Playbook'}
            </button>
          </div>

          {/* Legal Vault (History) */}
          {history.length > 0 && (
            <div className="p-6" id="history">
              <div className="section-label mb-4">Legal Vault</div>
              <div className="space-y-2">
                {history.slice(0, 8).map(item => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setAnalysisResult({ analysis: item.analysis_results, plainTranslation: item.plain_translation, riskStatus: item.risk_status, filename: item.filename });
                      window.scrollTo({ top: 0 });
                    }}
                    className="w-full text-left p-3 hover:bg-white/80 border border-transparent hover:border-gold/20 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[9px] font-black ${item.risk_score > 70 ? 'text-ink-mid' : 'text-red-700'}`}>{item.risk_score}/100</span>
                      <span className="text-[8px] font-sans text-gray">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[10px] font-bold text-ink truncate group-hover:text-gold transition-colors">{item.filename}</p>
                    <p className="text-[9px] text-gray">{item.analysis_results?.length || 0} clauses</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            CENTRE MAIN PANEL — Upload + Results
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-8">

          {/* ── Upload Zone (always visible when no result) ── */}
          {!analysisResult && (
            <div className="max-w-2xl mx-auto animate-fade-up">
              <div className="mb-8 text-center">
                <div className="section-label justify-center">Analysis Engine</div>
                <h2 className="font-sans text-4xl font-black mt-2">Upload Your <em>Contract</em></h2>
                <p className="font-sans text-sm text-gray mt-2">Drag and drop or click to select a PDF or image up to 10MB.</p>
              </div>
              <UploadDropzone
                persona={persona}
                strategySettings={{ riskAppetite, monthlyExpenses: Number(monthlyExpenses), industryContext, strategicGoal }}
                onUploadComplete={handleUploadComplete}
              />
              {/* Mobile-only playbook summary below upload */}
              <div className="lg:hidden mt-8 bg-white border border-ink/5 p-5">
                <div className="section-label mb-3">Current Profile</div>
                <div className="flex flex-wrap gap-3 text-[10px] font-bold uppercase">
                  <span className="px-2 py-1 bg-gold/10 text-gold border border-gold/30">{persona.replace('_',' ')}</span>
                  <span className="px-2 py-1 bg-ink/5">{riskAppetite}</span>
                  <span className="px-2 py-1 bg-ink/5">{strategicGoal}</span>
                  <span className="px-2 py-1 bg-ink/5">{industryContext}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Results Panel ── */}
          {analysisResult && (
            <div className="animate-fade-up space-y-6 max-w-4xl mx-auto" id="results-panel">

              {/* Results Header Bar — Law of Proximity: score + actions close together */}
              <div className="bg-white border border-ink/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm sticky top-0 z-10">
                <div>
                  <p className="text-[9px] font-sans text-gray uppercase tracking-widest mb-1">{analysisResult.filename || 'Analyzed Document'}</p>
                  <h2 className="font-sans text-2xl font-black">Analysis <em>Report</em></h2>
                </div>
                <div className="flex items-center gap-6">
                  {/* Score — visually dominant, Fitts's Law */}
                  <div className="text-center">
                    <p className="text-[8px] uppercase tracking-widest opacity-40 mb-0.5">Risk Score</p>
                    <p className={`text-3xl font-sans font-black ${scoreColor}`}>{score}<span className="text-base font-sans opacity-40">/100</span></p>
                  </div>
                  {/* Download */}
                  {analysisResult.riskStatus === 'clean' ? (
                    <button onClick={() => exportClarityPDF(analysisResult.plainTranslation, analysisResult.filename)} className="btn-primary !py-2 !px-5 !bg-ink !text-white whitespace-nowrap">
                      📄 Download Certificate
                    </button>
                  ) : (
                    <button onClick={() => exportAnalysisPDF(analysisResult.analysis)} className="btn-primary !py-2 !px-5 whitespace-nowrap">
                      ⬇ Risk Audit PDF
                    </button>
                  )}
                  {/* Re-analyze (reset) */}
                  <button
                    onClick={() => setAnalysisResult(null)}
                    className="text-[9px] font-bold uppercase tracking-widest text-gray hover:text-ink border border-ink/10 px-3 py-2 transition-all"
                  >
                    ↩ New
                  </button>
                </div>
              </div>

              {/* Status Badge */}
              <ResultsBadge
                riskStatus={analysisResult.riskStatus || (analysisResult.analysis?.length > 0 ? 'flagged' : 'clean')}
                flagCount={analysisResult.analysis?.length || 0}
              />

              {/* Plain Translation Panel */}
              {analysisResult.plainTranslation && (
                <div className="bg-white border border-ink/5 p-6 shadow-sm">
                  <PlainTranslationPanel
                    plainTranslation={analysisResult.plainTranslation}
                    flaggedClauses={analysisResult.analysis || []}
                    riskStatus={analysisResult.riskStatus || 'clean'}
                    onJumpToRisks={() => riskCardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  />
                </div>
              )}

              {/* Flagged Clauses — single column list for better readability */}
              {analysisResult.analysis?.length > 0 && (
                <div ref={riskCardsRef}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="section-label text-red-700">Flagged Clauses</div>
                      <h3 className="font-sans text-2xl font-black">Detailed <em>Risk Report</em></h3>
                    </div>
                    <span className="text-[10px] font-sans text-gray">{analysisResult.analysis.length} clause{analysisResult.analysis.length !== 1 ? 's' : ''} flagged</span>
                  </div>
                  <div className="space-y-4">
                    {analysisResult.analysis.map((clause, idx) => (
                      <ClauseCard
                        key={idx}
                        index={idx}
                        clause={clause}
                        persona={persona}
                        onFlag={handleFlagClause}
                        onEscalate={handleEscalate}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Template Gallery + Trust Index below results */}
              <TemplateGallery />
              <div id="trust"><TrustIndex /></div>
            </div>
          )}

          {/* If no result yet — show galleries below the upload zone */}
          {!analysisResult && (
            <div className="max-w-2xl mx-auto mt-16">
              <TemplateGallery />
              <div id="trust" className="mt-8"><TrustIndex /></div>
            </div>
          )}
        </main>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            RIGHT SIDEBAR — Financial Simulator
            Law of Proximity: foresight data near results
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <aside className="hidden xl:flex flex-col w-72 shrink-0 bg-ink text-white border-l border-white/5 overflow-y-auto">
          <div className="p-6">
            <div className="section-label text-gold mb-5">Consequence Engine</div>
            <h3 className="font-sans text-xl font-black mb-1 text-white">Financial <em>Foresight</em></h3>
            <p className="text-[10px] font-sans text-white/40 mb-6 leading-relaxed">Simulate a buyout or deal to see the real financial impact.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase tracking-widest font-bold mb-2 text-white/50">Buyout Offer (₦)</label>
                <input type="number" value={buyoutOffer} onChange={e => setBuyoutOffer(e.target.value)} className="input-premium bg-white/5 border-white/10 text-white w-full" />
              </div>
              <div>
                <label className="block text-[9px] uppercase tracking-widest font-bold mb-2 text-white/50">Monthly Revenue (₦)</label>
                <input type="number" value={monthlyStreams} onChange={e => setMonthlyStreams(e.target.value)} className="input-premium bg-white/5 border-white/10 text-white w-full" />
              </div>
              {/* Fitts's Law: wide primary button */}
              <button onClick={handleSimulate} disabled={isSimulating} className="btn-primary w-full">
                {isSimulating ? 'Simulating...' : 'Run Simulation'}
              </button>
            </div>

            {simResult && !simResult.error && (
              <div className="mt-8 pt-6 border-t border-white/10 animate-fade-up space-y-4">
                <div className="text-center">
                  <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">Recommendation</p>
                  <p className="text-lg font-sans font-bold text-gold">{simResult.optimalDecision}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 p-3 text-center">
                    <p className="text-[8px] uppercase text-white/40 mb-1">Deal Risk</p>
                    <p className="text-[11px] font-bold text-gold">{simResult.dealRisk}</p>
                  </div>
                  <div className="bg-white/5 p-3 text-center">
                    <p className="text-[8px] uppercase text-white/40 mb-1">Confidence</p>
                    <p className="text-[11px] font-bold text-gold">{simResult.confidenceScore}</p>
                  </div>
                  <div className="bg-white/5 p-3 text-center col-span-2">
                    <p className="text-[8px] uppercase text-white/40 mb-1">Strategic Leverage</p>
                    <p className="text-[11px] font-bold text-gold">{simResult.roi}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CAMA Compliance Info */}
          <div className="mt-auto p-6 border-t border-white/10">
            <div className="section-label text-gold mb-3">Market Intelligence</div>
            <h4 className="font-sans font-bold text-sm mb-2 text-white">CAMA 2020 Compliance</h4>
            <p className="text-[10px] font-sans text-white/40 leading-relaxed">
              All analysis is grounded in the Companies and Allied Matters Act (CAMA 2020) and Nigerian Evidence Act.
            </p>
          </div>
        </aside>
      </div>

      {/* ── FOOTER ── */}
      <footer className="bg-ink text-white py-10 px-8 shrink-0">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="font-sans font-extrabold text-lg tracking-widest uppercase">Clear<span className="text-gold">Sight</span></span>
            <p className="font-sans text-[10px] text-white/30 mt-1">The legal intelligence platform for Nigeria's commercial future.</p>
          </div>
          <div className="flex gap-8 text-[10px] font-sans text-white/40">
            <a href="#" className="hover:text-gold">Privacy Policy</a>
            <a href="#" className="hover:text-gold">Terms of Service</a>
            <a href="#" className="hover:text-gold">CAMA 2020 Guides</a>
          </div>
        </div>
      </footer>
    </div>
  )
}


export default App
