/**
 * RBAC middleware — restricts access to admin users only.
 * Must be used AFTER the auth middleware (requires req.user to be set).
 */
module.exports = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};
