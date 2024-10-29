const { dialog } = require('electron');
const store = require('../store');
const logger = require('../logger');
const path = require('path');
const fs = require('fs').promises;

class FileHandler {
    async selectGame() {
        logger.debug('Handling select-game request');
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openFile', 'multiSelections'],
                filters: [
                    { name: 'Xbox 360 Games', extensions: ['iso', 'xex', 'gdf'] }
                ]
            });
            
            logger.debug('File selection result:', result);
            return result.canceled ? null : result.filePaths;
        } catch (error) {
            logger.error('Error in select-game handler:', error);
            throw error;
        }
    }

    async selectGameImage(type = 'boxart') {
        logger.debug(`Handling select-game-${type} request`);
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [
                    { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
                ],
                title: `Select Game ${type === 'boxart' ? 'Box Art' : 'Icon'}`
            });

            if (result.canceled) return null;

            const sourcePath = result.filePaths[0];
            const fileName = `${Date.now()}-${path.basename(sourcePath)}`;
            const targetDir = path.join(process.cwd(), 'data', type === 'boxart' ? 'covers' : 'icons');
            const targetPath = path.join(targetDir, fileName);

            // Ensure target directory exists
            await fs.mkdir(targetDir, { recursive: true });

            // Copy image file to app's data directory
            await fs.copyFile(sourcePath, targetPath);

            // Return relative path for storage
            return path.join('data', type === 'boxart' ? 'covers' : 'icons', fileName);
        } catch (error) {
            logger.error(`Error in select-game-${type} handler:`, error);
            throw error;
        }
    }

    async selectXeniaDirectory() {
        logger.debug('Handling select-xenia request');
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory'],
                title: 'Select Xenia Base Directory',
                message: 'Select the folder containing your Xenia variants (Canary/Stable/Netplay)'
            });
            
            if (result.canceled) return null;

            // Validate the selected directory
            const variants = await store.getAvailableVariants();
            if (variants.length === 0) {
                throw new Error('Selected directory must contain at least one Xenia variant (Canary/Stable/Netplay)');
            }

            logger.debug('Xenia directory selection result:', result);
            return result.filePaths[0];
        } catch (error) {
            logger.error('Error in select-xenia handler:', error);
            throw error;
        }
    }

    async selectXeniaVariant() {
        logger.debug('Handling select-xenia-variant request');
        try {
            const variants = await store.getAvailableVariants();
            logger.debug('Available variants:', variants);
            
            if (variants.length === 0) {
                throw new Error('No Xenia variants found in the configured path');
            }

            // If only one variant is available, return it without showing dialog
            if (variants.length === 1) {
                const variant = variants[0].toLowerCase();
                logger.debug(`Using only available variant: ${variant}`);
                return variant;
            }

            // Show dialog with available variants
            const result = await dialog.showMessageBox({
                type: 'question',
                title: 'Select Xenia Variant',
                message: 'Which Xenia variant would you like to use?',
                buttons: variants,
                defaultId: variants.indexOf('Canary') !== -1 ? variants.indexOf('Canary') : 0,
                cancelId: -1,
                detail: 'Select the Xenia variant to use for this game.'
            });

            if (result.response === -1) return null;

            const selectedVariant = variants[result.response].toLowerCase();
            logger.debug(`Selected variant: ${selectedVariant}`);

            // Verify executable exists
            const execPath = await store.getXeniaExecutablePath(selectedVariant);
            if (!execPath) {
                throw new Error(`Xenia ${selectedVariant} executable not found`);
            }

            return selectedVariant;
        } catch (error) {
            logger.error('Error in select-xenia-variant handler:', error);
            throw error;
        }
    }

    async selectDirectory() {
        logger.debug('Handling select-directory request');
        try {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory']
            });
            
            logger.debug('Directory selection result:', result);
            return result.canceled ? null : result.filePaths[0];
        } catch (error) {
            logger.error('Error in select-directory handler:', error);
            throw error;
        }
    }

    async moveFile(sourcePath, targetPath) {
        try {
            await fs.rename(sourcePath, targetPath);
        } catch (error) {
            if (error.code === 'EXDEV') {
                // If rename fails due to cross-device link, fallback to copy and delete
                await fs.copyFile(sourcePath, targetPath);
                await fs.unlink(sourcePath);
            } else {
                throw error;
            }
        }
    }
}

module.exports = new FileHandler();
