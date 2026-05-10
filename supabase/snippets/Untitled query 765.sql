WITH program AS (
  SELECT id FROM public.radio_programs WHERE name = '安曇野北部ルート（テスト）'
),
content AS (
  SELECT id FROM public.contents WHERE title = '安曇野わさび農場 秋の収穫祭'
)
INSERT INTO public.radio_program_items (
  radio_program_id, content_id, lat, lng, display_name, sequence
)
SELECT program.id, content.id, 36.3006, 137.8729, '穂高駅前', 1
FROM program, content
ON CONFLICT DO NOTHING;
