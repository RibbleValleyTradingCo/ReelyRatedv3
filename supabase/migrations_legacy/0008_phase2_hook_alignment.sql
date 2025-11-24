-- Phase 2 hook alignment: normalized catch/session fields and leaderboard view

-- Add normalized metadata columns to catches
ALTER TABLE public.catches
    ADD COLUMN IF NOT EXISTS location_label TEXT;

ALTER TABLE public.catches
    ADD COLUMN IF NOT EXISTS species_slug TEXT;

ALTER TABLE public.catches
    ADD COLUMN IF NOT EXISTS custom_species TEXT;

ALTER TABLE public.catches
    ADD COLUMN IF NOT EXISTS water_type_code TEXT;

ALTER TABLE public.catches
    ADD COLUMN IF NOT EXISTS method_tag TEXT;

-- Manual venue label for sessions
ALTER TABLE public.sessions
    ADD COLUMN IF NOT EXISTS venue_name_manual TEXT;

-- Leaderboard view rebuild
DROP VIEW IF EXISTS public.leaderboard_scores_detailed;

CREATE VIEW public.leaderboard_scores_detailed AS
SELECT
    c.id,
    c.user_id,
    p.username AS owner_username,
    c.title,
    c.species_slug,
    c.weight,
    c.weight_unit,
    c.length,
    c.length_unit,
    c.image_url,
    COALESCE(AVG(r.rating), 0)::numeric AS avg_rating,
    COUNT(r.id)::integer AS rating_count,
    (COALESCE(AVG(r.rating), 0)::numeric * 10 + COALESCE(c.weight, 0)::numeric) AS total_score,
    c.created_at,
    COALESCE(c.location_label, c.location) AS location_label,
    c.method_tag,
    c.water_type_code,
    c.description,
    c.gallery_photos,
    c.tags,
    c.video_url,
    c.conditions,
    c.caught_at
FROM public.catches c
LEFT JOIN public.profiles p ON p.id = c.user_id
LEFT JOIN public.ratings r ON r.catch_id = c.id
WHERE c.deleted_at IS NULL
    AND c.visibility = 'public'
GROUP BY
    c.id,
    c.user_id,
    p.username,
    c.title,
    c.species_slug,
    c.weight,
    c.weight_unit,
    c.length,
    c.length_unit,
    c.image_url,
    c.created_at,
    c.location_label,
    c.location,
    c.method_tag,
    c.water_type_code,
    c.description,
    c.gallery_photos,
    c.tags,
    c.video_url,
    c.conditions,
    c.caught_at;

GRANT SELECT ON public.leaderboard_scores_detailed TO anon, authenticated;

-- Summary: add normalized catch/session columns & rebuild leaderboard view for hooks
