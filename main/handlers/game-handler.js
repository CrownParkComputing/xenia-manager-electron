const gameManager = require('../game-manager');
const store = require('../store');
const logger = require('../logger');
const fileHandler = require('./file-handler');
const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs').promises;

class GameHandler {
    constructor() {
        this.gameInfoWindow = null;
    }

    async addGame(filePath) {
        logger.debug('Handling add-game request:', filePath);
        try {
            // First, prompt for Xenia variant selection
            const variant = await fileHandler.selectXeniaVariant();
            if (!variant) {
                throw new Error('No Xenia variant selected');
            }

            logger.debug(`Selected Xenia variant: ${variant}`);
            const result = await gameManager.addGame(filePath, variant);
            logger.debug('Game added successfully');
            return result;
        } catch (error) {
            logger.error('Error in add-game handler:', error);
            throw error;
        }
    }

    async changeGameImage(gameId, type = 'boxart') {
        logger.debug(`Handling change-game-${type} request:`, gameId);
        try {
            const game = store.getGames().find(g => g.gameId === gameId);
            if (!game) {
                throw new Error('Game not found');
            }

            // Get new image path
            const newPath = await fileHandler.selectGameImage(type);
            if (!newPath) return null;

            // Remove old image if it exists and isn't the default
            const oldPath = type === 'boxart' ? game.coverPath : game.iconPath;
            if (oldPath && !oldPath.includes('default-cover') && !oldPath.includes('default-icon')) {
                try {
                    await fs.unlink(path.join(process.cwd(), oldPath));
                } catch (error) {
                    logger.warn(`Failed to remove old ${type}:`, error);
                }
            }

            // Update game object with new image path
            const updates = type === 'boxart' 
                ? { ...game, coverPath: newPath }
                : { ...game, iconPath: newPath };
            
            await store.updateGame(gameId, updates);
            return newPath;
        } catch (error) {
            logger.error(`Error in change-game-${type} handler:`, error);
            throw error;
        }
    }

    async removeGame(gameId) {
        logger.debug('Handling remove-game request:', gameId);
        try {
            const result = await gameManager.removeGame(gameId);
            logger.debug('Game removed successfully');
            return result;
        } catch (error) {
            logger.error('Error in remove-game handler:', error);
            throw error;
        }
    }

    getGames() {
        logger.debug('Handling get-games request');
        try {
            return store.getGames();
        } catch (error) {
            logger.error('Error in get-games handler:', error);
            throw error;
        }
    }

    async launchGame(gameId, options = {}) {
        logger.debug('Handling launch-game request:', { gameId, options });
        try {
            // Get the game's stored variant or use the specified one
            const games = store.getGames();
            const game = games.find(g => g.gameId === gameId);
            if (!game) {
                throw new Error('Game not found');
            }

            // If no variant specified in options, use the game's stored variant
            // If no stored variant, get available variants and use the first one
            if (!options.variant) {
                const variants = await store.getAvailableVariants();
                if (variants.length === 0) {
                    throw new Error('No Xenia variants available');
                }

                options = {
                    ...options,
                    variant: game.variant || variants[0].toLowerCase()
                };
                logger.debug(`Using variant: ${options.variant}`);
            }

            const result = await gameManager.launchGame(gameId, options);
            logger.debug('Game launched successfully');
            return result;
        } catch (error) {
            logger.error('Error in launch-game handler:', error);
            throw error;
        }
    }

    async showGameInfo(gameId) {
        try {
            const game = store.getGames().find(g => g.gameId === gameId);
            if (!game) {
                throw new Error('Game not found');
            }

            // Create game info window if it doesn't exist
            if (!this.gameInfoWindow || this.gameInfoWindow.isDestroyed()) {
                this.gameInfoWindow = new BrowserWindow({
                    width: 600,
                    height: 700,
                    frame: false,
                    webPreferences: {
                        nodeIntegration: true,
                        contextIsolation: false
                    }
                });

                await this.gameInfoWindow.loadFile(path.join(__dirname, '../../game-info.html'));
                
                // Handle window close
                this.gameInfoWindow.on('closed', () => {
                    this.gameInfoWindow = null;
                });
            }

            // Send game data to window
            this.gameInfoWindow.webContents.send('load-game-info', game);

            // Send available variants
            const variants = await store.getAvailableVariants();
            this.gameInfoWindow.webContents.send('update-variants', variants);

            this.gameInfoWindow.show();
        } catch (error) {
            logger.error('Error showing game info:', error);
            throw error;
        }
    }

    async handleGameInfoChange(gameId, updates) {
        try {
            const result = await store.updateGame(gameId, updates);
            logger.debug('Game info updated:', result);
            return result;
        } catch (error) {
            logger.error('Error updating game info:', error);
            throw error;
        }
    }

    async switchGameVariant(gameId, newVariant) {
        try {
            const game = store.getGames().find(g => g.gameId === gameId);
            if (!game) {
                throw new Error('Game not found');
            }

            // Get paths for old and new variants
            const oldXeniaPath = await store.getXeniaExecutablePath(game.variant);
            const newXeniaPath = await store.getXeniaExecutablePath(newVariant);

            if (!newXeniaPath) {
                throw new Error(`${newVariant} executable not found`);
            }

            // Handle config file transfer if needed
            if (game.config) {
                const oldConfigDir = path.dirname(oldXeniaPath);
                const newConfigDir = path.dirname(newXeniaPath);
                const configFileName = `${game.title}.config.toml`;

                // Move config file to new location
                await fileHandler.moveFile(
                    path.join(oldConfigDir, configFileName),
                    path.join(newConfigDir, configFileName)
                );
            }

            // Update game variant
            const result = await store.updateGame(gameId, {
                ...game,
                variant: newVariant
            });

            logger.debug(`Game variant switched to ${newVariant}`);
            return result;
        } catch (error) {
            logger.error('Error switching game variant:', error);
            throw error;
        }
    }

    async checkCompatibility(gameId) {
        logger.debug('Handling check-compatibility request:', gameId);
        try {
            const result = await gameManager.checkCompatibility(gameId);
            logger.debug('Compatibility check result:', result);
            return result;
        } catch (error) {
            logger.error('Error in check-compatibility handler:', error);
            throw error;
        }
    }

    getGameUptime(gameId) {
        return gameManager.getGameUptime(gameId);
    }

    async terminateGame(gameId) {
        return gameManager.terminateGame(gameId);
    }
}

module.exports = new GameHandler();
