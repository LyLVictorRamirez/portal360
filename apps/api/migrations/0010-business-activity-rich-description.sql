alter table "business"."activity"
  drop constraint "activity_description_length_check";

alter table "business"."activity"
  alter column "description" type jsonb using case
    when "description" is null or btrim("description") = '' then null
    else jsonb_build_object(
      'type', 'doc',
      'content', jsonb_build_array(
        jsonb_build_object(
          'type', 'paragraph',
          'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', "description"))
        )
      )
    )
  end;

alter table "business"."activity"
  add constraint "activity_description_document_check" check (
    "description" is null or jsonb_typeof("description") = 'object'
  );
