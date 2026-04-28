import { useState, useEffect } from 'react'
import axios from 'axios'
import UploadDropzone from './components/Upload/UploadDropzone'

// Fix OCR encoding artifact: â‚¦ → ₦ (Naira)
const fixEncoding = (str = '') => str.replace(/â‚¦/g, '₦').replace(/â‚¦/g, '₦');

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

  // Financial Simulation State
  const [buyoutOffer, setBuyoutOffer] = useState('')
  const [monthlyStreams, setMonthlyStreams] = useState('')
  const [simResult, setSimResult] = useState(null)
  const [isSimulating, setIsSimulating] = useState(false)

  const handleSimulate = async () => {
    if (!buyoutOffer || isNaN(buyoutOffer)) return;
    setIsSimulating(true);
    setSimResult(null);
    try {
      const payload = { 
        buyoutOffer: Number(buyoutOffer),
        monthlyStreams: monthlyStreams ? Number(monthlyStreams) : 100000 
      };
      const res = await axios.post('http://localhost:5000/api/simulate', payload);
      setSimResult(res.data);
    } catch (err) {
      console.error(err);
      setSimResult({ error: 'Simulation failed. Check backend connection.' });
    } finally {
      setIsSimulating(false);
    }
  }

  useEffect(() => {
    axios.get('http://localhost:5000/api/health')
      .then(r => setHealthStatus(r.data.status === 'ok' ? 'OK' : 'Error'))
      .catch(() => setHealthStatus('Disconnected'))
  }, [])

  return (
    <div className="min-h-screen bg-cream text-ink font-mono pb-12">
      {/* Header */}
      <header className="border-b border-ink/10 p-6 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-xl font-syne font-bold tracking-widest uppercase">Clear<span className="text-gold">Sight</span></h1>
        <div className="flex items-center space-x-2 text-xs">
          <div className={`w-2 h-2 rounded-full ${healthStatus === 'OK' ? 'bg-teal' : healthStatus === 'Checking...' ? 'bg-gold animate-pulse' : 'bg-accent'}`}></div>
          <span className="uppercase tracking-widest opacity-60">System {healthStatus}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-12">
        <div className="text-center mb-10">
          <h2 className="font-playfair text-4xl md:text-5xl font-black mb-4">Analyze any contract.<br/><em>In seconds.</em></h2>
          <p className="text-mid max-w-2xl mx-auto">Upload a PDF or image of a contract. Our AI will extract the clauses, flag hidden risks, and provide Advocate-Critic analysis grounded in Nigerian Law.</p>
        </div>

        {/* ── Persona Selector ── */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-mid mb-3 text-center">I am analyzing this contract as a...</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PERSONAS.map(p => (
              <button
                key={p.value}
                onClick={() => setPersona(p.value)}
                className={`p-3 rounded border text-left transition-all ${
                  persona === p.value
                    ? 'border-gold bg-gold/10 text-ink shadow-sm'
                    : 'border-ink/10 bg-white text-mid hover:border-gold/50'
                }`}
              >
                <div className="text-sm font-syne font-bold mb-0.5">{p.label}</div>
                <div className="text-xs opacity-60">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <UploadDropzone
          persona={persona}
          onUploadComplete={(result) => setAnalysisResult(result)}
        />

        {/* ── Financial Foresight Simulator ── */}
        <div className="mt-12 bg-white border border-gold p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-gold"></div>
          <h3 className="font-syne font-bold text-xl text-ink mb-2">Music Royalty Consequence Engine</h3>
          <p className="text-sm text-mid mb-6 max-w-2xl">Use Monte Carlo simulations to weigh a one-time buyout offer against long-term royalties. Adjusted for Nigerian inflation and a 33% historical judicial success rate.</p>
          
          <div className="flex flex-col md:flex-row gap-4 items-end mb-6">
            <div className="w-full md:w-1/3">
              <label className="block text-xs uppercase tracking-widest text-mid mb-2">Buyout Offer (₦)</label>
              <input 
                type="number" 
                value={buyoutOffer} 
                onChange={e => setBuyoutOffer(e.target.value)}
                placeholder="e.g. 12000000"
                className="w-full border border-ink/20 p-3 rounded focus:outline-none focus:border-gold"
              />
            </div>
            <div className="w-full md:w-1/3">
              <label className="block text-xs uppercase tracking-widest text-mid mb-2">Monthly Streams</label>
              <input 
                type="number" 
                value={monthlyStreams} 
                onChange={e => setMonthlyStreams(e.target.value)}
                placeholder="e.g. 100000"
                className="w-full border border-ink/20 p-3 rounded focus:outline-none focus:border-gold"
              />
            </div>
            <button 
              onClick={handleSimulate}
              disabled={isSimulating || !buyoutOffer}
              className="w-full md:w-1/3 bg-gold text-ink font-syne font-bold uppercase tracking-widest px-8 py-3 rounded hover:bg-gold/90 transition-colors disabled:opacity-50"
            >
              {isSimulating ? 'Simulating...' : 'Run Simulation'}
            </button>
          </div>

          {simResult && !simResult.error && (
            <div className="bg-cream/50 p-6 border border-ink/10 rounded">
              <div className="mb-6 text-center border-b border-ink/10 pb-4">
                <span className="text-xs uppercase tracking-widest text-mid block mb-1">Optimal Decision</span>
                <strong className="text-2xl font-syne text-teal">{simResult.optimalDecision}</strong>
              </div>

              {/* Triple-Threat Dashboard */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* RISK - Market Danger */}
                <div className="p-4 bg-slate-800 rounded-lg border-b-4 border-yellow-500 shadow-md">
                  <p className="text-[10px] uppercase tracking-tighter text-slate-400 font-bold">Deal Risk</p>
                  <p className="text-2xl font-bold text-yellow-400">{simResult.dealRisk}</p>
                  <p className="text-[9px] text-slate-500 mt-1">Market Volatility Factor</p>
                </div>

                {/* SAFETY - Personal Security */}
                <div className="p-4 bg-slate-800 rounded-lg border-b-4 border-green-500 shadow-md">
                  <p className="text-[10px] uppercase tracking-tighter text-slate-400 font-bold">Safety Level</p>
                  <p className={`text-2xl font-bold ${simResult.safetyColor}`}>{simResult.safetyLevel}</p>
                  <p className="text-[9px] text-slate-500 mt-1">Covers ~{simResult.monthsCovered} months expenses</p>
                </div>

                {/* CONFIDENCE - AI Accuracy */}
                <div className="p-4 bg-slate-800 rounded-lg border-b-4 border-blue-500 shadow-md">
                  <p className="text-[10px] uppercase tracking-tighter text-slate-400 font-bold">AI Confidence</p>
                  <p className="text-2xl font-bold text-blue-400">{simResult.confidenceScore}</p>
                  <p className="text-[9px] text-slate-500 mt-1">Based on Live SCN Data</p>
                </div>
              </div>

              <p className="text-sm text-ink/80 leading-relaxed bg-white p-4 border border-ink/5 rounded-md italic">"{simResult.foresightSummary}"</p>
            </div>
          )}
          {simResult?.error && (
            <div className="text-red-500 text-sm mt-4 p-4 bg-red-50 border border-red-200">{simResult.error}</div>
          )}
        </div>

        {analysisResult && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-syne font-bold text-2xl">Analysis Results</h3>
              {analysisResult.persona && (
                <span className="text-xs bg-gold/10 text-gold border border-gold/30 px-3 py-1 rounded-full uppercase tracking-widest">
                  {PERSONAS.find(p => p.value === analysisResult.persona)?.label || analysisResult.persona}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Preview */}
              <div className="bg-white border border-ink/10 p-6 shadow-sm">
                <h4 className="font-mono text-xs uppercase tracking-widest text-gold mb-4 border-b border-ink/10 pb-2">Extracted Text Preview</h4>
                <p className="text-sm text-mid whitespace-pre-wrap">{fixEncoding(analysisResult.extractedTextPreview)}</p>
              </div>

              {/* Clauses */}
              <div className="space-y-4">
                <h4 className="font-mono text-xs uppercase tracking-widest text-accent mb-4 border-b border-ink/10 pb-2">Flagged Clauses ({analysisResult.analysis?.length || 0})</h4>

                {analysisResult.analysis && analysisResult.analysis.length > 0 ? (
                  analysisResult.analysis.map((clause, idx) => {
                    const severityColor = clause.severity === 'HIGH' ? 'border-red-500' : clause.severity === 'MEDIUM' ? 'border-gold' : 'border-teal'
                    const severityBadge = clause.severity === 'HIGH' ? 'bg-red-100 text-red-700' : clause.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' : 'bg-teal/10 text-teal'
                    return (
                      <div key={idx} className={`bg-white border-l-4 ${severityColor} p-5 shadow-sm`}>
                        {/* Header Row */}
                        <div className="flex justify-between items-start mb-3 gap-2 flex-wrap">
                          <span className="font-syne font-bold text-sm">{clause.id}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded ${severityBadge}`}>{clause.severity || 'MEDIUM'}</span>
                            <span className="text-xs uppercase tracking-widest bg-accent/10 text-accent px-2 py-0.5 rounded">{clause.riskCategory}</span>
                            <span className="text-xs text-mid font-mono">{clause.confidence}%</span>
                          </div>
                        </div>

                        {/* Clause Text */}
                        <p className="text-xs text-ink/70 mb-4 italic border-l-2 border-ink/10 pl-3 line-clamp-3">"{fixEncoding(clause.text)}"</p>

                        {/* ── Plain English Summary ── */}
                        {clause.plainEnglish && (
                          <div className="mb-3 bg-emerald-50 border border-emerald-200 rounded p-4">
                            <strong className="text-emerald-800 text-xs uppercase tracking-widest block mb-2">💬 What This Means For You</strong>
                            <p className="text-emerald-900 text-xs leading-relaxed whitespace-pre-line">{clause.plainEnglish}</p>
                          </div>
                        )}

                        {/* ── Foresight / Consequence Engine ── */}
                        {clause.foresight && (
                          <div className="mb-3 bg-purple-50 border border-purple-200 rounded p-4">
                            <p className="text-purple-900 text-xs leading-relaxed">{clause.foresight}</p>
                          </div>
                        )}

                        {/* Advocate / Critic */}
                        <div className="space-y-3 bg-cream/50 p-3 text-xs mb-3">
                          <div>
                            <strong className="text-teal block mb-1">⚖️ Advocate (For the Clause):</strong>
                            <span className="text-mid">{clause.advocate}</span>
                          </div>
                          <div>
                            <strong className="text-accent block mb-1">🚨 Critic (Nigerian Law):</strong>
                            <span className="text-mid whitespace-pre-line">{clause.critic}</span>
                          </div>
                        </div>

                        {/* Negotiation Tip */}
                        {clause.negotiation_tip && (
                          <div className="bg-blue-50 border border-blue-100 p-3 text-xs rounded">
                            <strong className="text-blue-700 block mb-1">💡 Negotiation Tip:</strong>
                            <span className="text-blue-600">{clause.negotiation_tip}</span>
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="p-6 bg-green/5 border border-green/20 text-center">
                    <p className="text-teal font-syne font-bold">No significant risks found.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
