# PrivexBot Widget

Embeddable chat widget for PrivexBot chatbots and chatflows.

## Installation

### CDN (Recommended)

```html
<!-- Add before closing </body> tag -->
<script>
  (function(w,d,s,o,f,js,fjs){
    w['PrivexBot']=o;w[o] = w[o] || function () { (w[o].q = w[o].q || []).push(arguments) };
    js = d.createElement(s), fjs = d.getElementsByTagName(s)[0];
    js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'pb', 'https://cdn.privexbot.com/widget.js'));

  pb('init', {
    type: 'chatbot',
    id: 'your-chatbot-id',
    options: {
      position: 'bottom-right',
      color: '#6366f1',
      greeting: 'Hi! How can I help you?'
    }
  });
</script>
```

### NPM (For bundlers)

```bash
npm install @privexbot/widget
```

```javascript
import PrivexBotWidget from '@privexbot/widget';

const widget = new PrivexBotWidget();
widget.init({
  type: 'chatbot',
  id: 'your-chatbot-id',
  options: {
    position: 'bottom-right',
    color: '#6366f1'
  }
});
```

## Configuration

### Basic Options

```javascript
pb('init', {
  type: 'chatbot',        // 'chatbot' or 'chatflow'
  id: 'chatbot-id-123',   // Your chatbot/chatflow ID
  options: {
    // Position
    position: 'bottom-right',  // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

    // Appearance
    color: '#6366f1',          // Primary color (hex)
    botName: 'Support Bot',    // Name shown in header
    greeting: 'Hello! 👋',     // Initial message
    showBranding: true,        // Show "Powered by PrivexBot"

    // Size
    width: 400,                // Width in pixels
    height: 600,               // Height in pixels

    // API
    baseURL: 'https://api.privexbot.com/api/v1'  // Custom API URL
  }
});
```

### Lead Collection

The widget supports lead collection with flexible timing and custom fields.

```javascript
pb('init', {
  type: 'chatbot',
  id: 'chatbot-id-123',
  options: {
    leadConfig: {
      enabled: true,

      // Timing options
      timing: 'after_messages',  // 'before_chat' | 'after_messages'
      messageCount: 3,           // Show after N user messages (for 'after_messages')

      // Form customization
      title: 'Get in Touch',
      description: "We'd love to hear from you!",
      submitText: 'Continue',
      allowSkip: true,           // Allow users to skip

      // Custom fields
      fields: [
        {
          name: 'name',
          label: 'Name',
          type: 'text',
          required: true,
          placeholder: 'John Doe'
        },
        {
          name: 'email',
          label: 'Email',
          type: 'email',
          required: true,
          placeholder: 'john@example.com'
        },
        {
          name: 'phone',
          label: 'Phone Number',
          type: 'tel',
          required: false,
          placeholder: '+1 (555) 123-4567'
        },
        {
          name: 'company',
          label: 'Company',
          type: 'text',
          required: false,
          placeholder: 'Acme Inc.'
        }
      ]
    }
  }
});
```

#### Lead Collection Timing

**Before Chat (`timing: 'before_chat'`)**
- Lead form is shown immediately when widget opens
- Chat starts after form submission or skip
- Good for: High-intent lead capture, gated support

**After Messages (`timing: 'after_messages'`)**
- Chat starts immediately
- Lead form appears after N user messages
- Good for: Warm lead capture, progressive engagement

### API Methods

```javascript
// Open widget programmatically
pb('open');

// Close widget
pb('close');

// Destroy widget (cleanup)
pb('destroy');
```

## Development

### Setup

```bash
cd widget
npm install
```

### Build

```bash
# Production build
npm run build

# Development build with watch
npm run dev

# Development server
npm run serve
```

### Build Output

Compiled widget will be in `build/widget.js`.

## Features

- ✅ Lightweight (~50KB gzipped)
- ✅ Mobile responsive
- ✅ Customizable appearance
- ✅ Lead collection with validation
- ✅ Typing indicators
- ✅ Message history
- ✅ Session persistence
- ✅ Analytics tracking
- ✅ Self-contained (no conflicts)
- ✅ Accessible (ARIA labels)

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers

**Not supported**: IE11

## Examples

### Minimal Setup

```html
<script>
  (function(w,d,s,o,f,js,fjs){
    w['PrivexBot']=o;w[o] = w[o] || function () { (w[o].q = w[o].q || []).push(arguments) };
    js = d.createElement(s), fjs = d.getElementsByTagName(s)[0];
    js.id = o; js.src = f; js.async = 1; fjs.parentNode.insertBefore(js, fjs);
  }(window, document, 'script', 'pb', 'https://cdn.privexbot.com/widget.js'));

  pb('init', {
    id: 'chatbot-123',
    options: {}
  });
</script>
```

### With Lead Collection Before Chat

```html
<script>
  pb('init', {
    id: 'chatbot-123',
    options: {
      position: 'bottom-right',
      color: '#8b5cf6',
      greeting: 'Welcome! Let me know how I can help.',
      leadConfig: {
        enabled: true,
        timing: 'before_chat',
        title: 'Quick Introduction',
        description: 'Tell us about yourself to get started.',
        allowSkip: false,
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true }
        ]
      }
    }
  });
</script>
```

### With Lead Collection After 3 Messages

```html
<script>
  pb('init', {
    id: 'chatbot-123',
    options: {
      leadConfig: {
        enabled: true,
        timing: 'after_messages',
        messageCount: 3,
        title: 'Stay Connected',
        description: 'Leave your details so we can follow up!',
        allowSkip: true
      }
    }
  });
</script>
```

### Custom Styling

The widget uses scoped CSS classes. You can override styles:

```css
/* Change bubble shadow */
.privexbot-bubble {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3) !important;
}

/* Change message bubble colors */
.privexbot-message.bot .privexbot-message-bubble {
  background: #f0f0f0 !important;
}
```

## Events & Analytics

The widget automatically tracks:

- `widget_loaded` - Widget initialized
- `widget_opened` - Chat window opened
- `widget_closed` - Chat window closed
- `message_sent` - User sent a message
- `lead_collected` - Lead form submitted
- `lead_skipped` - Lead form skipped

Events are sent to: `POST /chatbots/{id}/widget/event`

## API Endpoints

The widget calls these backend endpoints:

```
GET  /chatbots/{id}/widget/config
POST /chatbots/{id}/widget/message
POST /chatbots/{id}/widget/lead
POST /chatbots/{id}/widget/event
GET  /chatbots/{id}/widget/conversation/{conversation_id}
```

## Security

- Session IDs stored in localStorage
- No sensitive data in widget code
- CORS configured on backend
- Rate limiting on API endpoints

## Troubleshooting

**Widget not showing**
- Check console for errors
- Verify chatbot ID is correct
- Ensure script is loaded (check Network tab)

**Lead form validation errors**
- Email must be valid format
- Phone must be 10+ digits
- Required fields must be filled

**Messages not sending**
- Check network connectivity
- Verify API base URL is correct
- Check backend is running

## License

MIT

## Support

- Documentation: https://docs.privexbot.com
- Email: support@privexbot.com
- GitHub: https://github.com/privexbot/widget
