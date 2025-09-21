/**
 * SPIN Digitals Meta CAPI - MINIMAL PRODUCTION VERSION
 * No hashing, no complex logic — just sends events.
 */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // CONFIG — HARDCODED FOR RELIABILITY
  const PIXEL_ID = '3960527257530916';
  const ACCESS_TOKEN = 'EAALxoeD2YXoBPUKWtbY2rW7zjQAJrGeuSQz74ihwph913KSTipys3ZBpLthqZCQ7NgLWNTc2ObTmTWWOCqGGZBQGiRBM3GBlf3dwd1hGylg85b6iZCkHUJIEL3P6DYqvKHbRjNxLpsdHU7jiRXIBPccW9XbMVh82JQqpdRvTD7bZA3ih35MTBVE2ZC2JPRlLfZCgAZDZD'; // ← Your working token
  const TEST_MODE = true; // ← Keep true for now
  const TEST_CODE = 'TEST89489';

  if (req.method === 'POST') {
    try {
      const body = req.body || {};

      if (!body.event_name) {
        return res.status(400).json({ error: 'Missing event_name' });
      }

      // Build minimal valid event
      const eventData = {
        event_name: body.event_name,
        event_id: body.event_id || `event_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: body.event_source_url || 'https://spindigitals.com',
        user_data: {
          client_ip_address: getValidIP(req.headers),
          client_user_agent: body.user_agent || req.headers['user-agent'] || 'Mozilla/5.0 (compatible; CAPI/1.0)'
        }
      };

      // Build payload
      const payload = {
        data: [eventData],
        access_token: ACCESS_TOKEN
      };

      // 👇 ADD TEST CODE TO SEE EVENTS INSTANTLY
      if (TEST_MODE && TEST_CODE) {
        payload.test_event_code = TEST_CODE;
      }

      // Log for debugging
      console.log('[CAPI] Sending event:', eventData.event_name, eventData.event_id);

      // Send to Meta
      const response = await fetch(`https://graph.facebook.com/v18.0/${PIXEL_ID}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const metaResponse = await response.json();

      // Log Meta response
      console.log('[CAPI] Meta Response:', metaResponse);

      // If Meta returns error, respond with 500
      if (metaResponse.error) {
        console.error('[CAPI] Meta Error:', metaResponse.error.message);
        return res.status(500).json({ success: false, error: metaResponse.error.message });
      }

      // Success!
      return res.status(200).json({
        success: true,
        event_id: eventData.event_id,
        event_name: eventData.event_name
      });

    } catch (error) {
      // Log full error for debugging
      console.error('[CAPI SERVER ERROR]', error.message, error.stack);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  return res.status(200).json({ ok: true });
}

// Simple IP getter — avoids complexity
function getValidIP(headers) {
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
      return ip;
    }
  }
  return '8.8.8.8'; // Fallback — valid format accepted by Meta
}
