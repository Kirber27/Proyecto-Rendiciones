-- Rediseño de Rendir gastos (spec 02, tarea 2.10): se elimina la lectura de fotos con IA por su costo.
-- La tabla de uso de la Edge Function `leer-rendicion` ya no se escribe ni se lee. Sus políticas e índice
-- se van con ella.

drop table if exists public.lecturas_ia;
