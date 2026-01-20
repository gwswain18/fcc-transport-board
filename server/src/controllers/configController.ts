import { Request, Response } from 'express';
import {
  getConfig,
  setConfig,
  getAllConfig,
  deleteConfig,
} from '../services/configService.js';
import { getIO } from '../socket/index.js';

// Get a config value
export const getConfigValue = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;

    const value = await getConfig(key);

    if (value === null) {
      return res.status(404).json({ error: 'Config key not found' });
    }

    res.json({ key, value });
  } catch (error) {
    console.error('Get config error:', error);
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

    // Emit socket event when alert_settings is updated
    if (key === 'alert_settings') {
      const io = getIO();
      if (io) {
        io.emit('alert_settings_changed', value);
      }
    }

    res.json({ key, value, message: 'Config updated' });
  } catch (error) {
    console.error('Set config error:', error);
    res.status(500).json({ error: 'Failed to set config' });
  }
};

// Get all config values
export const getAllConfigValues = async (_req: Request, res: Response) => {
  try {
    const config = await getAllConfig();
    res.json({ config });
  } catch (error) {
    console.error('Get all config error:', error);
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
    console.error('Delete config error:', error);
    res.status(500).json({ error: 'Failed to delete config' });
  }
};
