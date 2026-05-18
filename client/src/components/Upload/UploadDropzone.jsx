import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

const UPLOAD_PHASES = [
  { label: 'Translating document into plain English…', sub: 'Gemini is reading every clause' },
  { label: 'Scanning for predatory clauses…', sub: 'Checking against CAMA 2020 & Nigerian Law' },
  { label: 'Building legal advisory…', sub: 'Advocate-Critic analysis in progress' },
];
import { uploadContract } from '../../services/api';

const UploadDropzone = ({ onUploadComplete, persona = 'general', strategySettings = null, userId = null }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Cycle phase messages every 3 seconds while uploading
  useEffect(() => {
    if (!isUploading) { setPhaseIndex(0); return; }
    const interval = setInterval(() => {
      setPhaseIndex(prev => (prev + 1) % UPLOAD_PHASES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isUploading]);

  const onDrop = useCallback(async (acceptedFiles) => {
    setError(null);
    setSuccessMessage(null);

    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const result = await uploadContract(file, persona, strategySettings, userId);
      setSuccessMessage('Contract analyzed successfully!');
      if (onUploadComplete) {
        onUploadComplete(result);
      }
    } catch (err) {
      setError(err.message || 'An error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  }, [onUploadComplete, persona, strategySettings]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false
  });

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed p-10 flex flex-col items-center justify-center cursor-pointer transition-colors
          ${isDragActive ? 'border-accent bg-accent/5' : 'border-ink/20 hover:border-gold hover:bg-gold/5'}
          ${isDragReject ? 'border-red-500 bg-red-50' : ''}
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-gold animate-spin" />
            <div className="text-center">
              <p className="font-syne font-bold text-lg transition-all">
                {UPLOAD_PHASES[phaseIndex].label}
              </p>
              <p className="font-mono text-xs text-mid mt-1">
                {UPLOAD_PHASES[phaseIndex].sub}
              </p>
            </div>
            <div className="flex gap-1.5 mt-2">
              {UPLOAD_PHASES.map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all duration-500 ${
                    i === phaseIndex ? 'bg-gold scale-125' : 'bg-ink/20'
                  }`}
                />
              ))}
            </div>
          </div>
        ) : (
          <>
            <UploadCloud className={`w-12 h-12 mb-4 ${isDragActive ? 'text-accent' : 'text-mid'}`} />
            <p className="font-syne font-bold text-lg mb-2 text-center">
              {isDragActive ? 'Drop contract here' : 'Drag & drop contract, or click to select'}
            </p>
            <p className="font-mono text-xs text-mid text-center">
              Supports PDF, PNG, JPG up to 10MB
            </p>
          </>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-mono">{error}</p>
        </div>
      )}

      {successMessage && !isUploading && (
        <div className="mt-4 p-4 bg-teal/10 border border-teal flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-teal shrink-0 mt-0.5" />
          <p className="text-sm text-teal-800 font-mono">{successMessage}</p>
        </div>
      )}
    </div>
  );
};

export default UploadDropzone;
