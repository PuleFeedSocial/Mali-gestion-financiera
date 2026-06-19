-- =============================================
-- Push Notifications & Notification Preferences
-- =============================================

-- 1. Push subscriptions (stores browser push endpoints)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own push subs"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- 2. Notification preferences (per user, per type)
CREATE TABLE IF NOT EXISTS notification_preferences (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'task_reminder',
    'debt_reminder',
    'habit_reminder',
    'calendar_event',
    'group_invite'
  )),
  enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, notification_type)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own notif prefs"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id);

-- Insert default preferences for existing users
INSERT INTO notification_preferences (user_id, notification_type, enabled)
  SELECT id, 'task_reminder', true FROM profiles
  ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (user_id, notification_type, enabled)
  SELECT id, 'debt_reminder', true FROM profiles
  ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (user_id, notification_type, enabled)
  SELECT id, 'habit_reminder', true FROM profiles
  ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (user_id, notification_type, enabled)
  SELECT id, 'calendar_event', true FROM profiles
  ON CONFLICT DO NOTHING;

INSERT INTO notification_preferences (user_id, notification_type, enabled)
  SELECT id, 'group_invite', true FROM profiles
  ON CONFLICT DO NOTHING;

-- 3. App settings (stores public VAPID key and other global config)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read app_settings"
  ON app_settings FOR SELECT
  USING (true);

-- Insert default VAPID public key placeholder (replace with actual key)
INSERT INTO app_settings (key, value) VALUES ('vapid_public_key', '')
  ON CONFLICT (key) DO NOTHING;
