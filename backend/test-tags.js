// Test Gemini tag generation
import { summarizeContent } from './src/services/gemini.service.js';

const testContent = `
Artificial Intelligence (AI) is transforming the technology landscape. Machine learning algorithms
enable computers to learn from data without explicit programming. Deep learning neural networks
can process images, text, and speech with human-like accuracy. Popular frameworks include TensorFlow,
PyTorch, and Keras. Applications span from computer vision to natural language processing.
`;

const testUrl = 'https://example.com/ai-guide';

console.log('Testing Gemini tag generation...\n');

summarizeContent(testContent, testUrl)
  .then(result => {
    console.log('✅ SUCCESS!\n');
    console.log('Title:', result.title);
    console.log('Description:', result.description);
    console.log('Tags:', result.tags);
    console.log('\nNumber of tags:', result.tags ? result.tags.length : 0);
  })
  .catch(error => {
    console.error('❌ FAILED:', error.message);
  });
