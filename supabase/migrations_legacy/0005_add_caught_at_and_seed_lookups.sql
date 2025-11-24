-- Align catches table with frontend expectations
ALTER TABLE public.catches
    ADD COLUMN IF NOT EXISTS caught_at DATE;

-- Seed canonical water types
INSERT INTO public.water_types (code, label, group_name)
VALUES
    ('river', 'River', 'freshwater'),
    ('lake', 'Lake', 'freshwater'),
    ('reservoir', 'Reservoir', 'freshwater'),
    ('canal', 'Canal', 'freshwater'),
    ('pond', 'Pond', 'stillwater'),
    ('loch', 'Loch', 'freshwater'),
    ('gravel_pit', 'Gravel Pit', 'stillwater'),
    ('commercial', 'Commercial Fishery', 'managed'),
    ('club', 'Club Water', 'managed'),
    ('syndicate', 'Syndicate Water', 'managed'),
    ('park_lake', 'Park Lake', 'urban'),
    ('estuary', 'Estuary', 'brackish')
ON CONFLICT (code) DO NOTHING;

-- Seed canonical baits
INSERT INTO public.baits (slug, label, category)
VALUES
    ('boilies', 'Boilies', 'boilie'),
    ('pop_up_boilies', 'Pop-up Boilies', 'boilie'),
    ('wafters', 'Wafters', 'boilie'),
    ('sweetcorn', 'Sweetcorn', 'particle'),
    ('maize', 'Maize', 'particle'),
    ('tiger_nuts', 'Tiger Nuts', 'particle'),
    ('pellets', 'Pellets', 'pellet'),
    ('halibut_pellets', 'Halibut Pellets', 'pellet'),
    ('groundbait', 'Groundbait', 'groundbait'),
    ('method_mix', 'Method Mix', 'groundbait'),
    ('bread', 'Bread', 'surface'),
    ('luncheon_meat', 'Luncheon Meat', 'meat'),
    ('maggots', 'Maggots', 'natural'),
    ('casters', 'Casters', 'natural'),
    ('worms', 'Worms', 'natural'),
    ('deadbait_roach', 'Deadbait Roach', 'predator'),
    ('sardine', 'Sardine Deadbait', 'predator'),
    ('spinner', 'Spinner', 'lure'),
    ('fly', 'Fly', 'fly'),
    ('floater_hookbait', 'Floater Hookbait', 'surface')
ON CONFLICT (slug) DO NOTHING;

-- Seed fishing method tags (category = 'method')
INSERT INTO public.tags (slug, label, category, method_group)
VALUES
    ('float_fishing', 'Float Fishing', 'method', 'float'),
    ('pole_fishing', 'Pole Fishing', 'method', 'float'),
    ('waggler', 'Waggler Fishing', 'method', 'float'),
    ('method_feeder', 'Method Feeder', 'method', 'feeder'),
    ('feeder_fishing', 'Feeder Fishing', 'method', 'feeder'),
    ('legering', 'Legering', 'method', 'bottom'),
    ('zig_rig', 'Zig Rig', 'method', 'carp_specialist'),
    ('surface_fishing', 'Surface Fishing', 'method', 'surface'),
    ('stalking', 'Stalking', 'method', 'mobile'),
    ('lure_fishing', 'Lure Fishing', 'method', 'predator'),
    ('drop_shot', 'Drop Shot', 'method', 'predator'),
    ('fly_fishing', 'Fly Fishing', 'method', 'fly'),
    ('spod_marker', 'Spod & Marker', 'method', 'carp_specialist'),
    ('margin_fishing', 'Margin Fishing', 'method', 'coarse'),
    ('trotting', 'Trotting', 'method', 'river'),
    ('deadbaiting', 'Deadbaiting', 'method', 'predator')
ON CONFLICT (slug) DO NOTHING;
