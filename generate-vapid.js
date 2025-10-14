// Simple VAPID key generator for development
// In production, you should use a proper VAPID key generation library

const crypto = require('crypto');

// Generate a random key pair (simplified version)
const privateKey = crypto.randomBytes(32);
const publicKey = crypto.randomBytes(65);

// Convert to base64url format (VAPID format)
const vapidPublicKey = Buffer.from(publicKey).toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=/g, '');

const vapidPrivateKey = Buffer.from(privateKey).toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=/g, '');

console.log('VAPID Keys Generated:');
console.log('Public Key (for frontend):', vapidPublicKey);
console.log('Private Key (for backend):', vapidPrivateKey);
console.log('\nAdd this to your .env file:');
console.log(`REACT_APP_VAPID_PUBLIC_KEY=${vapidPublicKey}`);



