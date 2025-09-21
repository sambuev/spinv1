/**
 * SPIN Digitals Meta CAPI - FINAL PRODUCTION VERSION WOOOORKING SIMPLE. 
 * Tracks ONLY PageView and Lead events from https://spindigitals.com/egypt
 * Uses your valid access token and correct Pixel ID.
 */

export default async function handler(req, res) {
  // CORS — allow only your domains (NO SPACES!)
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://spindigitals.com',
    'https://www.spindigitals.com',
    'https://spindigitals.com/egypt'
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://spindigitals.com');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 🔥 USE THIS EXACT PIXEL ID — VERIFIED AS CORRECT
  const CONFIG = {
    PIXEL_ID: '1584644962920398',
    ACCESS_TOKEN: 'EAALqDC4ZALQQBPWcVsPGTivZB7HxKrDiMLuCeEbZAklxGwNEgXjJgZB2O7sY7eyi9ppqrXYqKr8wm2EpQPMOLQoQXQplgRZACFOKDWIgsTUnqmoqJCqNPZCbkmi83H16McQ6RvyckPyfd9G7fZCRLGr0z38q06MTtkctmg4hBOMEx8S5utFpn28h66D6OBTsjKkE1GnRUC5sObFIvQXci5Yk5EsT8zBwctNOo6ER61s9jilu2J8ZBh4d',
    API_VERSION: 'v18.0',
    USE_TEST_EVENTS: false,
    ALLOWED_EVENTS: ['PageView', 'Lead']
  };

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'healthy',
      pixel_id: CONFIG.PIXEL_ID,
      test_mode: CONFIG.USE_TEST_EVENTS,
      api_version: CONFIG.API_VERSION
    });
  }

  // Handle POST events
  if (req.method === 'POST') {
    try {
      const body = req.body || {};

      // Validate event
      if (!body.event_name || !CONFIG.ALLOWED_EVENTS.includes(body.event_name)) {
        return res.status(400).json({
          success: false,
          error: `Invalid event_name. Allowed: ${CONFIG.ALLOWED_EVENTS.join(', ')}`
        });
      }

      // Validate timestamp (±7 days)
      const now = Math.floor(Date.now() / 1000);
      const eventTime = body.event_time || now;
      if (Math.abs(now - eventTime) > 7 * 24 * 60 * 60) {
        return res.status(400).json({ success: false, error: 'Event time too far in past/future' });
      }

      // Get client IP (Vercel Edge-safe)
      const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                      req.headers['x-real-ip'] ||
                      '127.0.0.1';

      // Build event data
      const eventData = {
        event_name: body.event_name,
        event_time: eventTime,
        event_id: body.event_id || `${body.event_name}_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        action_source: 'website',
        event_source_url: body.event_source_url || 'https://spindigitals.com/egypt',
        user_data: {
          client_ip_address: clientIP,
          client_user_agent: body.user_agent || req.headers['user-agent'] || 'Unknown'
        }
      };

      // Add Facebook cookies
      if (body.fbp) eventData.user_data.fbp = body.fbp;
      if (body.fbc) eventData.user_data.fbc = body.fbc;

      // Optional: Hash email/phone for privacy (if provided)
      if (body.email) eventData.user_data.email = await hashData(body.email);
      if (body.phone_number) eventData.user_data.phone_number = await hashData(body.phone_number);

      // Add custom data
      if (body.custom_data) eventData.custom_data = { ...body.custom_data };

      // Construct payload
      const payload = {
        data: [eventData],
        access_token: CONFIG.ACCESS_TOKEN
      };

      // Build API URL — NO SPACES!
      const apiPath = CONFIG.USE_TEST_EVENTS
        ? `${CONFIG.PIXEL_ID}/events?test_event_code=TEST12345`
        : `${CONFIG.PIXEL_ID}/events`;

      const metaUrl = `https://graph.facebook.com/${CONFIG.API_VERSION}/${apiPath}`;

      // Send to Meta
      const response = await fetch(metaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000)
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        console.error('[CAPI] Meta API Error:', result.error);
        return res.status(400).json({
          success: false,
          error: 'Meta API rejected event',
          details: result.error
        });
      }

      return res.status(200).json({
        success: true,
        event_id: eventData.event_id,
        event_name: eventData.event_name,
        mode: CONFIG.USE_TEST_EVENTS ? 'TEST' : 'LIVE',
        events_received: result.events_received || 1
      });

    } catch (error) {
      console.error('[CAPI] Server Error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// SHA-256 Hash Function (for email/phone privacy)
async function hashData(data) {
  if (!data || typeof data !== 'string') return null;
  try {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data.toLowerCase().trim()));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    console.warn('[CAPI] Hashing failed:', e.message);
    return null;
  }
}
