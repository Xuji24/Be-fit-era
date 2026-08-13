-- RAG knowledge base for the AI coach chat. Embeddings are populated by
-- scripts/seed-coach-knowledge.mjs after this migration runs (SQL can't call
-- an embeddings API), so `embedding` starts NULL on every seeded row.
-- 768 dimensions matches lib/ai/embeddings.ts's requested output (Gemini
-- gemini-embedding-001, Matryoshka-truncated via dimensions:768) — if the
-- embedding provider or dimension ever changes, this column must be
-- recreated to match.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.coach_knowledge_articles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  category   TEXT NOT NULL CHECK (category IN ('training', 'nutrition', 'recovery', 'injury_prevention', 'mindset')),
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  embedding  extensions.vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.coach_knowledge_articles IS
  'Shared reference content for coach chat retrieval (RAG). Not user data — readable by every authenticated user, writable only by the service role via scripts/seed-coach-knowledge.mjs.';

ALTER TABLE public.coach_knowledge_articles ENABLE ROW LEVEL SECURITY;

-- Reference content, not user data — every authenticated user can read it.
-- No INSERT/UPDATE/DELETE policy for authenticated/anon: writes only happen
-- through the service-role seed script, same lockdown as coach_usage.
CREATE POLICY "authenticated_read_coach_knowledge"
  ON public.coach_knowledge_articles FOR SELECT
  TO authenticated
  USING (true);

-- No ANN index (ivfflat) — the corpus is ~20 rows; a full scan with
-- in-process cosine similarity (lib/coach/knowledge.ts) is simpler and fast
-- enough at this size. Revisit if the library grows into the hundreds.

INSERT INTO public.coach_knowledge_articles (slug, category, title, content) VALUES
('progressive-overload-basics', 'training', 'Progressive overload, the simple version',
 'Your body only gets stronger when you ask it to do slightly more than last time. That does not mean adding weight every single session — it can mean one more rep, one more set, a slower controlled lower, or a shorter rest between sets. Pick one variable to nudge up at a time so you can tell what actually worked. If a session feels harder than last week for no clear reason, that is your body asking for a lighter day, not a signal to push through at all costs.'),
('warm-up-why-it-matters', 'training', 'Why warm-ups matter more than people think',
 'A good warm-up is not just "getting loose" — it raises your muscle temperature, wakes up the nervous system pathways you are about to use, and rehearses the movement pattern at low intensity before you load it. Five minutes of light cardio followed by two or three warm-up sets of your first exercise, well under your working weight, prepares the exact tissues you are about to stress. Skipping it does not save time so much as move the risk from the warm-up to the first working set.'),
('rest-days-not-wasted', 'training', 'Rest days are not wasted days',
 'Training breaks muscle down; rest is when it actually rebuilds stronger. Skipping rest days in the name of consistency usually backfires — performance stalls, motivation drops, and small aches start turning into real ones. A rest day does not have to mean total stillness: a walk, light stretching, or an easy swim keeps blood moving without adding training stress. The plan schedules rest deliberately, not as an afterthought.'),
('understanding-rpe', 'training', 'Reading your own effort: RPE in plain language',
 'RPE (rate of perceived exertion) is just a 1-to-10 scale for how hard a set felt. A 10 means you could not have done one more rep. An 8 means you had about two reps left in the tank. Most productive training sits around 6 to 8 — hard enough to drive progress, not so hard every session leaves you wrecked. Checking in with this number after a set is more useful than staring at the weight on the bar, because it accounts for how you are actually feeling that day.'),
('deload-weeks-explained', 'training', 'Deload weeks: taking your foot off the gas on purpose',
 'A deload is a planned lighter week — less weight, fewer sets, or both — taken before fatigue forces it on you. It sounds counterproductive, but accumulated fatigue from weeks of hard training can quietly erode form and recovery even while the numbers on paper still look fine. A deload every four to six weeks lets joints and connective tissue catch up to the muscle gains, and most people come out the other side lifting better than before, not worse.'),
('beginner-form-cues', 'training', 'Beginner form cues that actually help',
 'Most beginner mistakes are not about strength, they are about awareness — knees caving in on a squat, back rounding on a deadlift-pattern movement, or rushing through the range of motion. Slowing the movement down on purpose, especially the lowering phase, gives you time to notice and correct these before they become habits. Filming yourself from the side for one set is more useful feedback than a dozen articles, because it shows exactly what your body is doing, not what it feels like it is doing.'),
('calorie-deficit-basics', 'nutrition', 'Calorie deficits without the guesswork',
 'Losing fat comes down to eating somewhat less energy than you burn, sustained over weeks. A deficit that is too aggressive is hard to stick to and tends to cost muscle along with fat, while a very small deficit is easier to follow but slower to show results. A moderate, steady deficit you can actually maintain for months will beat an extreme one you abandon after two weeks, every time. Your plan''s daily calorie target is built around this — trust the number over instinct in the first few weeks while you calibrate.'),
('protein-timing', 'nutrition', 'Protein timing: does it really matter?',
 'Total protein across the day matters far more than exactly when you eat it. Spreading protein across three or four meals rather than loading it all into one makes it easier to actually hit your daily target and keeps you fuller throughout the day, but there is no magic 30-minute post-workout window you need to sprint to catch. If a meal in your plan is light on protein, add a simple source like eggs, tofu, chicken, or fish rather than skipping it.'),
('hydration-basics', 'nutrition', 'Hydration basics for active days',
 'Even mild dehydration can make workouts feel harder than they are and slow recovery afterward. A simple check: if your urine is pale yellow, you are generally in a good range; noticeably dark means it is time to drink more. On training days, sipping water steadily through the day works better than trying to chug a large amount right before a session. Hot, humid conditions and longer sessions both raise how much you need — thirst is a lagging signal, not an early one.'),
('budget-filipino-staples', 'nutrition', 'Budget-friendly Filipino staples for muscle and energy',
 'You do not need imported protein powders to hit your targets on a tight budget. Eggs, chicken thigh, canned tuna or sardines, tofu, and mung beans (monggo) are all inexpensive, widely available protein sources. Rice remains a solid, cheap energy source to build meals around, and seasonal local vegetables cost far less than out-of-season imports while covering the same micronutrient needs. Buying proteins in bulk and prepping them in one batch for the week keeps both cost and daily effort down.'),
('reading-food-labels', 'nutrition', 'Reading a food label in 30 seconds',
 'Start with the serving size — many packages contain more than one serving, which changes every other number on the label. Then check calories, followed by protein, carbs, and fat grams for that serving. Ingredient lists are ordered by quantity, so the first two or three ingredients make up most of the product. You do not need to analyze every item you eat this closely, but for packaged foods that make up a regular part of your diet, thirty seconds here saves a lot of guessing later.'),
('meal-prep-basics', 'nutrition', 'Meal prep without a fancy kitchen',
 'Meal prep does not require a food processor or a week of free time — it just means doing the repetitive parts once instead of every day. Cooking a big batch of rice and a protein source on one or two days, then combining them with different quick vegetables through the week, covers most of your meals with far less daily effort. A rice cooker and a couple of containers are genuinely enough equipment to start; the goal is removing decision fatigue on busy days, not building a system for its own sake.'),
('sore-vs-injury', 'recovery', 'Sore muscles vs. injury: telling the difference',
 'Normal muscle soreness (DOMS) usually shows up 12 to 48 hours after a new or harder-than-usual session, feels dull and spread across a muscle, and eases within a few days as you move around. Injury pain tends to be sharper, more localized to a joint or a specific point, often starts during the activity rather than after, and does not improve — sometimes gets worse — with gentle movement. If something feels sharp, one-sided, or is affecting how you walk or move normally, that is a signal to back off and, if it persists, get it checked rather than push through it.'),
('sleep-is-part-of-training', 'recovery', 'Sleep is part of the training plan',
 'Muscle repair, hormone regulation, and the mental energy to actually follow your plan all lean heavily on sleep. Consistently getting under six hours tends to blunt strength gains and fat loss progress even when the diet and training are otherwise on point. You do not need a perfect eight hours every night, but a consistent sleep and wake time, and treating a bad sleep streak as seriously as a bad diet streak, pays off in the numbers over time.'),
('active-recovery', 'recovery', 'Active recovery: moving on your rest days',
 'Active recovery means light movement on a day you are not training hard — a walk, easy cycling, swimming, or gentle stretching. It increases blood flow to tired muscles without adding meaningful training stress, which can reduce next-day stiffness compared to complete inactivity. The intensity should stay conversational — if you are breathing hard or your heart rate is climbing, that is a workout, not active recovery.'),
('overtraining-signs', 'recovery', 'Signs you might be overtraining',
 'A single hard week is not overtraining — it is a pattern that matters. Watch for performance that keeps dropping despite consistent effort, resting heart rate creeping up morning after morning, sleep that stops feeling restful, irritability, or getting sick more often than usual. Any one of these alone could be a bad week; several together, lasting more than a week or two, is your body asking for a real recovery block, not just a rest day.'),
('common-running-aches', 'injury_prevention', 'Common running aches and how to avoid them',
 'Shin splints, runner''s knee, and Achilles tightness are among the most common running complaints, and most trace back to doing too much, too soon — a sudden jump in distance or pace the tissues have not adapted to yet. Increasing weekly distance gradually, replacing worn-out shoes, and not skipping warm-ups are the highest-leverage prevention steps. Mild tightness that eases as you warm up is usually fine to monitor; pain that gets worse as you run, or that changes your stride, deserves rest and attention rather than pushing through.'),
('when-to-see-a-doctor', 'injury_prevention', 'When a niggle needs a doctor, not a workaround',
 'Most training aches settle with rest, ice, and a lighter week. It is time to see a doctor or physiotherapist instead of self-managing when pain is sharp rather than dull, when it wakes you up at night, when a joint feels unstable or swells noticeably, or when the same issue keeps coming back every time you resume training. This coach can suggest general adjustments around a known limitation, but it cannot diagnose an injury — a professional evaluation is the right next step for anything that fits the pattern above.'),
('weight-loss-plateau', 'mindset', 'What to do when your weight loss stalls',
 'Weight loss is rarely a straight line — water retention, sodium intake, hormonal cycles, and normal day-to-day variation can all hide real progress on the scale for a week or two. Before assuming a genuine plateau, look at the trend over three to four weeks rather than any single weigh-in. If the trend really has flattened, small adjustments — slightly increasing activity, tightening portion consistency, or double-checking that logged intake matches what is actually being eaten — tend to work better than a drastic overhaul.'),
('building-lasting-habits', 'mindset', 'Building a habit that survives a bad week',
 'The plans that fail are usually not the ones that had one bad day — they are the ones where a bad day turned into giving up entirely. Habits that last are built around a minimum viable version: if a full workout is not happening today, a ten-minute walk still counts as showing up. Missing one meal target or one session is data, not a verdict on the whole plan. The goal is getting back to the plan tomorrow, not achieving a perfect record.');
