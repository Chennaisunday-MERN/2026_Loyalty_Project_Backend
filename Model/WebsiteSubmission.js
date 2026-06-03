const mongoose = require('mongoose');

const WebsiteSubmissionSchema = new mongoose.Schema({
  customerInfo: {
    name: String,
    email: String,
    phone: String,
    description: String,
  },
  productInfo: {
    quantity: Number,
    additionalRequirements: String,
    companyName: String,
    gstNumber: String,
  },
  product: {
    title: String,
    price: Number,
    productimage: String,
    description: String,
  },
}, { timestamps: true, strict: false });

module.exports = mongoose.model('Submit', WebsiteSubmissionSchema, 'submits');
