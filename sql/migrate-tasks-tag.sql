-- Agregar columna tag a la tabla tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tag TEXT DEFAULT 'personal' CHECK (tag IN ('academic', 'freelance', 'personal'));
