alter table public.operations
  add column if not exists "inOverrideQtyGrams" numeric(18,6);
