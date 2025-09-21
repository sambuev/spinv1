/**
 * SPIN Digitals Meta CAPI - MINIMAL WORKING VERSION
 * @version 6.0.3 - Simplified to eliminate 500 errors
 */

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Configuration
  const CONFIG = {
    PIXEL_ID: '3960527257530916',
    ACCESS_TOKEN: 'EAALxoeD2YXoBPUKWtbY2rW7zjQAJrGeuSQz74ihwph913KSTipys3ZBpLthqZCQ7NgLWNTc2ObTmTWWOCqGGZBQGiRBM3GBlf3dwd1hGylg85b6iZCkHUJIEL3P6DYqvKHbRjNxLpsdHU7jiRXIBPccW9XbMVh82JQqpdRvTD7bZA3ih35MTBVE2ZC2JPRlLfZCgAZDZD',
    API_VERSION: 'v18.0'
  };

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'healthy',
      pixel_id: CONFIG.PIXEL_ID,
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || 'production'
    });
  }

  // Handle POST requests
  if (req.method === 'POST') {
    try {
      console.log('[CAPI] POST request received');
      
      // Parse request body
      let body;
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        console.log('[CAPI] Parsed body:', body);
      } catch (parseError) {
        console.error('[CAPI] Body parse error:', parseError.message);
        return res.status(400).json({ success: false, error: 'Invalid JSON body' });
      }

      if (!body || !body.event_name) {
        console.log('[CAPI] Missing event_name');
        return res.status(400).json({ success: false, error: 'Missing event_name' });
      }

      // Basic event data (minimal to avoid errors)
      const eventData = {
        event_name: body.event_name === 'PageView' ? 'PageView' : 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: body.event_source_url || 'https://spindigitals.com',
        user_data: {
          client_ip_address: getClientIP(req),
          client_user_agent: req.headers['user-agent'] || 'Unknown'
        }
      };

      // Add Facebook cookies if they exist
      if (body.fbp) {
        eventData.user_data.fbp = body.fbp;
      }
      if (body.fbc) {
        eventData.user_data.fbc = body.fbc;
      }

      // Add basic custom data
      if (body.custom_data && typeof body.custom_data === 'object') {
        eventData.custom_data = {
          page_title: body.custom_data.page_title || 'Unknown',
          page_url: body.custom_data.page_url || eventData.event_source_url
        };
      }

      // Generate simple event ID
      const eventId = `${eventData.event_name}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      eventData.event_id = eventId;

      console.log('[CAPI] Final event data:', eventData);

      // Prepare payload for Meta
      const payload = {
        data: [eventData],
        access_token: CONFIG.ACCESS_TOKEN
      };

      console.log('[CAPI] Calling Meta API...');
      
      // Send to Meta API
      const metaUrl = `https://graph.facebook.com/${CONFIG.API_VERSION}/${CONFIG.PIXEL_ID}/events`;
      
      const metaResponse = await fetch(metaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('[CAPI] Meta response status:', metaResponse.status);
      
      const metaResult = await metaResponse.json();
      console.log('[CAPI] Meta response:', metaResult);

      if (!metaResponse.ok) {
        console.error('[CAPI] Meta API error:', metaResult);
        return res.status(400).json({
          success: false,
          error: 'Meta API error',
          meta_error: metaResult
        });
      }

      // Success response
      return res.status(200).json({
        success: true,
        event_id: eventId,
        event_name: eventData.event_name,
        meta_response: metaResult
      });

    } catch (error) {
      console.error('[CAPI] Unexpected error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        error_message: error.message,
        error_stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Simple IP detection
function getClientIP(req) {
  // Try various headers
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfIP = req.headers['cf-connecting-ip'];
  
  if (cfIP) return cfIP;
  if (realIP) return realIP;
  if (forwarded) return forwarded.split(',')[0].trim();
  
  // Fallback
  return '0.0.0.0';
}
