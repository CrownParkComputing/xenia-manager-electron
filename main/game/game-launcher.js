const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../logger');
const store = require('../store');
const os = require('os');

class GameLauncher {
    constructor() {
        this.runningGames = new Map();
        this.startTimes = new Map();
        this.processMonitorInterval = null;
        this.initializeProcessMonitor();
    }

    getConfigFileName(variant) {
        switch (variant.toLowerCase()) {
            case 'canary':
                return 'xenia-canary.config.toml';
            case 'netplay':
                return 'xenia-canary-netplay.config.toml';
            case 'stable':
                return 'xenia.config.toml';
            default:
                throw new Error(`Unknown variant: ${variant}`);
        }
    }

    initializeProcessMonitor() {
        // Monitor running games every 30 seconds
        this.processMonitorInterval = setInterval(() => {
            this.checkRunningGames();
        }, 30000);
    }

    async checkRunningGames() {
        for (const [gameId, process] of this.runningGames.entries()) {
            try {
                process.kill(0); // Test if process is still running
            } catch (error) {
                // Process no longer exists
                this.handleGameExit(gameId, null);
            }
        }
    }

    async launchGame(gameId, options = {}) {
        logger.info(`Launching game ${gameId} with options:`, options);
        
        try {
            const xeniaPath = await store.getXeniaExecutablePath(options.variant || 'canary');
            if (!xeniaPath) {
                throw new Error('Xenia executable not found');
            }

            const games = store.getGames();
            const game = games.find(g => g.gameId === gameId);
            
            if (!game) {
                throw new Error('Game not found');
            }

            // Check if game is already running
            if (this.isGameRunning(gameId)) {
                logger.warn(`Game ${gameId} is already running`);
                return false;
            }

            const args = await this.buildLaunchArguments(game, options, xeniaPath);
            logger.debug('Launch arguments:', args);

            const process = await this.spawnXenia(xeniaPath, args, store.getSettings().winePrefix);
            await this.trackGameSession(gameId, process);

            return true;
        } catch (error) {
            logger.error('Error launching game:', error);
            throw error;
        }
    }

    async buildLaunchArguments(game, options, xeniaPath) {
        const args = [path.resolve(game.path)]; // Ensure absolute path

        // Add window mode option
        if (options.windowedMode) {
            args.push('--fullscreen=false');
        }

        // Handle config file
        const variant = options.variant || game.variant || 'canary';
        
        // First check for custom game-specific config
        if (game.config) {
            const configPath = path.join(process.cwd(), game.config);
            try {
                await fs.access(configPath);
                args.push('--config', configPath);
                logger.debug(`Using custom config: ${configPath}`);
            } catch (error) {
                logger.warn(`Custom config file not found: ${configPath}`);
                // Fall back to variant-specific config
                const xeniaDir = path.dirname(xeniaPath);
                const configFileName = this.getConfigFileName(variant);
                const variantConfigPath = path.join(xeniaDir, configFileName);
                try {
                    await fs.access(variantConfigPath);
                    args.push('--config', variantConfigPath);
                    logger.debug(`Using variant config: ${variantConfigPath}`);
                } catch (error) {
                    logger.warn(`Variant config file not found: ${variantConfigPath}`);
                }
            }
        } else {
            // Use variant-specific config
            const xeniaDir = path.dirname(xeniaPath);
            const configFileName = this.getConfigFileName(variant);
            const variantConfigPath = path.join(xeniaDir, configFileName);
            try {
                await fs.access(variantConfigPath);
                args.push('--config', variantConfigPath);
                logger.debug(`Using variant config: ${variantConfigPath}`);
            } catch (error) {
                logger.warn(`Variant config file not found: ${variantConfigPath}`);
            }
        }

        // Add any additional launch options from game settings
        const gameSettings = store.getGameSettings(game.gameId);
        if (gameSettings?.launchOptions) {
            args.push(...gameSettings.launchOptions);
        }

        return args;
    }

    async spawnXenia(xeniaPath, args, winePrefix) {
        return new Promise((resolve, reject) => {
            try {
                let childProcess;
                
                // Check if running on Linux and use Wine if needed
                if (os.platform() === 'linux') {
                    if (!winePrefix) {
                        throw new Error('Wine prefix not configured');
                    }
                    
                    // Set WINEPREFIX environment variable
                    const env = { ...process.env, WINEPREFIX: winePrefix };
                    
                    // Prepend 'wine' to the command
                    childProcess = spawn('wine', [xeniaPath, ...args], {
                        detached: true,
                        stdio: ['ignore', 'pipe', 'pipe'],
                        env
                    });
                } else {
                    // On Windows, launch directly
                    childProcess = spawn(xeniaPath, args, {
                        detached: true,
                        stdio: ['ignore', 'pipe', 'pipe']
                    });
                }

                // Handle process output
                if (childProcess.stdout) {
                    childProcess.stdout.on('data', (data) => {
                        logger.xeniaOutput(data.toString());
                    });
                }

                if (childProcess.stderr) {
                    childProcess.stderr.on('data', (data) => {
                        logger.xeniaError(data.toString());
                    });
                }

                childProcess.on('error', (error) => {
                    logger.error('Error spawning Xenia:', error);
                    reject(error);
                });

                // Wait a short time to ensure process started successfully
                setTimeout(() => {
                    try {
                        childProcess.kill(0); // Test if process is running
                        childProcess.unref();
                        resolve(childProcess);
                    } catch (error) {
                        reject(new Error('Failed to start Xenia'));
                    }
                }, 1000);

            } catch (error) {
                reject(error);
            }
        });
    }

    async trackGameSession(gameId, process) {
        this.runningGames.set(gameId, process);
        this.startTimes.set(gameId, Date.now());

        process.on('exit', (code) => {
            this.handleGameExit(gameId, code);
        });

        process.on('error', (error) => {
            logger.error(`Error in game process ${gameId}:`, error);
            this.handleGameExit(gameId, 1);
        });

        // Update game status in store
        const games = store.getGames();
        const game = games.find(g => g.gameId === gameId);
        if (game) {
            store.updateGame(gameId, {
                ...game,
                isRunning: true,
                lastLaunched: new Date().toISOString()
            });
        }
    }

    handleGameExit(gameId, code) {
        logger.info(`Game ${gameId} exited with code ${code}`);

        const startTime = this.startTimes.get(gameId);
        if (startTime) {
            const playTime = Math.floor((Date.now() - startTime) / 1000);
            this.updatePlaytime(gameId, playTime);
        }

        this.runningGames.delete(gameId);
        this.startTimes.delete(gameId);

        // Update game status in store
        const games = store.getGames();
        const game = games.find(g => g.gameId === gameId);
        if (game) {
            store.updateGame(gameId, {
                ...game,
                isRunning: false,
                lastExitCode: code
            });
        }
    }

    async updatePlaytime(gameId, seconds) {
        try {
            const games = store.getGames();
            const game = games.find(g => g.gameId === gameId);
            
            if (game) {
                const updatedGame = {
                    ...game,
                    playtime: (game.playtime || 0) + seconds,
                    lastPlayed: new Date().toISOString()
                };

                store.updateGame(gameId, updatedGame);
                logger.info(`Updated playtime for ${gameId}: ${seconds} seconds`);
            }
        } catch (error) {
            logger.error('Error updating playtime:', error);
        }
    }

    isGameRunning(gameId) {
        return this.runningGames.has(gameId);
    }

    getRunningGames() {
        return Array.from(this.runningGames.keys());
    }

    async terminateGame(gameId) {
        const process = this.runningGames.get(gameId);
        if (process) {
            logger.info(`Terminating game ${gameId}`);
            try {
                process.kill();
                return true;
            } catch (error) {
                logger.error(`Error terminating game ${gameId}:`, error);
                return false;
            }
        }
        return false;
    }

    async terminateAllGames() {
        logger.info('Terminating all running games');
        const promises = Array.from(this.runningGames.keys()).map(gameId => 
            this.terminateGame(gameId)
        );
        await Promise.all(promises);
    }

    getGameUptime(gameId) {
        const startTime = this.startTimes.get(gameId);
        if (!startTime) return 0;
        return Math.floor((Date.now() - startTime) / 1000);
    }

    cleanup() {
        if (this.processMonitorInterval) {
            clearInterval(this.processMonitorInterval);
        }
        this.terminateAllGames();
    }
}

// Export a singleton instance
const gameLauncher = new GameLauncher();
module.exports = gameLauncher;
