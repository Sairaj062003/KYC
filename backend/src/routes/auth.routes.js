const router = require('express').Router();
const {
  register,
  login,
  makeAdmin,
  registerValidation,
  loginValidation,
} = require('../controllers/auth.controller');

// POST /auth/register — Create a new user account
router.post('/register', registerValidation, register);

// POST /auth/login — Authenticate and receive JWT
router.post('/login', loginValidation, login);

// POST /auth/make-admin — Promote user to admin using secret
router.post('/make-admin', makeAdmin);

module.exports = router;
