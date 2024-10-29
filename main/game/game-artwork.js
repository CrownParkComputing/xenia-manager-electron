const path = require('path');
const fs = require('fs').promises;
const logger = require('../logger');

class GameArtwork {
    constructor() {
        this.artworkPath = path.join(process.cwd(), 'data', 'artwork');
    }

    async downloadArtwork(gameId, mediaId) {
        logger.info(`Downloading artwork for game ${gameId}`);
        const gameArtworkPath = path.join(this.artworkPath, gameId);
        
        try {
            await fs.mkdir(gameArtworkPath, { recursive: true });
            const artworkPaths = {
                boxartPath: null,
                iconPath: null
            };

            if (gameId) {
                const boxartUrl = `http://download.xbox.com/content/images/66acd000-77fe-1000-9115-d802${gameId}/1033/boxartlg.jpg`;
                const boxartPath = path.join(gameArtworkPath, 'boxart.jpg');
                await this.downloadFile(boxartUrl, boxartPath);
                logger.info(`Downloaded boxart for game ${gameId}`);
                artworkPaths.boxartPath = path.join('data', 'artwork', gameId, 'boxart.jpg');
            }

            if (mediaId) {
                const iconUrl = `http://download.xbox.com/content/images/${mediaId}/icon.png`;
                const iconPath = path.join(gameArtworkPath, 'icon.png');
                await this.downloadFile(iconUrl, iconPath);
                logger.info(`Downloaded icon for game ${gameId}`);
                artworkPaths.iconPath = path.join('data', 'artwork', gameId, 'icon.png');
            }

            return artworkPaths;
        } catch (error) {
            logger.error(`Error downloading artwork for game ${gameId}: ${error.message}`);
            throw error;
        }
    }

    async downloadFile(url, filePath) {
        const axios = require('axios');
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

    async removeArtwork(gameId) {
        const gameArtworkPath = path.join(this.artworkPath, gameId);
        try {
            await fs.rm(gameArtworkPath, { recursive: true, force: true });
            logger.info(`Removed artwork for game ${gameId}`);
        } catch (error) {
            logger.error(`Error removing artwork for game ${gameId}: ${error.message}`);
            throw error;
        }
    }
}

module.exports = new GameArtwork();
