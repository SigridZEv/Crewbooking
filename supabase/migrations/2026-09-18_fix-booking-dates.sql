-- ============================================================
-- ENGANGSFIKS: flytt alle eksisterende bookinger én dag frem
-- ============================================================
-- Bakgrunn: Frem til 18.09.2026 lagret appen datoer via toISOString(),
-- som regner om til UTC. Siden Norge ligger foran UTC ble «mandag 21.»
-- lagret som 2026-09-20 i databasen. Appen viste det riktig for admin
-- (samme feil begge veier), men datoen i databasen var én dag for tidlig.
--
-- Koden er nå rettet. For at gamle bookinger skal vises på riktig dag
-- må de flyttes én dag frem — ÉN gang.
--
-- ⚠️  KJØR DENNE KUN ÉN GANG, og KUN etter at den nye koden er publisert.
--     Kjører du den to ganger flyttes alt to dager.
--
-- Slik gjør du det:
--   1. Publiser ny versjon av appen (Vercel) — vent til den er live.
--   2. Kjør sjekken under (uten å endre noe) og se at antallet ser riktig ut.
--   3. Kjør selve UPDATE-setningen.
-- ============================================================

-- Steg 2 — bare se: hvor mange bookinger finnes, og hvilken periode?
select count(*) as antall, min(date) as forste, max(date) as siste from bookings;

-- Steg 3 — selve fiksen (fjern «--» foran linjen for å kjøre den):
-- update bookings set date = date + 1;
