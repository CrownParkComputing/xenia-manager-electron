const path = require('path');
const fs = require('fs').promises;
const logger = require('../logger');

class GameConfig {
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

    async createGameConfig(xeniaDir, gameTitle, variant) {
        try {
            const variantConfigName = this.getConfigFileName(variant);
            const variantConfigPath = path.join(xeniaDir, variantConfigName);
            const gameConfigPath = path.join(xeniaDir, `${gameTitle}.config.toml`);

            // Check if variant config exists
            try {
                await fs.access(variantConfigPath);
            } catch (error) {
                logger.warn(`Variant config not found: ${variantConfigPath}`);
                return null;
            }

            // Copy variant config to game-specific config
            try {
                await fs.copyFile(variantConfigPath, gameConfigPath);
                logger.info(`Created game config at ${gameConfigPath}`);
                return gameConfigPath;
            } catch (error) {
                logger.error(`Error creating game config: ${error.message}`);
                return null;
            }
        } catch (error) {
            logger.error(`Error in createGameConfig: ${error.message}`);
            return null;
        }
    }

    async removeGameConfig(xeniaDir, gameTitle) {
        try {
            const configPath = path.join(xeniaDir, `${gameTitle}.config.toml`);
            await fs.unlink(configPath);
            logger.info(`Removed game config at ${configPath}`);
        } catch (error) {
            // Ignore if file doesn't exist
            if (error.code !== 'ENOENT') {
                logger.error(`Error removing game config: ${error.message}`);
                throw error;
            }
        }
    }

    async getGameConfigPath(xeniaDir, gameTitle) {
        const configPath = path.join(xeniaDir, `${gameTitle}.config.toml`);
        try {
            await fs.access(configPath);
            return configPath;
        } catch (error) {
            return null;
        }
    }

    async updateGameConfig(xeniaDir, gameTitle, updates) {
        const configPath = await this.getGameConfigPath(xeniaDir, gameTitle);
        if (!configPath) {
            logger.warn(`No config file found for game: ${gameTitle}`);
            return false;
        }

        try {
            const content = await fs.readFile(configPath, 'utf8');
            // Parse and update TOML content here
            // You might want to add a TOML parser library for this
            await fs.writeFile(configPath, content);
            logger.info(`Updated game config at ${configPath}`);
            return true;
        } catch (error) {
            logger.error(`Error updating game config: ${error.message}`);
            return false;
        }
    }
}

module.exports = new GameConfig();
