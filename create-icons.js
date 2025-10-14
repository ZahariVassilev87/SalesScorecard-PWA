const fs = require('fs');
const path = require('path');

// Simple SVG-based icon generator
const sizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];

sizes.forEach(size => {
  const svg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)"/>
  <circle cx="${size/2}" cy="${size/2}" r="${size/3}" fill="white"/>
  <text x="${size/2}" y="${size/2 + size/20}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${size/3}" font-weight="bold" fill="#667eea">S</text>
</svg>`;

  // Convert SVG to PNG using a simple approach - create a data URL
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  
  // For now, let's create a simple colored square as PNG data
  // This is a simplified approach - in production you'd use a proper image library
  const canvas = `
<!DOCTYPE html>
<html>
<head>
  <title>Icon Generator</title>
</head>
<body>
  <canvas id="canvas" width="${size}" height="${size}" style="display:none;"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, ${size}, ${size});
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    
    // Fill background
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ${size}, ${size});
    
    // Add white circle
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(${size/2}, ${size/2}, ${size/3}, 0, 2 * Math.PI);
    ctx.fill();
    
    // Add "S" text
    ctx.fillStyle = '#667eea';
    ctx.font = 'bold ${size/3}px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', ${size/2}, ${size/2});
    
    // Convert to PNG and download
    canvas.toBlob(function(blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'icon-${size}x${size}.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  </script>
</body>
</html>`;

  fs.writeFileSync(`icon-${size}x${size}.html`, canvas);
});

console.log('Icon generator files created. Open each HTML file in browser to download icons.');






