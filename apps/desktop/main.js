const { app, BrowserWindow, clipboard, nativeImage, Menu, nativeTheme } = require('electron');
const path = require('path');
const localRunner = require('./local-runner-host');

// Custom protocol scheme for deep linking
const PROTOCOL_SCHEME = 'dobby';

function resolveAppUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  try {
    const pkg = require('./package.json');
    if (pkg.dobbyAppUrl) return pkg.dobbyAppUrl;
  } catch (_) {}
  return 'https://dobby.now/';
}

// Get URL from environment, packaged build metadata, or production
const APP_URL = resolveAppUrl();

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
}

// Simple dev check without ES module dependency
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Normalize URL - ensure localhost uses http, not https
function normalizeUrl(url) {
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return url.replace(/^https:\/\//, 'http://');
  }
  return url;
}

// Check if URL is localhost
function isLocalhost(url) {
  return url.includes('localhost') || url.includes('127.0.0.1');
}

const normalizedUrl = normalizeUrl(APP_URL);
const isLocal = isLocalhost(normalizedUrl);

const DEFAULT_WINDOW_BG = '#000000';
const CHECKOUT_WINDOW_BG = '#ffffff';
const STRIPE_CHECKOUT_CSS = `
  :root { color-scheme: light only !important; }
  html, body { background: #ffffff !important; color-scheme: light only !important; }
`;

function isCheckoutUrl(url) {
  if (!url || url.startsWith('data:')) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (host === 'checkout.stripe.com' || host === 'pay.stripe.com') return true;
    if (host.endsWith('.stripe.com') && (parsed.pathname.includes('/c/pay') || parsed.pathname.includes('/checkout'))) {
      return true;
    }
    return parsed.pathname === '/checkout' || parsed.pathname.startsWith('/checkout/');
  } catch (_) {
    return false;
  }
}

function syncCheckoutPresentation(win, url) {
  if (!win || win.isDestroyed()) return;
  const checkout = isCheckoutUrl(url);
  nativeTheme.themeSource = checkout ? 'light' : 'system';
  win.setBackgroundColor(checkout ? CHECKOUT_WINDOW_BG : DEFAULT_WINDOW_BG);
}

// Set app name for macOS menu bar
if (process.platform === 'darwin') {
  app.setName('Dobby');
}

// Register as default protocol handler for dobby://
// This allows magic links to open in the desktop app
if (process.defaultApp) {
  // Development mode - register with path to electron executable
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  // Production mode
  app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
}

// Store pending deep link URL (received before window is ready)
let pendingDeepLinkUrl = null;

// Handle deep link URL
function handleDeepLink(url) {
  console.log('📱 Received deep link:', url);
  
  if (!url || !url.startsWith(`${PROTOCOL_SCHEME}://`)) {
    return;
  }
  
  // Convert dobby://auth/callback?code=xxx to the web app (APP_URL) + same path/query
  const deepLinkPath = url.replace(`${PROTOCOL_SCHEME}://`, '');
  const webUrl = normalizedUrl.endsWith('/') 
    ? normalizedUrl + deepLinkPath 
    : normalizedUrl + '/' + deepLinkPath;
  
  console.log('🔗 Converted to web URL:', webUrl);
  
  // Get the main window
  const mainWindow = BrowserWindow.getAllWindows()[0];
  
  if (mainWindow) {
    // Load the auth callback URL
    mainWindow.loadURL(webUrl);
    
    // Focus the window
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  } else {
    // Window not ready yet, store for later
    pendingDeepLinkUrl = webUrl;
  }
}

// macOS: Handle protocol when app is already running
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Windows/Linux: Handle protocol from command line args
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is running, quit this one
  app.quit();
} else {
  // Handle second instance (Windows/Linux deep link)
  app.on('second-instance', (event, commandLine) => {
    // Find the deep link URL in command line args
    const deepLinkUrl = commandLine.find(arg => arg.startsWith(`${PROTOCOL_SCHEME}://`));
    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
    }
    
    // Focus the main window
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Ignore certificate errors for localhost (dev server) - must be called before app.whenReady()
if (isLocal) {
  app.commandLine.appendSwitch('ignore-certificate-errors');
  app.commandLine.appendSwitch('ignore-ssl-errors');
}

// Allow the web UI to fetch the runner preview server on 127.0.0.1
app.commandLine.appendSwitch(
  'disable-features',
  'BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights'
);

// Circular loading animation HTML
const loadingHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Dobby</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      background: #000000;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .loader-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 24px;
    }
    
    .circular-loader {
      width: 48px;
      height: 48px;
      border: 3px solid rgba(255, 255, 255, 0.1);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    
    .loader-text {
      color: rgba(255, 255, 255, 0.5);
      font-size: 14px;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="loader-container">
    <div class="circular-loader"></div>
    <div class="loader-text">Loading...</div>
  </div>
</body>
</html>
`;

function createWindow() {
  // Use .icns for macOS (proper styling), PNG for other platforms
  const iconPath = process.platform === 'darwin' 
    ? path.resolve(__dirname, 'assets', 'icon.icns')
    : path.resolve(__dirname, 'assets', 'icon.png');
    
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
    backgroundColor: DEFAULT_WINDOW_BG,
    // Use default frame with native controls
    titleBarStyle: 'default',
    frame: true,
    transparent: false,
    show: false, // Don't show until ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: !isLocal,
    },
  });

  const { webContents } = mainWindow;

  const applyCheckoutPresentation = () => {
    const url = webContents.getURL();
    syncCheckoutPresentation(mainWindow, url);
    if (isCheckoutUrl(url)) {
      webContents.insertCSS(STRIPE_CHECKOUT_CSS).catch(() => {});
    }
  };

  webContents.on('did-start-navigation', (_event, url, _isInPlace, isMainFrame) => {
    if (isMainFrame) syncCheckoutPresentation(mainWindow, url);
  });
  webContents.on('did-navigate', (_event, url) => {
    syncCheckoutPresentation(mainWindow, url);
  });
  webContents.on('did-navigate-in-page', (_event, url) => {
    syncCheckoutPresentation(mainWindow, url);
  });
  webContents.on('will-redirect', (_event, url) => {
    syncCheckoutPresentation(mainWindow, url);
  });
  webContents.on('did-finish-load', applyCheckoutPresentation);

  // Show loading animation immediately
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingHTML)}`);
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Set custom user agent to identify Electron app
  webContents.setUserAgent(webContents.getUserAgent() + ' Electron/Dobby-Desktop');

  // Create menu with back/forward navigation
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: 'Dobby',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { 
          label: 'Back',
          accelerator: 'CmdOrCtrl+Left',
          click: () => {
            if (webContents.navigationHistory.canGoBack()) {
              webContents.navigationHistory.goBack();
            }
          }
        },
        { 
          label: 'Forward',
          accelerator: 'CmdOrCtrl+Right',
          click: () => {
            if (webContents.navigationHistory.canGoForward()) {
              webContents.navigationHistory.goForward();
            }
          }
        },
        { 
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => webContents.reload()
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' },
          { role: 'front' }
        ] : [
          { role: 'close' }
        ])
      ]
    }
  ];

  localRunner.rebuildMenu(template);

  // Handle certificate errors for localhost
  if (isLocal) {
    webContents.on('certificate-error', (event, url, error, certificate, callback) => {
      if (isLocalhost(url)) {
        event.preventDefault();
        callback(true);
      } else {
        callback(false);
      }
    });
  }

  // Open the web app homepage (same origin as APP_URL) so users get marketing + locale switcher
  const startUrl = normalizedUrl.endsWith('/')
    ? normalizedUrl
    : `${normalizedUrl}/`;

  // Load the actual URL after the loading screen is shown
  setTimeout(() => {
    mainWindow.loadURL(startUrl);
  }, 100);

  // Intercept navigation for OAuth (popup flow)
  webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const url = new URL(navigationUrl);
      
      // Check if this is an OAuth URL
      const isOAuthUrl = navigationUrl.includes('accounts.google.com') ||
                         navigationUrl.includes('github.com/login/oauth') ||
                         navigationUrl.includes('api.github.com') ||
                         navigationUrl.includes('supabase.co/auth') ||
                         navigationUrl.includes('/auth/v1/authorize');
      
      if (isOAuthUrl) {
        console.log('🚫 Preventing OAuth navigation in main window');
        console.log('✅ Opening OAuth in popup instead:', navigationUrl);
        event.preventDefault();
        
        // Create OAuth popup window with loading animation
        const oauthWindow = new BrowserWindow({
          width: 600,
          height: 800,
          parent: mainWindow,
          modal: false,
          autoHideMenuBar: true,
          title: 'Sign In',
          backgroundColor: '#000000',
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });
        
        // Show loading animation first, then load OAuth URL
        oauthWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingHTML)}`);
        oauthWindow.once('ready-to-show', () => {
          oauthWindow.show();
          oauthWindow.loadURL(navigationUrl);
        });
        
        // Handle OAuth callback - close popup and load callback in main window
        oauthWindow.webContents.on('will-navigate', (e, callbackUrl) => {
          if (callbackUrl.includes('/auth/callback') || callbackUrl.includes(normalizedUrl)) {
            console.log('✅ OAuth callback detected, closing popup');
            e.preventDefault();
            oauthWindow.close();
            mainWindow.loadURL(callbackUrl);
          }
        });
        
        oauthWindow.webContents.on('will-redirect', (e, callbackUrl) => {
          if (callbackUrl.includes('/auth/callback') || callbackUrl.includes(normalizedUrl)) {
            console.log('✅ OAuth redirect detected, closing popup');
            e.preventDefault();
            oauthWindow.close();
            mainWindow.loadURL(callbackUrl);
          }
        });
        
        return;
      }
    } catch (e) {
      console.error('Navigation error:', e);
    }
  });

  // Help OAuth links that use target="_blank" still open in an in-app popup (same as will-navigate flow)
  webContents.on('did-finish-load', () => {
    webContents.executeJavaScript(`
      (function() {
        document.addEventListener('click', function(e) {
          const link = e.target.closest('a[target="_blank"]');
          if (link && link.href) {
            const href = link.href;
            const isOAuthUrl = href.includes('accounts.google.com') ||
                               href.includes('github.com/login/oauth') ||
                               href.includes('api.github.com') ||
                               href.includes('supabase.co/auth') ||
                               href.includes('oauth') ||
                               href.includes('authorize');
            if (isOAuthUrl) {
              e.preventDefault();
              window.open(href, '_blank', 'width=500,height=700');
            }
          }
        }, true);
      })();
    `).catch(() => {});
  });

  // Handle all window.open() calls - OAuth and external links
  webContents.setWindowOpenHandler(({ url }) => {
    console.log('🔗 Window open requested:', url);
    
    // OAuth URLs that should open in a popup window
    const isOAuthUrl = url.includes('accounts.google.com') ||
                       url.includes('github.com/login/oauth') ||
                       url.includes('api.github.com') ||
                       url.includes('supabase.co/auth') ||
                       url.includes('/auth/v1/authorize') ||
                       url.includes('oauth') ||
                       url.includes('authorize');
    
    if (isOAuthUrl) {
      console.log('✅ Opening OAuth in popup window');
      // Open OAuth in a popup window - Electron will create it
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 600,
          height: 800,
          parent: mainWindow,
          modal: false,
          autoHideMenuBar: true,
          title: 'Sign In',
          backgroundColor: '#000000',
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        },
      };
    }

    const isLocalPreview = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url);
    if (isLocalPreview) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1100,
          height: 800,
          autoHideMenuBar: true,
          title: 'Preview',
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        },
      };
    }
    
    console.log('🌐 Opening in system browser');
    // External links open in system browser
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
  
  // Handle OAuth callback redirects from popup windows
  app.on('web-contents-created', (event, contents) => {
    // Only handle popup windows (not main window)
    if (contents !== webContents) {
      contents.on('will-navigate', (e, callbackUrl) => {
        if (callbackUrl.includes('/auth/callback') || callbackUrl.includes(normalizedUrl)) {
          e.preventDefault();
          // Close the popup
          const popupWindow = BrowserWindow.fromWebContents(contents);
          if (popupWindow) {
            popupWindow.close();
          }
          // Load callback in main window
          mainWindow.loadURL(callbackUrl);
        }
      });
      
      contents.on('will-redirect', (e, callbackUrl) => {
        if (callbackUrl.includes('/auth/callback') || callbackUrl.includes(normalizedUrl)) {
          e.preventDefault();
          // Close the popup
          const popupWindow = BrowserWindow.fromWebContents(contents);
          if (popupWindow) {
            popupWindow.close();
          }
          // Load callback in main window
          mainWindow.loadURL(callbackUrl);
        }
      });
    }
  });

  // Handle OAuth redirects back to the app in main window
  webContents.on('will-navigate', (event, url) => {
    // If navigating to our auth callback from OAuth, allow it
    if (url.includes('/auth/callback')) {
      // Re-inject nav bar after OAuth completes
      setTimeout(() => injectNavBar(), 500);
    }
  });
}

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;
  localRunner.registerIpc();
  localRunner.claimLocalFolders();

  if (process.platform === 'darwin') {
    // Use .icns for macOS dock icon - ensures proper styling with rounded corners
    const iconPath = path.resolve(__dirname, 'assets', 'icon.icns');
    console.log('🎨 Setting dock icon from:', iconPath);
    try {
      const icon = nativeImage.createFromPath(iconPath);
      console.log('🎨 Icon loaded, isEmpty:', icon.isEmpty(), 'size:', icon.getSize());
      if (!icon.isEmpty()) {
        app.dock.setIcon(icon);
        console.log('✅ Dock icon set successfully');
      } else {
        console.error('❌ Icon is empty');
      }
    } catch (err) {
      console.error('❌ Error setting dock icon:', err);
    }
  }

  createWindow();
  localRunner.autoStartIfPaired();

  // Handle pending deep link (received before window was ready)
  if (pendingDeepLinkUrl) {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.loadURL(pendingDeepLinkUrl);
    }
    pendingDeepLinkUrl = null;
  }

  // Check command line args for deep link on startup (Windows/Linux)
  if (process.platform !== 'darwin') {
    const deepLinkUrl = process.argv.find(arg => arg.startsWith(`${PROTOCOL_SCHEME}://`));
    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  localRunner.stopRunner({ immediate: true });
});
