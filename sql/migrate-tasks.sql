-- Crear tabla de tareas para el módulo Organización

CREATE TABLE IF NOT EXISTS tasks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('tarea', 'evento')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'por_hacer' CHECK (status IN ('por_hacer', 'en_progreso', 'en_pausa', 'realizado')),
  tag TEXT DEFAULT 'personal' CHECK (tag IN ('academic', 'freelance', 'personal')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Política: cada usuario solo ve y modifica sus propias tareas
CREATE POLICY "Users can manage their own tasks"
  ON tasks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
