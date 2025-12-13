// Script to update all wireframe files with responsive CSS
const fs = require('fs');
const path = require('path');

const wireframesDir = __dirname;
const files = fs.readdirSync(wireframesDir);

// List of wireframe files to update
const wireframeFiles = [
  'job-preferences.html',
  'candidate-resume.html',
  'job-descriptions.html',
  'painpoint-match.html',
  'find-contact.html',
  'context-research.html',
  'offer-creation.html',
  'compose.html',
  'campaign.html',
  'deliverability-launch.html'
];

// Update each wireframe file
wireframeFiles.forEach(filename => {
  const filePath = path.join(wireframesDir, filename);
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if responsive.css is already included
    if (!content.includes('responsive.css')) {
      // Add responsive.css link after styles.css
      content = content.replace(
        '<link rel="stylesheet" href="../styles.css" />',
        '<link rel="stylesheet" href="../styles.css" />\n<link rel="stylesheet" href="responsive.css" />'
      );
      
      // Write updated content back to file
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${filename} with responsive CSS`);
    } else {
      console.log(`${filename} already has responsive CSS`);
    }
  } else {
    console.log(`${filename} not found`);
  }
});

console.log('Responsive CSS update complete!');
