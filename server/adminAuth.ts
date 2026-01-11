
import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

interface AdminAuthRequest extends Request {
  adminUser?: any;
  user?: any;
}

export const adminAuth = async (req: AdminAuthRequest, res: Response, next: NextFunction) => {
  try {
    const adminToken = req.headers.authorization?.replace('Bearer ', '');
    
    if (!adminToken) {
      return res.status(401).json({ message: 'Admin authentication required' });
    }

    // Parse admin token. userId may contain underscores, so match via regex: admin_<userId>_<timestamp>
    const match = adminToken.match(/^admin_(.+)_(\d+)$/);
    if (!match) {
      return res.status(401).json({ message: 'Invalid admin token format' });
    }

    const userId = match[1];
    const tokenTime = parseInt(match[2]);

    // Check if token is expired (24 hours)
    const tokenAge = Date.now() - tokenTime;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (tokenAge > maxAge) {
      return res.status(401).json({ message: 'Admin token expired' });
    }

    // Verify user exists and is admin
    const user = await storage.getUser(userId);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: 'Admin access denied' });
    }

    req.adminUser = user;
    // Also set `req.user` for compatibility with existing handlers
    req.user = user;
    next();
  } catch (error) {
    console.error('Admin authentication error:', error);
    res.status(500).json({ message: 'Admin authentication failed' });
  }
};
