const { ChromaClient } = require('chromadb');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const client = new ChromaClient({
  // Use the host without any 'https://' prefix
  host: process.env.CHROMA_HOST || 'localhost',
  port: 443,
  ssl: true,
  tenant: process.env.CHROMA_TENANT || 'default_tenant',
  database: process.env.CHROMA_DATABASE || 'default_database',
  // The SDK now wants the token directly in a top-level headers object
  headers: {
    "X-Chroma-Token": (process.env.CHROMA_API_KEY || '').trim()
  }
});
const collectionName = "nigerian_law";
const casesCollectionName = "nigerian_cases";

// ── Use Local Transformers (100% Offline & Free) ──
let extractorPromise = null;

// Simple in-memory embedding cache — avoids re-embedding the same text twice
const embeddingCache = new Map();

async function getEmbedding(text) {
  // Check cache first
  if (embeddingCache.has(text)) {
    return embeddingCache.get(text);
  }

  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import('@xenova/transformers');
      env.allowLocalModels = false;
      env.useBrowserCache = false;
      return await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true,
      });
    })();
  }

  const extractor = await extractorPromise;
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  const embedding = Array.from(output.data);

  // Cache it (cap cache at 500 entries to avoid memory bloat)
  if (embeddingCache.size >= 500) {
    const firstKey = embeddingCache.keys().next().value;
    embeddingCache.delete(firstKey);
  }
  embeddingCache.set(text, embedding);

  return embedding;
}

/**
 * Pre-loads the Xenova transformer model at server startup.
 * This ensures the FIRST user request is fast.
 */
async function warmupEmbedder() {
  console.log('⚡ Pre-warming local embedding model...');
  await getEmbedding('Nigerian contract law clause review');
  console.log('✓ Embedding model ready.');
}

// Chroma embedding function wrapper
const localEmbeddingFunction = {
  generate: async (texts) => {
    return await Promise.all(texts.map(text => getEmbedding(text)));
  }
};

/**
 * Step 1: Extract Text from the PDF
 */
const loadPdf = async (filePath) => {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
};

/**
 * Step 2: Semantic Chunking — tracks approximate page number per chunk.
 * Assumes ~3000 chars per page (standard for legal PDFs).
 */
const chunkText = (text, size = 1000, overlap = 200) => {
  const CHARS_PER_PAGE = 3000;
  const chunks = [];
  for (let i = 0; i < text.length; i += (size - overlap)) {
    const approxPage = Math.floor(i / CHARS_PER_PAGE) + 1;
    chunks.push({ text: text.substring(i, i + size), page: approxPage });
  }
  return chunks;
};

/**
 * Initializes the ChromaDB collection.
 * Skips re-embedding if data already exists (persists across restarts).
 */
async function initKnowledgeBase() {
  let retries = 5;
  while (retries > 0) {
    try {
      const dataDir = path.join(__dirname, '../data');

      // ── Check if collection already has data ──
      let existingCount = 0;
      try {
        const existing = await client.getCollection({
          name: collectionName,
          embeddingFunction: localEmbeddingFunction
        });
        existingCount = await existing.count();
      } catch (e) {
        // Collection doesn't exist yet — that's fine
      }

      if (existingCount > 0) {
        console.log(`✓ ChromaDB law collection already loaded (${existingCount} vectors). Skipping re-embedding.`);
      } else {

        // ── First-time setup or empty collection ──
        const pdfFiles = fs.existsSync(dataDir)
          ? fs.readdirSync(dataDir).filter(f => f.endsWith('.pdf'))
          : [];

        try { await client.deleteCollection({ name: collectionName }); } catch (e) { }

        const collection = await client.createCollection({
          name: collectionName,
          embeddingFunction: localEmbeddingFunction
        });

        if (pdfFiles.length > 0) {
          console.log(`Found ${pdfFiles.length} law PDF(s) in data/. Starting local embedding pipeline...`);
          let globalIdx = 0;
          for (const file of pdfFiles) {
            console.log(`  Processing: ${file}`);
            const rawText = await loadPdf(path.join(dataDir, file));
            const chunks = chunkText(rawText);
            const batchSize = 10;

            for (let i = 0; i < chunks.length; i += batchSize) {
              const batch = chunks.slice(i, i + batchSize);
              const ids = batch.map((_, idx) => `${file}_sec_${globalIdx + idx}`);
              const embeddings = await localEmbeddingFunction.generate(batch.map(c => c.text));
              await collection.add({
                ids,
                embeddings,
                documents: batch.map(c => c.text),
                metadatas: batch.map(c => ({ source: file, page: c.page }))
              });
              globalIdx += batch.length;
            }
            console.log(`  ✓ ${file} embedded locally (${chunks.length} chunks)`);
          }
          console.log('RAG Knowledge Base fully loaded from PDF(s).');
        } else {
          console.log('No PDFs found in server/data/. Waiting for user to upload PDFs.');
        }
      } // close the outer else block

      // ── Load Foresight Cases (JSON) ──
      const casesPath = path.join(dataDir, 'foresight_vectors.json');
      if (fs.existsSync(casesPath)) {
        let casesCount = 0;
        try {
          const casesColl = await client.getCollection({ name: casesCollectionName, embeddingFunction: localEmbeddingFunction });
          casesCount = await casesColl.count();
        } catch (e) { }

        if (casesCount === 0) {
          console.log(`Loading foresight_vectors.json into ChromaDB...`);
          try { await client.deleteCollection({ name: casesCollectionName }); } catch (e) { }
          const casesCollection = await client.createCollection({ name: casesCollectionName, embeddingFunction: localEmbeddingFunction });
          const casesData = JSON.parse(fs.readFileSync(casesPath, 'utf8'));

          const batchSize = 100;
          for (let i = 0; i < casesData.length; i += batchSize) {
            const batch = casesData.slice(i, i + batchSize);
            const ids = batch.map((_, idx) => `case_${i + idx}`);
            // Prepend a word to help semantic matching, though Xenova handles it well
            const texts = batch.map(c => `Legal offence: ${c['Offence Description'].replace(/_/g, ' ')}`);
            const metadatas = batch.map(c => ({ outcome: c.Outcome, year: c.Year }));

            const embeddings = await localEmbeddingFunction.generate(texts);
            await casesCollection.add({
              ids,
              embeddings,
              documents: texts,
              metadatas
            });
          }
          console.log(`  ✓ ${casesData.length} historic cases embedded into ${casesCollectionName}.`);
        } else {
          console.log(`✓ ChromaDB cases already loaded (${casesCount} vectors).`);
        }
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
 * Smart Semantic Search against the Nigerian Law knowledge base
 * @param {string} query 
 * @returns {Promise<Array<string>>}
 */
async function searchLaw(query) {
  try {
    const collection = await client.getCollection({
      name: collectionName,
      embeddingFunction: localEmbeddingFunction
    });

    const queryEmbedding = await getEmbedding(query);
    const lowerQuery = query.toLowerCase();

    // ── Smart Metadata Filtering ──
    // Determine the most relevant source based on keywords in the clause
    let filter = undefined; // Default: search all

    if (/\b(rent|tenant|landlord|tenancy|premises|occupation|lease)\b/.test(lowerQuery)) {
      filter = { "source": "Tenancy-Law-2011.pdf" };
    } else if (/\b(share|director|company|board|dividend|cama)\b/.test(lowerQuery)) {
      filter = { "source": "CAMA-NOTE FINAL-FULL-VERSION.pdf" };
    } else if (/\b(employee|employer|wages|salary|labour|worker|intern|volunteer|dismissal|redundancy)\b/.test(lowerQuery)) {
      filter = { "source": "Labour Act, Cap L1, Laws of the Federation of Nigeria (LFN) 2004.pdf" };
    } else if (/\b(arbitration|mediation|dispute|conciliat)\b/.test(lowerQuery)) {
      filter = { "source": "New-Nigerian-Arbitration-and-Mediation-Act.pdf" };
    } else if (/\b(intellectual property|copyright|trademark|patent)\b/.test(lowerQuery)) {
      filter = { "source": "Copyright-Act-2022.pdf" };
    }

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: 2,
      where: filter
    });

    if (results && results.documents && results.documents[0]) {
      // Return enriched results with citation metadata
      return results.documents[0].map((doc, i) => {
        const meta = results.metadatas?.[0]?.[i] || {};
        const sourceName = (meta.source || '').replace('.pdf', '').replace(/-/g, ' ');
        const page = meta.page ? `p.${meta.page}` : '';
        return {
          text: doc,
          citation: [sourceName, page].filter(Boolean).join(', ')
        };
      });
    }
    return [];
  } catch (error) {
    console.error("RAG Search Error:", error);
    return [];
  }
}

/**
 * Searches historic case outcomes based on clause text
 * @param {string} query
 * @returns {Promise<Array<string>>} Array of outcomes (e.g. ['WON', 'LOST', ...])
 */
async function searchCases(query) {
  try {
    const collection = await client.getCollection({
      name: casesCollectionName,
      embeddingFunction: localEmbeddingFunction
    });

    const queryEmbedding = await getEmbedding(query);
    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: 50
    });

    if (results && results.metadatas && results.metadatas[0]) {
      return results.metadatas[0].map(m => m.outcome);
    }
    return [];
  } catch (error) {
    console.error("Cases Search Error:", error);
    return [];
  }
}

module.exports = {
  initKnowledgeBase,
  searchLaw,
  searchCases,
  warmupEmbedder
};
