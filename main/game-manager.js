const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');
const store = require('./store');
const gameInfo = require('./game/game-info');
const gameCompatibility = require('./game/game-compatibility');
const gameLauncher = require('./game/game-launcher');

class GameManager {
    constructor() {
        logger.info('Initializing GameManager');
        this.setupCleanup();
    }

    setupCleanup() {
        process.on('exit', () => this.cleanup());
        process.on('SIGINT', () => this.cleanup());
        process.on('SIGTERM', () => this.cleanup());
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught exception:', error);
            this.cleanup();
            process.exit(1);
        });
    }

    async addGame(filePath, variant) {
        logger.info(`Adding new game from: ${filePath} using ${variant}`);
        
        try {
            const settings = store.getSettings();
            if (!settings.xeniaPath) {
                throw new Error('Xenia path not configured');
            }

            // Extract game information using the specified variant
            const info = await gameInfo.extractGameInfo(filePath, variant);
            const gameObject = gameInfo.createGameObject({
                ...info,
                path: filePath,
                variant: variant // Ensure variant is included
            });

            // Add to store
            const addedGame = store.addGame(gameObject);
            logger.info('Game added successfully:', addedGame.title);

            // Check compatibility in the background
            this.checkCompatibilityAsync(addedGame.gameId).catch(error => {
                logger.error('Error in background compatibility check:', error);
            });

            return addedGame;
        } catch (error) {
            logger.error('Error adding game:', error);
            throw error;
        }
    }

    async removeGame(gameId) {
        logger.info(`Removing game ${gameId}`);
        
        try {
            // Ensure game isn't running
            if (gameLauncher.isGameRunning(gameId)) {
                logger.info('Terminating running game before removal');
                await gameLauncher.terminateGame(gameId);
            }

            // Get game info before removal
            const game = store.getGames().find(g => g.gameId === gameId);
            if (!game) {
                logger.warn(`Game ${gameId} not found for removal`);
                return false;
            }

            // Remove from store
            const result = store.removeGame(gameId);
            
            // Cleanup associated files
            await this.cleanupGameFiles(game);

            logger.info('Game removed successfully');
            return result;
        } catch (error) {
            logger.error('Error removing game:', error);
            throw error;
        }
    }

    async cleanupGameFiles(game) {
        try {
            // Remove cover image if it's not the default
            if (game.coverPath && game.coverPath !== 'assets/default-cover.svg') {
                const coverPath = path.join(process.cwd(), game.coverPath);
                try {
                    await fs.access(coverPath);
                    await fs.unlink(coverPath);
                    logger.debug(`Removed cover image: ${coverPath}`);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        logger.warn(`Error removing cover image: ${error.message}`);
                    }
                }
            }

            // Remove patches
            if (Array.isArray(game.patches)) {
                for (const patch of game.patches) {
                    if (patch.path) {
                        const patchPath = path.join(process.cwd(), patch.path);
                        try {
                            await fs.access(patchPath);
                            await fs.unlink(patchPath);
                            logger.debug(`Removed patch file: ${patchPath}`);
                        } catch (error) {
                            if (error.code !== 'ENOENT') {
                                logger.warn(`Error removing patch file: ${error.message}`);
                            }
                        }
                    }
                }
            }

            // Remove config file if it exists
            if (game.config) {
                const configPath = path.join(process.cwd(), game.config);
                try {
                    await fs.access(configPath);
                    await fs.unlink(configPath);
                    logger.debug(`Removed config file: ${configPath}`);
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        logger.warn(`Error removing config file: ${error.message}`);
                    }
                }
            }
        } catch (error) {
            logger.error('Error cleaning up game files:', error);
        }
    }

    async launchGame(gameId, options = {}) {
        logger.info(`Launch request for game ${gameId}`);
        return gameLauncher.launchGame(gameId, options);
    }

    async checkCompatibility(gameId) {
        logger.info(`Checking compatibility for game ${gameId}`);
        return gameCompatibility.checkCompatibility(gameId);
    }

    async checkCompatibilityAsync(gameId) {
        try {
            const rating = await gameCompatibility.checkCompatibility(gameId);
            const games = store.getGames();
            const game = games.find(g => g.gameId === gameId);
            
            if (game && game.compatibilityRating !== rating) {
                await store.updateGame(gameId, {
                    ...game,
                    compatibilityRating: rating
                });
                logger.info(`Updated compatibility rating for ${gameId} to ${rating}`);
            }
        } catch (error) {
            logger.error('Error in background compatibility check:', error);
        }
    }

    getRunningGames() {
        return gameLauncher.getRunningGames();
    }

    async terminateGame(gameId) {
        return gameLauncher.terminateGame(gameId);
    }

    getGameUptime(gameId) {
        return gameLauncher.getGameUptime(gameId);
    }

    clearCompatibilityCache() {
        gameCompatibility.clearCache();
        gameInfo.clearCache();
    }

    cleanup() {
        logger.info('Cleaning up GameManager');
        gameLauncher.cleanup();
        this.clearCompatibilityCache();
    }
}

// Export a singleton instance
const gameManager = new GameManager();
module.exports = gameManager;
