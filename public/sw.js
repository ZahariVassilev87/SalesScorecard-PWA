// Service Worker for Sales Scorecard PWA
// Provides caching, offline capabilities, and performance improvements

const CACHE_NAME = 'sales-scorecard-v1.5.0';
const STATIC_CACHE_NAME = 'sales-scorecard-static-v1.5.0';
const DYNAMIC_CACHE_NAME = 'sales-scorecard-dynamic-v1.5.0';
const OFFLINE_CACHE_NAME = 'sales-scorecard-offline-v1.5.0';

// Files to cache immediately
const STATIC_ASSETS = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-384x384.png'
];

// API endpoints to cache
const API_CACHE_PATTERNS = [
  /\/api\/auth\/login/,
  /\/api\/users/,
  /\/api\/teams/,
  /\/api\/evaluations/,
  /\/scoring\/categories/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static assets', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName !== CACHE_NAME &&
                cacheName !== OFFLINE_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated successfully');
        return self.clients.claim();
      })
      .then(() => {
        // Clean up old dynamic cache entries
        return cleanupOldCacheEntries();
      })
  );
});

// Clean up old cache entries to prevent unlimited growth
async function cleanupOldCacheEntries() {
  try {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const requests = await cache.keys();
    
    // Keep only the last 50 entries
    if (requests.length > 50) {
      const entriesToDelete = requests.slice(0, requests.length - 50);
      await Promise.all(
        entriesToDelete.map(request => cache.delete(request))
      );
      console.log(`Service Worker: Cleaned up ${entriesToDelete.length} old cache entries`);
    }
  } catch (error) {
    console.error('Service Worker: Failed to cleanup old cache entries', error);
  }
}

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Handle different types of requests with optimized strategies
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirst(request));
  } else if (isApiRequest(request)) {
    event.respondWith(networkFirstWithTimeout(request));
  } else if (isNavigationRequest(request)) {
    event.respondWith(networkFirstWithFallback(request));
  } else if (isImageRequest(request)) {
    event.respondWith(cacheFirstWithFallback(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Cache First Strategy - for static assets
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Cache First Strategy failed:', error);
    return new Response('Offline - Resource not available', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    });
  }
}

// Network First Strategy - for API requests and navigation
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (isNavigationRequest(request)) {
      return caches.match('/') || new Response('Offline', { 
        status: 503, 
        statusText: 'Service Unavailable' 
      });
    }
    
    return new Response('Offline - Resource not available', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    });
  }
}

// Stale While Revalidate Strategy - for other requests
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(() => {
    // Network failed, return cached version if available
    return cachedResponse;
  });
  
  return cachedResponse || fetchPromise;
}

// Helper functions
function isStaticAsset(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/static/') ||
         url.pathname.endsWith('.js') ||
         url.pathname.endsWith('.css') ||
         url.pathname.endsWith('.png') ||
         url.pathname.endsWith('.jpg') ||
         url.pathname.endsWith('.jpeg') ||
         url.pathname.endsWith('.gif') ||
         url.pathname.endsWith('.svg') ||
         url.pathname.endsWith('.ico') ||
         url.pathname.endsWith('.woff') ||
         url.pathname.endsWith('.woff2') ||
         url.pathname.endsWith('.ttf') ||
         url.pathname.endsWith('.eot');
}

function isApiRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/') ||
         url.pathname.startsWith('/scoring/') ||
         API_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname));
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
         (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

function isImageRequest(request) {
  const url = new URL(request.url);
  return url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i);
}

// Network First with Timeout - for API requests
async function networkFirstWithTimeout(request) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), 5000); // 5 second timeout
  });

  try {
    const networkResponse = await Promise.race([
      fetch(request),
      timeoutPromise
    ]);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed with timeout, trying cache:', error);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return new Response('Offline - API not available', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    });
  }
}

// Network First with Fallback - for navigation requests
async function networkFirstWithFallback(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    return caches.match('/') || new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Sales Scorecard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .offline-message { color: #666; }
            .retry-button { 
              background: #007bff; color: white; border: none; 
              padding: 10px 20px; border-radius: 5px; cursor: pointer; 
            }
          </style>
        </head>
        <body>
          <h1>📴 You're Offline</h1>
          <p class="offline-message">This page is not available offline.</p>
          <button class="retry-button" onclick="window.location.reload()">Retry</button>
        </body>
      </html>
    `, { 
      status: 200, 
      statusText: 'OK',
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Cache First with Fallback - for images
async function cacheFirstWithFallback(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Cache First with Fallback failed:', error);
    // Return a placeholder image or 1x1 transparent pixel
    return new Response(
      'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9InRyYW5zcGFyZW50Ii8+PC9zdmc+',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  } else if (event.tag === 'sync-evaluations') {
    event.waitUntil(syncPendingEvaluations());
  } else if (event.tag === 'sync-user-data') {
    event.waitUntil(syncUserData());
  }
});

async function doBackgroundSync() {
  try {
    console.log('Service Worker: Performing background sync');
    
    // Sync all pending offline actions
    await Promise.all([
      syncPendingEvaluations(),
      syncUserData(),
      updateCachedData()
    ]);
    
  } catch (error) {
    console.error('Service Worker: Background sync failed', error);
  }
}

async function syncPendingEvaluations() {
  try {
    const pendingEvaluations = await getOfflineData('pendingEvaluations');
    if (!pendingEvaluations || pendingEvaluations.length === 0) {
      return;
    }
    
    console.log(`Service Worker: Syncing ${pendingEvaluations.length} pending evaluations`);
    
    for (const evaluation of pendingEvaluations) {
      try {
        const response = await fetch('/api/evaluations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${evaluation.token}`
          },
          body: JSON.stringify(evaluation.data)
        });
        
        if (response.ok) {
          // Remove from pending list
          await removeOfflineData('pendingEvaluations', evaluation.id);
          console.log('Service Worker: Evaluation synced successfully', evaluation.id);
        }
      } catch (error) {
        console.error('Service Worker: Failed to sync evaluation', evaluation.id, error);
      }
    }
  } catch (error) {
    console.error('Service Worker: Failed to sync pending evaluations', error);
  }
}

async function syncUserData() {
  try {
    const pendingUserUpdates = await getOfflineData('pendingUserUpdates');
    if (!pendingUserUpdates || pendingUserUpdates.length === 0) {
      return;
    }
    
    console.log(`Service Worker: Syncing ${pendingUserUpdates.length} pending user updates`);
    
    for (const update of pendingUserUpdates) {
      try {
        const response = await fetch(update.endpoint, {
          method: update.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${update.token}`
          },
          body: JSON.stringify(update.data)
        });
        
        if (response.ok) {
          await removeOfflineData('pendingUserUpdates', update.id);
          console.log('Service Worker: User update synced successfully', update.id);
        }
      } catch (error) {
        console.error('Service Worker: Failed to sync user update', update.id, error);
      }
    }
  } catch (error) {
    console.error('Service Worker: Failed to sync user data', error);
  }
}

async function updateCachedData() {
  try {
    // Update cached API data when online
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
    const urlsToUpdate = [
      '/api/teams',
      '/api/users',
      '/scoring/categories'
    ];
    
    for (const url of urlsToUpdate) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response.clone());
          console.log('Service Worker: Updated cached data for', url);
        }
      } catch (error) {
        console.error('Service Worker: Failed to update cached data for', url, error);
      }
    }
  } catch (error) {
    console.error('Service Worker: Failed to update cached data', error);
  }
}

// Offline data storage helpers
async function getOfflineData(key) {
  try {
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    const response = await cache.match(`/offline-data/${key}`);
    if (response) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Service Worker: Failed to get offline data', key, error);
    return null;
  }
}

async function setOfflineData(key, data) {
  try {
    const cache = await caches.open(OFFLINE_CACHE_NAME);
    const response = new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put(`/offline-data/${key}`, response);
  } catch (error) {
    console.error('Service Worker: Failed to set offline data', key, error);
  }
}

async function removeOfflineData(key, itemId) {
  try {
    const data = await getOfflineData(key);
    if (data && Array.isArray(data)) {
      const filteredData = data.filter(item => item.id !== itemId);
      await setOfflineData(key, filteredData);
    }
  } catch (error) {
    console.error('Service Worker: Failed to remove offline data', key, itemId, error);
  }
}

// Push notifications (if needed in the future)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View Details',
        icon: '/logo192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/logo192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Sales Scorecard', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('Service Worker: Error occurred', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker: Unhandled promise rejection', event.reason);
});

console.log('Service Worker: Script loaded successfully');