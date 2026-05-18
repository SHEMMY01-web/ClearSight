import { jsPDF } from 'jspdf';

/**
 * Exports a "Certificate of Clarity" PDF for clean documents.
 * Uses a minimal, friendly green layout — not the risk-heavy audit template.
 * @param {string} plainTranslation - The full plain English translation
 * @param {string} filename - Original contract filename
 */
export const exportClarityPDF = (plainTranslation, filename = 'contract') => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  let y = 0;
  let pageNum = 1;

  const drawClarityHeader = () => {
    // Green header band
    doc.setFillColor(34, 139, 87); // ClearSight green
    doc.rect(0, 0, pageWidth, 40, 'F');

    // Brand name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text('ClearSight', 20, 18);

    // Subtitle
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 240, 220);
    doc.text('VERIFIED · YOUR CONTRACT IN PLAIN ENGLISH', 20, 26);

    // Date top-right
    doc.setFontSize(8);
    doc.setTextColor(200, 240, 220);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 20, 26, { align: 'right' });

    // Verified badge line
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(pageWidth - 65, 6, 45, 12, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(34, 139, 87);
    doc.text('✓ NO RISKS FOUND', pageWidth - 42.5, 14, { align: 'center' });
  };

  const drawClarityFooter = (pNum) => {
    doc.setDrawColor(34, 139, 87);
    doc.setLineWidth(0.3);
    doc.line(20, pageHeight - 14, pageWidth - 20, pageHeight - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('ClearSight — No Predatory Clauses Detected · CAMA 2020 Validated', 20, pageHeight - 9);
    doc.text(`Page ${pNum}`, pageWidth - 20, pageHeight - 9, { align: 'right' });
  };

  drawClarityHeader();
  y = 52;

  // Document title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(26, 32, 44);
  doc.text(`Document: ${filename.replace(/\.(pdf|png|jpg|jpeg)$/i, '')}`, 20, y);
  y += 8;

  // Green "all clear" strip
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(34, 139, 87);
  doc.setLineWidth(0.4);
  doc.roundedRect(20, y, pageWidth - 40, 14, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(34, 139, 87);
  doc.text('✅  ClearSight found no predatory clauses in this document. It has been translated below for your reference.', 26, y + 9);
  y += 22;

  // Section label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('PLAIN ENGLISH TRANSLATION', 20, y);
  y += 7;

  doc.setDrawColor(200, 200, 200);
  doc.line(20, y, pageWidth - 20, y);
  y += 6;

  // Render paragraphs
  const paragraphs = (plainTranslation || '')
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);

  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para, pageWidth - 40);
    const blockHeight = lines.length * 5.5 + 4;

    if (y + blockHeight > pageHeight - 20) {
      drawClarityFooter(pageNum++);
      doc.addPage();
      drawClarityHeader();
      y = 50;
    }

    doc.text(lines, 20, y);
    y += blockHeight;
  }

  drawClarityFooter(pageNum);
  const safeName = filename.replace(/\.(pdf|png|jpg|jpeg)$/i, '').replace(/\s+/g, '_');
  doc.save(`ClearSight_CertificateOfClarity_${safeName}.pdf`);
};


const templates = [
  {
    id: 'nda',
    name: 'Mutual NDA',
    desc: 'Standard non-disclosure agreement for Nigerian startups.',
    content: (data) => `MUTUAL NON-DISCLOSURE AGREEMENT

This Agreement is made on this ____ day of __________, 2026

BETWEEN:

1. ${data.partyA || '[PARTY A NAME]'}, a company incorporated under the Laws of the Federal Republic of Nigeria (CAMA 2020), with its registered office at ${data.addressA || '[ADDRESS]'};

AND

2. ${data.partyB || '[PARTY B NAME]'}, a company incorporated under the Laws of the Federal Republic of Nigeria (CAMA 2020), with its registered office at ${data.addressB || '[ADDRESS]'}.

1. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" shall mean all information disclosed by one party to the other, whether orally or in writing, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and the circumstances of disclosure.

2. OBLIGATIONS OF THE PARTIES
The receiving party shall use the same degree of care that it uses to protect the confidentiality of its own confidential information of like kind (but in no event less than reasonable care).

3. GOVERNING LAW
This Agreement shall be governed by and construed in accordance with the Laws of the Federal Republic of Nigeria. Any dispute arising out of or in connection with this Agreement shall be referred to the High Court of ${data.state || 'Lagos State'}.

[SIGNATURE BLOCKS]
`
  },
  {
    id: 'service_agreement',
    name: 'Service Agreement',
    desc: 'General commercial service contract with CAMA 2020 grounding.',
    content: (data) => `GENERAL SERVICE AGREEMENT

This Service Agreement is made between ${data.partyA} ("Client") and ${data.partyB} ("Service Provider").

1. SERVICES
The Service Provider shall provide the following services: [Describe Services].

2. FEES & PAYMENT
The Client shall pay the Service Provider the sum of ${data.fee || '₦0.00'} upon completion of the services.

3. LIMITATION OF LIABILITY
As per Nigerian commercial standards, the liability of the Service Provider is limited to the total value of the fees paid under this agreement.

4. GOVERNING LAW
CAMA 2020 and the Laws of the Federal Republic of Nigeria.
`
  },
  {
    id: 'employment_letter',
    name: 'Employment Offer',
    desc: 'Standard offer letter compliant with the Nigerian Labour Act.',
    content: (data) => `OFFER OF EMPLOYMENT

Dear ${data.candidateName || '[CANDIDATE]'},

We are pleased to offer you the position of ${data.role || '[ROLE]'} at ${data.partyA}.

1. SALARY
Your gross monthly salary will be ${data.salary || '₦0.00'}.

2. PROBATION
You will be on probation for a period of ${data.probation || '3 months'}.

3. TERMINATION
Either party may terminate this contract by giving ${data.notice || '1 month'} notice in writing, as per the Labour Act.
`
  },
  {
    id: 'supplier_contract',
    name: 'Supplier Agreement',
    desc: 'Contract for the supply of goods with Force Majeure clauses.',
    content: (data) => `SUPPLY OF GOODS AGREEMENT

... [Supplier Agreement Content] ...
`
  }
];

export const getTemplates = () => templates;

export const generatePDF = (title, content) => {
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold');
  doc.text(title, 20, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  const splitText = doc.splitTextToSize(content, 170);
  doc.text(splitText, 20, 30);
  
  doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}.pdf`);
};

export const exportAnalysisPDF = (analysis) => {
  const doc = new jsPDF();
  let y = 45;
  let pageCount = 1;

  // ── Branding Header ──
  const drawHeader = (doc) => {
    doc.setFillColor(26, 32, 44); // Dark Ink
    doc.rect(0, 0, 210, 35, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.text('ClearSight', 20, 22);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(196, 160, 82); // Gold
    doc.text('LEGAL STRATEGIST & RISK AUDIT', 20, 28);
    
    doc.setTextColor(200, 200, 200);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 155, 22);
  };

  const cleanText = (text) => {
    if (!text) return "";
    return text
      .replace(/[✅🚩💡⚖️📖🔮🚨⚠️🔍💰🛡️🎯🚀]/g, "") // Strip emojis jsPDF can't handle
      .replace(/WHAT THIS MEANS:/g, "ANALYSIS:")
      .replace(/The Law:/g, "STATUTE:")
      .replace(/Legal Fact:/g, "PRECEDENT:")
      .trim();
  };

  drawHeader(doc);

  analysis.forEach((clause, index) => {
    // Check for page break
    if (y > 230) {
      addFooter(doc, pageCount++);
      doc.addPage();
      drawHeader(doc);
      y = 45;
    }

    const severityColor = clause.severity === 'HIGH' ? [190, 30, 45] : [210, 160, 50];
    
    // 1. Risk Badge
    doc.setDrawColor(...severityColor);
    doc.setLineWidth(0.5);
    doc.setFillColor(...severityColor);
    doc.rect(20, y, 170, 8, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(`FLAG #${index + 1}: ${clause.riskCategory.toUpperCase()} [${clause.severity} RISK]`, 25, y + 5.5);
    y += 12;

    // 2. Original Clause Box
    doc.setFillColor(245, 245, 245);
    const clauseLines = doc.splitTextToSize(`"${clause.text}"`, 160);
    doc.rect(20, y, 170, (clauseLines.length * 5) + 5, 'F');
    
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(clauseLines, 25, y + 5);
    y += (clauseLines.length * 5) + 10;

    // 3. The "Plain English" Insight (Primary Card)
    doc.setDrawColor(230, 230, 230);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("EXECUTIVE SUMMARY", 20, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    const plainText = cleanText(clause.plainEnglish || "No summary available.");
    const splitPlain = doc.splitTextToSize(plainText, 170);
    doc.text(splitPlain, 20, y);
    y += (splitPlain.length * 5) + 8;

    // 4. Detailed Advisory
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("STRATEGIC ADVISORY", 20, y);
    y += 5;

    doc.setFont("times", "normal");
    const criticText = cleanText(clause.critic);
    const splitCritic = doc.splitTextToSize(criticText, 170);
    doc.text(splitCritic, 20, y);
    y += (splitCritic.length * 5) + 15;
    
    // Separator line
    doc.setDrawColor(240, 240, 240);
    doc.line(20, y - 5, 190, y - 5);
  });

  addFooter(doc, pageCount);
  doc.save(`ClearSight_Audit_${new Date().getTime()}.pdf`);
};

const addFooter = (doc, pageNum) => {
  const pageHeight = doc.internal.pageSize.height;
  doc.setDrawColor(196, 160, 82);
  doc.setLineWidth(0.5);
  doc.line(20, pageHeight - 15, 190, pageHeight - 15);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(26, 32, 44);
  doc.text(`CAMA 2020 VALIDATED REPORT`, 20, pageHeight - 10);
  
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(`Page ${pageNum} | Strictly Confidential`, 170, pageHeight - 10, { align: 'right' });
};
