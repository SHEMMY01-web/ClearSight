import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

const UPLOAD_PHASES = [
  { label: 'Translating document into plain English…', sub: 'Analyzing every clause' },
  { label: 'Scanning for predatory clauses…', sub: 'Checking against CAMA 2020 & Nigerian Law' },
  { label: 'Building legal advisory…', sub: 'Advocate-Critic analysis in progress' },
];
import { uploadContract } from '../../services/api';
import { supabase } from '../../supabaseClient';

/**
 * Captures an image from a native file/camera input and downscales it via HTML5 Canvas
 * to save network bandwidth and server processing power.
 */
async function optimizeImageBeforeUpload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1600; // Optimal width for high-accuracy OCR text
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Compress image to JPEG at 85% quality to drastically reduce payload size
        canvas.toBlob((blob) => {
          const optimizedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(optimizedFile);
        }, 'image/jpeg', 0.85);
      };
      img.onerror = () => reject(new Error('Failed to load image for optimization.'));
    };
    reader.onerror = (error) => reject(error);
  });
}

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
      let finalFile = file;
      // Native downscaling if the file is an image
      if (file.type.startsWith('image/')) {
        try {
          finalFile = await optimizeImageBeforeUpload(file);
        } catch (e) {
          console.error("Downscaling failed, falling back to raw file:", e);
        }
      }

      const result = await uploadContract(finalFile, persona, strategySettings, userId);
      
      if (result.jobId) {
        // Polling loop
        let isDone = false;
        let attempts = 0;
        
        while (!isDone && attempts < 60) { // Max 5 minutes (5s * 60)
          await new Promise(resolve => setTimeout(resolve, 5000));
          attempts++;
          
          const { data, error } = await supabase
            .from('contracts')
            .select('*')
            .eq('id', result.jobId)
            .single();
            
          if (error) {
            console.error("Polling error:", error);
            continue;
          }
          
          if (data && data.risk_status && data.risk_status !== 'processing') {
            isDone = true;
            if (data.risk_status === 'failed') {
              throw new Error(data.strategic_summary || 'Analysis failed. Please try again.');
            }
            
            // Format to match what the old API returned
            const finalResult = {
              success: true,
              filename: data.filename,
              persona: persona,
              riskStatus: data.risk_status,
              plainTranslation: data.plain_translation,
              extractedTextPreview: result.extractedTextPreview,
              analysis: data.analysis_results
            };
            
            setSuccessMessage('Contract analyzed successfully!');
            if (onUploadComplete) {
              onUploadComplete(finalResult);
            }
          }
        }
        
        if (!isDone) {
          throw new Error('Analysis timed out. Please refresh the page to view your results later.');
        }
      } else {
        setSuccessMessage('Contract analyzed successfully!');
        if (onUploadComplete) {
          onUploadComplete(result);
        }
      }
    } catch (err) {
      setError(err.message || 'An error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  }, [onUploadComplete, persona, strategySettings]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    noClick: true, // We disable react-dropzone's buggy click handler
    noKeyboard: true,
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
        className={`border-2 border-dashed p-10 flex flex-col items-center justify-center transition-colors w-full relative overflow-hidden cursor-pointer
          ${isDragActive ? 'border-accent bg-accent/5' : 'border-ink/20 hover:border-gold hover:bg-gold/5'}
          ${isDragReject ? 'border-red-500 bg-red-50' : ''}
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        {/* Bulletproof Native Overlay: Physical clicks bypass Chrome's Cancel lock */}
        {!isUploading && (
          <input 
            type="file"
            accept=".pdf,.jpeg,.jpg,.png"
            className="absolute opacity-0 cursor-pointer z-50"
            style={{ 
              fontSize: '10000px', 
              right: 0, 
              top: 0, 
              minWidth: '100%', 
              minHeight: '100%' 
            }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onDrop(Array.from(e.target.files));
              }
              // Safely reset value AFTER processing, never during onClick!
              e.target.value = '';
            }}
            title="Click to upload"
          />
        )}
        
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
