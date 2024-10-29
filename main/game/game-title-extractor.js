const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fs_sync = require('fs');
const logger = require('../logger');

class GameTitleExtractor {
    constructor() {
        this.extractionTimeout = 5000; // 5 seconds
    }

    async extractGameInfo(gamePath, xeniaPath) {
        logger.info(`Extracting game info from: ${gamePath}`);
        
        const xeniaDir = path.dirname(xeniaPath);
        const logPath = path.join(xeniaDir, 'xenia.log');

        // Delete existing log file if it exists
        try {
            await fs.unlink(logPath);
            logger.debug('Deleted existing xenia.log');
        } catch (error) {
            // Ignore error if file doesn't exist
        }

        return new Promise((resolve, reject) => {
            logger.info('Launching Xenia to extract game info');
            
            const xenia = spawn(xeniaPath, [gamePath], {
                cwd: xeniaDir
            });

            let info = {
                title: '',
                gameId: '',
                mediaId: ''
            };

            let logCheckInterval;
            let foundInfo = false;

            const cleanup = () => {
                if (logCheckInterval) {
                    clearInterval(logCheckInterval);
                }
                if (!xenia.killed) {
                    xenia.kill();
                }
            };

            // Start checking the log file immediately and continuously
            logCheckInterval = setInterval(async () => {
                try {
                    const logInfo = await this.readXeniaLog(xeniaDir);
                    if (logInfo && logInfo.title) {
                        logger.info(`Found game info in log: ${JSON.stringify(logInfo)}`);
                        cleanup();
                        foundInfo = true;
                        resolve(logInfo);
                    }
                } catch (error) {
                    logger.error('Error checking log:', error);
                }
            }, 100);

            // Set up a timeout to stop checking if we haven't found anything
            setTimeout(() => {
                cleanup();
                if (!foundInfo) {
                    logger.warn('Extraction timeout reached');
                    resolve(info);
                }
            }, this.extractionTimeout);

            xenia.on('error', (error) => {
                logger.error('Error spawning Xenia:', error);
                cleanup();
                reject(error);
            });

            xenia.on('exit', (code) => {
                logger.info(`Xenia process exited with code ${code}`);
                if (!foundInfo) {
                    cleanup();
                    resolve(info);
                }
            });
        });
    }

    async readXeniaLog(xeniaDir) {
        const logPath = path.join(xeniaDir, 'xenia.log');
        
        try {
            if (fs_sync.existsSync(logPath)) {
                // Use readFileSync to ensure we get the latest content
                const content = fs_sync.readFileSync(logPath, 'utf8');
                const info = {
                    title: '',
                    gameId: '',
                    mediaId: ''
                };

                const lines = content.split('\n');
                for (const line of lines) {
                    if (line.includes('Title name:')) {
                        const title = line.split(':')[1].trim();
                        if (title) {
                            info.title = title;
                            logger.info(`Found title in log: ${title}`);
                        }
                    } else if (line.includes('Title ID:')) {
                        const gameId = line.split(':')[1].trim();
                        if (gameId) {
                            info.gameId = gameId;
                            logger.info(`Found game ID in log: ${gameId}`);
                        }
                    } else if (line.includes('Media ID:')) {
                        const mediaId = line.split(':')[1].trim();
                        if (mediaId) {
                            info.mediaId = mediaId;
                            logger.info(`Found media ID in log: ${mediaId}`);
                        }
                    }
                }

                // Only return if we found at least one piece of information
                if (info.title || info.gameId || info.mediaId) {
                    return info;
                }
            }
        } catch (error) {
            logger.error('Error reading xenia.log:', error);
        }
        return null;
    }
}

module.exports = new GameTitleExtractor();
