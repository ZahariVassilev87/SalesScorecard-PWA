const https = require('https');

// Test the debug delete endpoint to see FK constraint details
const userId = 'cmfkvi3vd00011113hrso4mfl';
const token = 'your_jwt_token_here'; // You'll need to get this from browser dev tools

const options = {
  hostname: 'api.instorm.io',
  port: 443,
  path: `/public-admin/debug-delete/${userId}`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    try {
      const json = JSON.parse(data);
      console.log('Parsed JSON:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Not JSON response');
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.end();
