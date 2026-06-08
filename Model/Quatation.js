const mongoose = require('mongoose');

const Quatation = new mongoose.Schema({
  Eid: {
    type: String,
    required: true
  },
  EnquiryNo: {
    type: String,
    required: true
  },
  products: [{
    HSNCode: {
      type: String,
      required: true
    },
    UnitDescription: {
      type: String,
      required: true
    },
    Description: {
      type: String,
      required: true
    },
    UOM: {
      type: String,
      required: true
    },
    Quantity: {
      type: String,
    },
    UnitPrice: {
      type: String,
      required: true
    },
    LP: {
      type: String,
    },
    discount: {
      type: String,
    },
    Total: {
      type: String,
    },
  }],
  Paymentdue: {
    type: String,
  },
  validity: {
    type: String,
  },
  Warranty: {
    type: String,
  },
  Delivery: {
    type: String,
  },
  Discount: {
    type: String,
  },
  Gst: {
    type: String,
  },
  PayableAmount: {
    type: String,
  },
  Status: {
    type: String,
    required: true
  },
  ReferenceNumber: {  // Adding ReferenceNumber field
    type: String,
    required: true,
    unique: true
  },
  financialYear: {   // New field for financial year
    type: String,
    required: true
  },
  isRevision: {    // New field to indicate if it's a revision
    type: Boolean,
    required: true
  },
  referenceToRevise: {  // Optional field to reference the original quotation for revision
    type: String,
    default: null
  },
  LP:{
    type:String,
  },
  discount:{
    type:String
  }
}, { timestamps: true });

module.exports = mongoose.model('quots', Quatation);
