import fs from 'fs';
import { extractDocumentContent } from './src/services/document.service.js';
import https from 'https';

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function testPDF() {
  const url = 'https://pdfobject.com/pdf/sample.pdf';
  
  try {
    console.log(`Testing PDF extraction from URL...`);
    const result = await extractDocumentContent(url);
    
    console.log('\n--- EXTRACTION RESULTS ---');
    console.log('Success:', !!result.success);
    console.log('Content Length:', result?.content?.length || 0, 'characters');
    console.log('Extracted Text:\n', result?.content?.substring(0, 200) + '...');
    console.log('--------------------------');
  } catch (error) {
    console.error('PDF Test Failed:', error);
  }
}

testPDF();
