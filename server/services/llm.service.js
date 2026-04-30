const { pipeline, env } = require('@xenova/transformers');

// Configure transformers to use local cache and avoid some issues
env.allowLocalModels = false;
env.useBrowserCache = false;

let generatorPromise = null;

/**
 * Initializes the local text generation pipeline.
 * Using a small but capable model: LaMini-Flan-T5-77M
 * This model is ~300MB and very good at instruction following for its size.
 */
async function getGenerator() {
    if (!generatorPromise) {
        console.log('[LLM] Loading local dynamic generation model (LaMini-Flan-T5-77M)...');
        generatorPromise = pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-77M');
    }
    return generatorPromise;
}

/**
 * Dynamically generates a Plain English summary using a local transformer.
 */
async function generatePlainEnglish(clause, rule, statute, persona = 'general') {
    try {
        const generator = await getGenerator();
        
        // Refined "Blunt" prompt for LaMini models to ensure maximum clarity
        const prompt = `Rewrite this legal clause for a 10-year-old. Be short, blunt, and tell them exactly how they lose money.
Legal Clause: "${clause}"
Plain English Summary:`;

        const output = await generator(prompt, {
            max_new_tokens: 80,
            temperature: 0.2, // Lower temperature for more deterministic/stable output
            repetition_penalty: 1.5,
            no_repeat_ngram_size: 3
        });

        let result = output[0]?.generated_text || "";
        // Clean up common T5 artifacts
        result = result.replace(/^Plain English:/i, '').trim();
        
        return result ? `✅ WHAT THIS MEANS: ${result}` : null;
    } catch (error) {
        console.error("[LLM] Local generation failed:", error.message);
        return null;
    }
}

/**
 * Dynamically generates foresight consequences for a local transformer.
 */
async function generateDynamicForesight(clause, rule, persona = 'general') {
    try {
        const generator = await getGenerator();
        
        const prompt = `Predict a 6-month consequence for a ${persona} given this clause: "${clause}". Risk: ${rule}. Consequence:`;

        const output = await generator(prompt, {
            max_new_tokens: 60,
            temperature: 0.5,
            repetition_penalty: 1.5,
            no_repeat_ngram_size: 3
        });

        let result = output[0]?.generated_text || "";
        result = result.replace(/^Consequence:/i, '').trim();

        return result ? `🔮 Data Foresight: ${result}` : null;
    } catch (error) {
        console.error("[LLM] Local foresight failed:", error.message);
        return null;
    }
}

module.exports = {
    generatePlainEnglish,
    generateDynamicForesight
};
