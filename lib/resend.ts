import { Resend } from 'resend';

export const resend = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'get_free_from_resend.com'
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendAlertEmail(to: string, subject: string, alertDetails: {
  ticker: string;
  condition: string;
  targetPrice: number;
  currentPrice: number;
}) {
  if (!resend) {
    console.warn('[Resend] RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'GOD\'s Vision <alerts@resend.dev>',
      to,
      subject,
      html: `
        <div style="font-family: 'Courier New', monospace; background: #000; color: #c8e6c9; padding: 24px; border-radius: 8px;">
          <div style="color: #ff6d00; font-size: 18px; font-weight: bold; margin-bottom: 16px;">
            ⚡ GOD's VISION ALERT
          </div>
          <div style="background: #050a05; border: 1px solid #1b2e1b; border-radius: 4px; padding: 16px;">
            <div style="font-size: 14px; color: #607d8b; margin-bottom: 4px;">TICKER</div>
            <div style="font-size: 24px; font-weight: bold; color: #ff6d00; margin-bottom: 12px;">${alertDetails.ticker}</div>
            <div style="font-size: 13px; color: #c8e6c9; line-height: 1.6;">
              Your alert condition <strong>${alertDetails.condition} $${alertDetails.targetPrice}</strong> was triggered.<br/>
              Current price: <strong style="color: #00e676;">$${alertDetails.currentPrice}</strong>
            </div>
          </div>
          <div style="margin-top: 16px; font-size: 11px; color: #607d8b;">
            View live data at your GOD's Vision terminal.
          </div>
        </div>
      `,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
