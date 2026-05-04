const { pipeline, env } = require('@xenova/transformers');

// Configure transformers to use local cache and avoid some issues
env.allowLocalModels = false;
env.useBrowserCache = false;

let generatorPromise = null;
let modelReady = false;

/**
 * Initializes the local text generation pipeline.
 * Using a small but capable model: LaMini-Flan-T5-77M
 * This model is ~300MB and very good at instruction following for its size.
 */
async function getGenerator() {
    if (!generatorPromise) {
        console.log('[LLM] Loading local dynamic generation model (LaMini-Flan-T5-77M)...');
        generatorPromise = pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-77M')
            .then(gen => {
                modelReady = true;
                console.log('[LLM] ✓ Model ready.');
                return gen;
            })
            .catch(err => {
                console.error('[LLM] ✗ Model failed to load:', err.message);
                generatorPromise = null; // Allow retry on next request
                throw err;
            });
    }
    return generatorPromise;
}

/**
 * Pre-warm the model during server startup (non-blocking).
 */
async function warmupLLM() {
    try {
        await getGenerator();
    } catch (e) {
        console.warn('[LLM] Warmup failed, will retry on first request.');
    }
}

/**
 * Helper: Run a promise with a timeout. Returns null if it takes too long.
 */
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve(null), ms))
    ]);
}

/**
 * Dynamically generates a Plain English summary using a local transformer.
 * Returns null (triggering fallback) if the model isn't ready or times out.
 */
async function generatePlainEnglish(clause, rule, statute, persona = 'general') {
    // Skip if model isn't loaded yet (first request after cold start)
    if (!modelReady) {
        console.log('[LLM] Model not ready yet, using fallback.');
        return null;
    }

    try {
        const generator = await getGenerator();
        
        // Refined "Blunt" prompt for LaMini models to ensure maximum clarity
        const prompt = `Rewrite this legal clause for a 10-year-old. Be short, blunt, and tell them exactly how they lose money.
Legal Clause: "${clause}"
Plain English Summary:`;

        const output = await withTimeout(generator(prompt, {
            max_new_tokens: 80,
            temperature: 0.2,
            repetition_penalty: 1.5,
            no_repeat_ngram_size: 3
        }), 15000); // 15 second timeout

        if (!output) {
            console.warn('[LLM] Generation timed out.');
            return null;
        }

        let result = output[0]?.generated_text || "";
        result = result.replace(/^Plain English:/i, '').trim();
        
        return result ? `✅ WHAT THIS MEANS: ${result}` : null;
    } catch (error) {
        console.error("[LLM] Local generation failed:", error.message);
        return null;
    }
}

/**
 * Dynamically generates foresight consequences for a local transformer.
 * Returns null (triggering fallback) if the model isn't ready or times out.
 */
async function generateDynamicForesight(clause, rule, persona = 'general') {
    if (!modelReady) {
        return null;
    }

    try {
        const generator = await getGenerator();
        
        const prompt = `Predict a 6-month consequence for a ${persona} given this clause: "${clause}". Risk: ${rule}. Consequence:`;

        const output = await withTimeout(generator(prompt, {
            max_new_tokens: 60,
            temperature: 0.5,
            repetition_penalty: 1.5,
            no_repeat_ngram_size: 3
        }), 15000);

        if (!output) {
            console.warn('[LLM] Foresight timed out.');
            return null;
        }

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
    generateDynamicForesight,
    warmupLLM
};
