create or replace function public.claim_pending_letter_reply_notifications(p_limit integer default 50)
returns table (id uuid, letter_id uuid, recipient_email text, sender_name text)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.letter_replies as r
  set email_status = 'not_needed', email_error = null
  from public.letters as l
  where r.letter_id = l.id
    and r.email_status = 'pending'
    and (l.sender_email is null or r.sender_id = l.sender_id);

  return query
  with due as (
    select r.id, r.letter_id, l.sender_email, r.sender_name
    from public.letter_replies as r
    join public.letters as l on l.id = r.letter_id
    where r.email_status = 'pending'
      and l.sender_email is not null
      and r.sender_id <> l.sender_id
    order by r.created_at
    limit least(greatest(coalesce(p_limit, 50), 1), 50)
    for update of r skip locked
  )
  update public.letter_replies as r
  set email_status = 'sending', email_error = null
  from due
  where r.id = due.id
  returning r.id, r.letter_id, due.sender_email, due.sender_name;
end;
$function$;

revoke all on function public.claim_pending_letter_reply_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_pending_letter_reply_notifications(integer) to service_role;