const router = require('express').Router();
const {
  register,
  login,
  registerValidation,
  loginValidation,
} = require('../controllers/auth.controller');

// POST /auth/register — Create a new user account
router.post('/register', registerValidation, register);

// POST /auth/login — Authenticate and receive JWT
router.post('/login', loginValidation, login);

module.exports = router;
