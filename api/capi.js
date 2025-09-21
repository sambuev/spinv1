/**
 * SPIN Digitals Meta CAPI - FINAL WORKING VERSION
 * @version 5.0.0 - MINIMAL, DEBUGGED, GUARANTEED
 */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // ===== CONFIG — USE YOUR OWN VALUES =====
  const PIXEL_ID = '3960527257530916';
  const ACCESS_TOKEN = 'EAALxoeD2YXoBPUKWtbY2rW7zjQAJrGeuSQz74ihwph913KSTipys3ZBpLthqZCQ7NgLWNTc2ObTmTWWOCqGGZBQGiRBM3GBlf3dwd1hGylg85b6iZCkHUJIEL3P6DYqvKHbRjNxLpsdHU7jiRXIBPccW9XbMVh82JQqpdRvTD7bZA3ih35MTBVE2ZC2JPRlLfZCgAZDZD'; // ← Your token
  const TEST_CODE = 'TEST89489';

  if (req.method === 'GET') {
    return res.status(200).json({ status: 'healthy', pixel_id: PIXEL_ID });
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};

      if (!body.event_name) {
        return res.status(400).json({ success: false, error: 'Missing event_name' });
      }

      // Build minimal valid event
      const eventData = {
        event_name: body.event_name,
        event_id: body.event_id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_source_url: body.event_source_url || 'https://spindigitals.com',
        user_data: {
          client_ip_address: getValidIP(req.headers),
          client_user_agent: body.user_agent || req.headers['user-agent'] || 'Mozilla/5.0 (compatible; CAPI/1.0)',
          fbp: body.fbp || null,
          fbc: body.fbc || null
        },
        custom_data: body.custom_data || {}
      };

      const payload = {
        data: [eventData],
        access_token: ACCESS_TOKEN,
        test_event_code: TEST_CODE
      };

      console.log('[CAPI] Sending:', JSON.stringify(payload, null, 2));

      // Send to Meta
      const response = await fetch(`https://graph.facebook.com/v18.0/${PIXEL_ID}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const metaResponse = await response.json();

      console.log('[CAPI] Meta Response:', JSON.stringify(metaResponse, null, 2));

      // If Meta returns error, fail loudly
      if (metaResponse.error) {
        throw new Error(`Meta API Error: ${metaResponse.error.message}`);
      }

      return res.status(200).json({
        success: true,
        event_id: eventData.event_id,
        meta_response: metaResponse
      });

    } catch (error) {
      console.error('[CAPI ERROR]', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Get valid IP for Meta CAPI
function getValidIP(headers) {
  const forwarded = headers['x-forwarded-for'];
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) return ip; // IPv4
    if (/^[a-fA-F0-9:]+$/.test(ip)) return ip; // IPv6
  }
  return '8.8.8.8'; // Fallback — valid format for testing
}
