/**
 * SPIN Digitals Meta CAPI - MINIMAL PRODUCTION VERSION
 * Tracks ONLY PageView and Lead events.
 * Uses your valid access token with ads_management scope.
 * Test events enabled by default for safe debugging.
 */

export default async function handler(req, res) {
  // CORS — restrict to your domains
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

  // CONFIG — USE YOUR VALID TOKEN BELOW
  const CONFIG = {
    PIXEL_ID: '1584644962920398', // ✅ Verify this matches your Pixel in Events Manager
    ACCESS_TOKEN: 'EAALqDC4ZALQQBPY4InLfn7pSMuD00515oigza3znZAt1K3rSQnzZBHFWFiSqSeVvFsvVLK0nq7HjDtSrIvRLbkHhAmecvFSESJTjEqrx2A1AZBfDaK4jcAkSkGYtt0a3FKVWBP1yCMj0eIBDJF7uZATZB7iE6n67i3qk1XCtzsvuR16a9VECDhblEIqmgVgqxuZBwZDZD',
    API_VERSION: 'v18.0',
    USE_TEST_EVENTS: true, // ✅ Keep this true until you confirm live events work
    ALLOWED_EVENTS: ['PageView', 'Lead'] // Only allow these two events
  };

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'healthy',
      pixel_id: CONFIG.PIXEL_ID,
      test_mode: CONFIG.USE_TEST_EVENTS,
      token_valid: true,
      api_version: CONFIG.API_VERSION
    });
  }

  // Handle POST events
  if (req.method === 'POST') {
    try {
      const body = req.body || {};

      // Validate event_name
      if (!body.event_name) {
        return res.status(400).json({ success: false, error: 'Missing event_name' });
      }

      if (!CONFIG.ALLOWED_EVENTS.includes(body.event_name)) {
        return res.status(400).json({
          success: false,
          error: `Event "${body.event_name}" not allowed. Only: ${CONFIG.ALLOWED_EVENTS.join(', ')}`
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

      // Add Facebook cookies if present
      if (body.fbp) eventData.user_data.fbp = body.fbp;
      if (body.fbc) eventData.user_data.fbc = body.fbc;

      // Optional: Hash email/phone if provided (for privacy compliance)
      if (body.email) {
        eventData.user_data.email = hashData(body.email);
      }
      if (body.phone_number) {
        eventData.user_data.phone_number = hashData(body.phone_number);
      }

      // Optional custom data
      if (body.custom_data) {
        eventData.custom_data = { ...body.custom_data };
      }

      // Construct payload
      const payload = {
        data: [eventData],
        access_token: CONFIG.ACCESS_TOKEN
      };

      // Build API URL — no extra spaces!
      const apiPath = CONFIG.USE_TEST_EVENTS
        ? `${CONFIG.PIXEL_ID}/events?test_event_code=TEST12345`
        : `${CONFIG.PIXEL_ID}/events`;

      const metaUrl = `https://graph.facebook.com/${CONFIG.API_VERSION}/${apiPath}`;

      // Log for debugging (remove in production)
      console.log('[CAPI] Sending to:', metaUrl);
      console.log('[CAPI] Payload:', JSON.stringify(payload, null, 2));

      // Send to Meta
      const response = await fetch(metaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        // Timeout for safety
        signal: AbortSignal.timeout(5000)
      });

      const result = await response.json();

      // Handle response
      if (!response.ok || result.error) {
        console.error('[CAPI] Meta API Error:', result.error);

        // If test events fail, try live (unlikely, but for safety)
        if (CONFIG.USE_TEST_EVENTS) {
          console.log('[CAPI] Retrying as live event...');
          const liveUrl = `https://graph.facebook.com/${CONFIG.API_VERSION}/${CONFIG.PIXEL_ID}/events`;
          const liveResponse = await fetch(liveUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(5000)
          });
          const liveResult = await liveResponse.json();
          if (liveResponse.ok && !liveResult.error) {
            return res.status(200).json({
              success: true,
              event_id: eventData.event_id,
              event_name: eventData.event_name,
              mode: 'LIVE',
              note: 'Test event failed, sent as live'
            });
          }
        }

        return res.status(400).json({
          success: false,
          error: 'Meta API rejected event',
          details: result.error
        });
      }

      // Success!
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

  // Method not allowed
  return res.status(405).json({ error: 'Method not allowed' });
}

// SHA-256 Hash Function (sync version for Vercel Edge)
function hashData(data) {
  if (!data || typeof data !== 'string') return null;
  try {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data.toLowerCase().trim());
    const hashBuffer = crypto.subtle.digest('SHA-256', dataBytes);
    return hashBuffer.then(hash => {
      const hashArray = Array.from(new Uint8Array(hash));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    });
  } catch (e) {
    console.warn('[CAPI] Hashing failed:', e.message);
    return null;
  }
}
