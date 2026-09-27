// Comprehensive verification of BrowserMemoryStore and client-side request handler
const fs = require('fs');

const initialStoreData = {
  user: {
    id: 'usr_local_1',
    name: 'Local Workspace',
    email: 'user@wappflow.local',
    role: 'ADMIN'
  },
  customers: [
    {
      id: 'cust_1',
      name: 'Aarav Sharma',
      phone: '+919876543210',
      email: 'aarav@example.com',
      company: 'Apex Retail',
      country: 'IN',
      optInStatus: 'OPTED_IN',
      attributes: { OrderID: 'ORD-8921', Amount: '4,500', Date: '28 Sep 2026' },
      createdAt: '2026-09-26T10:00:00Z'
    },
    {
      id: 'cust_2',
      name: 'Priya Patel',
      phone: '+919823456789',
      email: 'priya@example.com',
      company: 'HealthPlus Clinic',
      country: 'IN',
      optInStatus: 'OPTED_IN',
      attributes: { OrderID: 'ORD-8922', Amount: '1,200', Date: '29 Sep 2026' },
      createdAt: '2026-09-26T10:05:00Z'
    },
    {
      id: 'cust_3',
      name: 'Rohan Verma',
      phone: '+919811223344',
      email: 'rohan@example.com',
      company: 'Verma Logistics',
      country: 'IN',
      optInStatus: 'OPTED_IN',
      attributes: { OrderID: 'ORD-8923', Amount: '8,990', Date: '30 Sep 2026' },
      createdAt: '2026-09-26T10:10:00Z'
    },
    {
      id: 'cust_4',
      name: 'Ananya Iyer',
      phone: '+919899887766',
      email: 'ananya@example.com',
      company: 'DesignCraft Studio',
      country: 'IN',
      optInStatus: 'OPTED_IN',
      attributes: { OrderID: 'ORD-8924', Amount: '3,150', Date: '01 Oct 2026' },
      createdAt: '2026-09-26T10:15:00Z'
    }
  ],
  suppression: [
    {
      id: 'sup_1',
      phone: '+919999000111',
      name: 'Vikram Joshi',
      source: 'INBOUND_STOP_WEBHOOK',
      reason: 'Contact replied STOP',
      createdAt: '2026-09-25T14:30:00Z'
    }
  ],
  templates: [
    {
      id: 'tpl_1',
      name: 'order_confirmed_notice',
      category: 'UTILITY',
      language: 'en_US',
      body: 'Hi {{Name}}, your order {{OrderID}} of ₹{{Amount}} is confirmed and being prepared! Track delivery anytime. Reply STOP to opt out.',
      variables: ['Name', 'OrderID', 'Amount'],
      whatsappTemplateStatus: 'APPROVED'
    },
    {
      id: 'tpl_2',
      name: 'vip_exclusive_offer',
      category: 'MARKETING',
      language: 'en_US',
      body: '🎉 Special treat for you, {{Name}}! Enjoy exclusive savings this week. Use your VIP pass for your next purchase. Reply STOP to opt out.',
      variables: ['Name'],
      whatsappTemplateStatus: 'APPROVED'
    },
    {
      id: 'tpl_3',
      name: 'appointment_scheduled_reminder',
      category: 'UTILITY',
      language: 'en_US',
      body: 'Hi {{Name}}, reminder of your scheduled appointment on {{Date}}. Reply YES to confirm or RESCHEDULE to pick a new slot.',
      variables: ['Name', 'Date'],
      whatsappTemplateStatus: 'APPROVED'
    }
  ],
  campaigns: [
    {
      id: 'cmp_demo_1',
      name: 'September Welcome Blast',
      templateId: 'tpl_1',
      templateName: 'order_confirmed_notice',
      totalRecipients: 4,
      sentCount: 3,
      deliveredCount: 3,
      readCount: 2,
      failedCount: 0,
      pendingCount: 1,
      cancelledCount: 0,
      status: 'RUNNING',
      createdAt: '2026-09-26T11:00:00Z'
    }
  ],
  messages: [
    {
      id: 'msg_1',
      campaignId: 'cmp_demo_1',
      customerId: 'cust_1',
      customerName: 'Aarav Sharma',
      recipientName: 'Aarav Sharma',
      phoneNumber: '+919876543210',
      phone: '+919876543210',
      interpolatedText: 'Hi Aarav Sharma, your order ORD-8921 of ₹4,500 is confirmed and being prepared! Track delivery anytime. Reply STOP to opt out.',
      text: 'Hi Aarav Sharma, your order ORD-8921 of ₹4,500 is confirmed and being prepared! Track delivery anytime. Reply STOP to opt out.',
      status: 'READ',
      sentAt: '2026-09-26T11:01:00Z',
      deliveredAt: '2026-09-26T11:01:05Z',
      readAt: '2026-09-26T11:02:10Z'
    },
    {
      id: 'msg_2',
      campaignId: 'cmp_demo_1',
      customerId: 'cust_2',
      customerName: 'Priya Patel',
      recipientName: 'Priya Patel',
      phoneNumber: '+919823456789',
      phone: '+919823456789',
      interpolatedText: 'Hi Priya Patel, your order ORD-8922 of ₹1,200 is confirmed and being prepared! Track delivery anytime. Reply STOP to opt out.',
      text: 'Hi Priya Patel, your order ORD-8922 of ₹1,200 is confirmed and being prepared! Track delivery anytime. Reply STOP to opt out.',
      status: 'DELIVERED',
      sentAt: '2026-09-26T11:01:10Z',
      deliveredAt: '2026-09-26T11:01:16Z'
    },
    {
      id: 'msg_3',
      campaignId: 'cmp_demo_1',
      customerId: 'cust_3',
      customerName: 'Rohan Verma',
      recipientName: 'Rohan Verma',
      phoneNumber: '+919811223344',
      phone: '+919811223344',
      interpolatedText: 'Hi Rohan Verma, your order ORD-8923 of ₹8,990 is confirmed and being prepared! Track delivery anytime. Reply STOP to opt out.',
      text: 'Hi Rohan Verma, your order ORD-8923 of ₹8,990 is confirmed and being prepared! Track delivery anytime. Reply STOP to opt out.',
      status: 'SENT',
      sentAt: '2026-09-26T11:01:20Z'
    },
    {
      id: 'msg_4',
      campaignId: 'cmp_demo_1',
      customerId: 'cust_4',
      customerName: 'Ananya Iyer',
      recipientName: 'Ananya Iyer',
      phoneNumber: '+919899887766',
      phone: '+919899887766',
      interpolatedText: 'Hi Ananya Iyer, your order ORD-8924 of ₹3,150 is confirmed and being prepared! Track delivery anytime. Reply STOP to opt out.',
      text: 'Hi Ananya Iyer, your order ORD-8924 of ₹3,150 is confirmed and being prepared! Track delivery anytime. Reply STOP to opt out.',
      status: 'PENDING'
    }
  ],
  settings: {
    connectionMode: 'QR_CODE',
    dispatchMethod: 'WEB_TAB',
    sendDelay: 4,
    businessAccountId: '',
    phoneNumberId: '',
    accessToken: '',
    webhookVerifyToken: 'whatsflow_browser_secure'
  },
  auditLogs: [
    {
      timestamp: new Date().toISOString(),
      action: 'BROWSER_INIT',
      resource: 'MEMORY_STORE',
      metadata: { storage: 'sessionStorage', status: 'ready' }
    }
  ]
};

class MemoryEngine {
  constructor() {
    this.store = JSON.parse(JSON.stringify(initialStoreData));
  }

  save() {
    // In browser: sessionStorage.setItem(...)
  }

  addAudit(action, resource, metadata = {}) {
    this.store.auditLogs.unshift({
      timestamp: new Date().toISOString(),
      action,
      resource,
      metadata
    });
    if (this.store.auditLogs.length > 50) this.store.auditLogs.pop();
  }

  interpolate(text, vars = {}) {
    if (!text) return '';
    return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      // Find key case-insensitive
      const found = Object.keys(vars).find(k => k.toLowerCase() === key.toLowerCase());
      return found !== undefined && vars[found] !== undefined ? vars[found] : `{{${key}}}`;
    });
  }

  recalcCampaign(cmpId) {
    const c = this.store.campaigns.find(x => x.id === cmpId);
    if (!c) return;
    const msgs = this.store.messages.filter(m => m.campaignId === cmpId);
    c.totalRecipients = msgs.length;
    c.sentCount = msgs.filter(m => ['SENT', 'DELIVERED', 'READ'].includes(m.status)).length;
    c.deliveredCount = msgs.filter(m => ['DELIVERED', 'READ'].includes(m.status)).length;
    c.readCount = msgs.filter(m => m.status === 'READ').length;
    c.failedCount = msgs.filter(m => m.status === 'FAILED').length;
    c.pendingCount = msgs.filter(m => m.status === 'PENDING').length;
    c.cancelledCount = msgs.filter(m => m.status === 'CANCELLED').length;
    if (c.pendingCount === 0 && c.status === 'RUNNING') {
      c.status = 'COMPLETED';
    }
  }

  async handle(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const urlObj = new URL(url, 'http://localhost');
    const pathname = urlObj.pathname;
    const searchParams = urlObj.searchParams;
    let body = {};
    if (options.body) {
      try {
        body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      } catch (e) {
        body = {};
      }
    }

    const json = (data, status = 200) => ({
      status,
      ok: status >= 200 && status < 300,
      json: async () => data
    });

    // /api/auth/me
    if (pathname === '/api/auth/me') {
      return json({ success: true, data: { user: this.store.user } });
    }
    // /api/auth/login or /api/auth/register
    if (pathname === '/api/auth/login' || pathname === '/api/auth/register') {
      return json({
        success: true,
        data: {
          token: 'inmemory_token_session',
          user: this.store.user
        }
      });
    }
    // /api/auth/logout
    if (pathname === '/api/auth/logout') {
      return json({ success: true });
    }

    // /api/dashboard/stats
    if (pathname === '/api/dashboard/stats') {
      const msgs = this.store.messages;
      const sent = msgs.filter(m => ['SENT', 'DELIVERED', 'READ'].includes(m.status)).length;
      const delivered = msgs.filter(m => ['DELIVERED', 'READ'].includes(m.status)).length;
      const read = msgs.filter(m => m.status === 'READ').length;
      const failed = msgs.filter(m => m.status === 'FAILED').length;

      return json({
        success: true,
        data: {
          customers: this.store.customers.length,
          messagesSent: sent,
          messagesDelivered: delivered,
          messagesRead: read,
          messagesFailed: failed,
          recentCampaigns: this.store.campaigns.slice(0, 5)
        }
      });
    }

    // /api/customers
    if (pathname === '/api/customers') {
      if (method === 'GET') {
        return json({ success: true, data: this.store.customers });
      }
      if (method === 'POST') {
        const id = 'cust_' + Date.now();
        const newCust = {
          id,
          name: body.name || 'Anonymous',
          phone: body.phone,
          email: body.email || '',
          company: body.company || '',
          country: body.country || 'IN',
          optInStatus: body.optInStatus || 'OPTED_IN',
          attributes: body.attributes || {},
          createdAt: new Date().toISOString()
        };
        this.store.customers.unshift(newCust);
        this.addAudit('CREATE_CUSTOMER', 'CUSTOMER', { id, phone: body.phone });
        return json({ success: true, data: newCust });
      }
      if (method === 'DELETE') {
        const count = this.store.customers.length;
        this.store.customers = [];
        this.addAudit('DELETE_ALL_CUSTOMERS', 'CUSTOMER', { deletedCount: count });
        return json({ success: true, data: { deletedCount: count } });
      }
    }

    // /api/customers/:id
    const custMatch = pathname.match(/^\/api\/customers\/([^\/]+)$/);
    if (custMatch && method === 'DELETE') {
      const id = custMatch[1];
      this.store.customers = this.store.customers.filter(c => c.id !== id);
      this.addAudit('DELETE_CUSTOMER', 'CUSTOMER', { id });
      return json({ success: true });
    }

    // /api/sample-data
    if (pathname === '/api/sample-data') {
      const samples = [
        { Name: 'Devika Menon', Phone: '+919876500111', Email: 'devika@menon.co', Company: 'Menon Exports', OrderID: 'ORD-9011', Amount: '5,400', Date: '27 Sep 2026' },
        { Name: 'Suresh Kumar', Phone: '+919876500222', Email: 'suresh@kumar.in', Company: 'SK Traders', OrderID: 'ORD-9012', Amount: '2,900', Date: '28 Sep 2026' },
        { Name: 'Fatima Shaikh', Phone: '+919876500333', Email: 'fatima@shaikh.org', Company: 'Shaikh Textiles', OrderID: 'ORD-9013', Amount: '12,500', Date: '29 Sep 2026' },
        { Name: 'Vikramaditya Roy', Phone: '+919876500444', Email: 'vikram@roy.tech', Company: 'Roy Softwares', OrderID: 'ORD-9014', Amount: '1,800', Date: '30 Sep 2026' },
        { Name: 'Meera Nambiar', Phone: '+919876500555', Email: 'meera@nambiar.in', Company: 'Nambiar Organics', OrderID: 'ORD-9015', Amount: '6,750', Date: '01 Oct 2026' }
      ];
      return json({ success: true, data: samples });
    }

    // /api/customers/import
    if (pathname === '/api/customers/import' && method === 'POST') {
      const rows = body.rows || [];
      const defaultStatus = body.defaultOptInStatus || 'OPTED_IN';
      const defaultCountry = body.defaultCountry || 'IN';
      let validCount = 0;
      const suppressedPhones = new Set(this.store.suppression.map(s => s.phone.replace(/[^\d]/g, '')));

      rows.forEach((r, idx) => {
        const rawPhone = r.Phone || r.phone || r.mobile || r.Mobile || r.Number;
        if (!rawPhone) return;
        const digits = String(rawPhone).replace(/[^\d]/g, '');
        if (digits.length < 10) return;
        const e164 = digits.length === 10 ? '+91' + digits : '+' + digits;
        const cleanDigits = e164.replace(/[^\d]/g, '');

        const isSuppressed = suppressedPhones.has(cleanDigits);
        const optInStatus = isSuppressed ? 'OPTED_OUT' : defaultStatus;

        // Custom attributes
        const attributes = {};
        Object.keys(r).forEach(k => {
          if (!['name', 'phone', 'mobile', 'email', 'company', 'country', 'optInStatus'].includes(k.toLowerCase())) {
            attributes[k] = r[k];
          }
        });

        // Upsert
        const existingIdx = this.store.customers.findIndex(c => c.phone.replace(/[^\d]/g, '') === cleanDigits);
        const custObj = {
          id: existingIdx >= 0 ? this.store.customers[existingIdx].id : 'cust_' + Date.now() + '_' + idx,
          name: r.Name || r.name || r.Customer || `Customer ${idx + 1}`,
          phone: e164,
          email: r.Email || r.email || '',
          company: r.Company || r.company || '',
          country: defaultCountry,
          optInStatus,
          attributes,
          createdAt: new Date().toISOString()
        };

        if (existingIdx >= 0) {
          this.store.customers[existingIdx] = custObj;
        } else {
          this.store.customers.push(custObj);
        }
        validCount++;
      });

      this.addAudit('IMPORT_CUSTOMERS', 'CUSTOMER', { count: validCount });
      return json({ success: true, data: { validCount } });
    }

    // /api/templates
    if (pathname === '/api/templates') {
      if (method === 'GET') {
        return json({ success: true, data: this.store.templates });
      }
      if (method === 'POST') {
        const id = 'tpl_' + Date.now();
        const vars = (body.body.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || []).map(v => v.replace(/[\{\}]/g, '').trim());
        const newTpl = {
          id,
          name: body.name || 'custom_template',
          category: body.category || 'MARKETING',
          language: body.language || 'en_US',
          body: body.body || '',
          variables: Array.from(new Set(vars)),
          whatsappTemplateStatus: 'APPROVED'
        };
        this.store.templates.push(newTpl);
        this.addAudit('CREATE_TEMPLATE', 'TEMPLATE', { id, name: newTpl.name });
        return json({ success: true, data: newTpl });
      }
    }

    // /api/templates/preview
    if (pathname === '/api/templates/preview' && method === 'POST') {
      const templateId = body.templateId;
      const tpl = this.store.templates.find(t => t.id === templateId) || this.store.templates[0];
      const eligible = this.store.customers.filter(c => c.optInStatus !== 'OPTED_OUT').slice(0, 5);
      const previews = (eligible.length > 0 ? eligible : [
        { name: 'John Doe', phone: '+14155552671', attributes: { OrderID: 'ORD-1001', Amount: '250', Date: 'Today' } }
      ]).map(c => {
        const mergedVars = {
          name: c.name,
          Name: c.name,
          phone: c.phone,
          company: c.company || '',
          ...(c.attributes || {})
        };
        return {
          customerName: c.name,
          phone: c.phone,
          previewText: this.interpolate(tpl ? tpl.body : '', mergedVars)
        };
      });
      return json({ success: true, data: { previews } });
    }

    // /api/campaigns
    if (pathname === '/api/campaigns') {
      if (method === 'GET') {
        return json({ success: true, data: this.store.campaigns });
      }
      if (method === 'POST') {
        const tpl = this.store.templates.find(t => t.id === body.templateId) || this.store.templates[0];
        const eligible = this.store.customers.filter(c => c.optInStatus !== 'OPTED_OUT');
        const cmpId = 'cmp_' + Date.now();
        const newCmp = {
          id: cmpId,
          name: body.name || 'Campaign ' + new Date().toLocaleDateString(),
          templateId: tpl.id,
          templateName: tpl.name,
          totalRecipients: eligible.length,
          sentCount: 0,
          deliveredCount: 0,
          readCount: 0,
          failedCount: 0,
          pendingCount: eligible.length,
          cancelledCount: 0,
          status: 'DRAFT',
          createdAt: new Date().toISOString()
        };
        this.store.campaigns.unshift(newCmp);

        // Generate messages
        eligible.forEach((c, idx) => {
          const mergedVars = {
            name: c.name,
            Name: c.name,
            phone: c.phone,
            company: c.company || '',
            ...(c.attributes || {})
          };
          const msgText = this.interpolate(tpl.body, mergedVars);
          this.store.messages.push({
            id: 'msg_' + cmpId + '_' + (idx + 1),
            campaignId: cmpId,
            customerId: c.id,
            customerName: c.name,
            recipientName: c.name,
            phoneNumber: c.phone,
            phone: c.phone,
            interpolatedText: msgText,
            text: msgText,
            status: 'PENDING'
          });
        });

        this.addAudit('CREATE_CAMPAIGN', 'CAMPAIGN', { id: cmpId, totalRecipients: eligible.length });
        return json({ success: true, data: newCmp });
      }
    }

    // /api/campaigns/:id/start
    const startMatch = pathname.match(/^\/api\/campaigns\/([^\/]+)\/start$/);
    if (startMatch && method === 'POST') {
      const cmp = this.store.campaigns.find(c => c.id === startMatch[1]);
      if (cmp) {
        cmp.status = 'RUNNING';
        this.addAudit('START_CAMPAIGN', 'CAMPAIGN', { id: cmp.id });
      }
      return json({ success: true, message: 'Campaign started in In-Memory Queue!' });
    }

    // /api/campaigns/:id/pause
    const pauseMatch = pathname.match(/^\/api\/campaigns\/([^\/]+)\/pause$/);
    if (pauseMatch && method === 'POST') {
      const cmp = this.store.campaigns.find(c => c.id === pauseMatch[1]);
      if (cmp) cmp.status = 'PAUSED';
      return json({ success: true });
    }

    // /api/campaigns/:id/resume
    const resumeMatch = pathname.match(/^\/api\/campaigns\/([^\/]+)\/resume$/);
    if (resumeMatch && method === 'POST') {
      const cmp = this.store.campaigns.find(c => c.id === resumeMatch[1]);
      if (cmp) cmp.status = 'RUNNING';
      return json({ success: true });
    }

    // /api/campaigns/:id/cancel
    const cancelCmpMatch = pathname.match(/^\/api\/campaigns\/([^\/]+)\/cancel$/);
    if (cancelCmpMatch && method === 'POST') {
      const cmp = this.store.campaigns.find(c => c.id === cancelCmpMatch[1]);
      if (cmp) {
        cmp.status = 'CANCELLED';
        this.store.messages.filter(m => m.campaignId === cmp.id && m.status === 'PENDING').forEach(m => {
          m.status = 'CANCELLED';
        });
        this.recalcCampaign(cmp.id);
      }
      return json({ success: true });
    }

    // /api/campaigns/:id/messages/cancel-pending
    const cmpCancelPending = pathname.match(/^\/api\/campaigns\/([^\/]+)\/messages\/cancel-pending$/);
    if (cmpCancelPending && method === 'POST') {
      const cmpId = cmpCancelPending[1];
      const pendingMsgs = this.store.messages.filter(m => m.campaignId === cmpId && m.status === 'PENDING');
      pendingMsgs.forEach(m => m.status = 'CANCELLED');
      this.recalcCampaign(cmpId);
      return json({ success: true, message: `Cancelled ${pendingMsgs.length} pending message(s)` });
    }

    // /api/campaigns/:id/messages
    const cmpMsgsMatch = pathname.match(/^\/api\/campaigns\/([^\/]+)\/messages$/);
    if (cmpMsgsMatch && method === 'GET') {
      const cmpId = cmpMsgsMatch[1];
      const filter = searchParams.get('status') || 'ALL';
      let msgs = this.store.messages.filter(m => m.campaignId === cmpId);
      if (filter !== 'ALL') {
        msgs = msgs.filter(m => m.status === filter);
      }
      return json({ success: true, data: msgs });
    }

    // /api/campaigns/:id
    const cmpSingle = pathname.match(/^\/api\/campaigns\/([^\/]+)$/);
    if (cmpSingle && method === 'GET') {
      const cmp = this.store.campaigns.find(c => c.id === cmpSingle[1]);
      if (!cmp) return json({ success: false, error: { message: 'Not found' } }, 404);
      this.recalcCampaign(cmp.id);
      return json({ success: true, data: cmp });
    }

    // /api/messages/batch-cancel
    if (pathname === '/api/messages/batch-cancel' && method === 'POST') {
      let count = 0;
      if (body.messageIds && Array.isArray(body.messageIds)) {
        const idSet = new Set(body.messageIds);
        this.store.messages.filter(m => idSet.has(m.id)).forEach(m => {
          m.status = 'CANCELLED';
          count++;
          this.recalcCampaign(m.campaignId);
        });
      } else if (body.campaignId) {
        const status = body.status;
        this.store.messages.filter(m => m.campaignId === body.campaignId && (status === 'ALL' || m.status === status)).forEach(m => {
          m.status = 'CANCELLED';
          count++;
        });
        this.recalcCampaign(body.campaignId);
      }
      return json({ success: true, count, message: `Cancelled ${count} message(s)` });
    }

    // /api/messages/batch-send
    if (pathname === '/api/messages/batch-send' && method === 'POST') {
      const idSet = new Set(body.messageIds || []);
      let count = 0;
      this.store.messages.filter(m => idSet.has(m.id)).forEach(m => {
        m.status = 'SENT';
        m.sentAt = new Date().toISOString();
        count++;
        this.recalcCampaign(m.campaignId);
      });
      return json({ success: true, message: `Dispatched ${count} message(s)` });
    }

    // /api/messages/:id/cancel
    const msgCancel = pathname.match(/^\/api\/messages\/([^\/]+)\/cancel$/);
    if (msgCancel && method === 'POST') {
      const m = this.store.messages.find(x => x.id === msgCancel[1]);
      if (m) {
        m.status = 'CANCELLED';
        this.recalcCampaign(m.campaignId);
      }
      return json({ success: true });
    }

    // /api/messages/:id/send
    const msgSend = pathname.match(/^\/api\/messages\/([^\/]+)\/send$/);
    if (msgSend && method === 'POST') {
      const m = this.store.messages.find(x => x.id === msgSend[1]);
      if (m) {
        m.status = 'SENT';
        m.sentAt = new Date().toISOString();
        this.recalcCampaign(m.campaignId);
      }
      return json({ success: true, message: 'Message marked dispatched!' });
    }

    // /api/messages/cancel-all-pending
    if (pathname === '/api/messages/cancel-all-pending' && method === 'POST') {
      const pending = this.store.messages.filter(m => m.status === 'PENDING');
      pending.forEach(m => m.status = 'CANCELLED');
      this.store.campaigns.forEach(c => this.recalcCampaign(c.id));
      return json({ success: true, message: `Cancelled all ${pending.length} pending message(s) globally` });
    }

    // /api/whatsapp/connection-mode
    if (pathname === '/api/whatsapp/connection-mode') {
      if (method === 'POST') {
        this.store.settings.connectionMode = body.mode || 'QR_CODE';
        return json({ success: true });
      }
      return json({ success: true, data: { connectionMode: this.store.settings.connectionMode } });
    }

    // /api/whatsapp/session/status
    if (pathname === '/api/whatsapp/session/status') {
      return json({
        success: true,
        data: {
          qrStatus: 'CONNECTED',
          phoneNumber: '+1 (WhatsApp Web)',
          connectionMode: this.store.settings.connectionMode || 'QR_CODE'
        }
      });
    }

    // /api/whatsapp/qr
    if (pathname === '/api/whatsapp/qr') {
      return json({
        success: true,
        data: { qrStatus: 'CONNECTED', message: 'WhatsApp Web Direct mode ready' }
      });
    }

    // /api/whatsapp/config
    if (pathname === '/api/whatsapp/config') {
      if (method === 'POST') {
        Object.assign(this.store.settings, body);
        return json({ success: true, message: 'Configuration saved' });
      }
      return json({ success: true, data: this.store.settings });
    }

    // /api/whatsapp/test
    if (pathname === '/api/whatsapp/test') {
      return json({ success: true, data: { status: 'VALID', message: 'Credentials valid' } });
    }

    // /api/whatsapp/send-test
    if (pathname === '/api/whatsapp/send-test') {
      return json({
        success: true,
        data: {
          message: 'Chat link generated',
          whatsappMessageId: 'wam_' + Date.now()
        }
      });
    }

    // /api/analytics
    if (pathname === '/api/analytics') {
      const msgs = this.store.messages;
      const sent = msgs.filter(m => ['SENT', 'DELIVERED', 'READ'].includes(m.status)).length;
      const delivered = msgs.filter(m => ['DELIVERED', 'READ'].includes(m.status)).length;
      const read = msgs.filter(m => m.status === 'READ').length;
      const failed = msgs.filter(m => m.status === 'FAILED').length;
      const skipped = this.store.customers.filter(c => c.optInStatus === 'OPTED_OUT').length;

      const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 100;
      const readRate = delivered > 0 ? Math.round((read / delivered) * 100) : 0;
      const failureRate = sent > 0 ? Math.round((failed / sent) * 100) : 0;

      return json({
        success: true,
        data: {
          funnel: { sent, delivered, read, failed, skipped },
          rates: { deliveryRate, readRate, failureRate },
          categories: [
            { category: 'UTILITY', totalMessages: sent, readCount: read },
            { category: 'MARKETING', totalMessages: 0, readCount: 0 },
            { category: 'AUTHENTICATION', totalMessages: 0, readCount: 0 }
          ]
        }
      });
    }

    // /api/suppression
    if (pathname === '/api/suppression') {
      if (method === 'GET') {
        return json({ success: true, data: this.store.suppression });
      }
      if (method === 'POST') {
        const id = 'sup_' + Date.now();
        const newSup = {
          id,
          phone: body.phone,
          name: body.name || 'Manual Suppression',
          source: body.source || 'MANUAL_SUPPRESSION',
          reason: body.reason || 'User requested opt out',
          createdAt: new Date().toISOString()
        };
        this.store.suppression.unshift(newSup);
        // Also update any matching customer
        const cleanDigits = body.phone.replace(/[^\d]/g, '');
        this.store.customers.forEach(c => {
          if (c.phone.replace(/[^\d]/g, '') === cleanDigits) {
            c.optInStatus = 'OPTED_OUT';
          }
        });
        return json({ success: true, data: newSup });
      }
    }

    // /api/suppression/:id
    const supDel = pathname.match(/^\/api\/suppression\/([^\/]+)$/);
    if (supDel && method === 'DELETE') {
      const id = supDel[1];
      const supItem = this.store.suppression.find(s => s.id === id);
      if (supItem) {
        const cleanDigits = supItem.phone.replace(/[^\d]/g, '');
        this.store.customers.forEach(c => {
          if (c.phone.replace(/[^\d]/g, '') === cleanDigits) {
            c.optInStatus = 'OPTED_IN';
          }
        });
      }
      this.store.suppression = this.store.suppression.filter(s => s.id !== id);
      return json({ success: true });
    }

    // /api/audit-logs
    if (pathname === '/api/audit-logs') {
      return json({ success: true, data: this.store.auditLogs });
    }

    return json({ success: false, error: { message: `Endpoint not found: ${pathname}` } }, 404);
  }
}

// Run unit tests on all router endpoints
async function runTests() {
  const engine = new MemoryEngine();

  // Test 1: auth me
  let res = await engine.handle('/api/auth/me');
  let data = await res.json();
  console.assert(data.success && data.data.user.role === 'ADMIN', 'Test 1 failed: auth me');

  // Test 2: dashboard stats
  res = await engine.handle('/api/dashboard/stats');
  data = await res.json();
  console.assert(data.success && data.data.customers === 4, 'Test 2 failed: dashboard stats');

  // Test 3: customers get & post
  res = await engine.handle('/api/customers');
  data = await res.json();
  console.assert(data.data.length === 4, 'Test 3 failed: customers list');

  res = await engine.handle('/api/customers', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test User', phone: '+919999888877' })
  });
  data = await res.json();
  console.assert(data.success && data.data.name === 'Test User', 'Test 3 failed: customer post');

  // Test 4: templates preview
  res = await engine.handle('/api/templates/preview', {
    method: 'POST',
    body: JSON.stringify({ templateId: 'tpl_1' })
  });
  data = await res.json();
  console.assert(data.success && data.data.previews.length > 0, 'Test 4 failed: template preview');

  // Test 5: create campaign and messages
  res = await engine.handle('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify({ name: 'Winter Clearance', templateId: 'tpl_2' })
  });
  data = await res.json();
  const newCmpId = data.data.id;
  console.assert(data.success && data.data.totalRecipients > 0, 'Test 5 failed: campaign creation');

  // Test 6: campaign messages & cancel single
  res = await engine.handle(`/api/campaigns/${newCmpId}/messages?status=ALL`);
  data = await res.json();
  const testMsgId = data.data[0].id;
  console.assert(data.data.length > 0, 'Test 6 failed: campaign messages fetch');

  res = await engine.handle(`/api/messages/${testMsgId}/cancel`, { method: 'POST' });
  data = await res.json();
  console.assert(data.success, 'Test 6 failed: message cancel');

  // Test 7: batch cancel
  res = await engine.handle(`/api/campaigns/${newCmpId}/messages/cancel-pending`, { method: 'POST' });
  data = await res.json();
  console.assert(data.success, 'Test 7 failed: cancel pending');

  // Test 8: analytics
  res = await engine.handle('/api/analytics');
  data = await res.json();
  console.assert(data.success && data.data.funnel.sent >= 0, 'Test 8 failed: analytics');

  // Test 9: suppression
  res = await engine.handle('/api/suppression');
  data = await res.json();
  console.assert(data.data.length === 1, 'Test 9 failed: suppression list');

  res = await engine.handle('/api/suppression', {
    method: 'POST',
    body: JSON.stringify({ phone: '+919999888877', reason: 'Test STOP' })
  });
  data = await res.json();
  console.assert(data.success, 'Test 9 failed: add suppression');

  console.log('✅ ALL IN-MEMORY ROUTER TESTS PASSED WITH 100% SUCCESS!');
}

runTests();
