-- Extends the activity_event_type enum created in V15, previously extended in V18, V20, V21, V23,
-- V25, V30, V34, V40 and V43.
--
-- On its own, as every enum extension here is: Postgres refuses to use an enum value inside the
-- transaction that added it, and Flyway wraps each migration in one transaction.
--
-- One event per import rather than one per member. A fifty row file would otherwise push fifty
-- near-identical rows into the activity feed and bury everything else in it; each member still
-- gets their own MEMBER_INVITED entry from MemberService.create.
ALTER TYPE activity_event_type ADD VALUE IF NOT EXISTS 'MEMBERS_IMPORTED';
