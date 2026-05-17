import pdfParse from 'pdf-parse';
console.log('Type of pdfParse:', typeof pdfParse);
if (typeof pdfParse === 'function') {
    console.log('Successfully loaded as a function!');
} else {
    console.log('Export keys:', Object.keys(pdfParse));
    console.log('Default export:', typeof pdfParse.default);
}
