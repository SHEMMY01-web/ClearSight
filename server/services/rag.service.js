const { ChromaClient } = require('chromadb');

// Optional: for generating embeddings if needed, though Chroma uses default all-MiniLM-L6-v2
// if we use the Python server. If we use the pure JS client, we might need a custom embedding function.
const { HuggingFaceInferenceEmbeddings } = require('@langchain/community/embeddings/hf');

const client = new ChromaClient();
const collectionName = "nigerian_law";

// Using HF for embeddings (via Langchain)
const hfEmbeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: process.env.HF_API_KEY,
  model: "sentence-transformers/all-MiniLM-L6-v2"
});

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

/**
 * Step 1: Extract Text from the PDF
 */
const loadCamaPdf = async (filePath) => {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
};

/**
 * Step 2: Semantic Chunking (The Legal Strategy)
 */
const chunkText = (text, size = 1000, overlap = 200) => {
    const chunks = [];
    for (let i = 0; i < text.length; i += (size - overlap)) {
        chunks.push(text.substring(i, i + size));
    }
    return chunks;
};

/**
 * Step 3: Embedding & Storing in ChromaDB
 */
const storeCamaInChroma = async (chunks) => {
    // Create a collection for CAMA 2020
    try {
        await client.deleteCollection({ name: collectionName });
    } catch (e) {}

    const collection = await client.createCollection({ 
        name: collectionName,
        embeddingFunction: hfEmbeddings
    });

    console.log(`Embedding ${chunks.length} chunks. This may take a moment...`);
    
    // Process in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
        const batchChunks = chunks.slice(i, i + batchSize);
        const ids = batchChunks.map((_, idx) => `cama_sec_${i + idx}`);
        const embeddings = await hfEmbeddings.embedDocuments(batchChunks);

        await collection.add({
            ids: ids,
            embeddings: embeddings,
            documents: batchChunks,
            metadatas: batchChunks.map(() => ({ source: "CAMA_2020_Official_Gazette" }))
        });
        console.log(`Stored batch ${i/batchSize + 1}`);
    }
    console.log("Successfully embedded and stored CAMA 2020 in ChromaDB.");
};

/**
 * Initializes the ChromaDB collection.
 * Skips re-embedding if data already exists (persists across restarts).
 */
async function initKnowledgeBase() {
  let retries = 5;
  while (retries > 0) {
    try {
      // ── Check if collection already has data ──
      let existingCount = 0;
      try {
        const existing = await client.getCollection({
          name: collectionName,
          embeddingFunction: hfEmbeddings
        });
        const countResult = await existing.count();
        existingCount = countResult;
      } catch (e) {
        // Collection doesn't exist yet — that's fine
      }

      if (existingCount > 0) {
        console.log(`✓ ChromaDB already loaded (${existingCount} vectors). Skipping re-embedding.`);
        return;
      }

      // ── First-time setup or empty collection ──
      const dataDir = path.join(__dirname, '../data');
      const pdfFiles = fs.existsSync(dataDir)
        ? fs.readdirSync(dataDir).filter(f => f.endsWith('.pdf'))
        : [];

      try { await client.deleteCollection({ name: collectionName }); } catch (e) {}

      const collection = await client.createCollection({
        name: collectionName,
        embeddingFunction: hfEmbeddings
      });

      if (pdfFiles.length > 0) {
        console.log(`Found ${pdfFiles.length} law PDF(s) in data/. Starting embedding pipeline...`);
        let globalIdx = 0;
        for (const file of pdfFiles) {
          console.log(`  Processing: ${file}`);
          const rawText = await loadCamaPdf(path.join(dataDir, file));
          const chunks = chunkText(rawText);
          const batchSize = 10;
          for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const ids = batch.map((_, idx) => `${file}_sec_${globalIdx + idx}`);
            const embeddings = await hfEmbeddings.embedDocuments(batch);
            await collection.add({
              ids,
              embeddings,
              documents: batch,
              metadatas: batch.map(() => ({ source: file }))
            });
            globalIdx += batch.length;
          }
          console.log(`  ✓ ${file} embedded (${chunks.length} chunks)`);
        }
        console.log('RAG Knowledge Base fully loaded from PDF(s).');
      } else {
        console.log('No PDFs found in server/data/. Seeding fallback CAMA 2020 rules...');
        const seedData = [
          "CAMA 2020 requires companies to have at least two directors, except for small companies which may have one.",
          "An indemnity clause should be mutual and not expose directors to personal liability under CAMA 2020.",
          "Penalty clauses are generally not enforced by Nigerian courts unless they represent genuine pre-estimated liquidated damages.",
          "Intellectual Property rights created during an employment or contractor agreement must explicitly state assignment to the paying entity to be fully protected under Nigerian law.",
          "Liability caps should not be lower than the contract value. Unlimited liability is heavily scrutinized.",
          "Lagos State Tenancy Law 2011 Section 7: Rent increases must be reasonable and subject to mutual agreement.",
          "Under the Labour Act Cap L1 LFN 2004, a monthly worker is entitled to one month's notice before termination.",
          "Non-compete clauses that are overly broad as to time, geography, or industry are unenforceable in Nigeria.",
          "Self-help eviction (locking out a tenant without a court order) is illegal under the Recovery of Premises Act.",
          "A mandatory arbitration fee before dispute resolution is a predatory penalty under Nigerian contract law."
        ];
        const ids = seedData.map((_, i) => `seed_rule_${i}`);
        const embeddings = await hfEmbeddings.embedDocuments(seedData);
        await collection.add({
          ids, embeddings, documents: seedData,
          metadatas: seedData.map(() => ({ source: "Seed — Nigerian Law Summary" }))
        });
        console.log('RAG Knowledge Base initialized with expanded fallback seeds.');
      }
      return;
    } catch (error) {
      retries--;
      if (retries === 0) {
        console.error('Failed to initialize ChromaDB after all retries:', error.message);
      } else {
        console.log(`ChromaDB not ready, retrying in 2s... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
}

/**
 * Semantic search against the Nigerian Law knowledge base
 * @param {string} query 
 * @returns {Promise<Array<string>>}
 */
async function searchLaw(query) {
  try {
    const collection = await client.getCollection({ 
      name: collectionName,
      embeddingFunction: hfEmbeddings
    });
    const queryEmbedding = await hfEmbeddings.embedQuery(query);
    
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: 2
    });

    if (results && results.documents && results.documents[0]) {
      return results.documents[0];
    }
    return [];
  } catch (error) {
    console.error("RAG Search Error:", error);
    return [];
  }
}

// Call this on server start
// initKnowledgeBase();

module.exports = {
  initKnowledgeBase,
  searchLaw
};
