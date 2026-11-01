import { randomInt, randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";

import type { Sql } from "@/lib/db";
import { getSql } from "@/lib/db";
import {
  mailFor,
  type AttRow,
  type CreateExamInput,
  type CreateStudentsInput,
  type ExamPaper,
  type ExamQuestion,
  type ExamView,
  type Group,
  type IssuedAccount,
  type MarkKey,
  type MarkRow,
  type MarksInput,
  type AttendanceInput,
  type Period,
  type Person,
  type PersonPatch,
  type ResultView,
  type ReviewItem,
  type Role,
  type SubmitResult,
  type Workspace,
} from "@/lib/academy.types";

type Row = {
  user_id: string;
  name: string;
  email: string;
  username: string | null;
  role: Role;
  group_id: string | null;
  teacher_id: string | null;
  issued_password: string | null;
  synthetic: boolean;
};

function asOptions(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* ignore */
    }
  }
  return [];
}

function asChoices(value: unknown): number[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (JSON.parse(value) as unknown)
      : [];
  if (!Array.isArray(list)) return [];
  return list.map((n) => (n === 0 || n === 1 || n === 2 || n === 3 ? n : -1));
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function personFrom(row: Row, issuedPassword: string | null): Person {
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    username: row.username,
    role: row.role,
    groupId: row.group_id,
    teacherId: row.teacher_id,
    issuedPassword,
    synthetic: Boolean(row.synthetic),
  };
}

async function loadRow(sql: Sql, userId: string): Promise<Row | null> {
  const rows = await sql<Row>`
    select p.user_id, u.name, u.email, p.username, p.role, p.group_id, p.teacher_id,
           p.issued_password, p.synthetic
    from profiles p
    join "user" u on u.id = p.user_id
    where p.user_id = ${userId}
  `;
  return rows[0] ?? null;
}

export async function ensureProfile(userId: string): Promise<void> {
  const sql = await getSql();
  const existing = await sql`select user_id from profiles where user_id = ${userId}`;
  if (existing.length) return;
  const users = await sql`select id from "user" where id = ${userId}`;
  if (!users.length) throw new Error("المستخدم غير موجود");
  const admins = await sql`select user_id from profiles where role = 'admin' limit 1`;
  const role: Role = admins.length ? "pending" : "admin";
  await sql`
    insert into profiles (user_id, role, synthetic)
    values (${userId}, ${role}, false)
    on conflict (user_id) do nothing
  `;
}

async function mustCaller(userId: string): Promise<{ sql: Sql; row: Row }> {
  await ensureProfile(userId);
  const sql = await getSql();
  const row = await loadRow(sql, userId);
  if (!row) throw new Error("الحساب غير موجود");
  return { sql, row };
}

function failClosed(row: Row) {
  if (row.role === "pending") throw new Error("الحساب لم يُفعَّل بعد. اطلب من المدير ربطه.");
}

function canManageStudent(caller: Row, student: Row): boolean {
  if (student.role !== "student") return false;
  if (caller.role === "admin") return true;
  return caller.role === "teacher" && student.teacher_id === caller.user_id;
}

function passwordFor(caller: Row, row: Row): string | null {
  if (!row.issued_password) return null;
  if (caller.role === "admin") return row.issued_password;
  if (caller.user_id === row.user_id && caller.role !== "student") return row.issued_password;
  if (caller.role === "teacher" && row.role === "student" && row.teacher_id === caller.user_id) {
    return row.issued_password;
  }
  return null;
}

async function setCredentialPassword(sql: Sql, userId: string, password: string) {
  const hash = await hashPassword(password);
  const now = new Date().toISOString();
  const existing = await sql<{ id: string }>`
    select id from account where "userId" = ${userId} and "providerId" = 'credential'
  `;
  if (existing[0]) {
    await sql`
      update account set password = ${hash}, "updatedAt" = ${now} where id = ${existing[0].id}
    `;
    return;
  }
  await sql`
    insert into account ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
    values (${randomUUID()}, ${userId}, 'credential', ${userId}, ${hash}, ${now}, ${now})
  `;
}

async function createCredentialUser(
  sql: Sql,
  input: { name: string; email: string; password: string },
): Promise<string> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const hash = await hashPassword(input.password);
  await sql`
    insert into "user" ("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt")
    values (${id}, ${input.name}, ${input.email}, true, null, ${now}, ${now})
  `;
  await sql`
    insert into account ("id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt")
    values (${randomUUID()}, ${id}, 'credential', ${id}, ${hash}, ${now}, ${now})
  `;
  return id;
}

async function allocUsername(sql: Sql): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const rows = await sql<{ n: number }>`
      update counters set n = n + 1 where id = 'student' returning n
    `;
    const n = num(rows[0]?.n);
    const username = `s${String(n).padStart(2, "0")}`;
    const clash = await sql`select user_id from profiles where username = ${username}`;
    if (!clash.length) return username;
  }
  throw new Error("تعذر إنشاء اسم مستخدم");
}

async function assertGroup(sql: Sql, groupId: string) {
  const rows = await sql`select id from groups where id = ${groupId}`;
  if (!rows.length) throw new Error("المجموعة غير موجودة");
}

let bootstrapDone = false;
async function ensureBootstrapAdmin(): Promise<void> {
  if (bootstrapDone) return;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
  try {
    const sql = await getSql();
    const admins = await sql`select user_id from profiles where role = 'admin' limit 1`;
    if (admins.length) {
      bootstrapDone = true;
      return;
    }
    if (password.length < 8) return;
    const username = (process.env.ADMIN_BOOTSTRAP_USERNAME ?? "islam").trim().toLowerCase();
    const email = mailFor(username);
    const clash = await sql`select id from "user" where email = ${email}`;
    if (clash.length) return;
    const id = await createCredentialUser(sql, { name: "إسلام", email, password });
    await sql`
      insert into profiles (user_id, role, username, synthetic)
      values (${id}, 'admin', ${username}, true)
      on conflict (user_id) do nothing
    `;
    bootstrapDone = true;
  } catch {
    /* another instance may have created it first */
  }
}

export async function getAcademyStatus(): Promise<{ hasAdmin: boolean }> {
  await ensureBootstrapAdmin();
  const sql = await getSql();
  const rows = await sql`select user_id from profiles where role = 'admin' limit 1`;
  return { hasAdmin: rows.length > 0 };
}

export async function resolveLoginEmail(identifier: string): Promise<{ email: string | null }> {
  await ensureBootstrapAdmin();
  const sql = await getSql();
  const id = identifier.trim().toLowerCase();
  if (!id || id.length > 120) return { email: null };
  if (id.includes("@")) {
    const rows = await sql<{ email: string }>`select email from "user" where email = ${id} limit 1`;
    return { email: rows[0]?.email ?? null };
  }
  const rows = await sql<{ email: string }>`
    select u.email from profiles p
    join "user" u on u.id = p.user_id
    where p.username = ${id}
    limit 1
  `;
  return { email: rows[0]?.email ?? null };
}

export async function getWorkspaceFor(userId: string): Promise<Workspace> {
  const { sql, row } = await mustCaller(userId);
  const me = personFrom(row, passwordFor(row, row));
  if (row.role === "pending") {
    return { me, groups: [], people: [me], exams: [], results: [], attendance: [], periods: [], marks: [] };
  }

  const groupRows = await sql<{ id: string; name: string; sort_order: number }>`
    select id, name, sort_order from groups order by sort_order, name
  `;
  const groups: Group[] = groupRows.map((g) => ({ id: g.id, name: g.name, sortOrder: num(g.sort_order) }));

  const periodRows = await sql<{ id: string; name: string; sort_order: number; locked: boolean }>`
    select id, name, sort_order, locked from periods order by sort_order, name
  `;
  const periods: Period[] = periodRows.map((p) => ({
    id: p.id,
    name: p.name,
    sortOrder: num(p.sort_order),
    locked: Boolean(p.locked),
  }));

  const peopleRows = await sql<Row>`
    select p.user_id, u.name, u.email, p.username, p.role, p.group_id, p.teacher_id,
           p.issued_password, p.synthetic
    from profiles p
    join "user" u on u.id = p.user_id
    order by u.name
  `;

  const visiblePeople = peopleRows.filter((p) => {
    if (p.user_id === row.user_id) return true;
    if (row.role === "admin") return p.role !== "pending";
    if (row.role === "teacher") return p.role === "student" && p.teacher_id === row.user_id;
    return false;
  });
  const people = visiblePeople.map((p) => personFrom(p, passwordFor(row, p)));
  const visibleStudents = new Set(
    visiblePeople.filter((p) => p.role === "student" && (row.role === "student" ? p.user_id === row.user_id : true)).map((p) => p.user_id),
  );
  if (row.role === "student") visibleStudents.add(row.user_id);

  const examRows = await sql<{
    id: string;
    title: string;
    group_id: string;
    created_by: string;
    author: string | null;
  }>`
    select e.id, e.title, e.group_id, e.created_by, u.name as author
    from exams e
    left join "user" u on u.id = e.created_by
    order by e.created_at desc
  `;
  const visibleExams = examRows.filter((e) => {
    if (row.role === "admin") return true;
    if (row.role === "teacher") return e.created_by === row.user_id;
    return row.role === "student" && !!row.group_id && e.group_id === row.group_id;
  });

  const questionMap = new Map<string, ExamQuestion[]>();
  if (row.role !== "student" && visibleExams.length) {
    const ids = visibleExams.map((e) => e.id);
    const qRows = await sql<{
      id: string;
      exam_id: string;
      position: number;
      prompt: string;
      options: unknown;
      answer: number;
    }>`
      select id, exam_id, position, prompt, options, answer from questions order by position
    `;
    for (const q of qRows) {
      if (!ids.includes(q.exam_id)) continue;
      const list = questionMap.get(q.exam_id) ?? [];
      list.push({
        id: q.id,
        prompt: q.prompt,
        options: asOptions(q.options),
        answer: num(q.answer),
      });
      questionMap.set(q.exam_id, list);
    }
  }

  const exams: ExamView[] = visibleExams.map((e) => {
    const questions = row.role === "student" ? null : (questionMap.get(e.id) ?? []);
    return {
      id: e.id,
      title: e.title,
      groupId: e.group_id,
      createdBy: e.created_by,
      authorName: e.author ?? "مدرس سابق",
      questionCount: questions ? questions.length : 0,
      questions,
    };
  });

  if (row.role === "student") {
    const counts = await sql<{ exam_id: string; n: number }>`
      select exam_id, count(*) as n from questions group by exam_id
    `;
    const countMap = new Map(counts.map((c) => [c.exam_id, num(c.n)]));
    for (const exam of exams) exam.questionCount = countMap.get(exam.id) ?? 0;
  }

  const resultRows = await sql<{
    exam_id: string;
    user_id: string;
    score: number;
    total: number;
    answers: unknown;
    title: string;
    student_name: string;
    teacher_id: string | null;
  }>`
    select r.exam_id, r.user_id, r.score, r.total, r.answers, e.title,
           u.name as student_name, stu.teacher_id
    from results r
    join exams e on e.id = r.exam_id
    join "user" u on u.id = r.user_id
    join profiles stu on stu.user_id = r.user_id
    order by r.submitted_at desc
  `;
  const visibleResults = resultRows.filter((r) => {
    if (row.role === "admin") return true;
    if (row.role === "teacher") return r.teacher_id === row.user_id;
    return r.user_id === row.user_id;
  });

  let reviewQuestions: { exam_id: string; position: number; prompt: string; options: unknown; answer: number }[] = [];
  if (row.role === "student" && visibleResults.length) {
    reviewQuestions = await sql`
      select exam_id, position, prompt, options, answer from questions order by position
    `;
  }

  const results: ResultView[] = visibleResults.map((r) => {
    let review: ReviewItem[] | null = null;
    if (row.role === "student") {
      const choices = asChoices(r.answers);
      review = reviewQuestions
        .filter((q) => q.exam_id === r.exam_id)
        .map((q, index) => ({
          prompt: q.prompt,
          options: asOptions(q.options),
          correct: num(q.answer),
          chosen: choices[index] ?? -1,
        }));
    }
    return {
      examId: r.exam_id,
      userId: r.user_id,
      studentName: r.student_name,
      examTitle: r.title,
      score: num(r.score),
      total: num(r.total),
      review,
    };
  });

  const attRows = await sql<{
    day: string;
    user_id: string;
    status: "p" | "a";
    teacher_id: string | null;
    marker_name: string | null;
  }>`
    select a.day::text as day, a.user_id, a.status, stu.teacher_id, mu.name as marker_name
    from attendance a
    join profiles stu on stu.user_id = a.user_id
    left join "user" mu on mu.id = a.marked_by
    order by a.day
  `;
  const attendance: AttRow[] = attRows
    .filter((a) => visibleStudents.has(a.user_id) || (row.role === "teacher" && a.teacher_id === row.user_id))
    .map((a) => ({
      day: String(a.day).slice(0, 10),
      userId: a.user_id,
      status: a.status === "a" ? "a" : "p",
      markerName: a.marker_name ?? "",
    }));

  const markRows = await sql<{ period_id: string; user_id: string; key: MarkKey; value: number }>`
    select period_id, user_id, key, value from marks
  `;
  const marks: MarkRow[] = markRows
    .filter((m) => visibleStudents.has(m.user_id))
    .map((m) => ({ periodId: m.period_id, userId: m.user_id, key: m.key, value: num(m.value) }));

  return { me, groups, people, exams, results, attendance, periods, marks };
}

export async function createStudents(callerId: string, input: CreateStudentsInput): Promise<IssuedAccount[]> {
  const { sql, row } = await mustCaller(callerId);
  failClosed(row);
  if (row.role !== "admin" && row.role !== "teacher") throw new Error("غير مسموح");
  await assertGroup(sql, input.groupId);
  let teacherId = row.role === "teacher" ? row.user_id : input.teacherId;
  if (teacherId) {
    const teacher = await loadRow(sql, teacherId);
    if (!teacher || teacher.role !== "teacher") throw new Error("اختر مدرسًا صحيحًا");
  }
  const names = input.names.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 30);
  const created: IssuedAccount[] = [];
  for (const name of names) {
    const username = await allocUsername(sql);
    const email = mailFor(username);
    const password = String(randomInt(10_000_000, 100_000_000));
    const id = await createCredentialUser(sql, { name, email, password });
    await sql`
      insert into profiles (user_id, role, username, group_id, teacher_id, issued_password, synthetic)
      values (${id}, 'student', ${username}, ${input.groupId}, ${teacherId}, ${password}, true)
    `;
    created.push({ name, username, email, password });
  }
  return created;
}

export async function createTeacher(
  callerId: string,
  input: { name: string; username: string; password: string },
): Promise<IssuedAccount> {
  const { sql, row } = await mustCaller(callerId);
  if (row.role !== "admin") throw new Error("غير مسموح");
  const email = mailFor(input.username);
  const clash = await sql`
    select id from "user" where email = ${email}
    union all
    select user_id from profiles where username = ${input.username}
  `;
  if (clash.length) throw new Error("اسم المستخدم مستخدم بالفعل");
  const id = await createCredentialUser(sql, { name: input.name, email, password: input.password });
  await sql`
    insert into profiles (user_id, role, username, issued_password, synthetic)
    values (${id}, 'teacher', ${input.username}, ${input.password}, true)
  `;
  return { name: input.name, username: input.username, email, password: input.password };
}

export async function updatePerson(callerId: string, patch: PersonPatch): Promise<void> {
  const { sql, row } = await mustCaller(callerId);
  failClosed(row);
  const target = await loadRow(sql, patch.userId);
  if (!target || target.role === "pending") throw new Error("الحساب غير موجود");
  const isSelf = row.user_id === target.user_id;
  const manages = canManageStudent(row, target);
  const adminStaff = row.role === "admin" && (target.role === "admin" || target.role === "teacher");
  if (!isSelf && !manages && !adminStaff) throw new Error("غير مسموح");
  if (row.role === "student") throw new Error("غير مسموح");
  if (patch.teacherId !== undefined && row.role !== "admin") throw new Error("غير مسموح");
  if (patch.groupId !== undefined && target.role !== "student") throw new Error("المجموعة للطلاب فقط");
  if (isSelf && row.role === "teacher" && (patch.groupId !== undefined || patch.teacherId !== undefined)) {
    throw new Error("غير مسموح");
  }

  const now = new Date().toISOString();
  if (patch.name) {
    await sql`update "user" set name = ${patch.name}, "updatedAt" = ${now} where id = ${target.user_id}`;
  }
  if (patch.username) {
    const email = target.synthetic ? mailFor(patch.username) : target.email;
    const emailClash = await sql`
      select id from "user" where email = ${email} and id <> ${target.user_id}
    `;
    const nameClash = await sql`
      select user_id from profiles where username = ${patch.username} and user_id <> ${target.user_id}
    `;
    if (emailClash.length || nameClash.length) throw new Error("اسم المستخدم مستخدم بالفعل");
    if (target.synthetic) {
      await sql`update "user" set email = ${email}, "updatedAt" = ${now} where id = ${target.user_id}`;
    }
    await sql`update profiles set username = ${patch.username} where user_id = ${target.user_id}`;
  }
  if (patch.password) {
    await setCredentialPassword(sql, target.user_id, patch.password);
    await sql`update profiles set issued_password = ${patch.password} where user_id = ${target.user_id}`;
  }
  if (patch.groupId !== undefined) {
    if (patch.groupId) await assertGroup(sql, patch.groupId);
    await sql`update profiles set group_id = ${patch.groupId} where user_id = ${target.user_id}`;
  }
  if (patch.teacherId !== undefined) {
    if (patch.teacherId) {
      const teacher = await loadRow(sql, patch.teacherId);
      if (!teacher || teacher.role !== "teacher") throw new Error("اختر مدرسًا صحيحًا");
    }
    await sql`update profiles set teacher_id = ${patch.teacherId} where user_id = ${target.user_id}`;
  }
}

export async function deletePerson(callerId: string, targetId: string): Promise<void> {
  const { sql, row } = await mustCaller(callerId);
  failClosed(row);
  if (targetId === row.user_id) throw new Error("لا يمكن حذف حسابك");
  const target = await loadRow(sql, targetId);
  if (!target || target.role === "pending") throw new Error("الحساب غير موجود");
  if (row.role === "teacher") {
    if (!canManageStudent(row, target)) throw new Error("غير مسموح");
  } else if (row.role !== "admin") {
    throw new Error("غير مسموح");
  }
  if (target.role === "admin") {
    const admins = await sql`select user_id from profiles where role = 'admin'`;
    if (admins.length < 2) throw new Error("لا يمكن حذف آخر مدير");
  }
  await sql`update profiles set teacher_id = null where teacher_id = ${targetId}`;
  await sql`delete from "user" where id = ${targetId}`;
}

export async function setGroupTeacher(callerId: string, groupId: string, teacherId: string | null): Promise<void> {
  const { sql, row } = await mustCaller(callerId);
  if (row.role !== "admin") throw new Error("غير مسموح");
  await assertGroup(sql, groupId);
  if (teacherId) {
    const teacher = await loadRow(sql, teacherId);
    if (!teacher || teacher.role !== "teacher") throw new Error("اختر مدرسًا صحيحًا");
  }
  await sql`
    update profiles set teacher_id = ${teacherId}
    where role = 'student' and group_id = ${groupId}
  `;
}

export async function createGroup(callerId: string, name: string): Promise<void> {
  const { sql, row } = await mustCaller(callerId);
  if (row.role !== "admin") throw new Error("غير مسموح");
  const clean = name.trim();
  if (!clean || clean.length > 80) throw new Error("اكتب اسم التصنيف");
  const max = await sql<{ n: number }>`select coalesce(max(sort_order), 0) as n from groups`;
  await sql`
    insert into groups (id, name, sort_order) values (${randomUUID()}, ${clean}, ${num(max[0]?.n) + 1})
  `;
}

export async function renameGroup(callerId: string, groupId: string, name: string): Promise<void> {
  const { sql, row } = await mustCaller(callerId);
  if (row.role !== "admin") throw new Error("غير مسموح");
  const clean = name.trim();
  if (!clean || clean.length > 80) throw new Error("اكتب اسم التصنيف");
  await sql`update groups set name = ${clean} where id = ${groupId}`;
}

export async function deleteGroup(callerId: string, groupId: string): Promise<void> {
  const { sql, row } = await mustCaller(callerId);
  if (row.role !== "admin") throw new Error("غير مسموح");
  await sql`delete from groups where id = ${groupId}`;
}

export async function createExam(callerId: string, input: CreateExamInput): Promise<void> {
  const { sql, row } = await mustCaller(callerId);
  if (row.role !== "teacher") throw new Error("غير مسموح");
  await assertGroup(sql, input.groupId);
  const examId = randomUUID();
  await sql`
    insert into exams (id, title, group_id, created_by) values (${examId}, ${input.title}, ${input.groupId}, ${row.user_id})
  `;
  for (let i = 0; i < input.questions.length; i += 1) {
    const q = input.questions[i];
    await sql`
      insert into questions (id, exam_id, position, prompt, options, answer)
      values (${randomUUID()}, ${examId}, ${i}, ${q.prompt}, ${JSON.stringify(q.options)}::jsonb, ${q.answer})
    `;
  }
}

export async function deleteExam(callerId: string, examId: string): Promise<void> {
  const { sql, row } = await mustCaller(callerId);
  const exams = await sql<{ created_by: string }>`select created_by from exams where id = ${examId}`;
  const exam = exams[0];
  if (!exam) return;
  if (row.role === "admin" || (row.role === "teacher" && exam.created_by === row.user_id)) {
    await sql`delete from exams where id = ${examId}`;
    return;
  }
  throw new Error("غير مسموح");
}

export async function openExam(callerId: string, examId: string): Promise<ExamPaper> {
  const { sql, row } = await mustCaller(callerId);
  if (row.role !== "student") throw new Error("غير مسموح");
  const exams = await sql<{ id: string; title: string; group_id: string }>`
    select id, title, group_id from exams where id = ${examId}
  `;
  const exam = exams[0];
  if (!exam || !row.group_id || exam.group_id !== row.group_id) throw new Error("هذا الامتحان غير متاح لك");
  const done = await sql`select exam_id from results where exam_id = ${examId} and user_id = ${row.user_id}`;
  if (done.length) throw new Error("تم تسليم هذا الامتحان");
  const questions = await sql<{ prompt: string; options: unknown }>`
    select prompt, options from questions where exam_id = ${examId} order by position
  `;
  return {
    id: exam.id,
    title: exam.title,
    questions: questions.map((q) => ({ prompt: q.prompt, options: asOptions(q.options) })),
  };
}

export async function submitExam(
  callerId: string,
  input: { examId: string; choices: number[] },
): Promise<SubmitResult> {
  const { sql, row } = await mustCaller(callerId);
  if (row.role !== "student") throw new Error("غير مسموح");
  const exams = await sql<{ id: string; group_id: string }>`
    select id, group_id from exams where id = ${input.examId}
  `;
  const exam = exams[0];
  if (!exam || !row.group_id || exam.group_id !== row.group_id) throw new Error("هذا الامتحان غير متاح لك");
  const questions = await sql<{ prompt: string; options: unknown; answer: number }>`
    select prompt, options, answer from questions where exam_id = ${input.examId} order by position
  `;
  if (!questions.length) throw new Error("الامتحان فارغ");
  if (input.choices.length !== questions.length) throw new Error("أجب عن كل الأسئلة");
  let score = 0;
  const review: ReviewItem[] = questions.map((q, index) => {
    const chosen = input.choices[index] ?? -1;
    const correct = num(q.answer);
    if (chosen === correct) score += 1;
    return { prompt: q.prompt, options: asOptions(q.options), correct, chosen };
  });
  const inserted = await sql`
    insert into results (exam_id, user_id, score, total, answers)
    values (${input.examId}, ${row.user_id}, ${score}, ${questions.length}, ${JSON.stringify(input.choices)}::jsonb)
    on conflict (exam_id, user_id) do nothing
    returning score
  `;
  if (!inserted.length) throw new Error("تم تسليم هذا الامتحان من قبل");
  return { score, total: questions.length, review };
}

export async function saveAttendance(callerId: string, input: AttendanceInput): Promise<void> {
  const { sql, row } = await mustCaller(callerId);
  if (row.role !== "teacher") throw new Error("غير مسموح");
  for (const entry of input.entries) {
    const student = await loadRow(sql, entry.userId);
    if (!student || !canManageStudent(row, student)) throw new Error("طالب خارج نطاقك");
    await sql`
      insert into attendance (day, user_id, status, marked_by)
      values (${input.day}, ${entry.userId}, ${entry.status}, ${row.user_id})
      on conflict (day, user_id) do update set status = excluded.status, marked_by = excluded.marked_by
    `;
  }
}

export async function saveMarks(callerId: string, input: MarksInput): Promise<void> {
  const { sql, row } = await mustCaller(callerId);
  if (row.role !== "teacher") throw new Error("غير مسموح");
  const periods = await sql`select id from periods where id = ${input.periodId}`;
  if (!periods.length) throw new Error("الفترة غير موجودة");
  for (const entry of input.entries) {
    const student = await loadRow(sql, entry.userId);
    if (!student || !canManageStudent(row, student)) throw new Error("طالب خارج نطاقك");
    if (entry.value === null) {
      await sql`
        delete from marks where period_id = ${input.periodId} and user_id = ${entry.userId} and key = ${entry.key}
      `;
    } else {
      await sql`
        insert into marks (period_id, user_id, key, value)
        values (${input.periodId}, ${entry.userId}, ${entry.key}, ${entry.value})
        on conflict (period_id, user_id, key) do update set value = excluded.value
      `;
    }
  }
}

export async function addPeriod(callerId: string, name: string): Promise<void> {
  const { sql, row } = await mustCaller(callerId);
  if (row.role !== "teacher") throw new Error("غير مسموح");
  const clean = name.trim();
  if (!clean || clean.length > 40) throw new Error("اكتب اسم الفترة");
  const exists = await sql`select id from periods where name = ${clean}`;
  if (exists.length) return;
  const max = await sql<{ n: number }>`select coalesce(max(sort_order), 0) as n from periods`;
  await sql`
    insert into periods (id, name, sort_order, locked)
    values (${randomUUID()}, ${clean}, ${num(max[0]?.n) + 1}, false)
  `;
}

export async function deletePeriod(callerId: string, periodId: string): Promise<void> {
  const { sql, row } = await mustCaller(callerId);
  if (row.role !== "teacher") throw new Error("غير مسموح");
  const periods = await sql<{ locked: boolean }>`select locked from periods where id = ${periodId}`;
  const period = periods[0];
  if (!period) return;
  if (row.role === "teacher") {
    const students = await sql<{ user_id: string }>`
      select user_id from profiles where role = 'student' and teacher_id = ${row.user_id}
    `;
    for (const student of students) {
      await sql`delete from marks where period_id = ${periodId} and user_id = ${student.user_id}`;
    }
    if (!period.locked) {
      const left = await sql`select user_id from marks where period_id = ${periodId} limit 1`;
      if (!left.length) await sql`delete from periods where id = ${periodId}`;
    }
    return;
  }
  if (period.locked) {
    await sql`delete from marks where period_id = ${periodId}`;
    return;
  }
  await sql`delete from periods where id = ${periodId}`;
}

export async function changeOwnPassword(callerId: string, password: string): Promise<void> {
  const { sql, row } = await mustCaller(callerId);
  failClosed(row);
  await setCredentialPassword(sql, row.user_id, password);
  await sql`update profiles set issued_password = ${password} where user_id = ${row.user_id}`;
}
