/**
 * SPIN Digitals Meta CAPI - FIXED VERSION
 * @version 6.0.1 - Bug fixes for 500 errors
 */

import { createHash } from 'crypto';

export default async function handler(req, res) {
  // CORS - More flexible for your domain
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://spindigitals.com',
    'https://www.spindigitals.com'
  ];
  
  if (allowedOrigins.includes(origin)) {
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
    ACCESS_TOKEN: 'EAALxoeD2YXoBPUKWtbY2rW7zjQAJrGeuSQz74ihwph913KSTipys3ZBpLthqZCQ7NgLWNTc2ObTmTWWOCqGGZBQGiRBM3GBlf3dwd1hGylg85b6iZCkHUJIEL3P6DYqvKHbRjNxLpsdHU7jiRXIBPccW9XbMVh82JQqpdRvTD7bZA3ih35MTBVE2ZC2JPRlLfZCgAZDZD',
    API_VERSION: 'v18.0',
    ALLOWED_DOMAINS: ['spindigitals.com', 'www.spindigitals.com'],
    MAX_EVENT_AGE_SECONDS: 7 * 24 * 60 * 60 // 7 days
  };

  // Validate domain - simplified logic
  const referer = req.headers.referer || '';
  const isValidDomain = referer.includes('spindigitals.com') || process.env.NODE_ENV === 'development';

  if (!isValidDomain) {
    console.warn('[CAPI] Blocked request from invalid domain:', referer);
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

      // Get event time - fix the validation
      const now = Math.floor(Date.now() / 1000);
      const eventTime = body.event_time || now;

      // Get client IP - simplified approach
      const ip = getClientIP(req);

      // Build event data
      const eventData = {
        event_name: sanitizeEventName(body.event_name),
        event_id: body.event_id || generateEventId(body.event_name),
        event_time: eventTime,
        action_source: 'website',
        event_source_url: body.event_source_url || req.headers.referer || 'https://spindigitals.com',
        user_data: {
          client_ip_address: ip,
          client_user_agent: req.headers['user-agent'] || 'Unknown'
        }
      };

      // Add Facebook browser cookies if available
      if (body.fbp) eventData.user_data.fbp = body.fbp;
      if (body.fbc) eventData.user_data.fbc = body.fbc;

      // Add hashed user data if provided
      if (body.email) {
        eventData.user_data.em = await hashData(body.email);
      }
      if (body.phone_number) {
        eventData.user_data.ph = await hashData(body.phone_number);
      }

      // Add custom data
      if (body.custom_data) {
        eventData.custom_data = { ...body.custom_data };
      }

      const payload = {
        data: [eventData],
        access_token: CONFIG.ACCESS_TOKEN
      };

      console.log('[CAPI] Processing event:', {
        event_name: eventData.event_name,
        event_id: eventData.event_id,
        ip: ip,
        url: eventData.event_source_url
      });

      // Send to Meta
      const metaResponse = await sendToMeta(payload, CONFIG);

      return res.status(200).json({
        success: true,
        event_id: eventData.event_id,
        event_name: eventData.event_name,
        meta_response: metaResponse
      });

    } catch (error) {
      console.error('[CAPI ERROR]', {
        message: error.message,
        stack: error.stack,
        body: req.body
      });
      
      return res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Get client IP address - simplified
function getClientIP(req) {
  // Try multiple headers for real IP
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfIP = req.headers['cf-connecting-ip']; // Cloudflare
  
  if (cfIP) return cfIP;
  if (realIP) return realIP;
  
  if (forwarded) {
    const ips = forwarded.split(',');
    const firstIP = ips[0].trim();
    if (firstIP && !firstIP.startsWith('10.') && !firstIP.startsWith('192.168.')) {
      return firstIP;
    }
  }
  
  // Fallback - Meta can handle missing IP
  return req.connection?.remoteAddress || '0.0.0.0';
}

// Sanitize event name
function sanitizeEventName(name) {
  const validEvents = [
    'PageView', 'Lead', 'Purchase', 'AddToCart', 'CompleteRegistration',
    'Contact', 'CustomizeProduct', 'Donate', 'FindLocation', 'Schedule',
    'Search', 'StartTrial', 'SubmitApplication', 'Subscribe', 'ViewContent'
  ];
  return validEvents.includes(name) ? name : 'Lead'; // Default to Lead for tracking
}

// Generate unique event ID - fixed crypto usage
function generateEventId(eventName) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${eventName}_${timestamp}_${random}`;
}

// Hash data for privacy compliance - fixed async handling
async function hashData(data) {
  if (!data || typeof data !== 'string') return null;
  
  try {
    const normalized = data.toLowerCase().trim();
    return createHash('sha256').update(normalized).digest('hex');
  } catch (e) {
    console.warn('[CAPI] Hashing failed:', e.message);
    return null;
  }
}

// Send to Meta API
async function sendToMeta(payload, config) {
  const url = `https://graph.facebook.com/${config.API_VERSION}/${config.PIXEL_ID}/events`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'SpinDigitals-CAPI/1.0'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[CAPI] Meta API Error Response:', {
        status: response.status,
        result
      });
      throw new Error(`Meta API Error: ${response.status} - ${JSON.stringify(result)}`);
    }

    if (result.error) {
      console.error('[CAPI] Meta API Business Error:', result.error);
      throw new Error(`Meta Business Error: ${result.error.message}`);
    }

    console.log('[CAPI] Success:', result);
    return result;
    
  } catch (error) {
    console.error('[CAPI] Network/Parse Error:', error.message);
    throw error;
  }
}
