const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const modelName = 'gemini-2.5-flash';

// ~3000 chars per page; 10-page cap = 30,000 chars
const MAX_CHARS_FOR_TRANSLATION = 30_000;
const CHUNK_SIZE = 2000; // ~half a page per Gemini call

/**
 * Pre-warm the model during server startup (no longer needed for Cloud API).
 */
async function warmupLLM() {
    console.log('[LLM] Using Google Gemini API. No local memory overhead.');
}

/**
 * Dynamically generates a Plain English summary using Gemini.
 * Returns null on failure to trigger the fallback.
 */
async function generatePlainEnglish(clause, rule, statute, persona = 'general') {
    try {
        const prompt = `Rewrite this legal clause for a 10-year-old. Be short, blunt, and tell them exactly how they lose money.
Legal Clause: "${clause}"
Plain English Summary:`;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                maxOutputTokens: 2000,
                temperature: 0.2, // Lower temperature for more deterministic/stable output
            }
        });

        let result = response.text || "";
        result = result.replace(/^Plain English( Summary)?:/i, '').trim();
        
        return result ? `✅ WHAT THIS MEANS: ${result}` : null;
    } catch (error) {
        console.error("[LLM] Gemini generation failed:", error.message);
        return null;
    }
}

/**
 * Dynamically generates foresight consequences using Gemini.
 * Returns null on failure to trigger the fallback.
 */
async function generateDynamicForesight(clause, rule, persona = 'general') {
    try {
        const prompt = `Predict a 6-month consequence for a ${persona} given this clause: "${clause}". Risk: ${rule}. Be concise.
Consequence:`;

        const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
                maxOutputTokens: 2000,
                temperature: 0.5,
            }
        });

        let result = response.text || "";
        result = result.replace(/^Consequence:/i, '').trim();

        return result ? `🔮 Data Foresight: ${result}` : null;
    } catch (error) {
        console.error("[LLM] Gemini foresight failed:", error.message);
        return null;
    }
}

/**
 * Splits text into paragraph-aligned chunks of at most `maxLen` characters.
 * Tries to break at double-newlines (paragraph boundaries) first.
 * @param {string} text
 * @param {number} maxLen
 * @returns {string[]}
 */
function splitIntoParagraphChunks(text, maxLen = CHUNK_SIZE) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const chunks = [];
    let current = '';

    for (const para of paragraphs) {
        // If a single paragraph exceeds maxLen, hard-split it
        if (para.length > maxLen) {
            if (current.trim()) { chunks.push(current.trim()); current = ''; }
            for (let i = 0; i < para.length; i += maxLen) {
                chunks.push(para.substring(i, i + maxLen).trim());
            }
            continue;
        }
        if ((current + '\n\n' + para).length > maxLen) {
            if (current.trim()) chunks.push(current.trim());
            current = para;
        } else {
            current = current ? current + '\n\n' + para : para;
        }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
}

/**
 * Translates a full legal document into plain Nigerian English.
 * Caps at 10 pages (~30,000 chars). Processes chunks in parallel batches of 3.
 * Falls back to a structured plain-text summary if Gemini fails.
 * @param {string} fullText
 * @returns {Promise<string>} The translated document (never null)
 */
async function translateFullDocument(fullText) {
    try {
        // Apply 10-page cap
        const cappedText = fullText.length > MAX_CHARS_FOR_TRANSLATION
            ? fullText.substring(0, MAX_CHARS_FOR_TRANSLATION)
            : fullText;

        const chunks = splitIntoParagraphChunks(cappedText, CHUNK_SIZE);
        console.log(`[LLM] Translating ${chunks.length} chunks (${cappedText.length} chars, capped at 10 pages)`);

        const BATCH_SIZE = 3; // smaller batches — safer for Render free tier
        const translatedChunks = [];

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
                batch.map(async (chunk) => {
                    const prompt = `Translate this section of a Nigerian legal document into plain, conversational English. Preserve all meaning and structure. Remove all legalese. Write as if explaining to a Nigerian small business owner who has never read a contract before. Preserve paragraph breaks. Return ONLY the translation — no commentary, no labels, no preamble.

LEGAL TEXT:
${chunk}

PLAIN ENGLISH TRANSLATION:`;

                    // Try up to 2 times before falling back to original text
                    for (let attempt = 1; attempt <= 2; attempt++) {
                        try {
                            const response = await ai.models.generateContent({
                                model: modelName,
                                contents: prompt,
                                config: {
                                    maxOutputTokens: 8000,
                                    temperature: 0.15,
                                }
                            });
                            const result = (response.text || '').replace(/^PLAIN ENGLISH TRANSLATION:?/i, '').trim();
                            if (result) return result;
                        } catch (e) {
                            console.warn(`[LLM] Chunk translation attempt ${attempt} failed:`, e.message);
                            if (attempt < 2) await new Promise(r => setTimeout(r, 1000)); // wait 1s before retry
                        }
                    }
                    // Fallback: return original text for this chunk
                    return chunk;
                })
            );
            translatedChunks.push(...batchResults);
        }

        const fullTranslation = translatedChunks.join('\n\n');

        // If original was capped, note that at the end
        const truncationNote = fullText.length > MAX_CHARS_FOR_TRANSLATION
            ? '\n\n---\n\u26a0\ufe0f Note: This document exceeded 10 pages. Only the first 10 pages have been translated.'
            : '';

        return fullTranslation + truncationNote;
    } catch (error) {
        console.error('[LLM] translateFullDocument failed completely:', error.message);
        // Last-resort fallback: return the raw text formatted as paragraphs
        const paragraphs = fullText
            .split(/\n\s*\n/)
            .filter(p => p.trim().length > 20)
            .slice(0, 30)
            .join('\n\n');
        return paragraphs || null;
    }
}

module.exports = {
    generatePlainEnglish,
    generateDynamicForesight,
    translateFullDocument,
    warmupLLM
};
