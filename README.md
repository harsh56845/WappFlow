# WhatsFlow - Bulk WhatsApp Customer Messaging Platform

> **"Import. Personalize. Send. Track."**

WhatsFlow is a production-ready bulk WhatsApp messaging web application powered by the **Official WhatsApp Business Platform Cloud API**. It is built for business users to upload customer spreadsheets, detect columns, validate phone numbers into normalized E.164 formats, personalize dynamic message templates, review sample messages, launch campaigns with strict opt-in compliance, and track real-time delivery status (Sent, Delivered, Read, Failed).

---

## ⚡ Instant Quick Start (Local Run)

The application has zero external requirements and runs immediately using Node.js:

```bash
# 1. Start the server
node server.js
```

Then open your browser to:
👉 **`http://localhost:3000`**

---

## 🚀 Key Features

1. **Excel / CSV Customer Importer**:
   - Supports `.xlsx`, `.xls`, and `.csv`.
   - Drag & drop interface with upload progress.
   - Automatic column detection (`Name`, `Phone`, `OrderID`, `Amount`, `Date`, etc.).
   - Phone number validation and **E.164 normalization** (`+91...`, `+1...`, etc.).
   - Pre-import validation summary: Total Rows, Valid, Duplicates, Invalid numbers, Missing numbers.
   - Comprehensive error review table with row-specific diagnostic reasons.

2. **WhatsApp Business Messaging Compliance**:
   - Explicit Opt-In consent handling (`OPTED_IN`, `NOT_OPTED_IN`, `OPTED_OUT`).
   - Automatic global suppression for opted-out contacts.
   - Confirmation compliance modal before campaign dispatch.
   - Template approval enforcement: only approved templates can be launched for business-initiated campaigns.

3. **Message Personalization Engine**:
   - Dynamic tag support: `{{Name}}`, `{{Phone}}`, `{{OrderID}}`, `{{Amount}}`, `{{Date}}`, and custom Excel headers.
   - Interactive tag chips for one-click insertion.
   - Live WhatsApp phone chat mockup preview.

4. **Campaign Execution & Queue System**:
   - Safe asynchronous message queue with throttling.
   - Prevention of duplicate dispatches (Idempotency).
   - Ability to **Pause**, **Resume**, and **Cancel** active campaigns.
   - Live animated progress bar (`2,250 / 2,500 processed - 90%`).
   - Real-time message status updates: `QUEUED` ➔ `SENT` ➔ `DELIVERED` ➔ `READ` / `FAILED`.

5. **Reports & Analytics**:
   - Executive dashboard cards: Total Customers, Messages Sent, Delivered, Read, Failed.
   - Delivery rate (%) and Read rate (%) calculations.
   - One-click CSV export of full campaign audit reports.

6. **Instant Demo Mode**:
   - Out-of-the-box local sandbox simulation.
   - Test full workflows without consuming Meta API quota or sending accidental messages to real customers.
   - Easily switch to live Meta Cloud API by providing credentials in **Settings**.

---

## 📁 Sample Test File Included

A pre-packaged test dataset is provided at [`sample-customers.csv`](file:///Users/harshvardhan/Downloads/bulk_whatsappmsgtool/sample-customers.csv) containing:
- 50 realistic customer records
- Intentional duplicate phone numbers
- Intentional invalid numbers (e.g. `99999`)
- Intentional missing phones
- Opted-out customer record (`OPTED_OUT`) to demonstrate compliance suppression

You can also click **"Load 50 Test Customers"** directly from the UI for a 1-click test!

---

## 🛠️ Official WhatsApp Cloud API Credentials Setup

To connect to your live Meta WhatsApp Business Account:

1. Go to **Meta for Developers** (https://developers.facebook.com/)
2. Navigate to your WhatsApp App ➔ **API Setup**
3. Obtain:
   - **Phone Number ID**
   - **WhatsApp Business Account ID**
   - **Permanent System User Access Token**
4. In WhatsFlow, navigate to **Settings & API**:
   - Enter your credentials
   - Click **"Test Connection"** to verify account status and quality rating.
   - Click **"Save Configuration"**.

---

## 🔒 Security & Architecture

- **Token Protection**: Access tokens are encrypted at rest using AES-256-GCM.
- **Strict Validation**: All phone numbers and campaign parameters pass server-side schemas.
- **Audit Logging**: All campaign actions, customer imports, and template updates are logged in an audit log.
