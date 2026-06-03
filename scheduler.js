// ─── Email Scheduler ──────────────────────────────────
// Tracks subscribers and fires timed emails automatically
// Uses a simple JSON file as a lightweight data store

const fs   = require('fs');
const path = require('path');

const DB_PATH = path.join('/data', 'subscribers.json');
const PAYHIP_URL  = 'https://payhip.com/b/DzR2a';
const SITE_URL    = 'https://hiddenlawsofmoney.com';
const CART_CLOSE  = 'Sunday June 22 at midnight';
const CLOSE_DATE  = new Date('2026-06-23T05:00:00Z'); // midnight PT = 07:00 UTC, using 05:00 UTC as safe buffer

// Days after opt-in to send each email
const SCHEDULE = {
  plc2:       3,
  plc3:       6,
  cartOpen:   7,
  objection:  7.33,  // ~8 hours after cart open
  story:      8,
  urgency:    8.33,  // ~8 hours after story
  close:      9,
};

// ─── DB helpers ───────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(DB_PATH)) return [];
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return []; }
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function addSubscriber(email, firstName) {
  const db  = loadDB();
  const now = new Date();
  const existing = db.find(s => s.email === email);
  if (existing) return; // already tracked
  db.push({
    email,
    firstName,
    optInAt:   now.toISOString(),
    sent:      [],
  });
  saveDB(db);
}

function markSent(email, key) {
  const db  = loadDB();
  const sub = db.find(s => s.email === email);
  if (!sub) return;
  if (!sub.sent.includes(key)) sub.sent.push(key);
  saveDB(db);
}

// ─── Check who needs what email right now ─────────────
async function runScheduler(resend) {
  const db  = loadDB();
  const now = new Date();

  for (const sub of db) {
    const optIn    = new Date(sub.optInAt);
    const daysSince = (now - optIn) / (1000 * 60 * 60 * 24);

    for (const [key, day] of Object.entries(SCHEDULE)) {
      if (daysSince >= day && !sub.sent.includes(key)) {
        try {
          await sendScheduledEmail(resend, key, sub.email, sub.firstName);
          markSent(sub.email, key);
          console.log(`Sent ${key} to ${sub.email}`);
        } catch (err) {
          console.error(`Failed to send ${key} to ${sub.email}:`, err.message);
        }
      }
    }
  }
}

// ─── Route to correct email ───────────────────────────
async function sendScheduledEmail(resend, key, email, firstName) {
  const emails = {
    plc2:      { subject: 'Part II — The Rule That Has Been Setting Your Ceiling',        html: plc2Html(firstName) },
    plc3:      { subject: 'Part III — Ten Rules. The Game Was Always Played by Them.',   html: plc3Html(firstName) },
    cartOpen:  { subject: 'The Hidden Laws of Money — it\'s open',                       html: cartOpenHtml(firstName) },
    objection: { subject: 'Does this work if you already know the basics?',              html: objectionHtml(firstName) },
    story:     { subject: 'The treadmill that had nothing to do with spending',           html: storyHtml(firstName) },
    urgency:   { subject: `Closes ${CART_CLOSE} — what disappears after`,               html: urgencyHtml(firstName) },
    close:     { subject: `Closing tonight — last email`,                                html: closeHtml(firstName) },
  };

  const e = emails[key];
  if (!e) return;

  await resend.emails.send({
    from:    process.env.FROM_EMAIL,
    to:      email,
    replyTo: process.env.REPLY_TO_EMAIL,
    subject: e.subject,
    html:    e.html,
  });
}

// ─── Email templates ──────────────────────────────────

function emailWrap(heading, body, firstName) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#0c0b09;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c0b09;">
<tr><td align="center" style="padding:40px 16px;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">
<tr><td style="height:3px;background:linear-gradient(90deg,transparent,#c9a84c,#e2c47a,#c9a84c,transparent);"></td></tr>
<tr><td style="background:#131210;padding:32px 40px 24px;text-align:center;">
  <p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#8a6e30;">The Hidden Laws of Money</p>
  <h1 style="margin:0;font-family:Georgia,serif;font-size:24px;line-height:1.25;color:#f0e8d8;font-weight:400;">${heading}</h1>
</td></tr>
<tr><td style="background:#1a1915;padding:36px 40px;">
  ${body}
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 0;">
    <tr><td style="border-top:1px solid #2e2c27;"></td></tr>
  </table>
  <p style="margin:20px 0 0;font-size:14px;line-height:1.7;color:#5a5648;">
    Eric Coste<br/>Author, The Hidden Laws of Money<br/>
    <a href="${SITE_URL}" style="color:#8a6e30;text-decoration:none;">${SITE_URL.replace('https://', '')}</a>
  </p>
</td></tr>
<tr><td style="background:#131210;padding:20px 40px;text-align:center;">
  <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#5a5648;line-height:1.6;">
    You received this because you signed up at hiddenlawsofmoney.com.<br/>
    <a href="{{RESEND_UNSUBSCRIBE_URL}}" style="color:#5a5648;text-decoration:underline;">Unsubscribe</a>
    &nbsp;&middot;&nbsp;
    <a href="${SITE_URL}/privacy.html" style="color:#5a5648;text-decoration:underline;">Privacy Policy</a>
  </p>
</td></tr>
<tr><td style="height:2px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);"></td></tr>
</table></td></tr></table>
</body></html>`;
}

function p(text) {
  return `<p style="margin:0 0 20px;font-size:16px;line-height:1.8;color:#ddd5c5;">${text}</p>`;
}

function quote(text) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr><td style="border-left:3px solid #c9a84c;padding:16px 24px;background:#131210;">
    <p style="margin:0;font-style:italic;font-size:17px;line-height:1.65;color:#ddd5c5;">${text}</p>
  </td></tr></table>`;
}

function btn(label, url) {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
  <tr><td align="center">
    <a href="${url}" style="display:inline-block;background:#c9a84c;color:#0c0b09;font-family:Arial,sans-serif;font-weight:700;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;padding:16px 36px;text-decoration:none;">${label}</a>
  </td></tr></table>`;
}

// ─── PLC2 ─────────────────────────────────────────────
function plc2Html(firstName) {
  const body = `
    ${p(`Hi ${firstName},`)}
    ${p('Yesterday I told you there is a second set of financial rules most people never get taught. Today I want to start with the most important one.')}
    ${p('Before you ever check your bank balance, there is already a number in your head.')}
    ${p('Not a specific figure. A feeling. A quiet sense of what is realistic for someone like you. What is normal. What kind of money people like you tend to have.')}
    ${p('You did not choose that number. It was installed over years of watching and listening and absorbing. The way your parents talked about money &mdash; or did not. The neighborhood you grew up in. The first time you heard &ldquo;we cannot afford that&rdquo; and what emotion came attached to it.')}
    ${quote('&ldquo;You don\'t rise to your goals. You fall to the level of your identity. So the only real work is building a self that makes success feel inevitable.&rdquo;')}
    ${p('That internal number is your money self-image. And here is the hidden law: your financial life will almost never exceed it for long.')}
    ${p('You might get a windfall. Land a big contract. Receive a significant raise. But if your identity has not expanded to hold that new level, the money finds a way out. The balance returns to familiar territory.')}
    ${p('This is not a discipline problem. It is a structural one. And no budget addresses a ceiling that moves with you.')}
    ${p('Tomorrow: the third and final part &mdash; all ten rules, finally visible.')}
  `;
  return emailWrap('The Rule Setting Your Financial Ceiling', body, firstName);
}

// ─── PLC3 ─────────────────────────────────────────────
function plc3Html(firstName) {
  const body = `
    ${p(`Hi ${firstName},`)}
    ${p('This week we covered two of the hidden laws running your financial life beneath the surface of every decision you make.')}
    ${p('The second set of rules that most people never see. And the identity ceiling installed before you were old enough to question it.')}
    ${p('But there are ten laws total. And the ones I have not shared yet are where it gets most interesting.')}
    ${p('<strong style="color:#f0e8d8;">The Velocity Law</strong> &mdash; why the wealthy do not just earn more but engineer what happens to money the moment it arrives. Mike Tyson earned over $300 million and filed for bankruptcy. Not recklessness. A velocity problem.')}
    ${p('<strong style="color:#f0e8d8;">The Asymmetry Law</strong> &mdash; how to structure risk so the downside has a floor and the upside does not. Small controlled bets on uncapped upside while protecting the foundation.')}
    ${p('<strong style="color:#f0e8d8;">The Scarcity Tax</strong> &mdash; what financial stress is actually costing you beyond the bank balance. Researchers found it consumes significant cognitive bandwidth whether you are actively thinking about money or not.')}
    ${p('And five more laws that map the full picture of how money actually moves, builds, and compounds for people who understand the real rules.')}
    ${quote('&ldquo;The board has always been there. You just needed someone to turn the lights on.&rdquo;')}
    ${p('Tomorrow the complete map opens. I will send you the link in the morning.')}
  `;
  return emailWrap('Ten Rules. The Game Was Always Played by Them.', body, firstName);
}

// ─── CART OPEN ────────────────────────────────────────
function cartOpenHtml(firstName) {
  const body = `
    ${p(`Hi ${firstName},`)}
    ${p('All week we talked about why smart, hardworking people stay stuck financially. The invisible ceiling. The velocity problem that took down Mike Tyson. The scarcity tax quietly consuming the cognitive resources needed to escape it.')}
    ${p('Today the complete map opens.')}
    ${p('The Hidden Laws of Money is a ten-law framework for finally seeing the game that has been played around you your entire financial life. Not another budget. Not another formula. The actual rules.')}
    ${p('<strong style="color:#f0e8d8;">Inside you get:</strong> all ten laws mapped with specific frameworks, real stories, and the exact mechanisms through which they have been shaping your financial outcomes without your awareness.')}
    ${p('<strong style="color:#f0e8d8;">Plus when you order today:</strong> The Hidden Laws Companion Workbook &mdash; 36 pages of structured exercises, one for each law, that move you from insight to implementation inside your actual financial life. Valued at $17.')}
    ${p(`Everything for <strong style="color:#f0e8d8;">$26</strong> through ${CART_CLOSE}.`)}
    ${p(`After that the price moves to $35 and the workbook comes down permanently.`)}
    ${btn('Get The Hidden Laws of Money — $26', PAYHIP_URL)}
    ${p(`This closes ${CART_CLOSE}. Real deadline.`)}
    ${p('<em style="color:#5a5648;">PS: The workbook alone took longer to build than the book. If something clicked this week, this is the complete system.</em>')}
  `;
  return emailWrap("The Hidden Laws of Money — it's open", body, firstName);
}

// ─── OBJECTION CRUSHER ────────────────────────────────
function objectionHtml(firstName) {
  const body = `
    ${p(`Hi ${firstName},`)}
    ${p('Got a version of this question a few times since this morning so I want to answer it directly.')}
    ${p('The Hidden Laws of Money is not a book for people who have never thought about money. It is a book for people who have thought about it seriously, done most of what they were supposed to do, and still feel like something is operating beneath the surface that the standard advice never addresses.')}
    ${p('If you already know what a Roth IRA is, this book is for you. If you have already read a personal finance book or two, this book is for you. If you have tried budgeting apps and savings challenges and still find yourself arriving at the same place, this book is specifically for you.')}
    ${p('The laws in this book do not operate at the level of tactics. They operate at the level of structure. The identity ceiling that pulls your balance back toward familiar territory. The velocity problem that compounds regardless of income level. The scarcity tax that quietly consumes the resources needed to escape it.')}
    ${p('None of those are addressed by knowing how index funds work.')}
    ${btn('Get The Hidden Laws of Money — $26', PAYHIP_URL)}
    ${p(`Closes ${CART_CLOSE}.`)}
  `;
  return emailWrap('Does this work if you already know the basics?', body, firstName);
}

// ─── STORY EMAIL ──────────────────────────────────────
function storyHtml(firstName) {
  const body = `
    ${p(`Hi ${firstName},`)}
    ${p('A reader I will call David earned a significant raise three years in a row. Each time, within about six months, his financial anxiety returned to roughly the same level it had been before the raise arrived.')}
    ${p('He tracked his spending. He was not reckless. The money was going to reasonable things &mdash; a better apartment, a newer car, dining out slightly more often. Each decision felt earned and defensible in isolation.')}
    ${p('What David did not see was that his spending was not the problem. His identity was the problem. His internal sense of what was normal for someone like him expanded in exact proportion to his income, every time, like a balloon that will not hold its shape unless something changes at the structural level.')}
    ${quote('&ldquo;The most expensive moment in any financial journey is the one right before something was about to change.&rdquo;')}
    ${p('The Identity Law calls this the ceiling that follows you. It does not care how much you earn. It recalibrates to whatever level feels familiar. And no amount of budgeting discipline addresses a ceiling that moves with you.')}
    ${p('David read Chapter 2 and recognized the pattern for the first time. Not as a criticism of his choices but as a structural explanation for why effort alone was not producing the compound results he was working toward.')}
    ${p('Seeing it clearly was the first time he had language for something he had felt for years without being able to name.')}
    ${btn('Get The Hidden Laws of Money — $26', PAYHIP_URL)}
    ${p(`Door is open until ${CART_CLOSE}.`)}
  `;
  return emailWrap('The treadmill that had nothing to do with spending', body, firstName);
}

// ─── URGENCY ──────────────────────────────────────────
function urgencyHtml(firstName) {
  const body = `
    ${p(`Hi ${firstName},`)}
    ${p('Brief and direct.')}
    ${p(`The Hidden Laws of Money closes ${CART_CLOSE}. After that the price moves to $35 and the companion workbook comes down permanently.`)}
    ${p('<strong style="color:#f0e8d8;">What you get before the deadline:</strong>')}
    ${p('The complete ten-law framework for seeing the financial rules that have been operating in your life without your awareness. Plus the 36-page companion workbook with reflection questions and 72-hour action steps for every single law.')}
    ${p('All of it for <strong style="color:#f0e8d8;">$26</strong>.')}
    ${p('After the deadline: $35, no workbook, no exceptions.')}
    ${btn(`Get Everything Before ${CART_CLOSE} — $26`, PAYHIP_URL)}
    ${p('The deadline is real. I am not extending it.')}
  `;
  return emailWrap(`Closes ${CART_CLOSE} — what disappears after`, body, firstName);
}

// ─── CLOSE ────────────────────────────────────────────
function closeHtml(firstName) {
  const body = `
    ${p(`Hi ${firstName},`)}
    ${p('Last one. Not sending another after this.')}
    ${p('If you have been reading since the beginning you already know whether this is for you. You know if the treadmill metaphor landed somewhere real. You know if you recognized yourself in the description of someone who has done most of the right things and still cannot seem to get ahead.')}
    ${p(`The Hidden Laws of Money &mdash; complete ten-law framework plus the 36-page companion workbook &mdash; closes tonight at midnight. $26 until then. $35 after that with no workbook.`)}
    ${p('You can keep following the advice that operates above the level where most financial outcomes are actually determined. Or you can spend $26 tonight and finally see the full board.')}
    ${btn('This Is the Last Chance — Get It Before Midnight', PAYHIP_URL)}
    ${p('<em style="color:#5a5648;">PS: Thirty-day guarantee fully in place. Read the first three chapters. If the laws do not feel true and specific to your actual financial life, one email gets you a full refund. The only real risk is missing tonight.</em>')}
  `;
  return emailWrap('Closing tonight — last email', body, firstName);
}

module.exports = { addSubscriber, runScheduler };
