require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Say hello world in 3 words.',
    });
    console.log("SUCCESS:", response.text);
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}
test();
