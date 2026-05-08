'use strict';
const fs = require('fs');
const path = require('path');

const versusDir = 'C:/CosmicGamesHub/versus';
const files = fs.readdirSync(versusDir).filter(f => f.endsWith('.html') && f !== 'index.html');

let updated = 0;
let skipped = 0;

files.forEach(f => {
  const filePath = path.join(versusDir, f);
  let src = fs.readFileSync(filePath, 'utf8');

  if (src.includes('"FAQPage"')) {
    console.log(f + ': already has FAQPage schema');
    skipped++;
    return;
  }

  // Extract FAQ Q&A pairs — handle both button/.faq__question and p/.faq-q styles
  let questions = [];
  let answers = [];

  // Style 1: <button class="faq__question"> + <div class="faq__answer">
  const qPattern1 = /<button class="faq__question"[^>]*>(.*?)<\/button>/gs;
  const aPattern1 = /<div class="faq__answer">([\s\S]*?)<\/div>/g;
  let m;
  while ((m = qPattern1.exec(src)) !== null) questions.push(m[1].trim());
  while ((m = aPattern1.exec(src)) !== null) answers.push(m[1].trim().replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());

  // Style 2: <p class="faq-q"> + <p class="faq-a">
  if (questions.length === 0) {
    const qPattern2 = /<p class="faq-q">([\s\S]*?)<\/p>/g;
    const aPattern2 = /<p class="faq-a">([\s\S]*?)<\/p>/g;
    while ((m = qPattern2.exec(src)) !== null) questions.push(m[1].trim());
    while ((m = aPattern2.exec(src)) !== null) answers.push(m[1].trim().replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  }

  // Style 3: <details class="faq-item"><summary>Q</summary><p>A</p></details>
  if (questions.length === 0) {
    const detailsPattern = /<details[^>]*>[\s\S]*?<summary>([\s\S]*?)<\/summary>[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<\/details>/g;
    while ((m = detailsPattern.exec(src)) !== null) {
      questions.push(m[1].trim());
      answers.push(m[2].trim().replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    }
  }

  if (questions.length === 0) {
    console.log(f + ': no FAQ found, skipping');
    skipped++;
    return;
  }

  const pairs = questions.slice(0, answers.length).map((q, i) => ({
    "@type": "Question",
    "name": q,
    "acceptedAnswer": { "@type": "Answer", "text": answers[i] }
  }));

  const schema = `  <script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": ${JSON.stringify(pairs, null, 4).replace(/^/gm, '  ').trim()}
}
  </script>`;

  // Insert before </head>
  if (!src.includes('</head>')) {
    console.log(f + ': no </head> found, skipping');
    skipped++;
    return;
  }

  src = src.replace('</head>', schema + '\n</head>');
  fs.writeFileSync(filePath, src, 'utf8');
  console.log(f + ': FAQPage schema added (' + pairs.length + ' Q&As)');
  updated++;
});

console.log('\nDone: ' + updated + ' updated, ' + skipped + ' skipped');
