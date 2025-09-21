/**
 * SPIN Digitals Meta CAPI - Cross-Subdomain Tracking
 * Works across all *.spindigitals.com subdomains
 * @version 4.0.0
 */

export default async function handler(req, res) {
  // CORS - Allow all spindigitals.com subdomains
  const origin = req.headers.origin || req.headers.referer || '*';
  const allowedOrigin = origin.includes('spindigitals.com') ? origin : 'https://spindigitals.com';
  
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-ID, X-Domain');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ===== CONFIGURATION =====
  const CONFIG = {
    PIXEL_ID: '3960527257530916',
    ACCESS_TOKEN: process.env.META_ACCESS_TOKEN || 'EAALxoeD2YXoBPUKWtbY2rW7zjQAJrGeuSQz74ihwph913KSTipys3ZBpLthqZCQ7NgLWNTc2ObTmTWWOCqGGZBQGiRBM3GBlf3dwd1hGylg85b6iZCkHUJIEL3P6DYqvKHbRjNxLpsdHU7jiRXIBPccW9XbMVh82JQqpdRvTD7bZA3ih35MTBVE2ZC2JPRlLfZCgAZDZD',
    TEST_MODE: true,
    TEST_CODE: 'TEST89489',
    API_VERSION: 'v18.0',
    ALLOWED_DOMAINS: ['spindigitals.com', 'www.spindigitals.com'],
    COOKIE_DOMAIN: '.spindigitals.com'
  };

  // Validate domain origin
  const requestDomain = req.headers['x-domain'] || req.headers.referer || '';
  const isValidDomain = CONFIG.ALLOWED_DOMAINS.some(domain => 
    requestDomain.includes(domain)
  );

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'healthy',
      service: 'SPIN Meta CAPI - Cross-Subdomain',
      version: '4.0.0',
      pixel_id: CONFIG.PIXEL_ID,
      test_mode: CONFIG.TEST_MODE,
      cookie_domain: CONFIG.COOKIE_DOMAIN,
      allowed_domains: CONFIG.ALLOWED_DOMAINS,
      current_domain: requestDomain,
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      
      // Validate required fields
      if (!body.event_name) {
        return res.status(400).json({
          success: false,
          error: 'Missing event_name'
        });
      }
      
      // Convert custom event names to standard Meta event names
      const standardEventName = convertToStandardEvent(body.event_name);
      
      // Extract domain info
      const sourceDomain = body.source_domain || extractDomain(body.event_source_url);
      
      // Get client IP
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
      
      // Build event data with cross-domain support
      const eventData = {
        event_name: standardEventName,
        event_id: body.event_id || generateEventId(standardEventName),
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: body.event_source_url || body.url || 'https://spindigitals.com',
        user_data: {
          client_ip_address: ip,
          client_user_agent: body.user_agent || req.headers['user-agent'] || 'Unknown',
          fbp: body.fbp || null,
          fbc: body.fbc || null,
          external_id: body.external_id || null
        }
      };
      
      // Process phone number if provided (hash it)
      if (body.user_data?.phone_number) {
        eventData.user_data.phone_number = hashData(body.user_data.phone_number);
      }
      
      // Process email if provided (hash it)
      if (body.user_data?.email) {
        eventData.user_data.email = hashData(body.user_data.email);
      }
      
      // Add custom data including domain info
      if (body.custom_data) {
        eventData.custom_data = {
          ...body.custom_data,
          source_subdomain: sourceDomain,
          cross_domain_id: body.cross_domain_id || null
        };
      }

      // Build Meta payload
      const payload = {
        data: [eventData],
        access_token: CONFIG.ACCESS_TOKEN
      };

      if (CONFIG.TEST_MODE && CONFIG.TEST_CODE) {
        payload.test_event_code = CONFIG.TEST_CODE;
      }

      // Send to Meta
      const metaResponse = await sendToMeta(payload, CONFIG);

      return res.status(200).json({
        success: true,
        event_name: eventData.event_name,
        event_id: eventData.event_id,
        source_domain: sourceDomain,
        meta_response: metaResponse
      });

    } catch (error) {
      console.error('Error processing event:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Convert custom event names to standard Meta event names
function convertToStandardEvent(eventName) {
  const standardNames = {
    'SubscribedButtonClick': 'Lead',
    'WhatsAppClick': 'Lead',
    'ContactFormSubmit': 'Lead',
    'LeadGeneration': 'Lead',
    'Purchase': 'Purchase',
    'AddToCart': 'AddToCart',
    'ViewContent': 'ViewContent',
    'Search': 'Search'
  };
  
  return standardNames[eventName] || eventName;
}

// Hash data for privacy compliance
function hashData(data) {
  if (!data) return null;
  try {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data.toLowerCase().trim());
    const hashBuffer = crypto.subtle.digest('SHA-256', dataBytes);
    return hashBuffer.then(hashArray => {
      const hash = Array.from(new Uint8Array(hashArray))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      return hash;
    });
  } catch (e) {
    return null;
  }
}

function generateEventId(eventName) {
  return `${eventName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return 'unknown';
  }
}

async function sendToMeta(payload, config) {
  const url = `https://graph.facebook.com/${config.API_VERSION}/${config.PIXEL_ID}/events`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return response.json();
}
