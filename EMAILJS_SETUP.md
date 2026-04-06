# EmailJS Setup for Room Invitations

## Overview
The Create Room page now uses EmailJS to automatically send room invitation links to invited members via email.

## EmailJS Template Setup

You need to create an email template in your EmailJS account with the following configuration:

### Template Variables
The following variables are sent from the application and should be used in your template:

- `{{to_email}}` - Recipient's email address
- `{{room_name}}` - Name of the study room
- `{{room_link}}` - Direct link to join the room
- `{{from_name}}` - Name of the user who created the room
- `{{subject}}` - Subject/topic of the study room

### Recommended Email Template

**Subject Line:**
```
You're invited to join "{{room_name}}" on StudyHub
```

**Email Body:**
```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
  <div style="background-color: #F2CF7E; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: #000; margin: 0;">StudyHub Invitation</h1>
  </div>
  
  <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <p style="font-size: 16px; color: #333;">Hi there!</p>
    
    <p style="font-size: 16px; color: #333;">
      <strong>{{from_name}}</strong> has invited you to join a study session on StudyHub.
    </p>
    
    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 5px 0; color: #666;"><strong>Room Name:</strong> {{room_name}}</p>
      <p style="margin: 5px 0; color: #666;"><strong>Subject:</strong> {{subject}}</p>
    </div>
    
    <p style="font-size: 16px; color: #333;">Click the button below to join the study room:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{room_link}}" style="background-color: #F2CF7E; color: #000; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
        Join Study Room
      </a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Or copy and paste this link into your browser:<br>
      <a href="{{room_link}}" style="color: #F2CF7E; word-break: break-all;">{{room_link}}</a>
    </p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #999; text-align: center;">
      This invitation was sent from StudyHub. If you didn't expect this email, you can safely ignore it.
    </p>
  </div>
</div>
```

## Configuration

The EmailJS credentials are already configured in:

### Frontend (.env)
```
VITE_EMAILJS_SERVICE_ID=service_a9x197y
VITE_EMAILJS_TEMPLATE_ID=template_d68fmd7
VITE_EMAILJS_PUBLIC_KEY=poqXRLHL27lAtbcTb
```

### Backend (.env)
```
EMAILJS_SERVICE_ID=service_a9x197y
EMAILJS_TEMPLATE_ID=template_d68fmd7
EMAILJS_PUBLIC_KEY=poqXRLHL27lAtbcTb
EMAILJS_PRIVATE_KEY=Bh7kkpyGe-bLVWXGBNk2F
```

## How It Works

1. User creates a room and adds email addresses in the "Invite Members" section
2. When the room is created, the application automatically sends invitation emails to all added members
3. Each email contains:
   - Room name and subject
   - Creator's name
   - Direct link to join the room
4. Recipients can click the link or copy it to join the study session

## Testing

To test the email functionality:

1. Create a new room
2. Add your own email address in the "Invite Members" section
3. Create the room
4. Check your email inbox for the invitation

## Troubleshooting

If emails are not being sent:

1. Verify EmailJS credentials are correct in `.env` files
2. Check that the EmailJS template ID matches your template
3. Ensure the template uses the correct variable names
4. Check browser console for any errors
5. Verify your EmailJS account has available email quota

## Features

- Automatic email sending when room is created with invited members
- Multiple recipients supported
- Success confirmation in the UI
- Graceful error handling (room still created even if emails fail)
