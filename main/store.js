const Store = require('electron-store');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./logger');

class AppStore {
    constructor() {
        logger.info('Initializing AppStore');
        try {
            this.store = new Store({
                name: 'config',
                defaults: {
                    settings: {
                        xeniaPath: '',
                        theme: 'dark',
                        gamesDirectory: '',
                        lastOpenedGame: null,
                        winePrefix: process.platform === 'linux' ? path.join(require('os').homedir(), '.wine') : null
                    },
                    xeniaSettings: {
                        graphicsBackend: 'vulkan',
                        resolutionScale: '1',
                        fullscreen: true,
                        vsync: true
                    },
                    paths: {
                        games: 'games',
                        covers: 'covers',
                        patches: 'patches'
                    },
                    compatibility: {
                        apiEndpoint: 'https://api.github.com/repos/xenia-project/game-compatibility/issues',
                        updateInterval: 86400
                    },
                    gameSettings: {},
                    games: []
                }
            });
            logger.info('AppStore initialized successfully');
        } catch (error) {
            logger.error('Error initializing AppStore:', error);
            throw error;
        }
    }

    async findExecutable(dir, variant) {
        try {
            const files = await fs.readdir(dir, { withFileTypes: true });
            for (const file of files) {
                if (file.isDirectory()) {
                    const found = await this.findExecutable(path.join(dir, file.name), variant);
                    if (found) return found;
                } else {
                    const fileName = file.name.toLowerCase();
                    // Look for executable files
                    if (variant === 'canary' && fileName.includes('canary') && fileName.endsWith('.exe')) return path.join(dir, file.name);
                    if (variant === 'stable' && fileName === 'xenia.exe') return path.join(dir, file.name);
                    if (variant === 'netplay' && fileName.includes('netplay') && fileName.endsWith('.exe')) return path.join(dir, file.name);
                }
            }
        } catch (error) {
            logger.debug(`Error searching directory ${dir}: ${error.message}`);
        }
        return null;
    }

    async getAvailableVariants() {
        const xeniaPath = this.getSettings().xeniaPath;
        if (!xeniaPath) {
            logger.debug('No Xenia path configured');
            return [];
        }

        logger.debug(`Checking for variants in path: ${xeniaPath}`);
        try {
            const variants = [];
            
            // Check for Canary
            const canaryPath = path.join(xeniaPath, 'Xenia Canary');
            if (await this.findExecutable(canaryPath, 'canary')) {
                logger.debug('Found Canary executable');
                variants.push('Canary');
            }

            // Check for Stable
            const stablePath = path.join(xeniaPath, 'Xenia Stable');
            if (await this.findExecutable(stablePath, 'stable')) {
                logger.debug('Found Stable executable');
                variants.push('Stable');
            }

            // Check for Netplay
            const netplayPath = path.join(xeniaPath, 'Xenia Netplay');
            if (await this.findExecutable(netplayPath, 'netplay')) {
                logger.debug('Found Netplay executable');
                variants.push('Netplay');
            }

            logger.debug(`Available Xenia variants: ${variants.join(', ')}`);
            return variants;
        } catch (error) {
            logger.error('Error getting available variants:', error);
            return [];
        }
    }

    async getXeniaExecutablePath(variant = 'canary') {
        const xeniaPath = this.getSettings().xeniaPath;
        if (!xeniaPath) {
            logger.debug('No Xenia path configured');
            return '';
        }

        const variantFolders = {
            'canary': 'Xenia Canary',
            'stable': 'Xenia Stable',
            'netplay': 'Xenia Netplay'
        };

        const folderName = variantFolders[variant.toLowerCase()];
        if (!folderName) {
            logger.debug(`Invalid variant: ${variant}`);
            return '';
        }

        const variantPath = path.join(xeniaPath, folderName);
        logger.debug(`Searching for executable in ${variantPath}`);
        
        try {
            const execPath = await this.findExecutable(variantPath, variant.toLowerCase());
            if (execPath) {
                logger.debug(`Found executable for ${variant}: ${execPath}`);
                return execPath;
            }
            logger.debug(`No executable found for ${variant}`);
            return '';
        } catch (error) {
            logger.debug(`Error finding executable: ${error.message}`);
            return '';
        }
    }

    async validateXeniaPath(mainPath) {
        if (!mainPath) {
            logger.debug('No path provided for validation');
            return false;
        }

        logger.debug(`Validating Xenia path: ${mainPath}`);
        try {
            // Check if directory exists
            const stats = await fs.stat(mainPath);
            if (!stats.isDirectory()) {
                logger.debug('Path is not a directory');
                return false;
            }

            // Check for at least one variant
            const variants = await this.getAvailableVariants();
            if (variants.length === 0) {
                logger.debug('No valid executables found');
                return false;
            }

            logger.debug('Xenia path validation successful');
            return true;
        } catch (error) {
            logger.error('Error validating Xenia path:', error);
            return false;
        }
    }

    getSettings() {
        return this.store.get('settings');
    }

    setSettings(settings) {
        this.store.set('settings', {
            ...this.store.get('settings'),
            ...settings
        });
    }

    getXeniaSettings() {
        return this.store.get('xeniaSettings');
    }

    setXeniaSettings(settings) {
        this.store.set('xeniaSettings', {
            ...this.store.get('xeniaSettings'),
            ...settings
        });
    }

    getGames() {
        return this.store.get('games', []);
    }

    addGame(game) {
        const games = this.getGames();
        games.push(game);
        this.store.set('games', games);
        return game;
    }

    updateGame(gameId, updates) {
        const games = this.getGames();
        const index = games.findIndex(g => g.gameId === gameId);
        if (index !== -1) {
            games[index] = { ...games[index], ...updates };
            this.store.set('games', games);
            return games[index];
        }
        return null;
    }

    removeGame(gameId) {
        const games = this.getGames();
        const updatedGames = games.filter(g => g.gameId !== gameId);
        this.store.set('games', updatedGames);
        // Also remove game settings
        this.store.delete(`gameSettings.${gameId}`);
        return true;
    }

    getGameSettings(gameId) {
        return this.store.get(`gameSettings.${gameId}`, {});
    }

    setGameSettings(gameId, settings) {
        this.store.set(`gameSettings.${gameId}`, settings);
    }

    getPaths() {
        return this.store.get('paths');
    }

    getPath(key) {
        return this.store.get(`paths.${key}`);
    }

    getCompatibilitySettings() {
        return this.store.get('compatibility');
    }
}

// Export a singleton instance
const store = new AppStore();
module.exports = store;
