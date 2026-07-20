# ClearSight

**Legal clarity for every Nigerian business.**

ClearSight is an AI-powered legal document reviewer for Nigerian SMBs. Draft, review, and understand contracts in seconds.

ClearSight gives Nigerian SMBs three things they've never had access to: the ability to generate legally sound contracts in seconds, an AI that reads the fine print so you don't have to, and a community intelligence layer that shows what other businesses flagged as predatory. We are not a law firm. We are the infrastructure that puts legal power back in the hands of the people running this economy.

## Why ClearSight Exists

A legal system built for the few — we're changing that.

*"A Lagos tailor signs a supplier agreement. Hidden inside: an indemnity clause that makes her liable for the supplier's losses. She finds out when it's too late."*

This happens every day across Nigeria because legal counsel costs ₦50,000–₦500,000 per engagement. For a market trader, a freelance developer, or a growing logistics startup — that's not an option. ClearSight exists because 40 million Nigerian businesses deserve the same legal protection that only corporations and wealthy individuals have had access to. We are democratizing legal intelligence — giving every SMB a fighting chance before they sign.

## Core Features

- **Draft (Contract Generation)**: Generate NDAs, service agreements, employment letters, and supplier contracts grounded in CAMA 2020 and Nigerian law — in seconds, not days.
- **Review (AI Clause Analysis)**: Upload any contract, digital or scanned paper. ClearSight flags high-risk clauses in plain English using an **Advocate-Critic AI debate model**. The Advocate finds the commercial upside; the Critic surfaces the legal trap.
- **Trust (Community Trust Index)**: A live database of clauses Nigerian businesses have flagged as unfair, predatory, or deceptive. This crowdsourced intelligence gets smarter over time.
- **Nigerian Law Grounding**: All analysis runs against a curated RAG knowledge base of CAMA 2020, the Evidence Act, CAC guidelines, and Nigerian case law.
- **Human-in-the-Loop**: ClearSight handles 97–99% of the analysis. For complex decisions, it escalates to a vetted human consultant.

## Who We Serve
- **The Founder / SMB Owner**: Growing fast, signing contracts regularly, no legal team.
- **The Freelancer / Creative**: Developers, designers, and consultants signing client contracts.
- **The Market Trader / Supplier**: Informal economy operators entering supplier or distribution agreements.
- **The Human Consultant**: Legal professionals who use ClearSight as a force multiplier.

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Supabase** (PostgreSQL) project for user management and database
- **ChromaDB** instance for vector storage
- **Gemini API Key** for LLM and embeddings

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/ClearSight.git
    cd ClearSight
    ```

2.  **Backend Setup**
    ```bash
    cd server
    npm install
    ```

3.  **Frontend Setup**
    ```bash
    cd ../client
    npm install
    ```

4.  **Environment Configuration**
    
    In the `server/` directory, copy the example environment file and fill in your keys:
    ```bash
    cp .env.example .env
    ```

    In the `client/` directory, copy the example environment file and fill in your keys:
    ```bash
    cp .env.example .env
    ```

### Running the Application

1.  **Start the Backend** (in the `server/` directory)
    ```bash
    npm run dev
    ```
    The API will be available at `http://localhost:5000`.

2.  **Start the Frontend** (in the `client/` directory)
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:5173` (or as configured by Vite).

## Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **Backend**: Node.js, Express
- **Database & Auth**: Supabase (PostgreSQL)
- **Vector Store**: ChromaDB
- **AI Models**: Google Gemini (Agentic RAG, Chain-of-Thought)
- **Document Processing**: PDF-Parse, Tesseract.js (OCR)

## Contributing

The UI for this project was "vibe coded", so if you are a UI/UX Designer who wants to improve the interface, your contributions are highly welcome! Feel free to fork the repository, make your changes, and submit a pull request.

## License

GNU GPLv3
