const crypto = require('crypto');
const { google } = require('googleapis');
const { GoogleGenAI, Type } = require('@google/genai');

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function getEncryptionKey() {
  const secret = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('GMAIL_TOKEN_ENCRYPTION_KEY is not configured');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function encryptToken(token) {
  if (!token) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

function decryptToken(value) {
  if (!value) return '';
  const [ivText, tagText, encryptedText] = value.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivText, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagText, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function getAuthUrl() {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
  });
}

async function exchangeCodeForConnection(code) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();

  return {
    mailboxEmail: userInfo.data.email,
    accessToken: encryptToken(tokens.access_token),
    refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : '',
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
  };
}

async function getAuthorizedGmail(connection) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: decryptToken(connection.accessToken),
    refresh_token: connection.refreshToken ? decryptToken(connection.refreshToken) : undefined,
    expiry_date: connection.expiryDate ? connection.expiryDate.getTime() : undefined,
  });

  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      connection.accessToken = encryptToken(tokens.access_token);
    }
    if (tokens.refresh_token) {
      connection.refreshToken = encryptToken(tokens.refresh_token);
    }
    if (tokens.expiry_date) {
      connection.expiryDate = new Date(tokens.expiry_date);
    }
    await connection.save();
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function formatGmailDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('/');
}

function getGmailQuery(days) {
  const lookbackDays = Math.max(0, Math.min(Number(days) || 0, 365));
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - lookbackDays);
  return `in:inbox after:${formatGmailDate(startDate)}`;
}

async function listInboxMessages(gmail, days, maxResults = 50) {
  const response = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: getGmailQuery(days),
  });
  return response.data.messages || [];
}

async function getEmailContent(gmail, messageId) {
  const email = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  return email.data;
}

function decodeBase64Url(data) {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function stripHtml(value) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractEmailBody(payload) {
  let body = '';

  if (payload?.body?.data) {
    body += decodeBase64Url(payload.body.data);
  }

  if (payload?.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body += decodeBase64Url(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data && !body) {
        body += stripHtml(decodeBase64Url(part.body.data));
      } else if (part.parts) {
        body += extractEmailBody(part);
      }
    }
  }

  return stripHtml(body);
}

function extractHeaders(headers = []) {
  const headerMap = {};
  headers.forEach((header) => {
    headerMap[header.name.toLowerCase()] = header.value;
  });
  return {
    from: headerMap.from || '',
    to: headerMap.to || '',
    subject: headerMap.subject || '',
    date: headerMap.date || '',
  };
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePriority(value) {
  const priority = String(value || '').toLowerCase();
  if (priority === 'high') return 'High';
  if (priority === 'medium') return 'Medium';
  return 'Low';
}

function buildMissingFields(extractedLead) {
  const requiredPaths = [
    'LeadDetails.clientName',
    'LeadDetails.Leadcondition',
    'LeadDetails.companyName',
    'LeadDetails.Department',
    'LeadDetails.LeadMedium',
    'LeadDetails.LeadPriority',
    'LeadDetails.EnquiryType',
    'ContactDetails.MobileNumber',
    'ContactDetails.PrimaryMail',
    'AddressDetails.Address',
    'AddressDetails.Country',
    'AddressDetails.City',
    'AddressDetails.PostalCode',
    'AddressDetails.State',
  ];

  return requiredPaths.filter((path) => {
    const value = path.split('.').reduce((current, key) => current?.[key], extractedLead);
    return !value || String(value).trim() === '';
  });
}

async function analyzeEmailWithGemini({ headers, body }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `
Analyze this email as a sales lead intake message for Loyalty Automations.

Classify lead priority as exactly High, Medium, or Low.
High means urgent buying intent, RFQ/pricing/demo/order request, clear project need, or explicit timeline.
Medium means possible business enquiry without strong urgency.
Low means weak sales intent, vague enquiry, newsletter, automated message, or spam-like content.

Extract fields for this CRM. Use empty strings when a field is not present. Do not invent phone, address, or company data.
For LeadMedium use "Email" when this is a lead email.
For LeadPriority use the same value as priority.
For Leadcondition use "new" unless the email clearly describes an existing customer.
For EnquiryType choose Product, Project, or Service only.

From: ${headers.from}
To: ${headers.to}
Subject: ${headers.subject}
Date: ${headers.date}
Body: ${body.slice(0, 6000)}
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
          priorityReason: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          extractedLead: {
            type: Type.OBJECT,
            properties: {
              LeadDetails: {
                type: Type.OBJECT,
                properties: {
                  clientName: { type: Type.STRING },
                  Leadcondition: { type: Type.STRING },
                  companyName: { type: Type.STRING },
                  Department: { type: Type.STRING },
                  LeadMedium: { type: Type.STRING },
                  LeadPriority: { type: Type.STRING },
                  EnquiryType: { type: Type.STRING },
                },
              },
              ContactDetails: {
                type: Type.OBJECT,
                properties: {
                  MobileNumber: { type: Type.STRING },
                  AlternateMobileNumber: { type: Type.STRING },
                  PrimaryMail: { type: Type.STRING },
                  SecondaryMail: { type: Type.STRING },
                },
              },
              AddressDetails: {
                type: Type.OBJECT,
                properties: {
                  Address: { type: Type.STRING },
                  Country: { type: Type.STRING },
                  City: { type: Type.STRING },
                  PostalCode: { type: Type.STRING },
                  State: { type: Type.STRING },
                },
              },
              DescriptionDetails: { type: Type.STRING },
            },
          },
        },
        required: ['priority', 'priorityReason', 'confidence', 'extractedLead'],
      },
    },
  });

  const result = JSON.parse(response.text || '{}');
  const extractedLead = result.extractedLead || {};
  extractedLead.LeadDetails = {
    clientName: extractedLead.LeadDetails?.clientName || '',
    Leadcondition: ['new', 'existing'].includes(extractedLead.LeadDetails?.Leadcondition)
      ? extractedLead.LeadDetails.Leadcondition
      : 'new',
    companyName: extractedLead.LeadDetails?.companyName || '',
    Department: extractedLead.LeadDetails?.Department || '',
    LeadMedium: extractedLead.LeadDetails?.LeadMedium || 'Email',
    LeadPriority: normalizePriority(result.priority),
    EnquiryType: ['Product', 'Project', 'Service'].includes(extractedLead.LeadDetails?.EnquiryType)
      ? extractedLead.LeadDetails.EnquiryType
      : '',
  };
  extractedLead.ContactDetails = {
    MobileNumber: extractedLead.ContactDetails?.MobileNumber || '',
    AlternateMobileNumber: extractedLead.ContactDetails?.AlternateMobileNumber || '',
    PrimaryMail: extractedLead.ContactDetails?.PrimaryMail || '',
    SecondaryMail: extractedLead.ContactDetails?.SecondaryMail || '',
  };
  extractedLead.AddressDetails = {
    Address: extractedLead.AddressDetails?.Address || '',
    Country: extractedLead.AddressDetails?.Country || '',
    City: extractedLead.AddressDetails?.City || '',
    PostalCode: extractedLead.AddressDetails?.PostalCode || '',
    State: extractedLead.AddressDetails?.State || '',
  };
  extractedLead.DescriptionDetails = extractedLead.DescriptionDetails || body.slice(0, 1000);

  return {
    priority: normalizePriority(result.priority),
    priorityReason: result.priorityReason || '',
    confidence: Number(result.confidence) || 0,
    extractedLead,
    missingFields: buildMissingFields(extractedLead),
  };
}

module.exports = {
  decryptToken,
  encryptToken,
  exchangeCodeForConnection,
  extractEmailBody,
  extractHeaders,
  getAuthUrl,
  getAuthorizedGmail,
  getEmailContent,
  listInboxMessages,
  parseDate,
  analyzeEmailWithGemini,
  buildMissingFields,
};
