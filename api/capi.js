/**
 * SPIN Digitals Meta CAPI - VERCEL EDGE COMPATIBLE VERSION
 * @version 6.0.2 - Fixed for Vercel Edge Runtime
 */

export default async function handler(req, res) {
  // CORS Headers
  const origin = req.headers.origin || 'https://spindigitals.com';
  
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Configuration
  const CONFIG = {
    PIXEL_ID: '3960527257530916',
    ACCESS_TOKEN: 'EAALxoeD2YXoBPUKWtbY2rW7zjQAJrGeuSQz74ihwph913KSTipys3ZBpLthqZCQ7NgLWNTc2ObTmTWWOCqGGZBQGiRBM3GBlf3dwd1hGylg85b6iZCkHUJIEL3P6DYqvKHbRjNxLpsdHU7jiRXIBPccW9XbMVh82JQqpdRvTD7bZA3ih35MTBVE2ZC2JPRlLfZCgAZDZD',
    API_VERSION: 'v18.0'
  };

  // Simple domain validation
  const referer = req.headers.referer || '';
  if (!referer.includes('spindigitals.com') && process.env.NODE_ENV !== 'development') {
    console.log('[CAPI] Invalid referer:', referer);
    return res.status(403).json({ success: false, error: 'Invalid domain' });
  }

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'healthy',
      pixel_id: CONFIG.PIXEL_ID,
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || 'unknown'
    });
  }

  // Handle POST requests
  if (req.method === 'POST') {
    try {
      console.log('[CAPI] Received POST request');
      
      const body = req.body || {};
      console.log('[CAPI] Request body:', JSON.stringify(body, null, 2));
      
      if (!body.event_name) {
        console.log('[CAPI] Missing event_name');
        return res.status(400).json({ success: false, error: 'Missing event_name' });
      }

      // Get client IP (simplified)
      const ip = getClientIP(req);
      console.log('[CAPI] Client IP:', ip);

      // Build event data
      const eventData = {
        event_name: sanitizeEventName(body.event_name),
        event_id: generateEventId(body.event_name),
        event_time: body.event_time || Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: body.event_source_url || referer,
        user_data: {
          client_ip_address: ip,
          client_user_agent: body.user_agent || req.headers['user-agent'] || 'Unknown'
        }
      };

      // Add Facebook cookies if available
      if (body.fbp) eventData.user_data.fbp = body.fbp;
      if (body.fbc) eventData.user_data.fbc = body.fbc;

      // Add hashed email/phone if provided (using Web Crypto API)
      if (body.email) {
        try {
          eventData.user_data.em = await hashWithWebCrypto(body.email);
        } catch (e) {
          console.warn('[CAPI] Email hashing failed:', e.message);
        }
      }

      if (body.phone_number) {
        try {
          eventData.user_data.ph = await hashWithWebCrypto(body.phone_number);
        } catch (e) {
          console.warn('[CAPI] Phone hashing failed:', e.message);
        }
      }

      // Add custom data
      if (body.custom_data && typeof body.custom_data === 'object') {
        eventData.custom_data = { ...body.custom_data };
      }

      const payload = {
        data: [eventData],
        access_token: CONFIG.ACCESS_TOKEN
      };

      console.log('[CAPI] Sending to Meta:', {
        event_name: eventData.event_name,
        event_id: eventData.event_id,
        has_custom_data: !!eventData.custom_data
      });

      // Send to Meta API
      const metaResponse = await sendToMeta(payload, CONFIG);
      
      console.log('[CAPI] Meta response:', metaResponse);

      return res.status(200).json({
        success: true,
        event_id: eventData.event_id,
        event_name: eventData.event_name,
        meta_events_received: metaResponse.events_received || 0
      });

    } catch (error) {
      console.error('[CAPI ERROR] Full error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        debug_message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Get client IP
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfIP = req.headers['cf-connecting-ip'];
  
  if (cfIP) return cfIP;
  if (realIP) return realIP;
  if (forwarded) {
    const firstIP = forwarded.split(',')[0].trim();
    return firstIP;
  }
  
  return req.socket?.remoteAddress || '127.0.0.1';
}

// Sanitize event name
function sanitizeEventName(name) {
  const validEvents = [
    'PageView', 'Lead', 'Purchase', 'AddToCart', 'CompleteRegistration',
    'Contact', 'ViewContent', 'Search', 'Subscribe'
  ];
  return validEvents.includes(name) ? name : 'Lead';
}

// Generate event ID without crypto dependency
function generateEventId(eventName) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${eventName}_${timestamp}_${random}`;
}

// Hash using Web Crypto API (available in Vercel Edge)
async function hashWithWebCrypto(data) {
  if (!data || typeof data !== 'string') return null;
  
  try {
    const normalized = data.toLowerCase().trim();
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.warn('[CAPI] Web Crypto hashing failed:', error.message);
    return null;
  }
}

// Send to Meta API
async function sendToMeta(payload, config) {
  const url = `https://graph.facebook.com/${config.API_VERSION}/${config.PIXEL_ID}/events`;
  
  console.log('[CAPI] Meta API URL:', url);
  console.log('[CAPI] Payload size:', JSON.stringify(payload).length, 'bytes');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SpinDigitals-CAPI/1.0'
      },
      body: JSON.stringify(payload)
    });

    console.log('[CAPI] Meta response status:', response.status);
    
    const result = await response.json();
    console.log('[CAPI] Meta response body:', result);

    if (!response.ok) {
      throw new Error(`Meta API HTTP Error: ${response.status} - ${JSON.stringify(result)}`);
    }

    if (result.error) {
      throw new Error(`Meta API Business Error: ${JSON.stringify(result.error)}`);
    }

    return result;
    
  } catch (error) {
    console.error('[CAPI] sendToMeta error:', error.message);
    throw error;
  }
}
