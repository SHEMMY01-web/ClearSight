import { jsPDF } from 'jspdf';

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
  let y = 35;
  let pageCount = 1;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('ClearSight Contract Risk Report', 20, 20);
  
  doc.setFont("times", "normal");
  analysis.forEach((clause, index) => {
    if (y > 250) {
      addFooter(doc, pageCount++);
      doc.addPage();
      y = 20;
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(196, 160, 82); // Gold
    doc.text(`${clause.riskCategory || 'Legal Risk'} - ${clause.severity}`, 20, y);
    y += 7;

    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const splitText = doc.splitTextToSize(`"${clause.text}"`, 170);
    doc.text(splitText, 20, y);
    y += (splitText.length * 5) + 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const splitCritic = doc.splitTextToSize(`Advisory: ${clause.critic}`, 170);
    doc.text(splitCritic, 20, y);
    y += (splitCritic.length * 5) + 15;
  });

  addFooter(doc, pageCount);
  doc.save(`ClearSight_Analysis_${new Date().getTime()}.pdf`);
};

const addFooter = (doc, pageNum) => {
  const pageHeight = doc.internal.pageSize.height;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`ClearSight Legal Strategist | CAMA 2020 Validated | Page ${pageNum}`, 20, pageHeight - 10);
  doc.text(`Confidential - For Strategic Use Only`, 140, pageHeight - 10);
};
