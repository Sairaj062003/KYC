const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validationResult, body } = require('express-validator');
const pool = require('../config/db');

/**
 * Validation rules for user registration.
 */
const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('phone_number')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Valid Indian mobile number required (10 digits starting with 6-9)'),
];

/**
 * Validation rules for user login.
 */
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

/**
 * POST /auth/register
 * Register a new user with name, email, password, and phone number.
 */
async function register(req, res, next) {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, email, password, phone_number } = req.body;

    // Check uniqueness of email
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Check uniqueness of phone number
    const phoneCheck = await pool.query(
      'SELECT id FROM users WHERE phone_number = $1',
      [phone_number]
    );
    if (phoneCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Phone number already registered' });
    }

    // Hash password with bcrypt (10 salt rounds)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user universally with role = 'user'
    const result = await pool.query(
      `INSERT INTO users (name, email, password, phone_number, role)
       VALUES ($1, $2, $3, $4, 'user')
       RETURNING id`,
      [name, email, hashedPassword, phone_number]
    );

    res.status(201).json({
      message: 'User registered successfully',
      userId: result.rows[0].id,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/login
 * Authenticate user with email and password, return JWT token.
 */
async function login(req, res, next) {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password } = req.body;

    // Hardcoded Admin Logic
    if (email === 'admin@gmail.com' && password === 'root@123') {
      let adminResult = await pool.query('SELECT id, name, email, role FROM users WHERE email = $1', [email]);
      
      if (adminResult.rows.length === 0) {
        const hash = await bcrypt.hash(password, 10);
        adminResult = await pool.query(
          `INSERT INTO users (name, email, password, phone_number, role) VALUES ('Admin', 'admin@gmail.com', $1, '0000000000', 'admin') RETURNING id, name, email, role`,
          [hash]
        );
      }
      
      const user = adminResult.rows[0];
      // Ensure role is admin in DB in case it was changed
      if (user.role !== 'admin') {
         await pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);
         user.role = 'admin';
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      return res.status(200).json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: 'admin' },
      });
    }

    // Fetch user by email
    const result = await pool.query(
      'SELECT id, name, email, password, role FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Compare password hashes
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Sign JWT with user payload
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/make-admin
 * Protected by secret key to promote a user to admin
 */
async function makeAdmin(req, res, next) {
  try {
    const { email, secretKey } = req.body;
    
    if (!secretKey || secretKey !== process.env.ADMIN_SETUP_SECRET) {
      return res.status(403).json({ error: 'Invalid or missing secret key' });
    }
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE email = $2 RETURNING id, email, role',
      ['admin', email]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(200).json({
      message: 'User promoted to admin successfully',
      user: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  makeAdmin,
  registerValidation,
  loginValidation,
};
