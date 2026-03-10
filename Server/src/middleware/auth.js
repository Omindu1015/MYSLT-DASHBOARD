import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not defined in environment variables.');
  process.exit(1);
}

/**
 * Middleware to verify JWT token
 */
export const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (localError) {
      // Check if it's a valid Azure AD token
      const decoded = jwt.decode(token);
      if (decoded && (decoded.iss?.includes('sts.windows.net') || decoded.iss?.includes('microsoftonline.com'))) {
        // Map Azure claims to the user object expected by other middlewares/controllers
        req.user = {
          userId: decoded.oid || decoded.sub,
          username: decoded.preferred_username || decoded.upn || decoded.name,
          role: 'admin' // Map Azure users to admin role for dashboard access
        };
        return next();
      }

      if (localError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }
      throw localError;
    }
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

/**
 * Middleware to check if user is admin
 */
export const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  next();
};
