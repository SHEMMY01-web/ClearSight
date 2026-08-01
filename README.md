# ClearSight

**Legal clarity for every Nigerian business.**

ClearSight is an AI-powered legal document reviewer for Nigerian SMBs. Draft, review, and understand contracts in seconds.

ClearSight gives Nigerian SMBs three things they've never had access to: the ability to generate legally sound contracts in seconds, an AI that reads the fine print so you don't have to, and a community intelligence layer that shows what other businesses flagged as predatory. We are not a law firm. We are the infrastructure that puts legal power back in the hands of the people running this economy.

---

##  Table of Contents
- [Why ClearSight Exists](#why-clearsight-exists)
- [Core Features](#core-features)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Project Structure](#project-structure)
- [Getting Started (Local Development)](#getting-started-local-development)
- [Usage Guide](#usage-guide)
- [Contributing](#contributing)
- [License](#license)

---

<a id="why-clearsight-exists"></a> ## Why ClearSight Exists

A legal system built for the few — we're changing that.

*"A Lagos tailor signs a supplier agreement. Hidden inside: an indemnity clause that makes her liable for the supplier's losses. She finds out when it's too late."*

This happens every day across Nigeria because legal counsel costs ₦50,000–₦500,000 per engagement. For a market trader, a freelance developer, or a growing logistics startup — that's not an option. ClearSight exists because 40 million Nigerian businesses deserve the same legal protection that only corporations and wealthy individuals have had access to. We are democratizing legal intelligence — giving every SMB a fighting chance before they sign.

---

<a id="core-features"></a> ## Core Features

- **Draft (Contract Generation)**: Generate NDAs, service agreements, employment letters, and supplier contracts grounded in CAMA 2020 and Nigerian law — in seconds, not days.
- **Review (AI Clause Analysis)**: Upload any contract, digital or scanned paper. ClearSight flags high-risk clauses in plain English using an **Advocate-Critic AI debate model**. The Advocate finds the commercial upside; the Critic surfaces the legal trap.
- **Trust (Community Trust Index)**: A live database of clauses Nigerian businesses have flagged as unfair, predatory, or deceptive. This crowdsourced intelligence gets smarter over time.
- **Nigerian Law Grounding**: All analysis runs against a curated RAG knowledge base of CAMA 2020, the Evidence Act, CAC guidelines, and Nigerian case law.
- **Human-in-the-Loop**: ClearSight handles 97–99% of the analysis. For complex decisions, it escalates to a vetted human consultant.

---

<a id="architecture--tech-stack"></a> ## Architecture & Tech Stack

ClearSight is built as a modern web application designed for speed, accuracy, and reliability.

- **Frontend**: React 18, Vite, Tailwind CSS
- **Backend API**: Node.js, Express
- **Database & Auth**: Supabase (PostgreSQL)
- **Vector Store (RAG)**: ChromaDB (Storing semantic embeddings of Nigerian Law)
- **AI / LLM Engine**: Google Gemini 2.5 (Agentic RAG, Chain-of-Thought reasoning)
- **Document Processing**: PDF-Parse, Tesseract.js (for OCR on scanned images)

---

<a id="project-structure"></a> ## Project Structure

```text
ClearSight/
├── client/                 # React Frontend (Vite)
│   ├── src/
│   │   ├── components/     # UI Components (Upload, Results, Templates, Trust)
│   │   ├── App.jsx         # Main React Application
│   │   └── main.jsx        # Entry point
│   └── .env.example        # Frontend environment variables
│
├── server/                 # Node.js Backend API
│   ├── data/               # Raw legal PDFs and processing scripts
│   ├── routes/             # Express API routes
│   ├── services/           # Core logic (LLM, RAG, Extraction, Analysis)
│   └── .env.example        # Backend environment variables
│
└── supabase/               # Database schemas and migrations
```

---

<a id="getting-started-local-development"></a> ## Getting Started (Local Development)

### Prerequisites

Ensure you have the following installed before proceeding:
- **Node.js** (v18 or higher)
- **Supabase Account** (for PostgreSQL database and Authentication)
- **ChromaDB** instance (Cloud or self-hosted)
- **Google Gemini API Key**

### 1. Clone the Repository
```bash
git clone https://github.com/SHEMMY01-web/ClearSight.git
cd ClearSight
```

### 2. Backend Setup
Navigate to the server directory, install dependencies, and configure the environment:
```bash
cd server
npm install
cp .env.example .env
```
Open `server/.env` and fill in your API keys (Gemini, Supabase, ChromaDB).

Start the backend server:
```bash
npm run dev
# The API will be available at http://localhost:5000
```

### 3. Frontend Setup
In a new terminal window, navigate to the client directory:
```bash
cd client
npm install
cp .env.example .env
```
Open `client/.env` and provide your Supabase URL and Anon Key.

Start the frontend development server:
```bash
npm run dev
# The app will be available at http://localhost:5173
```

---

<a id="usage-guide"></a>  Usage Guide

Once the application is running locally:

1. **Authentication**: Sign up or log in using the Supabase authentication flow.
2. **Dashboard**: Upon logging in, you will be directed to your dashboard.
3. **Draft a Contract**: Navigate to the "Templates" section to generate a new legally-compliant document (e.g., NDA, Employment Letter).
4. **Review a Document**: Click **"Upload Legal Document"** and select a PDF, image, or text file.
5. **Analyze**: The backend will process the document (using OCR if necessary), run the Advocate-Critic AI against it, and present a risk-scored summary in plain English.
6. **Community Trust**: If you spot a predatory clause, flag it! This contributes to the public Trust Index to protect other SMBs.

---

<a id="contributing"></a> ## Contributing

We welcome community contributions! ClearSight is an ambitious project and we need help from developers, legal experts, and designers.

### UI/UX Designers & Frontend Devs
The UI for this project was initially "vibe coded". If you are a UI/UX Designer or a frontend developer who wants to improve the interface, responsiveness, or accessibility, your contributions are highly welcome! 

### How to Contribute
1. **Fork** the repository.
2. **Clone** your fork locally.
3. **Create a new branch**: `git checkout -b feature/your-amazing-feature`.
4. **Make your changes** and commit them with descriptive messages.
5. **Push** to your fork and submit a **Pull Request**.

Please ensure your code follows the existing style and that you test your changes locally before submitting a PR.

---

##<a id="license"></a> 📄 License

This project is licensed under the **GNU GPLv3** License.
