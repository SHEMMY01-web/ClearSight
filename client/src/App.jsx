import { useState, useEffect } from 'react'
import axios from 'axios'
import UploadDropzone from './components/Upload/UploadDropzone'

function App() {
  const [analysisResult, setAnalysisResult] = useState(null)
  const [healthStatus, setHealthStatus] = useState('Checking...')

  useEffect(() => {
    axios.get('http://localhost:5000/api/health')
      .then(response => {
        if (response.data.status === 'ok') {
          setHealthStatus('OK')
        } else {
          setHealthStatus('Error')
        }
      })
      .catch(error => {
        setHealthStatus('Disconnected')
      })
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

        <UploadDropzone onUploadComplete={(result) => setAnalysisResult(result)} />

        {analysisResult && (
          <div className="mt-12">
            <h3 className="font-syne font-bold text-2xl mb-6">Analysis Results</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Preview */}
              <div className="bg-white border border-ink/10 p-6 shadow-sm">
                <h4 className="font-mono text-xs uppercase tracking-widest text-gold mb-4 border-b border-ink/10 pb-2">Extracted Text Preview</h4>
                <p className="text-sm text-mid whitespace-pre-wrap">{analysisResult.extractedTextPreview}</p>
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
                            <span className="text-xs text-mid font-mono">{clause.confidence}% confidence</span>
                          </div>
                        </div>

                        {/* Clause Text */}
                        <p className="text-xs text-ink/70 mb-4 italic border-l-2 border-ink/10 pl-3 line-clamp-3">"{clause.text}"</p>
                        
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
