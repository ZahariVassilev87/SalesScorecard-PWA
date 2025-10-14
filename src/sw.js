/* eslint-disable no-restricted-globals */
import { cleanupOutdatedCaches } from 'workbox-precaching';

// TEMPORARILY DISABLED PRECACHING FOR DEBUGGING - NO CACHING OF ANY ASSETS
// precacheAndRoute(self.__WB_MANIFEST);

// Clean up old caches automatically
cleanupOutdatedCaches();

// Override fetch to handle API calls differently
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
        cache: 'no-cache',
        headers: {
          ...event.request.headers,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
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
  
  // For everything else, use default behavior (precached assets)
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

self.addEventListener('install', (event) => {
  console.log('🔄 Service Worker installing...');
  // TEMPORARILY DISABLED FOR PWA DEBUGGING - self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activated');
  // TEMPORARILY DISABLED FOR PWA DEBUGGING - event.waitUntil(self.clients.claim());
});
