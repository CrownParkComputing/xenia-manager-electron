const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const logger = require('../logger');
const store = require('../store');

class GameCompatibility {
    constructor() {
        this.cache = new Map();
        this.lastUpdate = new Map();
        this.pendingRequests = new Map();
        this.ratingsMap = {
            'nothing': 'Unplayable',
            'crash': 'Unplayable',
            'intro': 'Loads',
            'menu': 'Loads',
            'ingame': 'Gameplay',
            'playable': 'Playable'
        };
    }

    async checkCompatibility(gameId) {
        logger.info(`Checking compatibility for game ${gameId}`);
        
        try {
            // Check if there's already a pending request for this gameId
            if (this.pendingRequests.has(gameId)) {
                logger.debug(`Using pending request for ${gameId}`);
                return this.pendingRequests.get(gameId);
            }

            // Check cache first
            if (this.shouldUseCache(gameId)) {
                const cachedRating = this.cache.get(gameId);
                logger.debug(`Using cached compatibility rating for ${gameId}:`, cachedRating);
                return cachedRating;
            }

            // Create new request promise
            const requestPromise = this.fetchCompatibility(gameId);
            this.pendingRequests.set(gameId, requestPromise);

            // Wait for result
            const rating = await requestPromise;

            // Clean up pending request
            this.pendingRequests.delete(gameId);

            return rating;
        } catch (error) {
            logger.error('Error checking compatibility:', error);
            this.pendingRequests.delete(gameId);
            return this.getDefaultRating();
        }
    }

    async fetchCompatibility(gameId) {
        const compatibilitySettings = store.getCompatibilitySettings();
        const url = `${compatibilitySettings.apiEndpoint}?q=${gameId}`;
        logger.debug(`Fetching compatibility data from: ${url}`);
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Xenia-Manager'
                },
                timeout: 10000 // 10 second timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            logger.debug('Received compatibility data:', data);
            
            const rating = this.parseCompatibilityData(data);
            
            // Update cache
            this.updateCache(gameId, rating);
            
            return rating;
        } catch (error) {
            logger.error(`Error fetching compatibility data for ${gameId}:`, error);
            throw error;
        }
    }

    parseCompatibilityData(data) {
        if (!Array.isArray(data) || data.length === 0) {
            logger.debug('No compatibility data found');
            return this.getDefaultRating();
        }

        try {
            const issue = data[0];
            const labels = issue.labels || [];
            const stateLabel = labels.find(l => l.name.startsWith('state-'));
            
            if (stateLabel) {
                const state = stateLabel.name.split('-')[1].toLowerCase();
                const rating = this.formatRating(state);
                logger.info(`Compatibility rating found: ${rating}`);
                return rating;
            }
        } catch (error) {
            logger.error('Error parsing compatibility data:', error);
        }
        
        logger.info('No compatibility rating found, using default');
        return this.getDefaultRating();
    }

    formatRating(state) {
        return this.ratingsMap[state] || this.getDefaultRating();
    }

    getDefaultRating() {
        return 'Unknown';
    }

    shouldUseCache(gameId) {
        const lastUpdateTime = this.lastUpdate.get(gameId);
        if (!lastUpdateTime) return false;

        const compatibilitySettings = store.getCompatibilitySettings();
        const cacheAge = Date.now() - lastUpdateTime;
        return cacheAge < compatibilitySettings.updateInterval * 1000;
    }

    updateCache(gameId, rating) {
        this.cache.set(gameId, rating);
        this.lastUpdate.set(gameId, Date.now());
        logger.debug(`Updated compatibility cache for ${gameId}:`, rating);
    }

    clearCache() {
        this.cache.clear();
        this.lastUpdate.clear();
        logger.info('Compatibility cache cleared');
    }

    getRatingDescription(rating) {
        const descriptions = {
            'Unplayable': 'The game either doesn\'t start or crashes frequently',
            'Loads': 'The game loads but crashes in the title screen or main menu',
            'Gameplay': 'Gameplay loads but may have significant issues',
            'Playable': 'The game can be played from start to finish with minor or no issues',
            'Unknown': 'Compatibility status has not been determined'
        };

        return descriptions[rating] || descriptions['Unknown'];
    }

    getRatingColor(rating) {
        const colors = {
            'Unplayable': '#d83b01',
            'Loads': '#ffd700',
            'Gameplay': '#107c10',
            'Playable': '#0078d4',
            'Unknown': '#6e6e6e'
        };

        return colors[rating] || colors['Unknown'];
    }

    getRatingIcon(rating) {
        return `assets/${rating.toLowerCase()}.png`;
    }

    async batchCheckCompatibility(gameIds) {
        logger.info(`Batch checking compatibility for ${gameIds.length} games`);
        const promises = gameIds.map(gameId => this.checkCompatibility(gameId));
        const results = await Promise.allSettled(promises);
        
        return gameIds.reduce((acc, gameId, index) => {
            const result = results[index];
            acc[gameId] = result.status === 'fulfilled' ? result.value : this.getDefaultRating();
            return acc;
        }, {});
    }

    // Export methods for testing
    _clearPendingRequests() {
        this.pendingRequests.clear();
    }

    _getCacheSize() {
        return this.cache.size;
    }

    _getPendingRequestsCount() {
        return this.pendingRequests.size;
    }
}

// Export a singleton instance
const gameCompatibility = new GameCompatibility();
module.exports = gameCompatibility;
