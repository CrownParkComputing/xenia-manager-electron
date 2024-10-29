const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const logger = require('../logger');
const store = require('../store');
const titleExtractor = require('./game-title-extractor');
const gameArtwork = require('./game-artwork');
const gameConfig = require('./game-config');

class GameInfo {
    constructor() {
        this.gameInfoCache = new Map();
    }

    async extractGameInfo(gamePath, variant = 'canary', options = {}) {
        logger.info(`Extracting game info from: ${gamePath}`);

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

            // Extract game title and IDs
            const extractedInfo = await titleExtractor.extractGameInfo(gamePath, xeniaPath);
            logger.info('Extracted info:', extractedInfo);

            // Only use filename as fallback if no title was found
            if (!extractedInfo || !extractedInfo.title) {
                logger.warn('No title found in Xenia output, using filename as fallback');
                extractedInfo.title = path.basename(gamePath, path.extname(gamePath));
            }

            // Create game config if title was found
            if (extractedInfo.title) {
                const xeniaDir = path.dirname(xeniaPath);
                await gameConfig.createGameConfig(xeniaDir, extractedInfo.title, variant);
            }

            const gameInfo = await this.enrichGameInfo(extractedInfo, gamePath, variant, options);
            
            // Double-check we're not losing the title
            if (extractedInfo.title && extractedInfo.title !== path.basename(gamePath, path.extname(gamePath))) {
                gameInfo.title = extractedInfo.title;
            }

            this.gameInfoCache.set(cacheKey, gameInfo);
            return gameInfo;
        } catch (error) {
            logger.error('Error extracting game info:', error);
            throw error;
        }
    }

    async validatePaths(gamePath, xeniaPath) {
        try {
            const gameStats = await fs.stat(gamePath);
            if (!gameStats.isFile()) {
                throw new Error('Game path is not a file');
            }
        } catch (error) {
            throw new Error(`Invalid game path: ${error.message}`);
        }

        try {
            const xeniaStats = await fs.stat(xeniaPath);
            if (!xeniaStats.isFile()) {
                throw new Error('Xenia executable not found');
            }
        } catch (error) {
            throw new Error(`Invalid Xenia path: ${error.message}`);
        }
    }

    async enrichGameInfo(info, gamePath, variant, options = {}) {
        try {
            const stats = await fs.stat(gamePath);
            const fileHandle = await fs.open(gamePath, 'r');
            const buffer = Buffer.alloc(1024 * 1024);
            await fileHandle.read(buffer, 0, buffer.length, 0);
            await fileHandle.close();

            // Preserve the original title from the extracted info
            const enrichedInfo = {
                title: info.title, // Keep the original title
                path: gamePath,
                gameId: info.gameId,
                mediaId: info.mediaId,
                type: options.type === 'xbla' ? 'XBLA' : this.determineGameType(gamePath),
                size: stats.size,
                hash: crypto.createHash('sha1').update(buffer).digest('hex'),
                variant: variant,
                lastModified: stats.mtime
            };

            logger.info('Enriched game info:', enrichedInfo);
            return enrichedInfo;
        } catch (error) {
            logger.error('Error enriching game info:', error);
            // Return the original info if enrichment fails, preserving the title
            return {
                ...info,
                path: gamePath,
                type: options.type === 'xbla' ? 'XBLA' : this.determineGameType(gamePath),
                variant: variant
            };
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
        // Ensure we're not losing the title when creating the game object
        return {
            title: gameInfo.title, // Keep the original title
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

    async downloadArtwork(gameId, mediaId) {
        return gameArtwork.downloadArtwork(gameId, mediaId);
    }

    clearCache() {
        this.gameInfoCache.clear();
        logger.debug('Game info cache cleared');
    }
}

module.exports = new GameInfo();
