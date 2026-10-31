export const MAIL_DOMAIN = "diyaafa.academy";

export const MARK_KEYS = ["m", "p1", "t1", "p2", "t2", "p3", "t3", "p4", "t4"] as const;
export type MarkKey = (typeof MARK_KEYS)[number];

export type Role = "admin" | "teacher" | "student" | "pending";

export type Person = {
  userId: string;
  name: string;
  email: string;
  username: string | null;
  role: Role;
  groupId: string | null;
  teacherId: string | null;
  issuedPassword: string | null;
  synthetic: boolean;
};

export type Group = { id: string; name: string; sortOrder: number };
export type Period = { id: string; name: string; sortOrder: number; locked: boolean };

export type ExamQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
};

export type ExamView = {
  id: string;
  title: string;
  groupId: string;
  createdBy: string;
  authorName: string;
  questionCount: number;
  questions: ExamQuestion[] | null;
};

export type ReviewItem = {
  prompt: string;
  options: string[];
  correct: number;
  chosen: number;
};

export type ResultView = {
  examId: string;
  userId: string;
  studentName: string;
  examTitle: string;
  score: number;
  total: number;
  review: ReviewItem[] | null;
};

export type AttRow = {
  day: string;
  userId: string;
  status: "p" | "a";
  markerName: string;
};

export type MarkRow = { periodId: string; userId: string; key: MarkKey; value: number };

export type Workspace = {
  me: Person;
  groups: Group[];
  people: Person[];
  exams: ExamView[];
  results: ResultView[];
  attendance: AttRow[];
  periods: Period[];
  marks: MarkRow[];
};

export type IssuedAccount = {
  name: string;
  username: string;
  email: string;
  password: string;
};

export type ExamPaper = {
  id: string;
  title: string;
  questions: { prompt: string; options: string[] }[];
};

export type SubmitResult = { score: number; total: number; review: ReviewItem[] };

export type CreateExamInput = {
  title: string;
  groupId: string;
  questions: { prompt: string; options: string[]; answer: number }[];
};

export type PersonPatch = {
  userId: string;
  name?: string;
  username?: string;
  password?: string;
  groupId?: string | null;
  teacherId?: string | null;
};

export type CreateStudentsInput = {
  names: string;
  groupId: string;
  teacherId: string | null;
};

export type AttendanceInput = {
  day: string;
  entries: { userId: string; status: "p" | "a" }[];
};

export type MarksInput = {
  periodId: string;
  entries: { userId: string; key: MarkKey; value: number | null }[];
};

function bad(message: string): never {
  throw new Error(message);
}

export function parseUsername(value: string): string {
  const username = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,31}$/.test(username)) {
    bad("اسم المستخدم حروف إنجليزية صغيرة وأرقام، من حرفين");
  }
  return username;
}

export function parsePassword(value: string): string {
  const password = value.trim();
  if (password.length < 8 || password.length > 72) bad("كلمة المرور من ٨ إلى ٧٢ حرفًا");
  return password;
}

export function parseName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 80) bad("اكتب الاسم");
  return name;
}

export function parseCreateStudents(input: unknown): CreateStudentsInput {
  if (!input || typeof input !== "object") bad("بيانات ناقصة");
  const o = input as Record<string, unknown>;
  const names = typeof o.names === "string" ? o.names : "";
  const lines = names.split("\n").map((s) => s.trim()).filter(Boolean);
  if (!lines.length) bad("الصق الأسماء أولًا، اسم في كل سطر");
  if (lines.length > 30) bad("الحد ٣٠ اسم في المرة الواحدة");
  if (lines.some((n) => n.length > 80)) bad("أحد الأسماء طويل جدًا");
  const groupId = typeof o.groupId === "string" ? o.groupId : "";
  if (!groupId) bad("اختر المجموعة");
  const teacherId = typeof o.teacherId === "string" && o.teacherId ? o.teacherId : null;
  return { names, groupId, teacherId };
}

export function parseCreateTeacher(input: unknown): { name: string; username: string; password: string } {
  if (!input || typeof input !== "object") bad("بيانات ناقصة");
  const o = input as Record<string, unknown>;
  return {
    name: parseName(o.name),
    username: parseUsername(typeof o.username === "string" ? o.username : ""),
    password: parsePassword(typeof o.password === "string" ? o.password : ""),
  };
}

export function parsePatch(input: unknown): PersonPatch {
  if (!input || typeof input !== "object") bad("بيانات ناقصة");
  const o = input as Record<string, unknown>;
  const userId = typeof o.userId === "string" ? o.userId : "";
  if (!userId) bad("الطالب غير محدد");
  const patch: PersonPatch = { userId };
  if ("name" in o) patch.name = parseName(o.name);
  if ("username" in o) patch.username = parseUsername(typeof o.username === "string" ? o.username : "");
  if ("password" in o && typeof o.password === "string" && o.password.trim()) {
    patch.password = parsePassword(o.password);
  }
  if ("groupId" in o) {
    patch.groupId = o.groupId === null || o.groupId === "" ? null : String(o.groupId);
  }
  if ("teacherId" in o) {
    patch.teacherId = o.teacherId === null || o.teacherId === "" ? null : String(o.teacherId);
  }
  return patch;
}

export function parseCreateExam(input: unknown): CreateExamInput {
  if (!input || typeof input !== "object") bad("بيانات ناقصة");
  const o = input as Record<string, unknown>;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  if (!title || title.length > 120) bad("اكتب عنوان الامتحان");
  const groupId = typeof o.groupId === "string" ? o.groupId : "";
  if (!groupId) bad("اختر المجموعة");
  if (!Array.isArray(o.questions) || o.questions.length < 1 || o.questions.length > 40) {
    bad("أضف سؤالًا واحدًا على الأقل");
  }
  const questions = o.questions.map((raw) => {
    if (!raw || typeof raw !== "object") bad("سؤال غير صالح");
    const q = raw as Record<string, unknown>;
    const prompt = typeof q.prompt === "string" ? q.prompt.trim() : "";
    if (!prompt || prompt.length > 500) bad("اكتب نص السؤال");
    if (!Array.isArray(q.options) || q.options.length !== 4) bad("كل سؤال يحتاج ٤ اختيارات");
    const options = q.options.map((item) => {
      const text = typeof item === "string" ? item.trim() : "";
      if (!text || text.length > 200) bad("اكتب الاختيارات الأربعة");
      return text;
    });
    if (q.answer !== 0 && q.answer !== 1 && q.answer !== 2 && q.answer !== 3) {
      bad("حدد الإجابة الصحيحة");
    }
    return { prompt, options, answer: q.answer };
  });
  return { title, groupId, questions };
}

export function parseDay(value: unknown): string {
  const day = typeof value === "string" ? value : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) bad("التاريخ غير صالح");
  return day;
}

export function parseAttendance(input: unknown): AttendanceInput {
  if (!input || typeof input !== "object") bad("بيانات ناقصة");
  const o = input as Record<string, unknown>;
  const day = parseDay(o.day);
  if (!Array.isArray(o.entries) || o.entries.length > 500) bad("لا يوجد طلاب");
  const entries = o.entries.map((raw) => {
    if (!raw || typeof raw !== "object") bad("سجل حضور غير صالح");
    const row = raw as Record<string, unknown>;
    const userId = typeof row.userId === "string" ? row.userId : "";
    const status: "p" | "a" | null = row.status === "p" || row.status === "a" ? row.status : null;
    if (!userId || !status) bad("سجل حضور غير صالح");
    return { userId, status };
  });
  return { day, entries };
}

export function parseMarks(input: unknown): MarksInput {
  if (!input || typeof input !== "object") bad("بيانات ناقصة");
  const o = input as Record<string, unknown>;
  const periodId = typeof o.periodId === "string" ? o.periodId : "";
  if (!periodId) bad("اختر الفترة");
  if (!Array.isArray(o.entries) || o.entries.length > 4000) bad("لا توجد درجات");
  const entries = o.entries.map((raw) => {
    if (!raw || typeof raw !== "object") bad("درجة غير صالحة");
    const row = raw as Record<string, unknown>;
    const userId = typeof row.userId === "string" ? row.userId : "";
    const key = row.key;
    if (!userId || typeof key !== "string" || !(MARK_KEYS as readonly string[]).includes(key)) {
      bad("درجة غير صالحة");
    }
    if (row.value === null) return { userId, key: key as MarkKey, value: null };
    const value = typeof row.value === "number" ? row.value : Number(row.value);
    if (!Number.isFinite(value) || value < 0 || value > 1000) bad("الدرجة بين ٠ و ١٠٠٠");
    return { userId, key: key as MarkKey, value };
  });
  return { periodId, entries };
}

export function parseChoices(input: unknown): { examId: string; choices: number[] } {
  if (!input || typeof input !== "object") bad("بيانات ناقصة");
  const o = input as Record<string, unknown>;
  const examId = typeof o.examId === "string" ? o.examId : "";
  if (!examId) bad("الامتحان غير محدد");
  if (!Array.isArray(o.choices) || o.choices.length > 40) bad("الإجابات ناقصة");
  const choices = o.choices.map((n) => (n === 0 || n === 1 || n === 2 || n === 3 ? n : -1));
  return { examId, choices };
}

export function mailFor(username: string): string {
  return `${username}@${MAIL_DOMAIN}`;
}
