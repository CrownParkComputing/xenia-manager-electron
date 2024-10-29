const windowManager = require('../window');
const logger = require('../logger');

class WindowHandler {
    minimizeWindow() {
        logger.debug('Handling minimize-window request');
        try {
            windowManager.minimizeMainWindow();
            return true;
        } catch (error) {
            logger.error('Error in minimize-window handler:', error);
            throw error;
        }
    }

    maximizeWindow() {
        logger.debug('Handling maximize-window request');
        try {
            windowManager.maximizeMainWindow();
            return true;
        } catch (error) {
            logger.error('Error in maximize-window handler:', error);
            throw error;
        }
    }

    closeWindow() {
        logger.debug('Handling close-window request');
        try {
            windowManager.closeMainWindow();
            return true;
        } catch (error) {
            logger.error('Error in close-window handler:', error);
            throw error;
        }
    }

    getWindowState() {
        return windowManager.getWindowState();
    }
}

module.exports = new WindowHandler();
