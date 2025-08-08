# Email Password Reset Configuration Guide

## Why Emails Might Not Be Working

The password reset emails may not be delivered due to several common issues with Supabase email configuration.

## Quick Fixes to Try First

### 1. Check Your Spam/Junk Folder
- Supabase emails often end up in spam initially
- Check all folders: Spam, Junk, Promotions, Updates

### 2. Wait 5-10 Minutes
- Supabase's shared email service can be slow
- Allow sufficient time for email delivery

### 3. Check Console Logs
- Open browser developer tools (F12)
- Look for email sending logs in the Console tab
- Check for any error messages

## Supabase Configuration Steps

### Step 1: Check Authentication Settings

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to **Authentication > Settings**
3. Scroll to **Email Settings** section
4. Ensure these are enabled:
   - ✅ **Enable email confirmations**
   - ✅ **Enable email change confirmations**

### Step 2: Email Templates Configuration

1. In **Authentication > Email Templates**
2. Check **Reset Password** template:
   - Should be **enabled**
   - Default template should work fine
   - Subject: "Reset Your Password"

### Step 3: Site URL Configuration

1. In **Authentication > URL Configuration**
2. Set **Site URL** to your domain: `https://your-domain.com`
3. Add **Redirect URLs**:
   - `https://your-domain.com/reset-password`
   - `http://localhost:3000/reset-password` (for development)

## Advanced: Custom SMTP Configuration

If emails still don't work, configure custom SMTP:

### Step 1: Get SMTP Credentials

Choose an email provider:
- **Gmail**: Use App Passwords
- **SendGrid**: Get API credentials  
- **AWS SES**: Get SMTP credentials
- **Mailgun**: Get SMTP settings

### Step 2: Configure SMTP in Supabase

1. Go to **Authentication > Settings**
2. Scroll to **SMTP Settings**
3. Enable **Enable custom SMTP**
4. Fill in your SMTP details:
   ```
   Host: smtp.gmail.com (for Gmail)
   Port: 587
   Username: your-email@gmail.com
   Password: your-app-password
   ```

### Step 3: Test Configuration

1. Save SMTP settings
2. Try password reset again
3. Check email delivery

## Gmail SMTP Setup Example

1. Enable 2-factor authentication on Gmail
2. Generate App Password:
   - Google Account > Security > 2-Step Verification > App passwords
   - Generate password for "Mail"
3. Use these settings in Supabase:
   ```
   Host: smtp.gmail.com
   Port: 587
   Username: your-email@gmail.com
   Password: [16-character app password]
   ```

## Troubleshooting Common Issues

### Issue: "Email rate limit exceeded"
**Solution**: Wait 10-15 minutes between attempts

### Issue: "Invalid email"
**Solution**: Check user email format in database

### Issue: "SMTP configuration error"
**Solution**: Verify SMTP credentials and settings

### Issue: No error but no email received
**Solutions**:
1. Check spam folder
2. Verify email address is correct
3. Try different email provider (Gmail, Outlook)
4. Check Supabase logs in dashboard

## Testing Email Delivery

1. Test with your own email first
2. Try different email providers (Gmail, Outlook, Yahoo)
3. Check browser console for errors
4. Look at Supabase project logs

## Environment Variables Cleanup

You can now remove the service role key from your `.env` file since we're using email-based reset:

```bash
# Remove this line - no longer needed
# SUPABASE_SERVICE_ROLE_KEY=...
```

## Reset Password Page

Make sure you have a reset password page at `/reset-password` that handles the email link. The page should:

1. Extract token from URL parameters
2. Show password reset form
3. Call Supabase `updateUser()` with new password
4. Handle success/error states

If you don't have this page, users won't be able to complete the password reset process.