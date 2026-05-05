const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const modelName = 'gemini-2.5-flash';

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
                maxOutputTokens: 80,
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
                maxOutputTokens: 60,
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

module.exports = {
    generatePlainEnglish,
    generateDynamicForesight,
    warmupLLM
};
