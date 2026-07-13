import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'alerts@jobtai.com';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://jobtai.vercel.app';

export async function sendDailyAlertEmail({ subscriber, jobs, resumes }) {
  const { email, name, role } = subscriber;
  const displayName = name || 'there';

  const jobCards = jobs.map((j, i) => {
    const scoreColor = j.score >= 90 ? '#1a4a2e' : j.score >= 80 ? '#7a4f1a' : '#6b6860';
    const scoreBg   = j.score >= 90 ? '#e4efe8' : j.score >= 80 ? '#faeeda' : '#f0ece5';
    const resumeText = resumes?.[i] ? `
      <div style="margin-top:12px;background:#f7f5f0;border-radius:8px;padding:14px;">
        <div style="font-size:11px;font-weight:700;color:#1a4a2e;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">📄 ATS-Ready Resume Excerpt</div>
        <pre style="font-size:11px;line-height:1.7;color:#3d3b36;white-space:pre-wrap;font-family:'Courier New',monospace;margin:0;">${resumes[i].substring(0, 800)}${resumes[i].length > 800 ? '\n...' : ''}</pre>
        <a href="${SITE}" style="display:inline-block;margin-top:8px;font-size:11px;color:#1a4a2e;font-weight:600;">Open JobTAi to download full Word resume →</a>
      </div>` : '';

    return `
    <div style="background:#ffffff;border-radius:12px;border:1px solid #e5e1d8;padding:18px 20px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div style="flex:1;">
          <div style="font-size:15px;font-weight:600;color:#1a1916;">${j.title}</div>
          <div style="font-size:13px;color:#6b6860;margin-top:2px;">${j.company} · ${j.location}</div>
          <div style="font-size:12px;color:#9e9b94;margin-top:1px;">via ${j.source}${j.salary ? ' · ' + j.salary : ''}</div>
        </div>
        <span style="background:${scoreBg};color:${scoreColor};font-size:11px;font-weight:700;padding:4px 10px;border-radius:99px;white-space:nowrap;">${j.score}% match</span>
      </div>
      <div style="background:#f7f5f0;border-radius:4px;height:4px;margin:10px 0;overflow:hidden;">
        <div style="background:${scoreColor};width:${j.score}%;height:100%;border-radius:4px;"></div>
      </div>
      ${j.perks && j.perks.length ? `<div style="margin-bottom:8px;">${j.perks.map(p => `<span style="background:#faeeda;color:#633806;font-size:10px;padding:2px 7px;border-radius:99px;margin-right:4px;font-weight:500;">${p}</span>`).join('')}</div>` : ''}
      <div style="font-size:13px;color:#3d3b36;line-height:1.6;margin-bottom:14px;">${j.desc}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a href="${j.applyUrl}" style="background:#1a4a2e;color:#ffffff;font-size:13px;font-weight:600;padding:9px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Apply Now ↗</a>
        <a href="${SITE}" style="background:#f7f5f0;color:#1a1916;font-size:13px;font-weight:500;padding:9px 18px;border-radius:8px;text-decoration:none;display:inline-block;border:1px solid #e5e1d8;">Tailor resume in JobTAi →</a>
      </div>
      ${resumeText}
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f3ef;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:620px;margin:0 auto;padding:24px 16px;">

  <div style="background:#1a4a2e;border-radius:14px;padding:24px;text-align:center;margin-bottom:20px;">
    <div style="font-family:Georgia,serif;font-size:28px;font-weight:700;color:#fff;letter-spacing:-0.5px;">Job<span style="color:#c9a84c;">TA</span>i</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:6px;">Your daily job matches · ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
  </div>

  <div style="background:#fff;border-radius:12px;padding:18px 20px;margin-bottom:16px;border:1px solid #e5e1d8;">
    <p style="font-size:14px;color:#3d3b36;line-height:1.65;margin:0;">Hi ${displayName}! Here are today's top ${jobs.length} job matches for <strong>${role || 'your target role'}</strong>. Each one was scored against your full profile and ranked by fit.</p>
  </div>

  ${jobCards}

  <div style="background:#fff;border-radius:12px;padding:16px 20px;margin-bottom:16px;border:1px solid #e5e1d8;text-align:center;">
    <div style="font-size:13px;color:#6b6860;margin-bottom:10px;">Want to see all 25 matches, generate Word resumes, cover letters, and Apply Kits?</div>
    <a href="${SITE}" style="background:#1a4a2e;color:#fff;font-size:14px;font-weight:600;padding:11px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Open JobTAi →</a>
  </div>

  <div style="text-align:center;font-size:11px;color:#9e9b94;line-height:1.8;padding-top:8px;">
    You subscribed to daily job alerts on JobTAi.<br>
    <a href="${SITE}/api/unsubscribe?email=${encodeURIComponent(email)}" style="color:#9e9b94;">Unsubscribe</a>
    &nbsp;·&nbsp; <a href="${SITE}" style="color:#1a4a2e;font-weight:500;">JobTAi</a><br><br>
    <span style="font-size:10px;">JobTAi is not affiliated with LinkedIn, Indeed, Greenhouse, or Built In NYC. Always verify listings before applying. AI-generated content should be reviewed before submission.</span>
  </div>

</div>
</body>
</html>`;

  return resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your ${jobs.length} job matches for ${new Date().toLocaleDateString('en-US',{weekday:'long'})} · JobTAi`,
    html,
  });
}
