const express = require('express');
const verifyToken = require('../VerifyToken');
const WebsiteSubmission = require('../Model/WebsiteSubmission');

const router = express.Router();

const allowedRoles = ['Lead filler', 'md', 'sales head'];

router.get('/customer-website-enquiries', verifyToken, async (req, res) => {
  try {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Permission denied. Only Lead filler, sales head, and md can view website enquiries.',
      });
    }

    const enquiries = await WebsiteSubmission.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json(enquiries);
  } catch (error) {
    console.error('Error fetching customer website enquiries:', error);
    return res.status(500).json({ message: 'Error fetching customer website enquiries.' });
  }
});

module.exports = router;
