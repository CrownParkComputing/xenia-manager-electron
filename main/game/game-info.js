const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const logger = require('../logger');
const store = require('../store');

class GameInfo {
    constructor() {
        this.gameInfoCache = new Map();
        this.extractionTimeout = 10000; // 10 seconds
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

    async extractGameInfo(gamePath, variant = 'canary') {
        logger.info(`Extracting game info from: ${gamePath}`);

        // Check cache first
        const cacheKey = `${gamePath}:${variant}`;
        if (this.gameInfoCache.has(cacheKey)) {
            logger.debug('Using cached game info');
            return this.gameInfoCache.get(cacheKey);
        }

        try {
            const xeniaPath = await store.getXeniaExecutablePath(variant);
            if (!xeniaPath) {
                throw new Error(`Xenia ${variant} executable not found`);
            }

            await this.validatePaths(gamePath, xeniaPath);
            
            // Get config file path
            const xeniaDir = path.dirname(xeniaPath);
            const configFileName = this.getConfigFileName(variant);
            const configPath = path.join(xeniaDir, configFileName);
            
            // Verify config file exists
            try {
                await fs.access(configPath);
                logger.debug(`Found config file: ${configPath}`);
            } catch (error) {
                logger.warn(`Config file not found: ${configPath}`);
                // Run without config if file doesn't exist
                const info = await this.runXeniaExtraction(gamePath, xeniaPath);
                const gameInfo = await this.enrichGameInfo(info, gamePath, variant);
                this.gameInfoCache.set(cacheKey, gameInfo);
                return gameInfo;
            }
            
            const info = await this.runXeniaExtraction(gamePath, xeniaPath, configPath);
            const gameInfo = await this.enrichGameInfo(info, gamePath, variant);

            // Cache the result
            this.gameInfoCache.set(cacheKey, gameInfo);
            return gameInfo;
        } catch (error) {
            logger.error('Error extracting game info:', error);
            throw error;
        }
    }

    async validatePaths(gamePath, xeniaPath) {
        // Validate game path
        try {
            const gameStats = await fs.stat(gamePath);
            if (!gameStats.isFile()) {
                throw new Error('Game path is not a file');
            }
        } catch (error) {
            throw new Error(`Invalid game path: ${error.message}`);
        }

        // Validate Xenia path
        try {
            const xeniaStats = await fs.stat(xeniaPath);
            if (!xeniaStats.isFile()) {
                throw new Error('Xenia executable not found');
            }
        } catch (error) {
            throw new Error(`Invalid Xenia path: ${error.message}`);
        }
    }

    async runXeniaExtraction(gamePath, xeniaPath, configPath = null) {
        return new Promise((resolve, reject) => {
            const info = {
                title: '',
                gameId: '',
                mediaId: '',
                type: this.determineGameType(gamePath)
            };

            // Build arguments array
            const args = [];
            if (configPath) {
                args.push('--config', configPath);
            }
            args.push(gamePath);

            const xenia = spawn(xeniaPath, args);
            let errorOutput = '';

            xenia.stdout.on('data', (data) => {
                const output = data.toString();
                logger.xeniaOutput(output);
                
                const lines = output.split('\n');
                for (const line of lines) {
                    if (line.includes('Title name:')) {
                        info.title = line.split('Title name:')[1].trim();
                    } else if (line.includes('Title ID:')) {
                        info.gameId = line.split('Title ID:')[1].trim();
                    } else if (line.includes('Media ID:')) {
                        info.mediaId = line.split('Media ID:')[1].trim();
                    }
                }
            });

            xenia.stderr.on('data', (data) => {
                const error = data.toString();
                logger.xeniaError(error);
                errorOutput += error;
            });

            xenia.on('error', (error) => {
                logger.error('Error spawning Xenia:', error);
                reject(error);
            });

            // Set a timeout to kill Xenia after extraction
            const timeout = setTimeout(() => {
                xenia.kill();
                if (!info.title && !info.gameId) {
                    if (errorOutput.includes('not a valid')) {
                        reject(new Error('Invalid game file format'));
                    } else {
                        reject(new Error('Failed to extract game information'));
                    }
                } else {
                    resolve(info);
                }
            }, this.extractionTimeout);

            xenia.on('close', (code) => {
                clearTimeout(timeout);
                logger.debug(`Xenia process exited with code ${code}`);
                
                if (!info.title && !info.gameId) {
                    if (errorOutput.includes('not a valid')) {
                        reject(new Error('Invalid game file format'));
                    } else {
                        reject(new Error('Failed to extract game information'));
                    }
                } else {
                    resolve(info);
                }
            });
        });
    }

    async enrichGameInfo(info, gamePath, variant) {
        // If no title was extracted, use filename
        if (!info.title) {
            info.title = path.basename(gamePath, path.extname(gamePath));
        }

        try {
            // Get file stats
            const stats = await fs.stat(gamePath);
            info.size = stats.size;
            info.lastModified = stats.mtime;

            // Calculate hash for the first 1MB of the file
            const fileHandle = await fs.open(gamePath, 'r');
            const buffer = Buffer.alloc(1024 * 1024);
            await fileHandle.read(buffer, 0, buffer.length, 0);
            await fileHandle.close();

            info.hash = crypto.createHash('sha1').update(buffer).digest('hex');
            info.variant = variant; // Store the Xenia variant used

            return info;
        } catch (error) {
            logger.error('Error enriching game info:', error);
            return info;
        }
    }

    determineGameType(gamePath) {
        const ext = path.extname(gamePath).toLowerCase();
        switch (ext) {
            case '.iso':
                return 'ISO';
            case '.xex':
                return 'XEX';
            case '.gdf':
                return 'GDF';
            default:
                return 'Unknown';
        }
    }

    createGameObject(gameInfo) {
        return {
            title: gameInfo.title,
            path: gameInfo.path,
            gameId: gameInfo.gameId,
            mediaId: gameInfo.mediaId,
            type: gameInfo.type,
            size: gameInfo.size,
            hash: gameInfo.hash,
            variant: gameInfo.variant,
            lastModified: gameInfo.lastModified,
            compatibilityRating: 'Unknown',
            playtime: 0,
            lastPlayed: null,
            patches: [],
            config: null,
            coverPath: 'assets/default-cover.svg'
        };
    }

    clearCache() {
        this.gameInfoCache.clear();
        logger.debug('Game info cache cleared');
    }
}

// Export a singleton instance
const gameInfo = new GameInfo();
module.exports = gameInfo;
