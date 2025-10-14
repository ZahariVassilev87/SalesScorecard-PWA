// Simple Service Worker for Push Notifications and Offline Sync
// No caching to avoid refresh issues

console.log('🔄 Simple Service Worker loading...');

// Skip waiting and claim clients immediately
self.addEventListener('install', (event) => {
  console.log('🔄 Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Handle fetch events - NEVER cache anything
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-HTTP requests (chrome-extension, etc.)
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // For API calls - NEVER cache, always network
  if (url.pathname.startsWith('/api/') || url.hostname === 'api.instorm.io') {
    event.respondWith(
      fetch(event.request, {
        cache: 'no-cache'
        // Don't add extra headers - let the original request headers pass through
        // Safari might reject the additional cache-busting headers
      }).catch(() => {
        // If network fails, return offline response
        return new Response(JSON.stringify({ 
          error: 'Network unavailable',
          offline: true 
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
  
  // For everything else, just pass through (no caching)
  event.respondWith(fetch(event.request));
});

// Background sync for offline functionality
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  console.log('🔄 Background sync triggered');
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: data.tag || 'default',
      data: data.data
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Sales Scorecard', options)
    );
  }
});

// Skip waiting and claim clients immediately
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('✅ Simple Service Worker loaded');

