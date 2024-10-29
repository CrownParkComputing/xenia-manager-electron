const store = require('../store');
const logger = require('../logger');
const path = require('path');
const fs = require('fs').promises;

class SettingsHandler {
    getSettings() {
        logger.debug('Handling get-settings request');
        try {
            return store.getSettings();
        } catch (error) {
            logger.error('Error in get-settings handler:', error);
            throw error;
        }
    }

    async saveSettings(settings) {
        logger.debug('Handling save-settings request:', settings);
        try {
            // If xeniaPath is being updated, validate it first
            if (settings.xeniaPath !== undefined) {
                // Check if path exists
                try {
                    const stats = await fs.stat(settings.xeniaPath);
                    if (!stats.isDirectory()) {
                        throw new Error('Selected path is not a directory');
                    }
                } catch (error) {
                    throw new Error(`Invalid path: ${error.message}`);
                }

                // Check for variant folders
                const dirs = await fs.readdir(settings.xeniaPath);
                const hasCanary = dirs.includes('Xenia Canary');
                const hasStable = dirs.includes('Xenia Stable');
                const hasNetplay = dirs.includes('Xenia Netplay');

                if (!hasCanary && !hasStable && !hasNetplay) {
                    throw new Error('Selected directory must contain at least one Xenia variant folder (Xenia Canary/Xenia Stable/Xenia Netplay)');
                }

                // Check for executables in variant folders
                let foundExecutable = false;
                const execName = process.platform === 'win32' ? 'xenia.exe' : 'xenia';

                for (const dir of ['Xenia Canary', 'Xenia Stable', 'Xenia Netplay']) {
                    if (dirs.includes(dir)) {
                        const execPath = path.join(settings.xeniaPath, dir, execName);
                        try {
                            const execStats = await fs.stat(execPath);
                            if (execStats.isFile()) {
                                foundExecutable = true;
                                logger.debug(`Found executable in ${dir}`);
                            }
                        } catch (error) {
                            logger.debug(`No executable found in ${dir}`);
                        }
                    }
                }

                if (!foundExecutable) {
                    throw new Error('No Xenia executables found in variant folders');
                }

                logger.debug('Xenia path validation successful');
            }

            // Validate theme
            if (settings.theme && !['dark', 'light'].includes(settings.theme)) {
                throw new Error('Invalid theme value. Must be "dark" or "light".');
            }

            // Save settings
            store.setSettings(settings);
            logger.debug('Settings saved successfully');
            return true;
        } catch (error) {
            logger.error('Error in save-settings handler:', error);
            throw error;
        }
    }

    getXeniaSettings() {
        logger.debug('Handling get-xenia-settings request');
        try {
            return store.getXeniaSettings();
        } catch (error) {
            logger.error('Error in get-xenia-settings handler:', error);
            throw error;
        }
    }

    saveXeniaSettings(settings) {
        logger.debug('Handling save-xenia-settings request:', settings);
        try {
            // Validate graphics backend
            if (settings.graphicsBackend && !['vulkan', 'd3d12'].includes(settings.graphicsBackend)) {
                throw new Error('Invalid graphics backend. Must be "vulkan" or "d3d12".');
            }

            // Validate resolution scale
            if (settings.resolutionScale && !['1', '2', '3'].includes(settings.resolutionScale)) {
                throw new Error('Invalid resolution scale. Must be "1", "2", or "3".');
            }

            store.setXeniaSettings(settings);
            logger.debug('Xenia settings saved successfully');
            return true;
        } catch (error) {
            logger.error('Error in save-xenia-settings handler:', error);
            throw error;
        }
    }
}

module.exports = new SettingsHandler();
