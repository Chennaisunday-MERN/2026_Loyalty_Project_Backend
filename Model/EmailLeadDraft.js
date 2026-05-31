const mongoose = require('mongoose');

const EmailLeadDraftSchema = new mongoose.Schema({
  gmailMessageId: {
    type: String,
    required: true,
    unique: true,
  },
  threadId: {
    type: String,
  },
  from: {
    type: String,
  },
  to: {
    type: String,
  },
  subject: {
    type: String,
  },
  receivedAt: {
    type: Date,
  },
  snippet: {
    type: String,
  },
  bodyPreview: {
    type: String,
  },
  aiPriority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Low',
  },
  aiReason: {
    type: String,
  },
  aiConfidence: {
    type: Number,
    default: 0,
  },
  extractedLead: {
    LeadDetails: {
      clientName: String,
      Leadcondition: String,
      companyName: String,
      Department: String,
      LeadMedium: String,
      LeadPriority: String,
      EnquiryType: String,
    },
    ContactDetails: {
      MobileNumber: String,
      AlternateMobileNumber: String,
      PrimaryMail: String,
      SecondaryMail: String,
    },
    AddressDetails: {
      Address: String,
      Country: String,
      City: String,
      PostalCode: String,
      State: String,
    },
    DescriptionDetails: String,
  },
  missingFields: [{
    type: String,
  }],
  status: {
    type: String,
    enum: ['draft', 'created', 'error'],
    default: 'draft',
  },
  createdEnquiryNo: {
    type: String,
  },
  createdBy: {
    type: String,
  },
  errorMessage: {
    type: String,
  },
}, { timestamps: true });

module.exports = mongoose.model('EmailLeadDraft', EmailLeadDraftSchema);
