import React, { useState } from 'react';
import { getTemplates, generatePDF } from '../../services/template.service';

const TemplateGallery = () => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({
    partyA: '',
    partyB: '',
    addressA: '',
    addressB: '',
    state: 'Lagos State'
  });

  const templates = getTemplates();

  const handleDownload = (template) => {
    const content = template.content(formData);
    generatePDF(template.name, content);
  };

  return (
    <div className="mt-12">
      <div className="section-label">Legal Template Gallery</div>
      <h3 className="font-sans text-3xl font-black mb-8">Deploy vetted contracts <em>in seconds.</em></h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {templates.map(t => (
          <div key={t.id} className="card-premium flex flex-col h-full">
            <div className="text-[10px] text-gold font-bold uppercase tracking-widest mb-2">CAMA 2020 Compliant</div>
            <h4 className="font-sans font-bold text-lg mb-2">{t.name}</h4>
            <p className="text-gray text-xs mb-6 flex-grow">{t.desc}</p>
            <button 
              onClick={() => setSelectedTemplate(t)}
              className="btn-primary w-full text-center"
            >
              Select Template
            </button>
          </div>
        ))}
      </div>

      {selectedTemplate && (
        <div className="animate-fade-up bg-white border-l-4 border-gold p-8 shadow-lg">
          <div className="flex justify-between items-start mb-8">
            <h4 className="font-sans text-2xl font-bold">Configure {selectedTemplate.name}</h4>
            <button onClick={() => setSelectedTemplate(null)} className="text-gray hover:text-ink">✕</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold mb-2">Party A (Your Name)</label>
              <input 
                type="text" 
                className="input-premium"
                value={formData.partyA}
                onChange={(e) => setFormData({...formData, partyA: e.target.value})}
                placeholder="e.g. ClearSight Tech Ltd"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold mb-2">Party B (Counterparty)</label>
              <input 
                type="text" 
                className="input-premium"
                value={formData.partyB}
                onChange={(e) => setFormData({...formData, partyB: e.target.value})}
                placeholder="e.g. Vendor Name"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold mb-2">Address A</label>
              <input 
                type="text" 
                className="input-premium"
                value={formData.addressA}
                onChange={(e) => setFormData({...formData, addressA: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold mb-2">Address B</label>
              <input 
                type="text" 
                className="input-premium"
                value={formData.addressB}
                onChange={(e) => setFormData({...formData, addressB: e.target.value})}
              />
            </div>
          </div>

          <button 
            onClick={() => handleDownload(selectedTemplate)}
            className="btn-primary w-full"
          >
            Generate & Download PDF
          </button>
        </div>
      )}
    </div>
  );
};

export default TemplateGallery;
