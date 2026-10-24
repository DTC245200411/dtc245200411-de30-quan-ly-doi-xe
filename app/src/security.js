'use strict';
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(crypto.scrypt);
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const key = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}
function csrf(req, res, next) {
  req.session.csrf ||= crypto.randomBytes(24).toString('hex');
  res.locals.csrf = req.session.csrf;
  if (req.method === 'POST') {
    const input = Buffer.from(String(req.body?._csrf || ''));
    const expected = Buffer.from(req.session.csrf);
    if (input.length !== expected.length || !crypto.timingSafeEqual(input, expected)) {
      return res.status(403).render('error', { title: 'Phiên biểu mẫu không hợp lệ', message: 'Vui lòng tải lại trang và thử lại.' });
    }
  }
  next();
}
module.exports = { hashPassword, verifyPassword, csrf };
