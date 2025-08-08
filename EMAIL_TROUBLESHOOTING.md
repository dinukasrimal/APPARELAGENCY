# Email Troubleshooting Guide - SMTP Issues

## Step-by-Step Debugging Process

### Step 1: Test the New Debug Features

1. **Open User Management** and click "Test Email" button
2. **Enter your personal email** and send test
3. **Open browser console** (F12 > Console tab)
4. **Look for detailed logs** starting with "=== EMAIL CONFIGURATION TEST START ==="

### Step 2: Check Browser Console Logs

When you try to reset a password, look for these log sections:

```
=== EMAIL RESET DEBUG START ===
Target user: [user object]
Email address: [email]
Current origin: [your domain]
Redirect URL: [reset URL]
Calling supabase.auth.resetPasswordForEmail...
Response data: [data]
Response error: [error]
```

**What to look for:**
- ✅ **No error**: Email was sent successfully (check spam folder)
- ❌ **Error object**: Note the specific error message and code

### Step 3: Common Error Messages & Solutions

#### Error: "Rate limit exceeded"
**Cause**: Too many email attempts
**Solution**: Wait 10-15 minutes before trying again

#### Error: "SMTP configuration error" or "Authentication failed"
**Cause**: Incorrect SMTP credentials
**Solution**: 
1. Go to Supabase Dashboard > Authentication > Settings
2. Check SMTP settings:
   - Host: `smtp.gmail.com` (for Gmail)
   - Port: `587`
   - Username: Your full email address
   - Password: App password (NOT your regular password)

#### Error: "Invalid email" 
**Cause**: Email format issue
**Solution**: Check if the user's email in the database is valid

#### Error: Network/Connection issues
**Cause**: Internet or Supabase connection problems
**Solution**: Check internet connection and Supabase status

### Step 4: Verify SMTP Configuration in Supabase

1. **Go to Supabase Dashboard**:
   - https://supabase.com/dashboard
   - Select your project

2. **Navigate to Authentication > Settings**

3. **Scroll to SMTP Settings section**

4. **Verify these settings**:
   ```
   Enable custom SMTP: ✅ ON
   Host: smtp.gmail.com
   Port: 587 (for TLS) or 465 (for SSL)
   Username: your-email@gmail.com
   Password: [16-character app password]
   ```

5. **Test SMTP Connection**:
   - Click "Test SMTP" if available
   - Or use our "Test Email" button

### Step 5: Gmail App Password Setup (Most Common Issue)

If using Gmail, you need an **App Password**, not your regular password:

1. **Enable 2-Factor Authentication** on Gmail
2. **Generate App Password**:
   - Go to Google Account > Security
   - Click "2-Step Verification" 
   - Click "App passwords"
   - Select "Mail" and generate password
   - Use this 16-character password in Supabase SMTP settings

### Step 6: Check Supabase Project Logs

1. **Go to Supabase Dashboard**
2. **Navigate to Logs**
3. **Check Authentication logs** for email sending attempts
4. **Look for errors** around the time you tried sending email

### Step 7: Verify URL Configuration

1. **In Supabase Dashboard > Authentication > URL Configuration**
2. **Check Site URL**: Should match your domain
3. **Check Redirect URLs**: Should include:
   - `https://your-domain.com/reset-password`
   - `http://localhost:3000/reset-password` (for development)

### Step 8: Alternative SMTP Providers

If Gmail doesn't work, try these:

#### SendGrid:
```
Host: smtp.sendgrid.net
Port: 587
Username: apikey
Password: [your sendgrid api key]
```

#### Outlook/Hotmail:
```
Host: smtp-mail.outlook.com
Port: 587
Username: your-email@outlook.com
Password: [your password]
```

#### AWS SES:
```
Host: email-smtp.[region].amazonaws.com
Port: 587
Username: [SMTP username from AWS]
Password: [SMTP password from AWS]
```

## Debugging Commands to Run

### In Browser Console:

1. **Check current user**:
   ```javascript
   const { data: { user } } = await supabase.auth.getUser();
   console.log('Current user:', user);
   ```

2. **Test direct email call**:
   ```javascript
   const { data, error } = await supabase.auth.resetPasswordForEmail('test@example.com');
   console.log('Data:', data, 'Error:', error);
   ```

3. **Check Supabase connection**:
   ```javascript
   console.log('Supabase URL:', supabase.supabaseUrl);
   console.log('Supabase Key:', supabase.supabaseKey);
   ```

## Most Likely Issues (In Order):

1. **App Password Not Used**: Using regular Gmail password instead of app password
2. **SMTP Not Enabled**: Custom SMTP not turned on in Supabase
3. **Wrong Port**: Using 25 instead of 587 or 465
4. **Rate Limiting**: Too many attempts too quickly
5. **Redirect URL Missing**: Reset password page URL not configured
6. **User Doesn't Exist**: Email address not in Supabase auth users

## Next Steps:

1. **Try the "Test Email" button** first
2. **Check browser console** for specific error messages
3. **Verify SMTP settings** in Supabase dashboard
4. **Try with your own email address** that you know works
5. **Check spam folder** thoroughly
6. **Wait 15 minutes** if you see rate limit errors

## If Still Not Working:

1. **Try a different email provider** (not Gmail)
2. **Use a different SMTP service** (SendGrid, AWS SES)
3. **Check Supabase project logs** for server-side errors
4. **Contact me with the specific error messages** from the console

The enhanced debugging will show you exactly what's happening when you try to send emails!