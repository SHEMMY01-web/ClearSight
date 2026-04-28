# ClearSight

ClearSight is an AI-powered legal research assistant built to help law students, paralegals, and legal professionals find relevant case law, statutes, and legal documents with unprecedented speed and accuracy.

## Features

- **Intelligent Document Analysis**: Automatically extracts and structures key legal concepts from uploaded documents.
- **Semantic Search**: Goes beyond keyword matching to understand the context and legal reasoning of your queries.
- **Vector-Based RAG**: Uses ChromaDB to store and retrieve semantically similar legal texts instantly.
- **Modern Tech Stack**: Built with Next.js, FastAPI, and a clean, responsive UI.
- **File Support**: Handles PDF, DOCX, TXT, and Markdown files with ease.

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Python** 3.8+
- **MongoDB** (Local or Atlas - required for user management)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/ClearSight.git
    cd ClearSight
    ```

2.  **Backend Setup**
    ```bash
    cd server
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    pip install -r requirements.txt
    ```

3.  **Frontend Setup**
    ```bash
    cd ../client
    npm install
    ```

4.  **Environment Configuration**
    Create a `.env` file in the `server/` directory and add your MongoDB URI:
    ```env
    MONGODB_URI=mongodb://localhost:27017/clearsight
    ```

### Running the Application

1.  **Start the Backend** (in the `server/` directory)
    ```bash
    python app.py
    ```
    The API will be available at `http://localhost:8000`.

2.  **Start the Frontend** (in the `client/` directory)
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:3000`.

## Usage

1.  Sign up or log in to the application.
2.  Navigate to the Dashboard.
3.  Click **"Upload Legal Document"** and select a PDF, DOCX, or TXT file.
4.  Once processed, ask a question in the search bar (e.g., "What is the standard for negligence?").
5.  Receive instant, context-aware results ranked by relevance.

## Technology Stack

- **Frontend**: Next.js 13 (App Router), React 18, Tailwind CSS
- **Backend**: FastAPI, Uvicorn
- **Database**: MongoDB
- **Vector Store**: ChromaDB
- **NLP**:spaCy, Sentence Transformers

## License

MIT
