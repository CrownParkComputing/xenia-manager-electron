const { BrowserWindow, screen } = require('electron');
const path = require('path');
const logger = require('./logger');
const store = require('./store');

class WindowManager {
    constructor() {
        this.mainWindow = null;
    }

    createMainWindow() {
        try {
            logger.info('Creating main window...');

            // Get the primary display's work area
            const workArea = screen.getPrimaryDisplay().workArea;
            
            // Get saved window state or calculate default
            const savedState = store.store.get('windowState', {});
            const defaultWidth = Math.floor(workArea.width * 0.8);
            const defaultHeight = Math.floor(workArea.height * 0.8);

            const windowConfig = {
                width: savedState.width || defaultWidth,
                height: savedState.height || defaultHeight,
                x: savedState.x || Math.floor(workArea.x + (workArea.width - defaultWidth) / 2),
                y: savedState.y || Math.floor(workArea.y + (workArea.height - defaultHeight) / 2),
                minWidth: 800,
                minHeight: 600,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, '..', 'preload.js'),
                    spellcheck: false // Disable spellcheck to reduce GTK warnings
                },
                icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
                show: false, // Don't show until ready-to-show
                backgroundColor: '#1e1e1e', // Match app theme background
                autoHideMenuBar: true, // Hide menu bar by default
                frame: process.platform !== 'win32', // Use native frame on Linux/macOS
                titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
                // Disable GPU acceleration if running in a VM or remote desktop
                webPreferences: {
                    ...this.getWebPreferences()
                }
            };

            logger.debug('Window configuration:', windowConfig);
            this.mainWindow = new BrowserWindow(windowConfig);

            // Restore maximized state
            if (savedState.isMaximized) {
                this.mainWindow.maximize();
            }

            // Load the index.html file
            const indexPath = path.join(__dirname, '..', 'index.html');
            logger.debug(`Loading index.html from: ${indexPath}`);
            this.mainWindow.loadFile(indexPath);

            // Window event handlers
            this.setupWindowEventHandlers();

            logger.info('Main window created successfully');
            return this.mainWindow;

        } catch (error) {
            logger.error('Error creating main window:', error);
            throw error;
        }
    }

    getWebPreferences() {
        const prefs = {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '..', 'preload.js'),
            spellcheck: false
        };

        // Disable GPU acceleration if running in a VM or remote desktop
        if (this.isRunningInVM() || process.env.REMOTE_DESKTOP_SESSION) {
            prefs.offscreen = true;
        }

        return prefs;
    }

    isRunningInVM() {
        try {
            const fs = require('fs');
            // Check common VM indicators
            const indicators = [
                '/sys/class/dmi/id/product_name', // Contains "VirtualBox", "VMware", etc.
                '/sys/class/dmi/id/sys_vendor',   // Contains "QEMU", "VMware", etc.
            ];

            for (const file of indicators) {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8').toLowerCase();
                    if (content.includes('virtualbox') || 
                        content.includes('vmware') || 
                        content.includes('qemu') || 
                        content.includes('virtual')) {
                        return true;
                    }
                }
            }
        } catch (error) {
            logger.debug('Error checking VM status:', error);
        }
        return false;
    }

    setupWindowEventHandlers() {
        if (!this.mainWindow) return;

        this.mainWindow.once('ready-to-show', () => {
            logger.info('Main window ready to show');
            this.mainWindow.show();
        });

        this.mainWindow.webContents.on('did-finish-load', () => {
            logger.info('Main window finished loading');
        });

        this.mainWindow.webContents.on('crashed', (event) => {
            logger.error('Renderer process crashed:', event);
        });

        this.mainWindow.on('unresponsive', () => {
            logger.error('Window became unresponsive');
        });

        this.mainWindow.on('responsive', () => {
            logger.info('Window became responsive');
        });

        // Save window state on close
        this.mainWindow.on('close', () => {
            try {
                const windowState = {
                    isMaximized: this.mainWindow.isMaximized(),
                    ...(!this.mainWindow.isMaximized() && {
                        width: this.mainWindow.getBounds().width,
                        height: this.mainWindow.getBounds().height,
                        x: this.mainWindow.getBounds().x,
                        y: this.mainWindow.getBounds().y
                    })
                };
                store.store.set('windowState', windowState);
            } catch (error) {
                logger.error('Error saving window state:', error);
            }
            logger.info('Main window closed');
        });

        // Handle navigation attempts
        this.mainWindow.webContents.on('will-navigate', (event, url) => {
            event.preventDefault();
            logger.warn(`Navigation attempt blocked: ${url}`);
        });

        // Handle new window creation attempts
        this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
            logger.warn(`New window creation attempt blocked: ${url}`);
            return { action: 'deny' };
        });

        // Handle window state changes
        this.mainWindow.on('maximize', () => {
            this.sendToRenderer('window-state-change', { isMaximized: true });
        });

        this.mainWindow.on('unmaximize', () => {
            this.sendToRenderer('window-state-change', { isMaximized: false });
        });

        this.mainWindow.on('enter-full-screen', () => {
            this.sendToRenderer('window-state-change', { isFullScreen: true });
        });

        this.mainWindow.on('leave-full-screen', () => {
            this.sendToRenderer('window-state-change', { isFullScreen: false });
        });
    }

    getMainWindow() {
        return this.mainWindow;
    }

    closeMainWindow() {
        if (this.mainWindow) {
            logger.info('Closing main window');
            this.mainWindow.close();
        }
    }

    minimizeMainWindow() {
        if (this.mainWindow) {
            logger.debug('Minimizing main window');
            this.mainWindow.minimize();
        }
    }

    maximizeMainWindow() {
        if (this.mainWindow) {
            if (this.mainWindow.isMaximized()) {
                logger.debug('Unmaximizing main window');
                this.mainWindow.unmaximize();
            } else {
                logger.debug('Maximizing main window');
                this.mainWindow.maximize();
            }
        }
    }

    focusMainWindow() {
        if (this.mainWindow) {
            if (this.mainWindow.isMinimized()) {
                logger.debug('Restoring minimized window');
                this.mainWindow.restore();
            }
            logger.debug('Focusing main window');
            this.mainWindow.focus();
        }
    }

    reloadMainWindow() {
        if (this.mainWindow) {
            logger.info('Reloading main window');
            this.mainWindow.reload();
        }
    }

    sendToRenderer(channel, ...args) {
        if (this.mainWindow) {
            logger.debug(`Sending message to renderer: ${channel}`);
            this.mainWindow.webContents.send(channel, ...args);
        }
    }

    getWindowState() {
        if (!this.mainWindow) return null;
        
        return {
            isMaximized: this.mainWindow.isMaximized(),
            isMinimized: this.mainWindow.isMinimized(),
            isFullScreen: this.mainWindow.isFullScreen(),
            isFocused: this.mainWindow.isFocused(),
            bounds: this.mainWindow.getBounds()
        };
    }
}

// Export a singleton instance
const windowManager = new WindowManager();
module.exports = windowManager;
