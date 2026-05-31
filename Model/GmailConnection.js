const mongoose = require('mongoose');

const GmailConnectionSchema = new mongoose.Schema({
  provider: {
    type: String,
    default: 'gmail',
  },
  mailboxEmail: {
    type: String,
    required: true,
  },
  accessToken: {
    type: String,
    required: true,
  },
  refreshToken: {
    type: String,
  },
  expiryDate: {
    type: Date,
  },
  connectedBy: {
    type: String,
  },
  status: {
    type: String,
    enum: ['connected', 'disconnected'],
    default: 'connected',
  },
}, { timestamps: true });

module.exports = mongoose.model('GmailConnection', GmailConnectionSchema);
