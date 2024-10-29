const { ipcMain, dialog } = require('electron');
const logger = require('./logger');
const gameHandler = require('./handlers/game-handler');
const fileHandler = require('./handlers/file-handler');
const settingsHandler = require('./handlers/settings-handler');
const windowHandler = require('./handlers/window-handler');
const store = require('./store');
const os = require('os');

class IPCHandler {
    initialize() {
        logger.info('Initializing IPC handlers');
        this.registerFileHandlers();
        this.registerGameHandlers();
        this.registerSettingsHandlers();
        this.registerWindowHandlers();
        this.registerErrorHandler();
        logger.info('IPC handlers initialized successfully');
    }

    registerFileHandlers() {
        logger.debug('Registering file handlers');
        
        ipcMain.handle('select-file', async (event, options) => {
            return await fileHandler.selectFile(options);
        });

        ipcMain.handle('select-directory', async (event, options) => {
            return await fileHandler.selectDirectory(options);
        });

        ipcMain.handle('select-game', async (event, options) => {
            if (options && options.type === 'xbla') {
                return await fileHandler.selectXBLAFolder();
            }
            return await fileHandler.selectGame();
        });

        ipcMain.handle('select-xenia', async () => {
            return await fileHandler.selectDirectory();
        });
    }

    registerGameHandlers() {
        logger.debug('Registering game handlers');

        // Game management
        ipcMain.handle('add-game', async (event, filePath, options) => {
            return await gameHandler.addGame(filePath, options);
        });

        ipcMain.handle('remove-game', async (event, gameId) => {
            return await gameHandler.removeGame(gameId);
        });

        ipcMain.handle('get-games', () => {
            return gameHandler.getGames();
        });

        ipcMain.handle('launch-game', async (event, gameId, options) => {
            return await gameHandler.launchGame(gameId, options);
        });

        ipcMain.handle('check-compatibility', async (event, gameId) => {
            return await gameHandler.checkCompatibility(gameId);
        });

        // Game info window handlers
        ipcMain.handle('show-game-info', async (event, gameId) => {
            return await gameHandler.showGameInfo(gameId);
        });

        ipcMain.on('close-game-info', () => {
            if (gameHandler.gameInfoWindow) {
                gameHandler.gameInfoWindow.close();
            }
        });

        ipcMain.on('game-info-changed', async (event, game) => {
            await gameHandler.handleGameInfoChange(game.gameId, game);
        });

        ipcMain.handle('switch-game-variant', async (event, { gameId, newVariant }) => {
            return await gameHandler.switchGameVariant(gameId, newVariant);
        });

        // Game assets handlers
        ipcMain.on('change-game-boxart', async (event, gameId) => {
            try {
                const newPath = await gameHandler.changeGameImage(gameId, 'boxart');
                if (newPath) {
                    event.reply('boxart-changed', newPath);
                }
            } catch (error) {
                logger.error('Error changing boxart:', error);
                event.reply('error', error.message);
            }
        });

        ipcMain.on('change-game-icon', async (event, gameId) => {
            try {
                const newPath = await gameHandler.changeGameImage(gameId, 'icon');
                if (newPath) {
                    event.reply('icon-changed', newPath);
                }
            } catch (error) {
                logger.error('Error changing icon:', error);
                event.reply('error', error.message);
            }
        });

        ipcMain.on('change-game-location', async (event, gameId) => {
            const result = await dialog.showOpenDialog({
                filters: [
                    { name: 'Xbox 360 Games', extensions: ['iso', 'xex', 'gdf'] }
                ],
                properties: ['openFile']
            });

            if (!result.canceled && result.filePaths.length > 0) {
                await gameHandler.handleGameInfoChange(gameId, { path: result.filePaths[0] });
                event.reply('game-location-changed', result.filePaths[0]);
            }
        });
    }

    registerSettingsHandlers() {
        logger.debug('Registering settings handlers');

        ipcMain.handle('get-settings', () => {
            return settingsHandler.getSettings();
        });

        ipcMain.handle('save-settings', async (event, settings) => {
            return await settingsHandler.saveSettings(settings);
        });

        ipcMain.handle('get-xenia-settings', () => {
            return settingsHandler.getXeniaSettings();
        });

        ipcMain.handle('save-xenia-settings', async (event, settings) => {
            return await settingsHandler.saveXeniaSettings(settings);
        });

        ipcMain.handle('get-platform', () => {
            return os.platform();
        });

        ipcMain.handle('get-available-variants', async () => {
            return await store.getAvailableVariants();
        });
    }

    registerWindowHandlers() {
        logger.debug('Registering window handlers');

        ipcMain.on('minimize-window', () => {
            windowHandler.minimizeWindow();
        });

        ipcMain.on('maximize-window', () => {
            windowHandler.maximizeWindow();
        });

        ipcMain.on('close-window', () => {
            windowHandler.closeWindow();
        });
    }

    registerErrorHandler() {
        logger.debug('Registering error handler');

        ipcMain.on('error', (event, error) => {
            logger.error('Error occurred in renderer process:', error);
            dialog.showErrorBox('Error', error.message || 'An unknown error occurred');
        });
    }
}

module.exports = new IPCHandler();
