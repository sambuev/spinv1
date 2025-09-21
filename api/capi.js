/**
 * SPIN Digitals Meta CAPI - MINIMAL VERSION
 * Works with basic permissions - Test Events approach
 */

export default async function handler(req, res) {
  // CORS Headers (corrected)
  res.setHeader('Access-Control-Allow-Origin', 'https://spindigitals.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Simple configuration - try with test events first
  const CONFIG = {
    PIXEL_ID: '3960527257530916',
    ACCESS_TOKEN: 'EAALxoeD2YXoBPaSkKA19qXkIYBQ7ttTz6ZCLMGz0Fop11o7SygCgdkOhhVGX3wzUznFK40vJQlm6gc3uw5m6zhlT8TwgJ8h9dzh23fVpefw77qKQZAYwXqHmsS70WB7rZBBJUXK7LCLxxe60gaHMRZBZAaLG4g3mQyQVR5gBqwsrRs5efZBL6qH0MNXoTDIuAAeAZDZD',
    API_VERSION: 'v18.0',
    USE_TEST_EVENTS: true // Try test events first
  };

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'healthy',
      pixel_id: CONFIG.PIXEL_ID,
      test_mode: CONFIG.USE_TEST_EVENTS
    });
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      
      if (!body.event_name) {
        return res.status(400).json({ success: false, error: 'Missing event_name' });
      }

      // Minimal event data
      const eventData = {
        event_name: body.event_name,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: body.event_source_url || 'https://spindigitals.com',
        user_data: { // Corrected from 'user_' to 'user_data'
          client_ip_address: getClientIP(req),
          client_user_agent: req.headers['user-agent'] || 'Unknown'
        }
      };

      // Add Facebook cookies if available
      if (body.fbp) eventData.user_data.fbp = body.fbp;
      if (body.fbc) eventData.user_data.fbc = body.fbc;

      // Simple event ID
      eventData.event_id = `${body.event_name}_${Date.now()}`;

      // Define payload BEFORE using it
      const payload = {
        data: [eventData],
        access_token: CONFIG.ACCESS_TOKEN
      };

      const apiPath = CONFIG.USE_TEST_EVENTS ? 
        `${CONFIG.PIXEL_ID}/events?test_event_code=TEST12345` : 
        `${CONFIG.PIXEL_ID}/events`;

      // Fixed URL formatting (removed extra space)
      const metaUrl = `https://graph.facebook.com/${CONFIG.API_VERSION}/${apiPath}`;

      console.log('[CAPI] Sending to:', metaUrl);
      console.log('[CAPI] Mode:', CONFIG.USE_TEST_EVENTS ? 'TEST' : 'LIVE');

      const response = await fetch(metaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('[CAPI] Error:', result);
        
        // If live events fail, automatically try test events
        if (!CONFIG.USE_TEST_EVENTS) {
          console.log('[CAPI] Retrying with test events...');
          const testUrl = `https://graph.facebook.com/${CONFIG.API_VERSION}/${CONFIG.PIXEL_ID}/events?test_event_code=TEST12345`;
          
          const testResponse = await fetch(testUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          const testResult = await testResponse.json();
          
          if (testResponse.ok) {
            return res.status(200).json({
              success: true,
              event_id: eventData.event_id,
              event_name: eventData.event_name,
              mode: 'TEST_EVENTS',
              note: 'Sent as test event - check Test Events in Events Manager'
            });
          }
        }
        
        return res.status(400).json({
          success: false,
          error: 'API error',
          details: result
        });
      }

      return res.status(200).json({
        success: true,
        event_id: eventData.event_id,
        event_name: eventData.event_name,
        mode: CONFIG.USE_TEST_EVENTS ? 'TEST_EVENTS' : 'LIVE',
        events_received: result.events_received || 1
      });

    } catch (error) {
      console.error('[CAPI] Error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Server error',
        message: error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         '127.0.0.1';
}
