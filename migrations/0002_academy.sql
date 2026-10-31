-- Academy platform: groups, people profiles, exams, attendance, marks.

create table if not exists groups (
  id text primary key,
  name text not null,
  sort_order int not null
);

create table if not exists periods (
  id text primary key,
  name text not null,
  sort_order int not null,
  locked boolean not null default false
);

create table if not exists counters (
  id text primary key,
  n int not null
);

create table if not exists profiles (
  user_id text primary key references "user" (id) on delete cascade,
  role text not null check (role in ('admin', 'teacher', 'student', 'pending')),
  username text unique,
  group_id text references groups (id) on delete set null,
  teacher_id text,
  issued_password text,
  synthetic boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists exams (
  id text primary key,
  title text not null,
  group_id text not null references groups (id) on delete cascade,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists questions (
  id text primary key,
  exam_id text not null references exams (id) on delete cascade,
  position int not null,
  prompt text not null,
  options jsonb not null,
  answer int not null check (answer >= 0 and answer <= 3)
);

create table if not exists results (
  exam_id text not null references exams (id) on delete cascade,
  user_id text not null references "user" (id) on delete cascade,
  score int not null,
  total int not null,
  answers jsonb not null,
  submitted_at timestamptz not null default now(),
  primary key (exam_id, user_id)
);

create table if not exists attendance (
  day date not null,
  user_id text not null references "user" (id) on delete cascade,
  status text not null check (status in ('p', 'a')),
  marked_by text not null,
  primary key (day, user_id)
);

create table if not exists marks (
  period_id text not null references periods (id) on delete cascade,
  user_id text not null references "user" (id) on delete cascade,
  key text not null,
  value double precision not null,
  primary key (period_id, user_id, key)
);

create index if not exists profiles_role_idx on profiles (role);
create index if not exists profiles_teacher_idx on profiles (teacher_id);
create index if not exists exams_group_idx on exams (group_id);
create index if not exists questions_exam_idx on questions (exam_id);
create index if not exists attendance_day_idx on attendance (day);

insert into groups (id, name, sort_order) values
  ('hk1', 'هاوس كيبنج - الصف الأول', 1),
  ('hk2', 'هاوس كيبنج - الصف الثاني', 2),
  ('hk3', 'هاوس كيبنج - الصف الثالث', 3),
  ('fb1', 'Food and Beverage - الصف الأول', 4),
  ('fb2', 'Food and Beverage - الصف الثاني', 5),
  ('fb3', 'Food and Beverage - الصف الثالث', 6)
on conflict (id) do nothing;

insert into periods (id, name, sort_order, locked) values
  ('oct', 'أكتوبر', 1, true),
  ('nov', 'نوفمبر', 2, true),
  ('dec', 'ديسمبر', 3, true)
on conflict (id) do nothing;

insert into counters (id, n) values ('student', 0)
on conflict (id) do nothing;
