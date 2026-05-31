const express = require('express');
const verifyToken = require('../VerifyToken');
const GmailConnection = require('../Model/GmailConnection');
const EmailLeadDraft = require('../Model/EmailLeadDraft');
const HeadEnquiry = require('../Model/HeadEnquiry');
const {
  analyzeEmailWithGemini,
  buildMissingFields,
  exchangeCodeForConnection,
  extractEmailBody,
  extractHeaders,
  getAuthUrl,
  getAuthorizedGmail,
  getEmailContent,
  listInboxMessages,
  parseDate,
} = require('../services/emailLeadService');

const router = express.Router();

function requireLeadFiller(req, res, next) {
  if (req.user.role !== 'Lead filler') {
    return res.status(403).json({ message: 'Permission denied, only Lead filler can use email leads' });
  }
  next();
}

function getFrontendUrl() {
  return process.env.FRONTEND_URL || 'http://localhost:3000';
}

function sanitizeDays(value) {
  const days = Number(value);
  if (!Number.isFinite(days) || days < 0) return 0;
  return Math.min(Math.floor(days), 365);
}

function sanitizeMaxResults(value) {
  const maxResults = Number(value);
  if (!Number.isFinite(maxResults) || maxResults < 1) return 50;
  return Math.min(Math.floor(maxResults), 100);
}

function normalizeLeadPayload(payload) {
  return {
    LeadDetails: {
      clientName: payload?.LeadDetails?.clientName || '',
      Leadcondition: payload?.LeadDetails?.Leadcondition || '',
      companyName: payload?.LeadDetails?.companyName || '',
      Department: payload?.LeadDetails?.Department || '',
      LeadMedium: payload?.LeadDetails?.LeadMedium || '',
      LeadPriority: payload?.LeadDetails?.LeadPriority || '',
      EnquiryType: payload?.LeadDetails?.EnquiryType || '',
    },
    ContactDetails: {
      MobileNumber: payload?.ContactDetails?.MobileNumber || '',
      AlternateMobileNumber: payload?.ContactDetails?.AlternateMobileNumber || '',
      PrimaryMail: payload?.ContactDetails?.PrimaryMail || '',
      SecondaryMail: payload?.ContactDetails?.SecondaryMail || '',
    },
    AddressDetails: {
      Address: payload?.AddressDetails?.Address || '',
      Country: payload?.AddressDetails?.Country || '',
      City: payload?.AddressDetails?.City || '',
      PostalCode: payload?.AddressDetails?.PostalCode || '',
      State: payload?.AddressDetails?.State || '',
    },
    DescriptionDetails: payload?.DescriptionDetails || '',
  };
}

router.get('/gmail/connect', verifyToken, requireLeadFiller, async (req, res) => {
  try {
    return res.status(200).json({ url: getAuthUrl() });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.get('/gmail/callback', async (req, res) => {
  try {
    if (!req.query.code) {
      return res.redirect(`${getFrontendUrl()}/SaleteamDasboard/EmailLeads?error=no_code`);
    }

    const connectionData = await exchangeCodeForConnection(req.query.code);
    await GmailConnection.findOneAndUpdate(
      { provider: 'gmail' },
      { ...connectionData, provider: 'gmail', status: 'connected' },
      { upsert: true, new: true }
    );

    return res.redirect(`${getFrontendUrl()}/SaleteamDasboard/EmailLeads?connected=true`);
  } catch (err) {
    console.error('Gmail callback failed:', err);
    return res.redirect(`${getFrontendUrl()}/SaleteamDasboard/EmailLeads?error=auth_failed`);
  }
});

router.get('/gmail/status', verifyToken, requireLeadFiller, async (req, res) => {
  try {
    const connection = await GmailConnection.findOne({ provider: 'gmail', status: 'connected' })
      .select('mailboxEmail updatedAt');
    return res.status(200).json({
      connected: !!connection,
      mailboxEmail: connection?.mailboxEmail || '',
      updatedAt: connection?.updatedAt || null,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post('/fetch', verifyToken, requireLeadFiller, async (req, res) => {
  try {
    const connection = await GmailConnection.findOne({ provider: 'gmail', status: 'connected' });
    if (!connection) {
      return res.status(400).json({ message: 'Shared Gmail mailbox is not connected' });
    }

    const days = sanitizeDays(req.body.days);
    const maxResults = sanitizeMaxResults(req.body.maxResults);
    const gmail = await getAuthorizedGmail(connection);
    const messages = await listInboxMessages(gmail, days, maxResults);
    const existingDrafts = await EmailLeadDraft.find({
      gmailMessageId: { $in: messages.map((message) => message.id) },
    }).select('gmailMessageId');
    const existingIds = new Set(existingDrafts.map((draft) => draft.gmailMessageId));

    const createdDrafts = [];
    let skipped = 0;

    for (const message of messages) {
      if (existingIds.has(message.id)) {
        skipped += 1;
        continue;
      }

      const emailData = await getEmailContent(gmail, message.id);
      const headers = extractHeaders(emailData.payload?.headers);
      const body = extractEmailBody(emailData.payload);

      try {
        const analysis = await analyzeEmailWithGemini({ headers, body });
        const draft = await EmailLeadDraft.create({
          gmailMessageId: message.id,
          threadId: message.threadId,
          from: headers.from,
          to: headers.to,
          subject: headers.subject,
          receivedAt: parseDate(headers.date),
          snippet: emailData.snippet || '',
          bodyPreview: body.slice(0, 3000),
          aiPriority: analysis.priority,
          aiReason: analysis.priorityReason,
          aiConfidence: analysis.confidence,
          extractedLead: analysis.extractedLead,
          missingFields: analysis.missingFields,
          status: 'draft',
          createdBy: req.user.email,
        });
        createdDrafts.push(draft);
      } catch (err) {
        const extractedLead = normalizeLeadPayload({
          LeadDetails: { LeadMedium: 'Email', LeadPriority: 'Low', Leadcondition: 'new' },
          ContactDetails: { PrimaryMail: headers.from },
          DescriptionDetails: body.slice(0, 1000),
        });
        const draft = await EmailLeadDraft.create({
          gmailMessageId: message.id,
          threadId: message.threadId,
          from: headers.from,
          to: headers.to,
          subject: headers.subject,
          receivedAt: parseDate(headers.date),
          snippet: emailData.snippet || '',
          bodyPreview: body.slice(0, 3000),
          aiPriority: 'Low',
          aiReason: 'AI analysis failed; review manually.',
          aiConfidence: 0,
          extractedLead,
          missingFields: buildMissingFields(extractedLead),
          status: 'error',
          errorMessage: err.message,
          createdBy: req.user.email,
        });
        createdDrafts.push(draft);
      }
    }

    return res.status(200).json({
      message: 'Email fetch completed',
      fetched: messages.length,
      created: createdDrafts.length,
      skipped,
      drafts: createdDrafts,
    });
  } catch (err) {
    console.error('Email fetch failed:', err);
    return res.status(500).json({ message: err.message || 'Email fetch failed' });
  }
});

router.get('/drafts', verifyToken, requireLeadFiller, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.aiPriority = req.query.priority;

    const drafts = await EmailLeadDraft.find(filter).sort({ receivedAt: -1, createdAt: -1 });
    return res.status(200).json({ drafts });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.put('/drafts/:id', verifyToken, requireLeadFiller, async (req, res) => {
  try {
    const extractedLead = normalizeLeadPayload(req.body.extractedLead);
    const missingFields = buildMissingFields(extractedLead);
    const draft = await EmailLeadDraft.findByIdAndUpdate(
      req.params.id,
      {
        extractedLead,
        missingFields,
        aiPriority: req.body.aiPriority || extractedLead.LeadDetails.LeadPriority || 'Low',
        aiReason: req.body.aiReason || '',
        status: missingFields.length > 0 ? 'draft' : req.body.status || 'draft',
      },
      { new: true }
    );

    if (!draft) {
      return res.status(404).json({ message: 'Draft not found' });
    }

    return res.status(200).json({ message: 'Draft updated', draft });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

router.post('/drafts/:id/create-enquiry', verifyToken, requireLeadFiller, async (req, res) => {
  try {
    const draft = await EmailLeadDraft.findById(req.params.id);
    if (!draft) {
      return res.status(404).json({ message: 'Draft not found' });
    }
    if (draft.status === 'created') {
      return res.status(400).json({ message: 'Draft already created an enquiry' });
    }

    const extractedLead = normalizeLeadPayload(req.body.extractedLead || draft.extractedLead);
    const missingFields = buildMissingFields(extractedLead);
    if (missingFields.length > 0) {
      draft.extractedLead = extractedLead;
      draft.missingFields = missingFields;
      await draft.save();
      return res.status(400).json({ message: 'Required fields are missing', missingFields });
    }

    if (!req.body.Eid) {
      return res.status(400).json({ message: 'Sales Head ID is required' });
    }

    const randomId = Math.floor(Math.random() * 1000000);
    const enquirynumber = `ENQ-${randomId.toString().padStart(5, '0')}`;
    const headEnquiry = await HeadEnquiry.create({
      ...extractedLead,
      Status: 'Enquiry-1stage',
      EnquiryNo: enquirynumber,
      Eid: req.body.Eid,
      createdBy: req.user.role,
    });

    draft.extractedLead = extractedLead;
    draft.missingFields = [];
    draft.status = 'created';
    draft.createdEnquiryNo = enquirynumber;
    await draft.save();

    return res.status(200).json({
      message: 'Enquiry created from email draft',
      data: headEnquiry,
      draft,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
