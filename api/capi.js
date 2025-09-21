/**
 * SPIN Digitals - Client-side Facebook CAPI Tracking
 * For PageViews and Lead tracking via CAPI
 */

class SpinCAPITracker {
  constructor() {
    this.apiEndpoint = 'https://spinv1.vercel.app/api/capi';
    this.fbp = this.getFBP();
    this.fbc = this.getFBC();
    this.initialized = false;
    
    // Debug mode - set to false in production
    this.debug = true;
  }

  // Get Facebook Browser ID (_fbp cookie)
  getFBP() {
    const fbpCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('_fbp='));
    
    if (fbpCookie) {
      return fbpCookie.split('=')[1];
    }
    
    // If no _fbp cookie exists, Facebook pixel should create one
    // Check if fbq is loaded and try to get it
    if (typeof fbq !== 'undefined') {
      // Facebook pixel is loaded, cookie should exist soon
      return null;
    }
    
    return null;
  }

  // Get Facebook Click ID (_fbc cookie)
  getFBC() {
    const fbcCookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('_fbc='));
    
    if (fbcCookie) {
      return fbcCookie.split('=')[1];
    }
    
    // Check URL for fbclid parameter
    const urlParams = new URLSearchParams(window.location.search);
    const fbclid = urlParams.get('fbclid');
    if (fbclid) {
      // Create _fbc value: version.subdomainIndex.creationTime.fbclid
      const timestamp = Math.floor(Date.now() / 1000);
      return `fb.1.${timestamp}.${fbclid}`;
    }
    
    return null;
  }

  // Log debug messages
  log(message, data = {}) {
    if (this.debug) {
      console.log(`[SPIN CAPI] ${message}`, data);
    }
  }

  // Send event to CAPI
  async sendEvent(eventName, customData = {}) {
    const eventData = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: window.location.href,
      user_agent: navigator.userAgent,
      fbp: this.fbp,
      fbc: this.fbc,
      custom_data: customData
    };

    this.log('Sending event', { eventName, customData, eventData });

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(eventData)
        // Removed credentials: 'include' to avoid CORS issues
      });

      this.log('Response status:', response.status);

      let result;
      try {
        result = await response.json();
        this.log('Response body:', result);
      } catch (parseError) {
        this.log('Failed to parse response as JSON:', parseError.message);
        throw new Error(`HTTP ${response.status}: Invalid JSON response`);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${result.error || result.debug_message || 'Unknown error'}`);
      }

      if (result.success) {
        this.log('Event sent successfully', {
          event_id: result.event_id,
          event_name: result.event_name,
          meta_events_received: result.meta_events_received
        });
        return result;
      } else {
        throw new Error(result.error || 'Event failed');
      }

    } catch (error) {
      console.error('[SPIN CAPI ERROR]', error.message);
      
      // Test the health endpoint if main request fails
      if (error.message.includes('500')) {
        this.testHealthEndpoint();
      }
      
      return { success: false, error: error.message };
    }
  }

  // Test health endpoint for debugging
  async testHealthEndpoint() {
    try {
      this.log('Testing health endpoint...');
      const response = await fetch(this.apiEndpoint, { method: 'GET' });
      const result = await response.json();
      this.log('Health check result:', result);
    } catch (error) {
      this.log('Health check failed:', error.message);
    }
  }

  // Track PageView
  async trackPageView() {
    const customData = {
      page_title: document.title,
      page_url: window.location.href,
      referrer: document.referrer || undefined
    };

    return await this.sendEvent('PageView', customData);
  }

  // Track Lead (button clicks, form submissions, etc.)
  async trackLead(elementInfo = {}) {
    const customData = {
      content_name: elementInfo.text || elementInfo.id || 'Unknown',
      content_category: elementInfo.category || 'lead',
      page_url: window.location.href,
      ...elementInfo // Allow custom properties
    };

    return await this.sendEvent('Lead', customData);
  }

  // Initialize tracking
  async init() {
    if (this.initialized) return;

    this.log('Initializing SPIN CAPI Tracker');

    // Check if page is loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
      return;
    }

    // Track initial page view
    await this.trackPageView();

    // Set up automatic lead tracking for buttons and links
    this.setupAutoTracking();

    this.initialized = true;
    this.log('SPIN CAPI Tracker initialized successfully');
  }

  // Setup automatic tracking for buttons and links
  setupAutoTracking() {
    // Track all buttons
    document.querySelectorAll('button, [role="button"], .btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const elementInfo = {
          text: button.textContent?.trim() || button.value || 'Button',
          id: button.id || undefined,
          class: button.className || undefined,
          category: 'button_click'
        };
        this.trackLead(elementInfo);
      });
    });

    // Track important links (CTAs, contact, etc.)
    document.querySelectorAll('a[href*="contact"], a[href*="quote"], a[href*="demo"], a.cta').forEach(link => {
      link.addEventListener('click', (e) => {
        const elementInfo = {
          text: link.textContent?.trim() || 'Link',
          href: link.href,
          id: link.id || undefined,
          category: 'cta_click'
        };
        this.trackLead(elementInfo);
      });
    });

    // Track form submissions
    document.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', (e) => {
        const elementInfo = {
          text: 'Form Submission',
          id: form.id || undefined,
          action: form.action || undefined,
          category: 'form_submit'
        };
        this.trackLead(elementInfo);
      });
    });

    this.log('Auto-tracking setup complete');
  }

  // Manual method to track specific elements (call this from your code)
  trackElement(element, category = 'interaction') {
    const elementInfo = {
      text: element.textContent?.trim() || element.value || 'Element',
      id: element.id || undefined,
      class: element.className || undefined,
      category: category
    };
    return this.trackLead(elementInfo);
  }
}

// Initialize tracker
const spinTracker = new SpinCAPITracker();

// Auto-initialize when script loads
spinTracker.init();

// Make available globally for manual tracking
window.spinTracker = spinTracker;

// Example usage:
// window.spinTracker.trackLead({ text: 'Custom Button', category: 'special_cta' });
// window.spinTracker.trackPageView(); // Manual page view
