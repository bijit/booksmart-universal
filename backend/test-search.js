
import dotenv from 'dotenv';
dotenv.config();

async function listModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_AI_API_KEY}`);
    const data = await response.json();
    console.log("Available models:", data.models.map(m => m.name).filter(n => n.includes('gemini')));
  } catch (e) {
    console.error("Error fetching models:", e);
  }
}
listModels();
