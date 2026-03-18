/**
 * Global error handler middleware.
 * Logs the full error with timestamp and returns a structured JSON response.
 * Stack traces are only included in development mode.
 */
module.exports = (err, req, res, next) => {
  console.error(
    `[${new Date().toISOString()}] ERROR:`,
    err.message,
    err.stack
  );

  const status = err.status || 500;

  res.status(status).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
