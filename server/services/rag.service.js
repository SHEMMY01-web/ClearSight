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
const collectionName = "nigerian_law_v3"; // Renamed to force re-index with Gemini 768d semantic chunking
const casesCollectionName = "nigerian_cases_v2";

const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const embeddingModel = 'gemini-embedding-001';

// Simple in-memory embedding cache — avoids re-embedding the same text twice
const embeddingCache = new Map();

async function getEmbedding(text) {
  // Check cache first
  if (embeddingCache.has(text)) {
    return embeddingCache.get(text);
  }

  try {
    const response = await ai.models.embedContent({
      model: embeddingModel,
      contents: text
    });
    
    const embedding = response.embeddings[0].values;

    // Cache it (cap cache at 500 entries to avoid memory bloat)
    if (embeddingCache.size >= 500) {
      const firstKey = embeddingCache.keys().next().value;
      embeddingCache.delete(firstKey);
    }
    embeddingCache.set(text, embedding);

    return embedding;
  } catch (error) {
    console.error("Embedding generation failed:", error.message);
    throw error;
  }
}

/**
 * Pre-loads the embedding model at server startup.
 */
async function warmupEmbedder() {
  console.log('⚡ Pre-warming Gemini embedding model...');
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
 * Step 2: Semantic Chunking
 * Splits text into paragraphs and groups them up to a max chunk size.
 * This preserves sentence boundaries and legal context much better than blind character splitting.
 */
const chunkText = (text, maxChars = 1500) => {
  const CHARS_PER_PAGE = 3000;
  const chunks = [];
  
  // Split by double newlines or significant line breaks
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 20);
  
  let currentChunk = '';
  let startCharIdx = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (currentChunk.length + p.length > maxChars && currentChunk.length > 0) {
      // Push the current chunk
      const approxPage = Math.floor(startCharIdx / CHARS_PER_PAGE) + 1;
      chunks.push({ text: currentChunk.trim(), page: approxPage });
      
      // Start a new chunk, but carry over the last paragraph for semantic overlap (sliding window)
      const overlapPara = paragraphs[i - 1] || '';
      currentChunk = (overlapPara.length < 500 ? overlapPara + '\n\n' : '') + p + '\n\n';
      startCharIdx += currentChunk.length; // rough approximation
    } else {
      currentChunk += p + '\n\n';
      if (currentChunk.length === p.length + 2) {
        startCharIdx = text.indexOf(p.substring(0, 50)); // Sync page tracking occasionally
        if (startCharIdx === -1) startCharIdx = chunks.length * maxChars;
      }
    }
  }

  if (currentChunk.trim().length > 0) {
    const approxPage = Math.floor(startCharIdx / CHARS_PER_PAGE) + 1;
    chunks.push({ text: currentChunk.trim(), page: approxPage });
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
      const v2Path = path.join(dataDir, 'foresight_vectors_v2.json');
      const v1Path = path.join(dataDir, 'foresight_vectors.json');
      const casesPath = fs.existsSync(v2Path) ? v2Path : (fs.existsSync(v1Path) ? v1Path : null);

      if (casesPath) {
        let casesCount = 0;
        try {
          const casesColl = await client.getCollection({ name: casesCollectionName });
          casesCount = await casesColl.count();
        } catch (e) { }

        if (casesCount === 0) {
          console.log(`Loading ${path.basename(casesPath)} into ChromaDB collection ${casesCollectionName}...`);
          try { await client.deleteCollection({ name: casesCollectionName }); } catch (e) { }
          const casesCollection = await client.createCollection({ name: casesCollectionName });
          const casesData = JSON.parse(fs.readFileSync(casesPath, 'utf8'));

          const batchSize = 50;
          for (let i = 0; i < casesData.length; i += batchSize) {
            const batch = casesData.slice(i, i + batchSize);
            const ids = batch.map((c, idx) => c.id || `case_${i + idx}`);
            const texts = batch.map(c => c['Offence Description'] || c.summary || 'Legal Dispute');
            const metadatas = batch.map(c => ({ 
              outcome: c.Outcome || 'UNKNOWN', 
              year: c.Year || 'N/A',
              category: c.Business_Category || 'General',
              summary: c.Summary || ''
            }));

            // Extract pre-computed embeddings or generate on the fly
            let embeddings = batch.map(c => c.embedding);
            if (embeddings.some(e => !e)) {
              embeddings = await localEmbeddingFunction.generate(texts);
            }

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
      } else {
        console.warn('⚠️ No foresight_vectors.json file found in server/data/. Cases collection skipped.');
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
/**
 * Maps raw source PDF filenames to canonical legal titles.
 */
function cleanSourceCitation(sourceStr = '') {
  if (!sourceStr) return 'Companies and Allied Matters Act (CAMA 2020)';
  const clean = sourceStr.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ').trim();
  if (/cama/i.test(clean)) return 'Companies and Allied Matters Act (CAMA 2020)';
  if (/labour/i.test(clean)) return 'Labour Act Cap L1 LFN 2004';
  if (/tenancy/i.test(clean)) return 'Lagos State Tenancy Law 2011';
  if (/evidence/i.test(clean)) return 'Evidence Act 2011 (Nigeria)';
  if (/copyright/i.test(clean)) return 'Copyright Act 2022 (Nigeria)';
  if (/arbitration/i.test(clean)) return 'Arbitration and Mediation Act 2023';
  return clean || 'Nigerian Statutory Precedent';
}

/**
 * Smart Semantic Search against the Nigerian Law knowledge base
 * Enforces independent citation gate: distance <= 0.45 (similarity >= 0.70)
 * @param {string} query 
 * @returns {Promise<Array<{ text: string, distance: number, similarity: number, citation: string, sourceName: string }>>}
 */
async function searchLaw(query) {
  try {
    const collection = await client.getCollection({
      name: collectionName,
      embeddingFunction: localEmbeddingFunction
    });

    const queryEmbedding = await getEmbedding(query);

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: 5
    });

    if (results && results.documents && results.documents[0]) {
      const distances = results.distances?.[0] || [];
      const hits = [];

      for (let i = 0; i < results.documents[0].length; i++) {
        const doc = results.documents[0][i];
        const dist = distances[i] !== undefined ? distances[i] : 0.2; // default if mock
        const meta = results.metadatas?.[0]?.[i] || {};
        const sourceTitle = cleanSourceCitation(meta.source);
        const page = meta.page ? `p.${meta.page}` : '';
        const citation = [sourceTitle, page].filter(Boolean).join(', ');

        hits.push({
          text: doc,
          distance: dist,
          similarity: Math.max(0, 1 - dist),
          citation,
          sourceName: sourceTitle
        });
      }

      // Enforce independent citation gate: distance <= 0.45
      return hits.filter(h => h.distance <= 0.45);
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
      name: casesCollectionName
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
    if (error.name === 'ChromaNotFoundError' || error.message?.includes('not found')) {
      console.warn(`[RAG] Cases collection '${casesCollectionName}' not found yet in ChromaDB. Falling back to default case stats.`);
    } else {
      console.error("Cases Search Error:", error.message || error);
    }
    return [];
  }
}

module.exports = {
  initKnowledgeBase,
  searchLaw,
  searchCases,
  warmupEmbedder
};
