# Reading Tracker Browser Extension

A browser extension that automatically tracks your web reading habits and syncs with your Reading Tracker dashboard.

## Features

- **Automatic Tracking**: Detects when you're reading articles and tracks time spent
- **Smart Detection**: Identifies article-like pages vs navigation/social media
- **Real-time Sync**: Syncs reading sessions with your local dashboard
- **Offline Support**: Stores sessions locally when API is unavailable
- **Reading Analytics**: Shows stats directly in the extension popup
- **Content Analysis**: Automatically categorizes content with tags

## Installation

### Development Installation

1. **Load Extension in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked"
   - Select the `extension` folder from this project

2. **Start the Reading Tracker API**:
   ```bash
   # From the project root
   docker compose up -d
   ```

3. **Test the Extension**:
   - Visit any article or blog post
   - The extension will automatically start tracking
   - Click the extension icon to see stats
   - Visit `http://localhost:3000` to see the full dashboard

### Icons

The extension currently runs without custom icons (using browser defaults). To add custom icons:

1. Create PNG files in the `public/` directory:
   - `public/icon16.png` (16x16px)
   - `public/icon32.png` (32x32px) 
   - `public/icon48.png` (48x48px)
   - `public/icon128.png` (128x128px)

2. Update `manifest.json` to include the icons section:
   ```json
   "icons": {
     "16": "public/icon16.png",
     "32": "public/icon32.png", 
     "48": "public/icon48.png",
     "128": "public/icon128.png"
   }
   ```

## How It Works

### Content Detection
The extension uses multiple heuristics to identify article-like content:
- URL patterns (medium.com, dev.to, news sites, etc.)
- Page structure (article tags, content containers)
- Text density (pages with 300+ words)

### Reading Tracking
- Monitors user activity (scrolling, mouse movement, keyboard input)
- Pauses tracking after 30 seconds of inactivity
- Tracks scroll progress and reading time
- Only saves sessions longer than 10 seconds

### Data Sync
- Automatically sends reading sessions to the local API
- Falls back to local storage when API is unavailable
- Periodic sync of pending sessions
- Real-time stats in extension popup

## API Integration

The extension communicates with the Reading Tracker API at `http://localhost:3001`:

- `POST /api/sessions` - Save reading sessions
- `GET /api/stats` - Get reading statistics
- `GET /health` - Check API status

## Privacy

- All data stays local (your machine only)
- No external tracking or analytics
- No personal data collection
- Reading content is not stored, only metadata

## Development

### File Structure
```
extension/
├── manifest.json          # Extension configuration
├── src/
│   ├── content.js         # Content script (runs on web pages)
│   ├── background.js      # Service worker (handles API calls)
├── public/
│   ├── popup.html         # Extension popup UI
│   ├── popup.js           # Popup functionality
│   └── icon*.png          # Extension icons
```

### Testing
1. Load the extension in Chrome
2. Open browser console and look for "Reading Tracker" logs
3. Visit article pages and verify tracking starts
4. Check the extension popup for stats
5. Verify sessions appear in the dashboard

### Permissions

The extension requests these permissions:
- `activeTab`: To read page content and detect articles
- `storage`: To cache sessions when API is offline
- `scripting`: To inject content scripts
- `host_permissions`: To access websites and local API

## Browser Support

- ✅ Chrome (Manifest V3)
- ✅ Edge (Chromium-based)
- 🚧 Firefox (requires Manifest V2 adaptation)
- 🚧 Safari (requires conversion)

## Troubleshooting

### Extension not tracking
- Check if the page is detected as an article (see popup)
- Verify the Reading Tracker API is running
- Check browser console for error messages

### API connection issues
- Ensure Docker containers are running: `docker compose ps`
- Check API health: `curl http://localhost:3001/health`
- Verify no firewall blocking localhost:3001

### No stats showing
- Try the "Sync Now" button in the extension popup
- Check if sessions are stored locally in Chrome storage
- Restart the extension if needed