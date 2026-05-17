import { generateEmbedding } from './src/services/gemini.service.js';

async function run() {
  try {
    console.log('Testing empty query embedding...');
    const result = await generateEmbedding(" ");
    console.log('Success! Vector length:', result.length);
  } catch (e) {
    console.error('Failed:', e.message);
  }
}
run();
