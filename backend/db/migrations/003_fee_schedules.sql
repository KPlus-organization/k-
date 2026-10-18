-- Fee calculator data, synced from content/fees/*.yaml by `npm run db:seed`.
-- One row per schedule (file); parameters and fees are stored as JSON as loaded
-- and checked by src/content/loadFees.ts.

CREATE TABLE fee_schedules (
  id             text PRIMARY KEY,
  title          text NOT NULL,
  basis          text NOT NULL,
  effective_from date NOT NULL,
  reference      text NOT NULL,
  reviewed_by    text,
  note           text,
  parameters     jsonb NOT NULL,
  fees           jsonb NOT NULL,
  sort_order     integer NOT NULL,
  is_published   boolean NOT NULL DEFAULT true,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
