import { Request, Response } from 'express';
import {
  getConfig,
  setConfig,
  getAllConfig,
  deleteConfig,
  getNotesEnabled,
} from '../services/configService.js';
import { getIO } from '../socket/index.js';
import logger from '../utils/logger.js';

// Get a config value
export const getConfigValue = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const value = await getConfig(key);

    if (key === 'alert_settings') {
      logger.info(`[Config] GET alert_settings: ${value !== null ? 'found' : 'not found'}`);
    }

    if (value === null) {
      return res.status(404).json({ error: 'Config key not found' });
    }

    res.json({ key, value });
  } catch (error) {
    logger.error('Get config error:', error);
    res.status(500).json({ error: 'Failed to get config' });
  }
};

// Resolved notes-enabled flag, readable by any approved user (the request /
// delay forms need it to show or hide the free-text fields). Always returns a
// boolean, defaulting to true when unset.
export const getNotesEnabledValue = async (_req: Request, res: Response) => {
  try {
    const notesEnabled = await getNotesEnabled();
    res.json({ notesEnabled });
  } catch (error) {
    logger.error('Get notes_enabled error:', error);
    res.status(500).json({ error: 'Failed to get config' });
  }
};

// Set a config value (manager only)
export const setConfigValue = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    await setConfig(key, value);

    if (key === 'alert_settings') {
      logger.info(`[Config] SET alert_settings: master_enabled=${value?.master_enabled}`);
    }

    // Emit socket event when alert_settings is updated
    if (key === 'alert_settings') {
      const io = getIO();
      if (io) {
        io.emit('alert_settings_changed', value);
      }
    }

    // Broadcast notes-enabled changes so all clients show/hide the free-text
    // fields immediately, without a re-login
    if (key === 'notes_enabled') {
      const io = getIO();
      if (io) {
        io.emit('notes_enabled_changed', value !== false);
      }
    }

    res.json({ key, value, message: 'Config updated' });
  } catch (error) {
    logger.error('Set config error:', error);
    res.status(500).json({ error: 'Failed to set config' });
  }
};

// Get all config values
export const getAllConfigValues = async (_req: Request, res: Response) => {
  try {
    const config = await getAllConfig();
    res.json({ config });
  } catch (error) {
    logger.error('Get all config error:', error);
    res.status(500).json({ error: 'Failed to get config' });
  }
};

// Delete a config value (manager only)
export const deleteConfigValue = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const deleted = await deleteConfig(key);

    if (!deleted) {
      return res.status(404).json({ error: 'Config key not found' });
    }

    res.json({ message: 'Config deleted' });
  } catch (error) {
    logger.error('Delete config error:', error);
    res.status(500).json({ error: 'Failed to delete config' });
  }
};
