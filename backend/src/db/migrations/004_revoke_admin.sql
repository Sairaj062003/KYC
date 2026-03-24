-- Migration: Revoke admin access from everyone except the actual hardcoded admin
UPDATE users SET role = 'user' WHERE email != 'admin@gmail.com';
