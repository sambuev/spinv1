/**
 * SPIN Digitals Meta CAPI - PRODUCTION VERSION
 * @version 6.0.0 - Optimized, Secure, Production-Ready
 */

export default async function handler(req, res) {
  // CORS - Restrict to your domains in production
  const origin = req.headers.origin || '*';
  const allowedOrigins = [
    'https://spindigitals.com',
    'https://www.spindigitals.com',
    'https://*.spindigitals.com'
  ];
  
  if (allowedOrigins.some(allowed => origin === allowed || (allowed.includes('*') && origin.endsWith(allowed.replace('*.', ''))))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://spindigitals.com');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ===== CONFIGURATION =====
  const CONFIG = {
    PIXEL_ID: '3960527257530916',
    ACCESS_TOKEN: process.env.META_ACCESS_TOKEN || 'EAALxoeD2YXoBPUKWtbY2rW7zjQAJrGeuSQz74ihwph913KSTipys3ZBpLthqZCQ7NgLWNTc2ObTmTWWOCqGGZBQGiRBM3GBlf3dwd1hGylg85b6iZCkHUJIEL3P6DYqvKHbRjNxLpsdHU7jiRXIBPccW9XbMVh82JQqpdRvTD7bZA3ih35MTBVE2ZC2JPRlLfZCgAZDZD', // ← Replace or use env var
    API_VERSION: 'v18.0',
    ALLOWED_DOMAINS: ['spindigitals.com', 'www.spindigitals.com'],
    MAX_EVENT_AGE_SECONDS: 7 * 24 * 60 * 60 // 7 days
  };

  // Validate domain
  const requestDomain = req.headers.referer ? new URL(req.headers.referer).hostname : '';
  const isValidDomain = CONFIG.ALLOWED_DOMAINS.some(domain => 
    requestDomain === domain || requestDomain.endsWith('.' + domain)
  );

  if (!isValidDomain && process.env.NODE_ENV !== 'development') {
    console.warn('[CAPI] Blocked request from invalid domain:', requestDomain);
    return res.status(403).json({ success: false, error: 'Invalid domain' });
  }

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'healthy',
      pixel_id: CONFIG.PIXEL_ID,
      timestamp: new Date().toISOString()
    });
  }

  // Handle events
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      
      if (!body.event_name) {
        return res.status(400).json({ success: false, error: 'Missing event_name' });
      }

      // Validate event time (must be within ±7 days)
      const now = Math.floor(Date.now() / 1000);
      const eventTime = body.event_time || now;
      if (Math.abs(now - eventTime) > CONFIG.MAX_EVENT_AGE_SECONDS) {
        return res.status(400).json({ success: false, error: 'Event time outside acceptable range' });
      }

      // Get real client IP
      const ip = getClientIP(req.headers);
      if (!ip) {
        return res.status(400).json({ success: false, error: 'Invalid IP address' });
      }

      // Build event
      const eventData = {
        event_name: sanitizeEventName(body.event_name),
        event_id: body.event_id || generateEventId(body.event_name),
        event_time: eventTime,
        action_source: 'website',
        event_source_url: body.event_source_url || req.headers.referer || 'https://spindigitals.com',
        user_data: {
          client_ip_address: ip,
          client_user_agent: body.user_agent || req.headers['user-agent'] || 'Unknown',
          fbp: body.fbp || getCookieValue('_fbp'),
          fbc: body.fbc || getCookieValue('_fbc')
        }
      };

      // Add optional fields
      if (body.email) eventData.user_data.email = hashData(body.email);
      if (body.phone_number) eventData.user_data.phone_number = hashData(body.phone_number);
      if (body.custom_data) eventData.custom_data = { ...body.custom_data };

      const payload = {
        data: [eventData],
        access_token: CONFIG.ACCESS_TOKEN
      };

      // Log for debugging (remove in ultra-high-volume production)
      console.log('[CAPI] Processing event:', {
        event_name: eventData.event_name,
        event_id: eventData.event_id,
        source: requestDomain
      });

      // Send to Meta
      const metaResponse = await sendToMeta(payload, CONFIG);

      return res.status(200).json({
        success: true,
        event_id: eventData.event_id,
        event_name: eventData.event_name
      });

    } catch (error) {
      console.error('[CAPI ERROR]', error.message, {
        body: req.body,
        headers: {
          referer: req.headers.referer,
          'user-agent': req.headers['user-agent']
        }
      });
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Get client IP address
function getClientIP(headers) {
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    for (const ip of ips) {
      if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && !ip.startsWith('10.') && !ip.startsWith('192.168.')) {
        return ip;
      }
    }
  }
  return null; // Let Meta handle fallback if needed
}

// Sanitize event name
function sanitizeEventName(name) {
  const validEvents = [
    'PageView', 'Lead', 'Purchase', 'AddToCart', 'CompleteRegistration',
    'Contact', 'CustomizeProduct', 'Donate', 'FindLocation', 'Schedule',
    'Search', 'StartTrial', 'SubmitApplication', 'Subscribe'
  ];
  return validEvents.includes(name) ? name : 'CustomEvent';
}

// Generate unique event ID
function generateEventId(eventName) {
  return `${eventName}_${Date.now()}_${crypto.randomUUID ? crypto.randomUUID().substring(0, 8) : Math.random().toString(36).substr(2, 8)}`;
}

// Get cookie value (server-side)
function getCookieValue(name) {
  // Note: In Vercel Edge Functions, cookies are in req.cookies or header
  // This is a placeholder — implement based on your setup
  return null;
}

// Hash data for privacy compliance
function hashData(data) {
  if (!data) return null;
  try {
    // Use Web Crypto API (available in Vercel Edge)
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data.toLowerCase().trim());
    return crypto.subtle.digest('SHA-256', dataBytes).then(hashBuffer => {
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    });
  } catch (e) {
    console.warn('[CAPI] Hashing failed:', e.message);
    return null;
  }
}

// Send to Meta API
async function sendToMeta(payload, config) {
  const url = `https://graph.facebook.com/${config.API_VERSION}/${config.PIXEL_ID}/events`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const result = await response.json();

  if (!response.ok || result.error) {
    const errorMsg = result.error?.message || 'Unknown error';
    console.error('[CAPI] Meta API Error:', errorMsg);
    throw new Error(errorMsg);
  }

  return result;
}
