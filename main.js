const { app, BrowserWindow } = require('electron');
const path = require('path');
const logger = require('./main/logger');
const windowManager = require('./main/window');
const ipcHandler = require('./main/ipc-handler');
const gameManager = require('./main/game-manager');
const store = require('./main/store');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
    app.quit();
}

async function initializeApp() {
    logger.info('Starting Xenia Manager...');
    logger.info('App version: ' + app.getVersion());
    logger.info('Electron version: ' + process.versions.electron);
    logger.info('Chrome version: ' + process.versions.chrome);
    logger.info('Node version: ' + process.versions.node);
    logger.info('Platform: ' + process.platform);
    logger.info('Architecture: ' + process.arch);

    try {
        logger.info('Initializing application directories...');
        const userDataPath = app.getPath('userData');
        logger.info('User data path:', userDataPath);

        // Create required directories
        const dirs = ['games', 'covers', 'patches'].map(dir => 
            path.join(userDataPath, dir)
        );

        for (const dir of dirs) {
            await require('fs').promises.mkdir(dir, { recursive: true });
        }

        // Initialize IPC handlers
        ipcHandler.initialize();

        // Create main window
        await windowManager.createMainWindow();

    } catch (error) {
        logger.error('Initialization Error:', error);
        app.quit();
    }
}

// This method will be called when Electron has finished initialization
app.on('ready', initializeApp);

// Quit when all windows are closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.createMainWindow();
    }
});

// Cleanup on app quit
app.on('before-quit', () => {
    logger.info('Cleaning up GameManager');
    gameManager.cleanup();
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
    logger.error('Unhandled Rejection:', error);
});
