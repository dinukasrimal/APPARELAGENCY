-- Allow superusers to delete daily-activity records (and their child rows) from
-- the Daily Activity Log. customers / sales_orders / invoices / deliveries already
-- grant superuser delete; these add the missing ones.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'non_productive_visits','time_tracking','invoice_items',
    'collections','collection_allocations','collection_cheques'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'superuser_delete_'||tbl, tbl);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.get_user_role(auth.uid()) = ''superuser''::public.user_role)',
      'superuser_delete_'||tbl, tbl
    );
  end loop;
end $$;
