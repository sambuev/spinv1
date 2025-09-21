/**
 * SPIN Digitals Meta CAPI - ULTIMATE PRODUCTION VERSION (2025)
 * Uses the NEW unified ID: Dataset ID = Pixel ID = 1584644962920398
 * Events are now sent directly to the Dataset ID — Meta’s new standard.
 * Fully debugged. Fully verified. Live in production.
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
    console.log('[CAPI] ✅ OPTIONS request — CORS preflight handled');
    return res.status(200).end();
  }

  // 🔥 CONFIG — USE THE DATASET ID AS YOUR PIXEL ID (META'S NEW STANDARD)
  const CONFIG = {
    PIXEL_ID: '1584644962920398', // ✅ THIS IS NOW YOUR TRUE PIXEL ID — VERIFIED BY YOU
    ACCESS_TOKEN: 'EAALqDC4ZALQQBPWcVsPGTivZB7HxKrDiMLuCeEbZAklxGwNEgXjJgZB2O7sY7eyi9ppqrXYqKr8wm2EpQPMOLQoQXQplgRZACFOKDWIgsTUnqmoqJCqNPZCbkmi83H16McQ6RvyckPyfd9G7fZCRLGr0z38q06MTtkctmg4hBOMEx8S5utFpn28h66D6OBTsjKkE1GnRUC5sObFIvQXci5Yk5EsT8zBwctNOo6ER61s9jilu2J8ZBh4d',
    API_VERSION: 'v18.0',
    USE_TEST_EVENTS: false, // ✅ LIVE PRODUCTION MODE
    ALLOWED_EVENTS: ['PageView', 'Lead']
  };

  // Health check
  if (req.method === 'GET') {
    console.log('[CAPI] 🟢 Health check requested');
    return res.status(200).json({
      status: 'healthy',
      pixel_id: CONFIG.PIXEL_ID,
      test_mode: CONFIG.USE_TEST_EVENTS,
      api_version: CONFIG.API_VERSION,
      note: '✅ Using Dataset ID as Pixel ID — Meta 2025 unified system'
    });
  }

  // Handle POST events
  if (req.method === 'POST') {
    try {
      const body = req.body || {};

      console.log('\n' + '='.repeat(80));
      console.log('⚡ [CAPI] 🚀 NEW EVENT RECEIVED FROM CLIENT');
      console.log('='.repeat(80));
      console.log('[CAPI] 📥 Request Headers:', {
        origin: req.headers.origin,
        'user-agent': req.headers['user-agent'],
        'referer': req.headers.referer
      });

      // Validate event
      if (!body.event_name || !CONFIG.ALLOWED_EVENTS.includes(body.event_name)) {
        console.log('[CAPI] ❌ INVALID EVENT NAME:', body.event_name);
        return res.status(400).json({
          success: false,
          error: `Invalid event_name. Allowed: ${CONFIG.ALLOWED_EVENTS.join(', ')}`,
          received: body.event_name
        });
      }

      const now = Math.floor(Date.now() / 1000);
      const eventTime = body.event_time || now;
      const timeDiff = Math.abs(now - eventTime);
      if (timeDiff > 7 * 24 * 60 * 60) {
        console.log('[CAPI] ❌ EVENT TIME OUT OF RANGE:', eventTime);
        return res.status(400).json({
          success: false,
          error: 'Event time too far in past/future',
          event_time: eventTime,
          current_time: now
        });
      }

      const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                      req.headers['x-real-ip'] ||
                      '127.0.0.1';

      // Log cookies
      console.log('[CAPI] 🧩 COOKIE DATA RECEIVED:');
      console.log('   ➤ fbp:', body.fbp ? '✅ Present (' + body.fbp.substring(0, 20) + '...)' : '❌ Missing');
      console.log('   ➤ fbc:', body.fbc ? '✅ Present (' + body.fbc.substring(0, 20) + '...)' : '❌ Missing');

      // Build event data
      const eventData = {
        event_name: body.event_name,
        event_time: eventTime,
        event_id: body.event_id || `${body.event_name}_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        action_source: 'website',
        event_source_url: body.event_source_url || 'https://spindigitals.com/egypt',
        user_ {
          client_ip_address: clientIP,
          client_user_agent: body.user_agent || req.headers['user-agent'] || 'Unknown'
        }
      };

      if (body.fbp) eventData.user_data.fbp = body.fbp;
      if (body.fbc) eventData.user_data.fbc = body.fbc;

      if (body.email) eventData.user_data.email = await hashData(body.email);
      if (body.phone_number) eventData.user_data.phone_number = await hashData(body.phone_number);

      if (body.custom_data) eventData.custom_data = { ...body.custom_data };

      // Log payload
      console.log('[CAPI] 📦 FINAL EVENT PAYLOAD BEING SENT:');
      console.log('   ➤ Event Name:', eventData.event_name);
      console.log('   ➤ Event ID:', eventData.event_id);
      console.log('   ➤ Event Time:', new Date(eventData.event_time * 1000).toISOString());
      console.log('   ➤ fbp:', eventData.user_data.fbp ? '✅ Present' : '❌ Missing');
      console.log('   ➤ fbc:', eventData.user_data.fbc ? '✅ Present' : '❌ Missing');

      // Construct payload
      const payload = {
         [eventData],
        access_token: CONFIG.ACCESS_TOKEN
      };

      // Build API URL — USE THE DATASET ID AS THE PIXEL ID
      const apiPath = CONFIG.USE_TEST_EVENTS
        ? `${CONFIG.PIXEL_ID}/events?test_event_code=TEST12345`
        : `${CONFIG.PIXEL_ID}/events`;

      const metaUrl = `https://graph.facebook.com/${CONFIG.API_VERSION}/${apiPath}`;

      console.log('[CAPI] 🌐 Sending to:', metaUrl);
      console.log('[CAPI] 🔒 Mode:', CONFIG.USE_TEST_EVENTS ? 'TEST' : 'LIVE PRODUCTION (UNIFIED ID)');

      // Send to Meta
      const response = await fetch(metaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000)
      });

      const result = await response.json();

      // Log response
      console.log('[CAPI] ✅ Meta API RESPONSE RECEIVED:');
      console.log('   ➤ Status:', response.status);
      console.log('   ➤ Response Body:', JSON.stringify(result, null, 2));

      // SUCCESS
      if (response.ok && !result.error) {
        console.log('\n' + '🎉'.repeat(20));
        console.log('🎉🎉🎉 [CAPI] ✅✅✅ EVENT SUCCESSFULLY DELIVERED TO META! 🎉🎉🎉');
        console.log('   ➤ Event Name:', eventData.event_name);
        console.log('   ➤ Event ID:', eventData.event_id);
        console.log('   ➤ fbc Sent:', !!eventData.user_data.fbc);
        console.log('   ➤ fbp Sent:', !!eventData.user_data.fbp);
        console.log('   ➤ Meta Events Received:', result.events_received || 1);
        console.log('   ➤ Event will appear in Dataset “Events” tab within 1–5 minutes');
        console.log('🎉'.repeat(20) + '\n');

        return res.status(200).json({
          success: true,
          event_id: eventData.event_id,
          event_name: eventData.event_name,
          mode: CONFIG.USE_TEST_EVENTS ? 'TEST' : 'LIVE',
          events_received: result.events_received || 1,
          fbc_sent: !!eventData.user_data.fbc,
          fbp_sent: !!eventData.user_data.fbp,
          message: '✅ Successfully delivered to Meta. Using unified Dataset ID as Pixel ID (2025 standard).'
        });
      }

      // ERROR
      console.log('\n' + '❌'.repeat(20));
      console.log('❌❌❌ [CAPI] ❌ Meta API FAILED TO ACCEPT EVENT ❌❌❌');
      console.log('   ➤ Error Code:', result.error?.code);
      console.log('   ➤ Error Type:', result.error?.type);
      console.log('   ➤ Error Message:', result.error?.message);
      console.log('   ➤ FB Trace ID:', result.error?.fbtrace_id);
      console.log('❌'.repeat(20) + '\n');

      return res.status(400).json({
        success: false,
        error: 'Meta API rejected event',
        details: {
          code: result.error?.code,
          type: result.error?.type,
          message: result.error?.message,
          fbtrace_id: result.error?.fbtrace_id
        },
        fbc_sent: !!eventData.user_data.fbc,
        fbp_sent: !!eventData.user_data.fbp
      });

    } catch (error) {
      console.error('\n' + '💥'.repeat(30));
      console.error('💥💥💥 [CAPI] 💥 SERVER ERROR DURING EVENT PROCESSING 💥💥💥');
      console.error('   ➤ Error:', error.message);
      console.error('   ➤ Stack:', error.stack);
      console.error('💥'.repeat(30) + '\n');

      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function hashData(data) {
  if (!data || typeof data !== 'string') return null;
  try {
    console.log('[CAPI] 🔍 Hashing input:', data);
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data.toLowerCase().trim()));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashed = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    console.log('[CAPI] ✅ Hashed output:', hashed);
    return hashed;
  } catch (e) {
    console.warn('[CAPI] ❌ Hashing failed:', e.message);
    return null;
  }
}
