# EmailJS Template Setup Guide

## Step-by-Step Instructions

### Step 1: Login to EmailJS
1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Login with your account credentials

### Step 2: Navigate to Email Templates
1. Click on **"Email Templates"** in the left sidebar
2. Click on **"Create New Template"** button

### Step 3: Configure Template Settings

#### Template Name
```
StudyHub Room Invitation
```

#### Template ID
Your template ID should be: `template_d68fmd7`
(This matches the ID in your .env file)

### Step 4: Set Email Subject
In the "Subject" field, enter:
```
You're invited to join "{{room_name}}" on StudyHub
```

### Step 5: Set Email Content

#### Option A: Use HTML Editor
1. Click on the **"HTML"** tab in the content editor
2. Copy the entire content from `EMAILJS_ROOM_INVITATION_TEMPLATE.html`
3. Paste it into the HTML editor
4. Click **"Save"**

#### Option B: Manual Setup (if HTML doesn't work)
1. Use the visual editor
2. Add the following structure:

**Header Section:**
- Background color: #F2CF7E
- Text: "📚 StudyHub"
- Subtitle: "You're Invited to a Study Session"

**Body Content:**
```
Hi there! 👋

{{from_name}} has invited you to join a collaborative study session on StudyHub.

Room Details:
📖 Room Name: {{room_name}}
📚 Subject: {{subject}}

Click the button below to join the study room:
[Join Study Room Button] → Link to: {{room_link}}

Or copy this link: {{room_link}}

What you can do:
🎥 Video & Audio collaboration
💬 Real-time chat
📝 Shared notes & resources
🤖 AI-powered study tools
```

### Step 6: Configure Template Variables

Make sure these variables are recognized in your template:
- `{{to_email}}` - Recipient email (auto-filled by EmailJS)
- `{{from_name}}` - Sender's name
- `{{room_name}}` - Study room name
- `{{room_link}}` - Direct link to room
- `{{subject}}` - Room subject/topic

### Step 7: Test the Template

1. Click **"Test it"** button in EmailJS
2. Fill in sample values:
   - `from_name`: "John Doe"
   - `room_name`: "Math Study Group"
   - `room_link`: "https://yourdomain.com/#/room/123"
   - `subject`: "Calculus"
3. Enter your email address
4. Click **"Send Test"**
5. Check your inbox

### Step 8: Verify Service Configuration

1. Go to **"Email Services"** in EmailJS
2. Ensure your service ID is: `service_a9x197y`
3. Make sure the service is connected and active

### Step 9: Check API Keys

Verify your EmailJS credentials match:

**Public Key:** `poqXRLHL27lAtbcTb`
**Private Key:** `Bh7kkpyGe-bLVWXGBNk2F`

You can find these in:
- EmailJS Dashboard → Account → API Keys

## Quick Copy-Paste Template (Plain Text Version)

If you prefer a simpler plain text version:

**Subject:**
```
You're invited to join "{{room_name}}" on StudyHub
```

**Body:**
```
Hi there!

{{from_name}} has invited you to join a collaborative study session on StudyHub.

Room Details:
- Room Name: {{room_name}}
- Subject: {{subject}}

Join the study room by clicking this link:
{{room_link}}

What you can do in the study room:
• Video & Audio collaboration
• Real-time chat
• Shared notes & resources
• AI-powered study tools

---
This invitation was sent from StudyHub.
If you didn't expect this email, you can safely ignore it.
```

## Troubleshooting

### Emails not sending?
1. Check that Service ID matches: `service_a9x197y`
2. Check that Template ID matches: `template_d68fmd7`
3. Verify Public Key: `poqXRLHL27lAtbcTb`
4. Check EmailJS dashboard for error logs
5. Ensure your EmailJS account has available email quota

### Variables not showing?
1. Make sure you're using double curly braces: `{{variable_name}}`
2. Variable names are case-sensitive
3. Test with the "Test it" button in EmailJS

### Styling not working?
1. Use inline CSS styles (not external stylesheets)
2. Some email clients strip certain CSS properties
3. Test with multiple email providers (Gmail, Outlook, etc.)

## Email Preview

Your recipients will receive a professional email with:
- StudyHub branding with yellow (#F2CF7E) theme
- Clear room details in a highlighted card
- Prominent "Join Study Room" button
- Alternative text link for accessibility
- List of available features
- Professional footer

## Next Steps

After setup:
1. Create a test room in your application
2. Add your own email to the invite list
3. Verify you receive the invitation
4. Click the link to ensure it works
5. Adjust template styling if needed

## Support

If you need help:
- EmailJS Documentation: https://www.emailjs.com/docs/
- EmailJS Support: https://www.emailjs.com/support/
