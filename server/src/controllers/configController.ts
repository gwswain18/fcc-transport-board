import { Request, Response } from 'express';
import {
  getConfig,
  setConfig,
  getAllConfig,
  deleteConfig,
  getNotesEnabled,
} from '../services/configService.js';
import { createAuditLog, getAuditLogs } from '../services/auditService.js';
import { getAuditContext } from '../middleware/auditMiddleware.js';
import { AuthenticatedRequest } from '../types/index.js';
import { getIO } from '../socket/index.js';
import logger from '../utils/logger.js';

// Deep equality for config values (objects, arrays, primitives). Used to
// skip audit rows for no-op writes — the settings save buttons re-PUT every
// key, so most writes don't actually change anything.
const deepEquals = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  if (aKeys.length !== Object.keys(bObj).length) return false;
  return aKeys.every((key) => deepEquals(aObj[key], bObj[key]));
};

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
export const setConfigValue = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    // Capture the previous value before overwriting so the settings change
    // history can show old -> new
    const oldValue = await getConfig(key);

    await setConfig(key, value);

    // Only audit real changes — the settings save buttons re-PUT unchanged keys
    if (!deepEquals(oldValue, value)) {
      const { ipAddress, userAgent } = getAuditContext(req);
      await createAuditLog({
        userId: req.user?.id,
        action: 'update',
        entityType: 'system_config',
        // entity_id is INTEGER but config keys are varchar; the key lives in the values
        oldValues: { key, value: oldValue },
        newValues: { key, value },
        ipAddress,
        userAgent,
      });
    }

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

    // Keep other managers' settings pages fresh when auto-reassign changes
    if (key === 'auto_reassign_enabled' || key === 'auto_reassign_timeout_minutes') {
      const io = getIO();
      if (io) {
        io.emit('auto_reassign_settings_changed', { key, value });
      }
    }

    res.json({ key, value, message: 'Config updated' });
  } catch (error) {
    logger.error('Set config error:', error);
    res.status(500).json({ error: 'Failed to set config' });
  }
};

// Settings change history (manager only) — audit rows for system_config
export const getConfigAuditHistory = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 100);
    const offset = parseInt(String(req.query.offset ?? '0'), 10) || 0;

    const logs = await getAuditLogs({ entityType: 'system_config', limit, offset });
    res.json({ logs });
  } catch (error) {
    logger.error('Get config audit history error:', error);
    res.status(500).json({ error: 'Failed to get settings history' });
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
export const deleteConfigValue = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { key } = req.params;

    const oldValue = await getConfig(key);
    const deleted = await deleteConfig(key);

    if (!deleted) {
      return res.status(404).json({ error: 'Config key not found' });
    }

    const { ipAddress, userAgent } = getAuditContext(req);
    await createAuditLog({
      userId: req.user?.id,
      action: 'delete',
      entityType: 'system_config',
      oldValues: { key, value: oldValue },
      ipAddress,
      userAgent,
    });

    res.json({ message: 'Config deleted' });
  } catch (error) {
    logger.error('Delete config error:', error);
    res.status(500).json({ error: 'Failed to delete config' });
  }
};
