import { supabase } from '../../lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      email, name, profile, skills, experience, education,
      role, location, linkedin, preferences,
      alertTime, alertCount, includeResume
    } = body;

    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Valid email required' }, { status: 400 });
    }

    // Upsert: update if email exists, insert if new
    const { data, error } = await supabase
      .from('subscribers')
      .upsert({
        email: email.toLowerCase().trim(),
        name: name || '',
        profile: profile || '',
        skills: skills || '',
        experience: experience || '',
        education: education || '',
        role: role || '',
        location: location || '',
        linkedin: linkedin || '',
        preferences: preferences || [],
        alert_time: alertTime || '08:00',
        alert_count: parseInt(alertCount) || 10,
        include_resume: includeResume || 'yes',
        active: true,
      }, { onConflict: 'email' })
      .select();

    if (error) throw error;

    return Response.json({ success: true, message: 'Subscribed successfully!' });
  } catch (error) {
    console.error('Subscribe error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Unsubscribe via GET
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  if (!email) return Response.json({ error: 'Email required' }, { status: 400 });

  const { error } = await supabase
    .from('subscribers')
    .update({ active: false })
    .eq('email', email.toLowerCase());

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return new Response('<html><body style="font-family:sans-serif;text-align:center;padding:60px;"><h2>Unsubscribed ✓</h2><p>You\'ve been removed from JobTAi daily alerts.</p><a href="/">Back to JobTAi</a></body></html>', { headers: { 'Content-Type': 'text/html' } });
}
