const gameManager = require('../game-manager');
const store = require('../store');
const logger = require('../logger');
const fileHandler = require('./file-handler');
const { BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');  // Regular fs for createWriteStream
const fsPromises = require('fs').promises;  // Promises version for mkdir, etc.
const axios = require('axios');

class GameHandler {
    constructor() {
        this.gameInfoWindow = null;
        this.artworkPath = path.join(process.cwd(), 'data', 'artwork');
    }

    async addGame(filePath, options = {}) {
        logger.debug('Handling add-game request:', filePath, options);
        try {
            // First, prompt for Xenia variant selection
            const variant = await fileHandler.selectXeniaVariant();
            if (!variant) {
                throw new Error('No Xenia variant selected');
            }

            logger.debug(`Selected Xenia variant: ${variant}`);

            let gamePath = filePath;
            if (options.type === 'xbla') {
                // For XBLA games, we need to find the executable in the folder
                const files = await this.findXBLAExecutable(filePath);
                if (!files || files.length === 0) {
                    throw new Error('No valid XBLA executable found in the selected folder');
                }
                gamePath = files[0];
                
                // Get the game title from the folder name
                const gameTitle = path.basename(filePath);
                options.title = gameTitle;

                // Rename the folder to match the title if needed
                const parentDir = path.dirname(filePath);
                const newPath = path.join(parentDir, gameTitle);
                if (filePath !== newPath) {
                    await fsPromises.rename(filePath, newPath);
                }
            }

            const result = await gameManager.addGame(gamePath, variant, options);

            // Download artwork after game is added
            await this.downloadGameArtwork(result);

            logger.debug('Game added successfully');
            return result;
        } catch (error) {
            logger.error('Error in add-game handler:', error);
            throw error;
        }
    }

    async findXBLAExecutable(folderPath) {
        const foundFiles = [];
        
        async function searchFolder(currentPath) {
            const entries = await fsPromises.readdir(currentPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                
                if (entry.isDirectory()) {
                    await searchFolder(fullPath);
                } else if (entry.isFile()) {
                    // Check if file has no extension
                    const ext = path.extname(entry.name);
                    if (!ext) {
                        foundFiles.push(fullPath);
                    }
                }
            }
        }

        await searchFolder(folderPath);
        return foundFiles;
    }

    async downloadGameArtwork(game) {
        logger.info(`Downloading artwork for game ${game.gameId}`);
        const gameArtworkPath = path.join(this.artworkPath, game.gameId);
        
        try {
            // Create artwork directory if it doesn't exist
            await fsPromises.mkdir(gameArtworkPath, { recursive: true });

            // Download boxart using the game ID
            if (game.gameId) {
                const boxartUrl = `http://download.xbox.com/content/images/66acd000-77fe-1000-9115-d802${game.gameId}/1033/boxartlg.jpg`;
                const boxartPath = path.join(gameArtworkPath, 'boxart.jpg');
                await this.downloadFile(boxartUrl, boxartPath);
                logger.info(`Downloaded boxart for game ${game.gameId}`);

                // Update game with new boxart path
                await store.updateGame(game.gameId, {
                    ...game,
                    coverPath: path.join('data', 'artwork', game.gameId, 'boxart.jpg')
                });
            }

            // Download icon using the media ID if available
            if (game.mediaId) {
                const iconUrl = `http://download.xbox.com/content/images/${game.mediaId}/icon.png`;
                const iconPath = path.join(gameArtworkPath, 'icon.png');
                await this.downloadFile(iconUrl, iconPath);
                logger.info(`Downloaded icon for game ${game.gameId}`);

                // Update game with new icon path
                await store.updateGame(game.gameId, {
                    ...game,
                    iconPath: path.join('data', 'artwork', game.gameId, 'icon.png')
                });
            }
        } catch (error) {
            logger.error(`Error downloading artwork for game ${game.gameId}: ${error.message}`);
            // Don't throw error - just log it and continue
            // This way the game is still added even if artwork download fails
        }
    }

    async downloadFile(url, filePath) {
        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        } catch (error) {
            logger.error(`Error downloading file from ${url}: ${error.message}`);
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
                    await fsPromises.unlink(path.join(process.cwd(), oldPath));
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
