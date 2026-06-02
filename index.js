require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { Resend } = require('resend');

const app    = express();
const resend = new Resend(process.env.RESEND_API_KEY);

app.use(express.json());
app.use(cors({
  origin: [
    'https://hiddenlawsofmoney.com',
    'https://www.hiddenlawsofmoney.com',
    'https://hiddenlaws-waitlist.vercel.app',
  ],
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'hiddenlaws-backend' });
});

app.post('/subscribe', async (req, res) => {
  const { name, email } = req.body;

  if (!email || !email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ error: 'Valid email required.' });
  }

  const firstName = name ? name.trim().split(' ')[0] : 'Friend';

  try {
    await resend.contacts.create({
      audienceId:   process.env.RESEND_AUDIENCE_ID,
      email:        email.toLowerCase().trim(),
      firstName:    firstName,
      unsubscribed: false,
    });

    await resend.emails.send({
      from:    process.env.FROM_EMAIL,
      to:      email.toLowerCase().trim(),
      replyTo: process.env.REPLY_TO_EMAIL,
      subject: 'Part I — You Were Given a Map to the Wrong City',
      html:    plc1Html(firstName),
    });

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await sendTelegram(`New subscriber: ${firstName} <${email}>`);
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Subscribe error:', err);
    if (err?.message?.toLowerCase().includes('already exists') || err?.statusCode === 409) {
      return res.status(200).json({ success: true, note: 'already subscribed' });
    }
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields required.' });
  }
  if (message.length < 10) {
    return res.status(400).json({ error: 'Message too short.' });
  }

  try {
    await resend.emails.send({
      from:    process.env.FROM_EMAIL,
      to:      process.env.REPLY_TO_EMAIL,
      replyTo: email.toLowerCase().trim(),
      subject: `[hiddenlawsofmoney.com] Message from ${name}`,
      html: `
        <p><strong>From:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <hr />
        <p>${message.replace(/\n/g, '<br />')}</p>
      `,
    });

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      await sendTelegram(`Contact form from ${name} <${email}>:\n${message.substring(0, 200)}`);
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Contact error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

async function sendTelegram(text) {
  try {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
    });
  } catch (e) {
    console.error('Telegram error:', e.message);
  }
}

function plc1Html(firstName) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Part I</title></head>
<body style="margin:0;padding:0;background:#0c0b09;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c0b09;">
<tr><td align="center" style="padding:40px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">
<tr><td style="height:3px;background:linear-gradient(90deg,transparent,#c9a84c,#e2c47a,#c9a84c,transparent);"></td></tr>
<tr><td style="background:#131210;padding:32px 40px 24px;text-align:center;">
  <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#8a6e30;">The Hidden Laws of Money &mdash; Part I of III</p>
  <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;line-height:1.2;color:#f0e8d8;font-weight:400;">You Were Given a Map<br/>to the Wrong City</h1>
</td></tr>
<tr><td style="background:#1a1915;padding:36px 40px;">
  <p style="margin:0 0 20px;font-size:16px;line-height:1.8;color:#ddd5c5;">Hi ${firstName},</p>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.8;color:#ddd5c5;">Let me ask you something honest.</p>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.8;color:#ddd5c5;">Have you ever done most of what you were supposed to do with money? Worked hard. Tried to save. Maybe read a book or two. And still felt like no matter how fast you move, you never actually get ahead?</p>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.8;color:#ddd5c5;">The standard explanation is that you are not disciplined enough. Not consistent enough. That if you just tracked your spending more carefully, the numbers would eventually add up.</p>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
    <tr><td style="border-left:3px solid #c9a84c;padding:16px 24px;background:#131210;">
      <p style="margin:0;font-style:italic;font-size:17px;line-height:1.65;color:#ddd5c5;">&ldquo;Most people are not bad with money. They were just given a map to the wrong city.&rdquo;</p>
    </td></tr>
  </table>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.8;color:#ddd5c5;">Here is a different explanation: most people are playing a financial game they were never taught the rules of. And no amount of effort changes the outcome of a game you do not understand.</p>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.8;color:#ddd5c5;">There is a second set of rules. Not the budgeting and saving rules you already know. A deeper layer &mdash; invisible, unspoken, rarely explained &mdash; that quietly sorts people into two categories. Those who build wealth. And those who spend their lives genuinely trying and wondering why they cannot seem to hold onto it.</p>
  <p style="margin:0 0 20px;font-size:16px;line-height:1.8;color:#ddd5c5;">The people who build wealth are not more disciplined than you. They are playing by a different rulebook. And that rulebook was never handed to you &mdash; not out of malice, but because the people inside it never had to think about it consciously. It was their dinner table conversation at age twelve.</p>
  <p style="margin:0 0 32px;font-size:16px;line-height:1.8;color:#ddd5c5;">Over the next two emails I am going to walk you through what those rules actually are. Tomorrow: the single rule that has been setting your financial ceiling since before you were old enough to question it.</p>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
    <tr><td style="border-top:1px solid #2e2c27;"></td></tr>
  </table>
  <p style="margin:0;font-size:14px;line-height:1.7;color:#5a5648;">Eric Coste<br/>Author, The Hidden Laws of Money<br/><a href="https://hiddenlawsofmoney.com" style="color:#8a6e30;text-decoration:none;">hiddenlawsofmoney.com</a></p>
</td></tr>
<tr><td style="background:#131210;padding:20px 40px;text-align:center;">
  <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#5a5648;line-height:1.6;">
    You received this because you signed up at hiddenlawsofmoney.com.<br/>
    <a href="{{RESEND_UNSUBSCRIBE_URL}}" style="color:#5a5648;text-decoration:underline;">Unsubscribe</a>
    &nbsp;&middot;&nbsp;
    <a href="https://hiddenlawsofmoney.com/privacy.html" style="color:#5a5648;text-decoration:underline;">Privacy Policy</a>
  </p>
</td></tr>
<tr><td style="height:2px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);"></td></tr>
</table></td></tr></table>
</body></html>`;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`hiddenlaws-backend running on port ${PORT}`));
