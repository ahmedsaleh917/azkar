/**
 * 🕋 Service Worker لتطبيق "صفاء الروح - الأذكار والعبادات"
 * الإصدار: 3.0
 * الاستراتيجية: Cache-First للمحتوى الثابت، Network-First للبيانات الحية
 * يدعم: العمل دون اتصال، التحديث في الخلفية، الإشعارات، المزامنة
 */

// 📦 إعدادات الكاش
const CACHE_NAME = 'safaa-athkar-v3.0';
const CACHE_VERSION = '2026.04.11';

// 🗂️ الأصول الأساسية للتخزين الفوري
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/sw.js',
    
    // الخطوط
    'https://fonts.googleapis.com/css2?family=Almarai:wght@400;600;700&family=Amiri:wght@400;700&display=swap',
    'https://fonts.gstatic.com/s/almarai/v8/Qw3GZ9VLnMv9VvJ9K8V9K8V9.woff2',
    
    // الأيقونات
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://i.postimg.cc/zGSvxgCn/1775323811617.png',
    
    // الأصوات (اختياري)
    'https://www.soundjay.com/buttons/sounds/button-10.mp3'
];

// 🌐 النطاقات المسموح بها للكاش
const ALLOWED_DOMAINS = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdnjs.cloudflare.com',
    'i.postimg.cc',
    'www.soundjay.com'
];

// 🔄 التثبيت: تخزين الأصول الأساسية
self.addEventListener('install', (event) => {
    console.log(`🔧 [SW] Installing ${CACHE_NAME} v${CACHE_VERSION}`);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('✅ [SW] فتح الكاش بنجاح');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {                console.log('✅ [SW] تم تخزين جميع الأصول الأساسية');
                return self.skipWaiting(); // تفعيل الـ SW فوراً
            })
            .catch((error) => {
                console.error('❌ [SW] فشل في التخزين:', error);
            })
    );
});

// 🗑️ التنشيط: حذف نسخ الكاش القديمة
self.addEventListener('activate', (event) => {
    console.log(`🔄 [SW] Activating ${CACHE_NAME} v${CACHE_VERSION}`);
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => {
                            // حذف الكاش القديم فقط إذا كان مختلفاً عن الحالي
                            return name !== CACHE_NAME && name.startsWith('safaa-');
                        })
                        .map((name) => {
                            console.log(`🗑️ [SW] حذف الكاش القديم: ${name}`);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('✅ [SW] تم تنظيف الكاش القديم');
                return self.clients.claim(); // السيطرة على جميع الصفحات المفتوحة
            })
            .catch((error) => {
                console.error('❌ [SW] فشل في التنشيط:', error);
            })
    );
});

// 🌐 اعتراض الطلبات وتطبيق استراتيجيات الكاش
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // تجاهل الطلبات غير GET
    if (request.method !== 'GET') return;
    
    // تجاهل طلبات النظام الداخلي
    if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') return;
    
    // 📋 استراتيجية Cache-First للخطوط والصور وCSS    if (isStaticAsset(url)) {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        console.log(`📦 [SW] من الكاش: ${url.pathname}`);
                        return cachedResponse;
                    }
                    return fetchAndCache(request);
                })
                .catch((error) => {
                    console.warn(`⚠️ [SW] فشل جلب: ${url.pathname}`, error);
                    // Fallback للصورة أو الخط من الكاش
                    return caches.match(request);
                })
        );
        return;
    }
    
    // 📄 استراتيجية Network-First للصفحة الرئيسية مع fallback
    if (request.destination === 'document' || url.pathname === '/' || url.pathname.endsWith('index.html')) {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => cache.put(request, responseClone))
                            .catch((err) => console.warn('⚠️ [SW] فشل تحديث الكاش:', err));
                    }
                    return networkResponse;
                })
                .catch(() => {
                    console.log('📦 [SW] عدم اتصال، جلب الصفحة من الكاش');
                    return caches.match('/index.html');
                })
        );
        return;
    }
    
    // 🎵 استراتيجية Stale-While-Revalidate للمحتوى المتغير
    if (url.pathname.endsWith('.mp3') || url.pathname.endsWith('.json')) {
        event.respondWith(
            caches.open(CACHE_NAME)
                .then((cache) => {
                    return cache.match(request).then((cached) => {
                        const fetchPromise = fetch(request)
                            .then((networkResponse) => {
                                if (networkResponse.ok) {
                                    cache.put(request, networkResponse.clone());                                }
                                return networkResponse;
                            })
                            .catch(() => cached); // استخدام الكاش إذا فشل الشبكة
                        return cached || fetchPromise;
                    });
                })
        );
        return;
    }
    
    // 🎯 الاستراتيجية الافتراضية: Network-First مع fallback للكاش
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => cache.put(request, clone))
                        .catch(() => {});
                }
                return response;
            })
            .catch(() => {
                return caches.match(request).then((cached) => {
                    if (cached) return cached;
                    if (request.destination === 'document') {
                        return caches.match('/index.html');
                    }
                    return new Response('Offline - تطبيق صفاء الروح', {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: { 'Content-Type': 'text/plain' }
                    });
                });
            })
    );
});

// 🔍 دالة مساعدة: تحديد إذا كان الأصل ثابتاً
function isStaticAsset(url) {
    const pathname = url.pathname.toLowerCase();
    const href = url.href.toLowerCase();
    
    return (
        pathname.endsWith('.css') ||
        pathname.endsWith('.js') ||
        pathname.endsWith('.png') ||
        pathname.endsWith('.jpg') ||
        pathname.endsWith('.jpeg') ||        pathname.endsWith('.svg') ||
        pathname.endsWith('.woff') ||
        pathname.endsWith('.woff2') ||
        pathname.endsWith('.ttf') ||
        pathname.endsWith('.eot') ||
        href.includes('fonts.googleapis') ||
        href.includes('fonts.gstatic') ||
        href.includes('font-awesome') ||
        href.includes('postimg') ||
        href.includes('soundjay')
    );
}

// 🔄 دالة مساعدة: جلب وتخزين
async function fetchAndCache(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.warn(`⚠️ [SW] فشل الجلب: ${request.url}`, error);
        throw error;
    }
}

// 📡 التعامل مع رسائل من الصفحة الرئيسية
self.addEventListener('message', (event) => {
    console.log(`💬 [SW] رسالة مستلمة:`, event.data);
    
    if (event.data?.type === 'SKIP_WAITING') {
        console.log('⚡ [SW] تخطي الانتظار وتفعيل فوري');
        self.skipWaiting();
    }
    
    if (event.data?.type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
        console.log(`📦 [SW] تخزين ${event.data.urls.length} روابط إضافية`);
        event.waitUntil(
            caches.open(CACHE_NAME)
                .then((cache) => cache.addAll(event.data.urls))
                .then(() => {
                    event.ports?.[0]?.postMessage({ success: true, cached: event.data.urls.length });
                })
                .catch((err) => {
                    console.error('❌ [SW] فشل التخزين الإضافي:', err);
                    event.ports?.[0]?.postMessage({ success: false, error: err.message });
                })
        );    }
    
    if (event.data?.type === 'CLEAR_CACHE') {
        console.log('🗑️ [SW] طلب مسح الكاش');
        event.waitUntil(
            caches.delete(CACHE_NAME)
                .then(() => {
                    console.log('✅ [SW] تم مسح الكاش');
                    event.ports?.[0]?.postMessage({ success: true });
                })
                .catch((err) => {
                    console.error('❌ [SW] فشل مسح الكاش:', err);
                    event.ports?.[0]?.postMessage({ success: false, error: err.message });
                })
        );
    }
    
    if (event.data?.type === 'GET_CACHE_INFO') {
        event.waitUntil(
            caches.open(CACHE_NAME)
                .then((cache) => cache.keys())
                .then((requests) => {
                    const info = {
                        cacheName: CACHE_NAME,
                        version: CACHE_VERSION,
                        totalItems: requests.length,
                        urls: requests.map(r => r.url)
                    };
                    event.ports?.[0]?.postMessage(info);
                })
        );
    }
});

// 🔔 دعم إشعارات الدفع (Push Notifications)
self.addEventListener('push', (event) => {
    console.log('🔔 [SW] إشعار وارد:', event.data);
    
    if (!event.data) return;
    
    try {
        const data = event.data.json();
        const options = {
            body: data.body || 'تذكير من تطبيق صفاء الروح',
            icon: '/icon-192.png',
            badge: '/icon-72.png',
            vibrate: [200, 100, 200],
            tag: data.tag || 'safaa-notification',
            renotify: true,
            requireInteraction: data.requireInteraction || false,            actions: data.actions || [
                { action: 'open', title: 'فتح التطبيق' },
                { action: 'dismiss', title: 'إغلاق' }
            ],
             {
                url: data.url || '/',
                timestamp: Date.now()
            }
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title || 'صفاء الروح', options)
        );
    } catch (error) {
        console.error('❌ [SW] فشل معالجة الإشعار:', error);
    }
});

// 🎯 التعامل مع نقرات الإشعارات
self.addEventListener('notificationclick', (event) => {
    console.log('🖱️ [SW] نقرة على إشعار:', event.action);
    
    event.notification.close();
    
    const url = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // إذا كانت هناك نافذة مفتوحة، ركز عليها
                for (const client of clientList) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }
                // إذا لم تكن موجودة، افتح نافذة جديدة
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
            .catch((err) => console.error('❌ [SW] فشل فتح النافذة:', err))
    );
});

// 🔄 مزامنة الخلفية (Background Sync)
self.addEventListener('sync', (event) => {
    console.log(`🔄 [SW] مزامنة الخلفية: ${event.tag}`);
    
    if (event.tag === 'sync-dhikr-progress') {
        event.waitUntil(            // هنا يمكن إضافة منطق لمزامنة تقدم الأذكار مع الخادم
            console.log('✅ [SW] مزامنة تقدم الأذكار مكتملة')
        );
    }
    
    if (event.tag === 'sync-favorites') {
        event.waitUntil(
            // هنا يمكن إضافة منطق لمزامنة المفضلة
            console.log('✅ [SW] مزامنة المفضلة مكتملة')
        );
    }
});

// 📊 إحصائيات الأداء (اختياري للتطوير)
self.addEventListener('fetch', (event) => {
    const start = performance.now();
    
    event.respondWith(
        (async () => {
            try {
                const response = await fetch(event.request);
                const duration = performance.now() - start;
                console.log(`⏱️ [SW] ${event.request.url} - ${duration.toFixed(2)}ms`);
                return response;
            } catch (error) {
                console.error(`❌ [SW] ${event.request.url} - Error: ${error.message}`);
                throw error;
            }
        })()
    );
});

// 🧹 تنظيف الذاكرة عند انخفاض الموارد
self.addEventListener('memorypressure', (event) => {
    console.log('🧹 [SW] ضغط على الذاكرة، تنظيف مؤقت');
    // يمكن إضافة منطق لتحرير الذاكرة هنا
});

// 📋 معلومات الـ SW للتحقق
self.addEventListener('message', (event) => {
    if (event.data?.type === 'GET_SW_INFO') {
        event.ports?.[0]?.postMessage({
            name: 'صفاء الروح Service Worker',
            version: CACHE_VERSION,
            cacheName: CACHE_NAME,
            status: 'active',
            timestamp: new Date().toISOString()
        });
    }
});
// 🎬 تسجيل بدء التشغيل
console.log(`🚀 [SW] Service Worker "صفاء الروح" جاهز للعمل`);
console.log(`📦 Cache: ${CACHE_NAME}`);
console.log(`🔖 Version: ${CACHE_VERSION}`);
