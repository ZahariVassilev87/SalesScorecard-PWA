// Simple script to clear invalid tokens
console.log('🔧 Clearing invalid tokens...');

// Clear all offline data
localStorage.removeItem('offlineEvaluations');
localStorage.removeItem('offlineUserUpdates');

// Check current token
const currentToken = localStorage.getItem('userToken');
if (currentToken && !currentToken.includes('.')) {
    console.log('❌ Current token is invalid, removing it...');
    localStorage.removeItem('userToken');
} else {
    console.log('✅ Current token is valid');
}

console.log('✅ All invalid data cleared!');
console.log('🔄 Please refresh the page and try the sync again.');


