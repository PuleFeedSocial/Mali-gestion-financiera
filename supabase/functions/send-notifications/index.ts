// Supabase Edge Function: send-notifications
// Scheduled via Supabase cron (every 30 min recommended)
// Deploy: supabase functions deploy send-notifications --no-verify-jwt
//
// Requires secrets:
//   VAPID_PUBLIC_KEY  - VAPID public key (generate with: npx web-push generate-vapid-keys)
//   VAPID_PRIVATE_KEY - VAPID private key
//   VAPID_EMAIL       - contact email for push service

import { serve } from 'https://deno.land/std@0.170.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import webpush from 'npm:web-push@3.6.7'

interface PushSubscription {
  id: number
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface NotificationPref {
  notification_type: string
  enabled: boolean
}

interface Task {
  id: number
  description: string
  date: string
  status: string
}

interface Debt {
  id: number
  name: string
  installments_paid: number
  installments: number
  next_due_date: string
}

interface Habit {
  id: number
  name: string
  icon: string
}

serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') || ''
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') || ''
  const vapidEmail = Deno.env.get('VAPID_EMAIL') || ''

  if (!vapidPublic || !vapidPrivate) {
    console.error('VAPID keys not configured')
    return new Response('VAPID keys missing', { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublic, vapidPrivate)

  // Get all subscriptions with their user profiles
  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')

  if (subErr || !subs) {
    console.error('Error fetching subscriptions:', subErr)
    return new Response('OK')
  }

  const today = new Date().toISOString().split('T')[0]

  for (const sub of subs) {
    const notifications: Array<{ title: string; body: string; url: string }> = []

    // Get user notification preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('notification_type, enabled')
      .eq('user_id', sub.user_id)

    const prefMap: Record<string, boolean> = {}
    if (prefs) {
      for (const p of prefs) prefMap[p.notification_type] = p.enabled
    }

    // 1. TASK REMINDER: tasks due today that are not completed
    if (prefMap['task_reminder'] !== false) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, description, status')
        .eq('user_id', sub.user_id)
        .eq('date', today)
        .neq('status', 'realizado')
        .limit(5)

      if (tasks && tasks.length > 0) {
        const pending = tasks.filter(t => t.status !== 'realizado')
        if (pending.length > 0) {
          notifications.push({
            title: `📋 ${pending.length} tarea(s) pendiente(s)`,
            body: pending.slice(0, 3).map(t => t.description).join(', ') + (pending.length > 3 ? '...' : ''),
            url: '/pages/tareas.html'
          })
        }
      }
    }

    // 2. DEBT REMINDER: debts with pending installments
    if (prefMap['debt_reminder'] !== false) {
      const { data: debts } = await supabase
        .from('debts')
        .select('name, installments_paid, installments, total_amount')
        .eq('user_id', sub.user_id)
        .eq('status', 'active')
        .limit(20)

      if (debts) {
        const pending = debts.filter(d => (d.installments_paid || 0) < d.installments)
        if (pending.length > 0) {
          notifications.push({
            title: `💳 ${pending.length} deuda(s) por pagar`,
            body: pending.slice(0, 3).map(d => d.name).join(', ') + (pending.length > 3 ? '...' : ''),
            url: '/pages/deudas.html'
          })
        }
      }
    }

    // 3. HABIT REMINDER: habits not logged today
    if (prefMap['habit_reminder'] !== false) {
      const { data: habits } = await supabase
        .from('habits')
        .select('id, name, icon')
        .eq('user_id', sub.user_id)

      if (habits && habits.length > 0) {
        const habitIds = habits.map(h => h.id)
        const { data: logs } = await supabase
          .from('habit_logs')
          .select('habit_id')
          .in('habit_id', habitIds)
          .eq('date', today)
          .eq('done', true)

        const doneIds = new Set((logs || []).map(l => l.habit_id))
        const pending = habits.filter(h => !doneIds.has(h.id))

        if (pending.length > 0) {
          notifications.push({
            title: `🔥 ${pending.length} hábito(s) sin marcar`,
            body: pending.slice(0, 3).map(h => `${h.icon || '✅'} ${h.name}`).join(', ') + (pending.length > 3 ? '...' : ''),
            url: '/pages/habitos.html'
          })
        }
      }
    }

    // Send all notifications for this user
    for (const notif of notifications) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        }, JSON.stringify(notif))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('410') || msg.includes('gone') || msg.includes('unsubscribed')) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }
  }

  return new Response('OK')
})
