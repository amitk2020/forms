import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, date, time } = req.body;

  if (!name || !email || !date || !time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Save to Supabase
  const { error: dbError } = await supabase
    .from('reservations')
    .insert([{ name, email, date, time }]);

  if (dbError) {
    console.error(dbError);
    return res.status(500).json({ error: 'Database error' });
  }

  try {
    // Email to customer
    await resend.emails.send({
      from: 'Coffee Shop <no-reply@yourdomain.com>',
      to: email,
      subject: 'Reservation Confirmation',
      html: `<p>Hi ${escapeHtml(name)},</p>
             <p>Your reservation for ${escapeHtml(date)} at ${escapeHtml(time)} is confirmed!</p>
             <p>We look forward to seeing you ☕</p>`,
    });

    // Email to owner
    await resend.emails.send({
      from: 'Coffee Shop <no-reply@yourdomain.com>',
      to: process.env.OWNER_EMAIL,
      subject: 'New Reservation',
      html: `<p>${escapeHtml(name)} booked for ${escapeHtml(date)} at ${escapeHtml(time)}.</p>
             <p>Email: ${escapeHtml(email)}</p>`,
    });
  } catch (emailError) {
    console.error('Email send error:', emailError);
    return res.status(500).json({ error: 'Failed to send emails' });
  }

  return res.status(200).json({ success: true });
};