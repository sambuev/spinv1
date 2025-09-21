/**
 * SPIN Digitals Meta CAPI - VERCEL CORS FIXED VERSION
 * @version 6.0.4 - Fixed CORS for Vercel deployment
 */

export default async function handler(req, res) {
  console.log('[CAPI] Request received:', req.method, req.url);
  console.log('[CAPI] Request headers:', req.headers);

  // Set CORS headers FIRST - before any other logic
  res.setHeader('Access-Control-Allow-Origin', 'https://spindigitals.com');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, Authorization');

  console.log('[CAPI] CORS headers set');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    console.log('[CAPI] Handling OPTIONS preflight request');
    res.status(200).end();
    return;
  }

  // Configuration
  const CONFIG = {
    PIXEL_ID: '3960527257530916',
    ACCESS_TOKEN: 'EAALxoeD2YXoBPUKWtbY2rW7zjQAJrGeuSQz74ihwph913KSTipys3ZBpLthqZCQ7NgLWNTc2ObTmTWWOCqGGZBQGiRBM3GBlf3dwd1hGylg85b6iZCkHUJIEL3P6DYqvKHbRjNxLpsdHU7jiRXIBPccW9XbMVh82JQqpdRvTD7bZA3ih35MTBVE2ZC2JPRlLfZCgAZDZD',
    API_VERSION: 'v18.0'
  };

  // Health check
  if (req.method === 'GET') {
    console.log('[CAPI] GET health check request');
    return res.status(200).json({
      status: 'healthy',
      pixel_id: CONFIG.PIXEL_ID,
      timestamp: new Date().toISOString(),
      cors: 'enabled'
    });
  }

  // Handle POST requests
  if (req.method === 'POST') {
    console.log('[CAPI] POST request - processing event');
    
    try {
      // Parse request body
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }
      
      console.log('[CAPI] Request body parsed:', body);

      if (!body || !body.event_name) {
        console.log('[CAPI] Missing event_name');
        return res.status(400).json({ 
          success: false, 
          error: 'Missing event_name' 
        });
      }

      // Build event data
      const eventData = {
        event_name: body.event_name === 'PageView' ? 'PageView' : 'Lead',
        event_time: body.event_time || Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: body.event_source_url || 'https://spindigitals.com',
        user_data: {
          client_ip_address: getClientIP(req),
          client_user_agent: body.user_agent || req.headers['user-agent'] || 'Unknown'
        }
      };

      // Add Facebook cookies
      if (body.fbp) eventData.user_data.fbp = body.fbp;
      if (body.fbc) eventData.user_data.fbc = body.fbc;

      // Add custom data
      if (body.custom_data) {
        eventData.custom_data = body.custom_data;
      }

      // Generate event ID
      eventData.event_id = `${eventData.event_name}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      console.log('[CAPI] Event data prepared:', eventData);

      // Send to Meta
      const payload = {
        data: [eventData],
        access_token: CONFIG.ACCESS_TOKEN
      };

      const metaUrl = `https://graph.facebook.com/${CONFIG.API_VERSION}/${CONFIG.PIXEL_ID}/events`;
      
      console.log('[CAPI] Sending to Meta API...');
      
      const metaResponse = await fetch(metaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const metaResult = await metaResponse.json();
      
      console.log('[CAPI] Meta response:', {
        status: metaResponse.status,
        result: metaResult
      });

      if (!metaResponse.ok || metaResult.error) {
        console.error('[CAPI] Meta API error:', metaResult);
        return res.status(400).json({
          success: false,
          error: 'Meta API error',
          details: metaResult
        });
      }

      // Success
      console.log('[CAPI] Event sent successfully');
      return res.status(200).json({
        success: true,
        event_id: eventData.event_id,
        event_name: eventData.event_name,
        events_received: metaResult.events_received || 1
      });

    } catch (error) {
      console.error('[CAPI] Error processing request:', {
        message: error.message,
        stack: error.stack
      });
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  // Method not allowed
  console.log('[CAPI] Method not allowed:', req.method);
  return res.status(405).json({ 
    error: 'Method not allowed',
    method: req.method
  });
}

// Get client IP
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfIP = req.headers['cf-connecting-ip'];
  
  console.log('[CAPI] IP headers:', { forwarded, realIP, cfIP });
  
  if (cfIP) return cfIP;
  if (realIP) return realIP;
  if (forwarded) return forwarded.split(',')[0].trim();
  
  return '127.0.0.1';
}
