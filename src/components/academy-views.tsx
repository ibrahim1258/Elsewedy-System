import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button, Card, ConfirmButton, Empty, Field, Input, Select, TextArea } from "@/components/ui";
import { useMutate } from "@/components/use-mutate";
import {
  addPeriod,
  changeOwnPassword,
  createExam,
  createGroup,
  createStudents,
  createTeacher,
  deleteExam,
  deleteGroup,
  deletePeriod,
  deletePerson,
  openExam,
  renameGroup,
  saveAttendance,
  saveMarks,
  setGroupTeacher,
  submitExam,
  updatePerson,
} from "@/lib/academy.fn";
import type {
  AttRow,
  ExamPaper,
  ExamView,
  Group,
  IssuedAccount,
  MarkKey,
  MarkRow,
  Period,
  Person,
  ResultView,
  Workspace,
} from "@/lib/academy.types";

const WEEK = [
  ["m", "امتحان الشهر"],
  ["1", "الأسبوع الأول"],
  ["2", "الأسبوع الثاني"],
  ["3", "الأسبوع الثالث"],
  ["4", "الأسبوع الرابع"],
] as const;

const ALL_COLS: [MarkKey, string][] = [
  ["m", "امتحان الشهر"],
  ["p1", "أسبوع 1 عملي"],
  ["t1", "أسبوع 1 نظري"],
  ["p2", "أسبوع 2 عملي"],
  ["t2", "أسبوع 2 نظري"],
  ["p3", "أسبوع 3 عملي"],
  ["t3", "أسبوع 3 نظري"],
  ["p4", "أسبوع 4 عملي"],
  ["t4", "أسبوع 4 نظري"],
];

export function localToday() {
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function groupName(groups: Group[], id: string | null) {
  return groups.find((group) => group.id === id)?.name ?? "غير محدد";
}

export function studentsOf(people: Person[]) {
  return people.filter((person) => person.role === "student").sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

function teachersOf(people: Person[]) {
  return people.filter((person) => person.role === "teacher").sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

function cell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function IssuedBanner({ rows, onClose }: { rows: IssuedAccount[]; onClose: () => void }) {
  return (
    <Card title={`تم إنشاء ${rows.length} حساب`}>
      <p className="text-sm text-muted">سلّم بيانات الدخول. تقدر تشوفها بعد كده في الجدول.</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-muted">
              <th className="border-b border-line px-2 py-2 text-start font-medium">الاسم</th>
              <th className="border-b border-line px-2 py-2 text-start font-medium">المستخدم</th>
              <th className="border-b border-line px-2 py-2 text-start font-medium">كلمة المرور</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.username}>
                <td className="border-b border-line px-2 py-2">{row.name}</td>
                <td className="border-b border-line px-2 py-2" dir="ltr">
                  {row.username}
                </td>
                <td className="border-b border-line px-2 py-2 tabular-nums" dir="ltr">
                  {row.password}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button variant="ghost" onClick={onClose}>
        إخفاء
      </Button>
    </Card>
  );
}

export function ExamStudio({
  ws,
  onReady,
}: {
  ws: Workspace;
  onReady: () => void;
}) {
  const students = studentsOf(ws.people);
  const [title, setTitle] = useState("");
  const [groupId, setGroupId] = useState(ws.groups[0]?.id ?? "");
  const [draft, setDraft] = useState<{ prompt: string; options: string[]; answer: number }[]>([]);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [answer, setAnswer] = useState(0);
  const { pending, run } = useMutate();
  const mine = ws.exams.filter((exam) => ws.me.role === "admin" || exam.createdBy === ws.me.userId);

  function addQuestion() {
    if (!prompt.trim() || options.some((option) => !option.trim())) {
      toast.error("اكتب السؤال والاختيارات الأربعة");
      return;
    }
    setDraft((current) => [
      ...current,
      { prompt: prompt.trim(), options: options.map((option) => option.trim()), answer },
    ]);
    setPrompt("");
    setOptions(["", "", "", ""]);
    setAnswer(0);
  }

  async function publish(event: FormEvent) {
    event.preventDefault();
    try {
      await run(
        () => createExam({ data: { title, groupId, questions: draft } }),
        "تم نشر الامتحان",
      );
      setTitle("");
      setDraft([]);
      onReady();
    } catch {
      /* toasted */
    }
  }

  return (
    <div className="space-y-4">
      <Card title="امتحان جديد">
        <form className="space-y-4" onSubmit={publish}>
          <Field label="عنوان الامتحان">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field label="المجموعة">
            <Select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
              {ws.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-sm text-muted">
            يظهر لكل طلاب هذه المجموعة. عدد طلابك فيها:{" "}
            {students.filter((student) => student.groupId === groupId).length}
          </p>
          {draft.length ? (
            <ol className="space-y-2 text-sm">
              {draft.map((question, index) => (
                <li key={`${question.prompt}-${index}`} className="flex items-start justify-between gap-3">
                  <span>
                    {index + 1}. {question.prompt}
                  </span>
                  <Button variant="ghost" onClick={() => setDraft(draft.filter((_, i) => i !== index))}>
                    إزالة
                  </Button>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>لم تُضف أسئلة بعد.</Empty>
          )}
          <Field label="نص السؤال">
            <TextArea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          </Field>
          {options.map((option, index) => (
            <Field key={index} label={`الاختيار ${index + 1}`}>
              <Input
                value={option}
                onChange={(event) =>
                  setOptions(options.map((item, i) => (i === index ? event.target.value : item)))
                }
              />
            </Field>
          ))}
          <Field label="الإجابة الصحيحة">
            <Select value={answer} onChange={(event) => setAnswer(Number(event.target.value))}>
              {[0, 1, 2, 3].map((index) => (
                <option key={index} value={index}>
                  الاختيار {index + 1}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={addQuestion}>
              إضافة السؤال
            </Button>
            <Button type="submit" disabled={pending || !title.trim() || !draft.length}>
              نشر الامتحان
            </Button>
          </div>
        </form>
      </Card>
      <Card title="الامتحانات المنشورة">
        {mine.length ? (
          mine.map((exam) => <ExamRow key={exam.id} exam={exam} groups={ws.groups} />)
        ) : (
          <Empty>لا توجد امتحانات.</Empty>
        )}
      </Card>
    </div>
  );
}

function ExamRow({ exam, groups }: { exam: ExamView; groups: Group[] }) {
  const { pending, run } = useMutate();
  return (
    <div className="space-y-2 border-b border-line py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">{exam.title}</p>
          <p className="text-sm text-muted">
            {exam.questionCount} سؤال · {groupName(groups, exam.groupId)}
            {exam.authorName ? ` · ${exam.authorName}` : ""}
          </p>
        </div>
        <ConfirmButton
          label="حذف"
          disabled={pending}
          onConfirm={() => run(() => deleteExam({ data: exam.id }), "تم حذف الامتحان")}
        />
      </div>
      {exam.questions?.length ? (
        <details>
          <summary className="cursor-pointer text-sm text-muted">عرض الأسئلة</summary>
          <ol className="mt-2 space-y-3 text-sm">
            {exam.questions.map((question, index) => (
              <li key={question.id}>
                <p className="font-medium">
                  {index + 1}. {question.prompt}
                </p>
                <ul className="mt-1 space-y-1">
                  {question.options.map((option, optionIndex) => (
                    <li key={option} className={optionIndex === question.answer ? "text-ok" : "text-muted"}>
                      {option}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

export function StudentExams({
  ws,
  paper,
  setPaper,
}: {
  ws: Workspace;
  paper: ExamPaper | null;
  setPaper: (paper: ExamPaper | null) => void;
}) {
  const [choices, setChoices] = useState<number[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const { run } = useMutate();

  useEffect(() => {
    setChoices(paper ? paper.questions.map(() => -1) : []);
    setConfirming(false);
  }, [paper]);

  async function start(examId: string) {
    setBusy(true);
    try {
      const next = await openExam({ data: examId });
      setReviewId(null);
      setPaper(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر فتح الامتحان");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!paper) return;
    try {
      const result = await run(
        () => submitExam({ data: { examId: paper.id, choices } }),
        "تم تسليم الامتحان",
      );
      setPaper(null);
      setReviewId(result ? paper.id : null);
    } catch {
      /* toasted */
    }
  }

  if (!ws.me.groupId) {
    return (
      <Card title="الامتحانات">
        <Empty>لم يتم تحديد مجموعتك بعد.</Empty>
      </Card>
    );
  }

  if (paper) {
    const blanks = choices.some((choice) => choice < 0);
    return (
      <Card title={paper.title}>
        {paper.questions.map((question, index) => (
          <fieldset key={`${paper.id}-${index}`} className="space-y-2">
            <legend className="font-medium">
              {index + 1}. {question.prompt}
            </legend>
            {question.options.map((option, optionIndex) => (
              <label key={option} className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="radio"
                  name={`q-${index}`}
                  checked={choices[index] === optionIndex}
                  onChange={() =>
                    setChoices(choices.map((choice, i) => (i === index ? optionIndex : choice)))
                  }
                />
                <span>{option}</span>
              </label>
            ))}
          </fieldset>
        ))}
        {confirming ? (
          <div className="space-y-3">
            <p className="text-sm">
              {blanks
                ? "في أسئلة من غير إجابة وهتتحسب غلط. التسليم نهائي."
                : "التسليم نهائي ومش هتقدر تعيد الامتحان."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void finish()}>تأكيد التسليم</Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                رجوع
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setConfirming(true)}>تسليم</Button>
            <Button variant="ghost" onClick={() => setPaper(null)}>
              خروج بدون تسليم
            </Button>
          </div>
        )}
      </Card>
    );
  }

  const review = ws.results.find((result) => result.examId === reviewId);
  return (
    <div className="space-y-4">
      <Card title="الامتحانات المتاحة">
        {ws.exams.length ? (
          ws.exams.map((exam) => {
            const result = ws.results.find((item) => item.examId === exam.id);
            return (
              <div key={exam.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 last:border-0">
                <div>
                  <p className="font-medium">{exam.title}</p>
                  <p className="text-sm text-muted">{exam.questionCount} سؤال</p>
                </div>
                {result ? (
                  <Button variant="ghost" onClick={() => setReviewId(result.examId)}>
                    <span className={result.total && result.score / result.total >= 0.5 ? "text-ok" : "text-bad"}>
                      {result.score} / {result.total}
                    </span>
                  </Button>
                ) : (
                  <Button disabled={busy} onClick={() => void start(exam.id)}>
                    ابدأ
                  </Button>
                )}
              </div>
            );
          })
        ) : (
          <Empty>لا توجد امتحانات.</Empty>
        )}
      </Card>
      {review?.review ? <ReviewCard result={review} onClose={() => setReviewId(null)} /> : null}
    </div>
  );
}

function ReviewCard({ result, onClose }: { result: ResultView; onClose: () => void }) {
  return (
    <Card title={`مراجعة ${result.examTitle}`} action={<Button variant="ghost" onClick={onClose}>إغلاق</Button>}>
      <p className="tabular-nums">
        الدرجة {result.score} / {result.total}
      </p>
      <ol className="space-y-3 text-sm">
        {result.review?.map((item, index) => (
          <li key={`${item.prompt}-${index}`}>
            <p className="font-medium">
              {index + 1}. {item.prompt}
            </p>
            <ul className="mt-1 space-y-1">
              {item.options.map((option, optionIndex) => {
                const chosen = optionIndex === item.chosen;
                const correct = optionIndex === item.correct;
                return (
                  <li key={option} className={correct ? "text-ok" : chosen ? "text-bad" : "text-muted"}>
                    {option}
                    {correct ? " · الصحيحة" : ""}
                    {chosen && !correct ? " · إجابتك" : ""}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function PeopleView({
  ws,
  onIssued,
}: {
  ws: Workspace;
  onIssued: (rows: IssuedAccount[]) => void;
}) {
  const students = studentsOf(ws.people);
  const teachers = teachersOf(ws.people);
  const admin = ws.me.role === "admin";
  const [names, setNames] = useState("");
  const [groupId, setGroupId] = useState(ws.groups[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState("");
  const [oneName, setOneName] = useState("");
  const { pending, run } = useMutate();

  async function addList(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await run(
        () => createStudents({ data: { names, groupId, teacherId: teacherId || null } }),
        "تمت إضافة الطلاب",
      );
      setNames("");
      onIssued(created);
    } catch {
      /* toasted */
    }
  }

  async function addOne(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await run(
        () => createStudents({ data: { names: oneName, groupId, teacherId: teacherId || null } }),
        "تمت إضافة الطالب",
      );
      setOneName("");
      onIssued(created);
    } catch {
      /* toasted */
    }
  }

  return (
    <div className="space-y-4">
      <Card title="إضافة قائمة طلاب">
        <form className="space-y-4" onSubmit={addList}>
          <TextArea
            placeholder="اسم في كل سطر، حتى ٣٠ اسم"
            value={names}
            onChange={(event) => setNames(event.target.value)}
          />
          <Select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            {ws.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
          {admin ? (
            <Select value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
              <option value="">بدون مدرس</option>
              {teachers.map((teacher) => (
                <option key={teacher.userId} value={teacher.userId}>
                  {teacher.name}
                </option>
              ))}
            </Select>
          ) : null}
          <Button type="submit" disabled={pending}>
            إضافة القائمة
          </Button>
        </form>
      </Card>
      {admin ? (
        <Card title="تعيين المدرسين على المجموعات">
          <p className="text-sm text-muted">اختيار «بدون مدرس» يفك المدرس عن المجموعة كلها بعد التأكيد.</p>
          {ws.groups.map((group) => {
            const inGroup = students.filter((student) => student.groupId === group.id);
            const ids = new Set(inGroup.map((student) => student.teacherId ?? ""));
            const current = ids.size > 1 ? "__mixed" : ([...ids][0] ?? "");
            return (
              <div key={group.id} className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {group.name} ({inGroup.length})
                </span>
                <Select
                  className="sm:max-w-64"
                  value={current}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value && !window.confirm("هيتم فك المدرس عن كل طلاب المجموعة. متأكد؟")) return;
                    void run(
                      () => setGroupTeacher({ data: { groupId: group.id, teacherId: value || null } }),
                      "تم تحديث المجموعة",
                    );
                  }}
                >
                  <option value="__mixed" disabled>
                    مدرسون مختلفون
                  </option>
                  <option value="">بدون مدرس</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.userId} value={teacher.userId}>
                      {teacher.name}
                    </option>
                  ))}
                </Select>
              </div>
            );
          })}
        </Card>
      ) : null}
      <Card title={`الطلاب (${students.length})`}>
        {students.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-muted">
                  <th className="border-b border-line px-2 py-2 text-start font-medium">الاسم</th>
                  <th className="border-b border-line px-2 py-2 text-start font-medium">المستخدم</th>
                  <th className="border-b border-line px-2 py-2 text-start font-medium">كلمة المرور</th>
                  <th className="border-b border-line px-2 py-2 text-start font-medium">المجموعة</th>
                  {admin ? <th className="border-b border-line px-2 py-2 text-start font-medium">المدرس</th> : null}
                  <th className="border-b border-line px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <StudentRow key={student.userId} student={student} ws={ws} admin={admin} teachers={teachers} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>لا يوجد طلاب بعد.</Empty>
        )}
      </Card>
      <Card title="إضافة طالب">
        <form className="space-y-4" onSubmit={addOne}>
          <Field label="اسم الطالب">
            <Input value={oneName} onChange={(event) => setOneName(event.target.value)} />
          </Field>
          <p className="text-sm text-muted">اسم المستخدم وكلمة المرور يتولّدان تلقائيًا، ٨ أرقام.</p>
          <Button type="submit" disabled={pending || !oneName.trim()}>
            إضافة
          </Button>
        </form>
      </Card>
    </div>
  );
}

function StudentRow({
  student,
  ws,
  admin,
  teachers,
}: {
  student: Person;
  ws: Workspace;
  admin: boolean;
  teachers: Person[];
}) {
  const { pending, run } = useMutate();
  return (
    <tr>
      <td className="border-b border-line px-2 py-2">
        <Input
          className="min-w-32"
          defaultValue={student.name}
          key={`${student.userId}-name-${student.name}`}
          onBlur={(event) => {
            const name = event.target.value.trim();
            if (!name || name === student.name) return;
            void run(() => updatePerson({ data: { userId: student.userId, name } }), "تم حفظ الاسم");
          }}
        />
      </td>
      <td className="border-b border-line px-2 py-2">
        <Input
          dir="ltr"
          className="min-w-28"
          defaultValue={student.username ?? ""}
          key={`${student.userId}-user-${student.username}`}
          onBlur={(event) => {
            const username = event.target.value.trim().toLowerCase();
            if (!username || username === student.username) return;
            void run(() => updatePerson({ data: { userId: student.userId, username } }), "تم حفظ اسم المستخدم");
          }}
        />
      </td>
      <td className="border-b border-line px-2 py-2">
        <Input
          dir="ltr"
          className="min-w-28 tabular-nums"
          defaultValue={student.issuedPassword ?? ""}
          key={`${student.userId}-pw-${student.issuedPassword}`}
          placeholder="٨ حروف"
          onBlur={(event) => {
            const password = event.target.value.trim();
            if (!password || password === student.issuedPassword) return;
            void run(() => updatePerson({ data: { userId: student.userId, password } }), "تم تغيير كلمة المرور");
          }}
        />
      </td>
      <td className="border-b border-line px-2 py-2">
        <Select
          className="min-w-40"
          value={student.groupId ?? ""}
          onChange={(event) =>
            void run(
              () => updatePerson({ data: { userId: student.userId, groupId: event.target.value || null } }),
              "تم نقل الطالب",
            )
          }
        >
          <option value="">غير محدد</option>
          {ws.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
      </td>
      {admin ? (
        <td className="border-b border-line px-2 py-2">
          <Select
            className="min-w-36"
            value={student.teacherId ?? ""}
            onChange={(event) =>
              void run(
                () => updatePerson({ data: { userId: student.userId, teacherId: event.target.value || null } }),
                "تم تعيين المدرس",
              )
            }
          >
            <option value="">بدون مدرس</option>
            {teachers.map((teacher) => (
              <option key={teacher.userId} value={teacher.userId}>
                {teacher.name}
              </option>
            ))}
          </Select>
        </td>
      ) : null}
      <td className="border-b border-line px-2 py-2">
        <ConfirmButton
          label="حذف"
          disabled={pending}
          onConfirm={() => run(() => deletePerson({ data: student.userId }), "تم حذف الطالب")}
        />
      </td>
    </tr>
  );
}

export function TeacherView({ ws, onIssued }: { ws: Workspace; onIssued: (rows: IssuedAccount[]) => void }) {
  const staff = ws.people
    .filter((person) => person.role === "admin" || person.role === "teacher")
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { pending, run } = useMutate();

  async function add(event: FormEvent) {
    event.preventDefault();
    try {
      const created = await run(() => createTeacher({ data: { name, username, password } }), "تمت إضافة المدرس");
      setName("");
      setUsername("");
      setPassword("");
      onIssued([created]);
    } catch {
      /* toasted */
    }
  }

  return (
    <div className="space-y-4">
      <Card title="المدرسون والمدير">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-muted">
                <th className="border-b border-line px-2 py-2 text-start font-medium">الاسم</th>
                <th className="border-b border-line px-2 py-2 text-start font-medium">المستخدم</th>
                <th className="border-b border-line px-2 py-2 text-start font-medium">كلمة المرور</th>
                <th className="border-b border-line px-2 py-2 text-start font-medium">الدور</th>
                <th className="border-b border-line px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {staff.map((person) => (
                <StaffRow key={person.userId} person={person} self={person.userId === ws.me.userId} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="إضافة مدرس">
        <form className="space-y-4" onSubmit={add}>
          <Field label="الاسم">
            <Input value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field label="اسم المستخدم">
            <Input dir="ltr" value={username} onChange={(event) => setUsername(event.target.value)} required />
          </Field>
          <Field label="كلمة المرور">
            <Input
              dir="ltr"
              type="text"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </Field>
          <Button type="submit" disabled={pending}>
            إضافة
          </Button>
        </form>
      </Card>
    </div>
  );
}

function StaffRow({ person, self }: { person: Person; self: boolean }) {
  const { pending, run } = useMutate();
  return (
    <tr>
      <td className="border-b border-line px-2 py-2">
        <Input
          className="min-w-32"
          defaultValue={person.name}
          key={`${person.userId}-n-${person.name}`}
          onBlur={(event) => {
            const name = event.target.value.trim();
            if (!name || name === person.name) return;
            void run(() => updatePerson({ data: { userId: person.userId, name } }), "تم حفظ الاسم");
          }}
        />
      </td>
      <td className="border-b border-line px-2 py-2">
        <Input
          dir="ltr"
          className="min-w-28"
          defaultValue={person.username ?? ""}
          placeholder="اختياري"
          key={`${person.userId}-u-${person.username}`}
          onBlur={(event) => {
            const username = event.target.value.trim().toLowerCase();
            if (!username || username === person.username) return;
            void run(() => updatePerson({ data: { userId: person.userId, username } }), "تم حفظ اسم المستخدم");
          }}
        />
      </td>
      <td className="border-b border-line px-2 py-2">
        <Input
          dir="ltr"
          className="min-w-28"
          defaultValue={person.issuedPassword ?? ""}
          placeholder={person.synthetic ? "" : "تعيين كلمة مرور"}
          key={`${person.userId}-p-${person.issuedPassword}`}
          onBlur={(event) => {
            const password = event.target.value.trim();
            if (!password || password === person.issuedPassword) return;
            void run(() => updatePerson({ data: { userId: person.userId, password } }), "تم تغيير كلمة المرور");
          }}
        />
      </td>
      <td className="border-b border-line px-2 py-2">{person.role === "admin" ? "مدير" : "مدرس"}</td>
      <td className="border-b border-line px-2 py-2">
        {self ? (
          <span className="text-sm text-muted">حسابك</span>
        ) : (
          <ConfirmButton
            label="حذف"
            disabled={pending}
            onConfirm={() => run(() => deletePerson({ data: person.userId }), "تم الحذف")}
          />
        )}
      </td>
    </tr>
  );
}

export function GroupView({ ws }: { ws: Workspace }) {
  const [name, setName] = useState("");
  const { pending, run } = useMutate();
  const students = studentsOf(ws.people);
  return (
    <div className="space-y-4">
      <Card title="تصنيفات الطلاب">
        <p className="text-sm text-muted">حذف التصنيف يمسح امتحاناته ويفك الطلاب منه.</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-muted">
                <th className="border-b border-line px-2 py-2 text-start font-medium">الاسم</th>
                <th className="border-b border-line px-2 py-2 text-start font-medium">الطلاب</th>
                <th className="border-b border-line px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {ws.groups.map((group) => (
                <tr key={group.id}>
                  <td className="border-b border-line px-2 py-2">
                    <Input
                      className="min-w-48"
                      defaultValue={group.name}
                      key={`${group.id}-${group.name}`}
                      onBlur={(event) => {
                        const next = event.target.value.trim();
                        if (!next || next === group.name) return;
                        void run(() => renameGroup({ data: { groupId: group.id, name: next } }), "تم تعديل الاسم");
                      }}
                    />
                  </td>
                  <td className="border-b border-line px-2 py-2 tabular-nums">
                    {students.filter((student) => student.groupId === group.id).length}
                  </td>
                  <td className="border-b border-line px-2 py-2">
                    <ConfirmButton
                      label="حذف"
                      disabled={pending}
                      onConfirm={() => run(() => deleteGroup({ data: group.id }), "تم حذف التصنيف")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="تصنيف جديد">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => createGroup({ data: name }), "تمت إضافة التصنيف")
              .then(() => setName(""))
              .catch(() => undefined);
          }}
        >
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="اسم التصنيف" />
          <Button type="submit" disabled={pending || !name.trim()}>
            إضافة
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function AttendanceView({ ws, editable }: { ws: Workspace; editable: boolean }) {
  const students = studentsOf(ws.people).filter((student) => ws.me.role !== "student" || student.userId === ws.me.userId);
  const list = ws.me.role === "student" ? [ws.me] : students;
  const [day, setDay] = useState(localToday);
  const [filter, setFilter] = useState("");
  const shown = list.filter((student) => !filter || student.groupId === filter);
  const savedKey = ws.attendance
    .filter((row) => row.day === day)
    .map((row) => `${row.userId}:${row.status}`)
    .sort()
    .join("|");
  const shownKey = shown.map((student) => student.userId).join("|");
  const [values, setValues] = useState<Record<string, "p" | "a">>({});
  const { pending, run } = useMutate();

  useEffect(() => {
    const next: Record<string, "p" | "a"> = {};
    for (const student of shown) {
      const row = ws.attendance.find((item) => item.day === day && item.userId === student.userId);
      next[student.userId] = row?.status ?? "p";
    }
    setValues(next);
    // Reload only when the saved day, roster, or date changes — not on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, savedKey, shownKey]);

  const days = [...new Set(ws.attendance.map((row) => row.day))].sort();

  function exportCsv() {
    if (!days.length) {
      toast.error("لا يوجد حضور مسجل");
      return;
    }
    const header = ["الاسم", "اسم المستخدم", "المجموعة", ...days, "نسبة الحضور"];
    const lines = [header.map(cell).join(",")];
    for (const student of list) {
      const stats = attendanceStats(ws.attendance, student.userId, days);
      const marks = stats.cells.map((status) => (status === "p" ? "حاضر" : status === "a" ? "غائب" : ""));
      lines.push(
        [student.name, student.username ?? "", groupName(ws.groups, student.groupId), ...marks, stats.pct]
          .map(cell)
          .join(","),
      );
    }
    const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "attendance.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="space-y-4">
      {editable ? (
        <Card title="تسجيل الحضور">
          <Field label="التاريخ">
            <Input dir="ltr" type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          </Field>
          {ws.me.role === "admin" ? (
            <Select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="">كل المجموعات</option>
              {ws.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
          ) : null}
          {shown.length ? (
            shown.map((student) => (
              <div key={student.userId} className="flex items-center justify-between gap-3">
                <span>{student.name}</span>
                <Select
                  className="max-w-36"
                  value={values[student.userId] ?? "p"}
                  onChange={(event) =>
                    setValues({ ...values, [student.userId]: event.target.value === "a" ? "a" : "p" })
                  }
                >
                  <option value="p">حاضر</option>
                  <option value="a">غائب</option>
                </Select>
              </div>
            ))
          ) : (
            <Empty>لا يوجد طلاب.</Empty>
          )}
          <Button
            disabled={pending || !shown.length}
            onClick={() =>
              void run(
                () =>
                  saveAttendance({
                    data: {
                      day,
                      entries: shown.map((student) => ({
                        userId: student.userId,
                        status: values[student.userId] ?? "p",
                      })),
                    },
                  }),
                `تم حفظ حضور ${day}`,
              )
            }
          >
            حفظ
          </Button>
        </Card>
      ) : null}
      <Card
        title={ws.me.role === "student" ? "سجل حضوري" : "سجل الحضور"}
        action={
          ws.me.role === "student" ? null : (
            <Button variant="ghost" onClick={exportCsv}>
              تنزيل Excel
            </Button>
          )
        }
      >
        <AttendanceTable people={list} attendance={ws.attendance} days={days} />
      </Card>
    </div>
  );
}

function attendanceStats(rows: AttRow[], userId: string, days: string[]) {
  let recorded = 0;
  let present = 0;
  const cells = days.map((day) => {
    const row = rows.find((item) => item.day === day && item.userId === userId);
    if (!row) return null;
    recorded += 1;
    if (row.status === "p") present += 1;
    return row.status;
  });
  return { cells, pct: recorded ? `${Math.round((present / recorded) * 100)}%` : "—" };
}

function AttendanceTable({
  people,
  attendance,
  days,
}: {
  people: Person[];
  attendance: AttRow[];
  days: string[];
}) {
  if (!days.length) return <Empty>لا يوجد سجل حضور بعد.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-line px-2 py-2 text-start font-medium">الطالب</th>
            {days.map((day) => {
              const names = [
                ...new Set(
                  attendance.filter((row) => row.day === day && row.markerName).map((row) => row.markerName),
                ),
              ];
              return (
                <th key={day} className="border-b border-line px-2 py-2 text-start font-medium whitespace-nowrap">
                  <span dir="ltr">{day}</span>
                  {names.length ? <span className="block text-xs font-normal text-muted">{names.join(" + ")}</span> : null}
                </th>
              );
            })}
            <th className="border-b border-line px-2 py-2 text-start font-medium">النسبة</th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => {
            const stats = attendanceStats(attendance, person.userId, days);
            return (
              <tr key={person.userId}>
                <td className="border-b border-line px-2 py-2">{person.name}</td>
                {stats.cells.map((status, index) => (
                  <td
                    key={days[index]}
                    className={`border-b border-line px-2 py-2 ${status === "p" ? "text-ok" : status === "a" ? "text-bad" : "text-muted"}`}
                  >
                    {status === "p" ? "حاضر" : status === "a" ? "غائب" : "—"}
                  </td>
                ))}
                <td className="border-b border-line px-2 py-2 tabular-nums">{stats.pct}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function MarksView({ ws }: { ws: Workspace }) {
  const students = studentsOf(ws.people);
  const [periodId, setPeriodId] = useState(ws.periods[0]?.id ?? "");
  const [week, setWeek] = useState<(typeof WEEK)[number][0]>("m");
  const [filter, setFilter] = useState("");
  const [periodName, setPeriodName] = useState("");
  const [dirty, setDirty] = useState(false);
  const shown = students.filter((student) => !filter || student.groupId === filter);
  const cols: [MarkKey, string][] =
    week === "m"
      ? [["m", "امتحان الشهر"]]
      : [
          [`p${week}` as MarkKey, "عملي"],
          [`t${week}` as MarkKey, "نظري"],
        ];
  const markKey = ws.marks
    .filter((mark) => mark.periodId === periodId && cols.some(([key]) => key === mark.key))
    .map((mark) => `${mark.userId}:${mark.key}:${mark.value}`)
    .join("|");
  const shownKey = shown.map((student) => student.userId).join("|");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const { pending, run } = useMutate();

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const student of shown) {
      for (const [key] of cols) {
        const row = ws.marks.find(
          (mark) => mark.periodId === periodId && mark.userId === student.userId && mark.key === key,
        );
        next[`${student.userId}:${key}`] = row ? String(row.value) : "";
      }
    }
    setDraft(next);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId, week, markKey, shownKey]);

  function choosePeriod(id: string) {
    if (dirty && !window.confirm("في درجات لم تُحفظ. تتركها؟")) return;
    setPeriodId(id);
  }

  function chooseWeek(next: (typeof WEEK)[number][0]) {
    if (dirty && !window.confirm("في درجات لم تُحفظ. تتركها؟")) return;
    setWeek(next);
  }

  const period = ws.periods.find((item) => item.id === periodId);

  return (
    <div className="space-y-4">
      <Card title="درجات الشهر والتقييم الأسبوعي">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ws.periods.map((item) => (
            <Button key={item.id} variant={item.id === periodId ? "primary" : "ghost"} onClick={() => choosePeriod(item.id)}>
              {item.name}
            </Button>
          ))}
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => addPeriod({ data: periodName }), "تمت إضافة الفترة")
              .then(() => setPeriodName(""))
              .catch(() => undefined);
          }}
        >
          <Input
            className="min-w-40 flex-1"
            placeholder="فترة جديدة، مثل يناير"
            value={periodName}
            onChange={(event) => setPeriodName(event.target.value)}
          />
          <Button type="submit" variant="ghost" disabled={!periodName.trim()}>
            إضافة
          </Button>
        </form>
        {period ? (
          <ConfirmButton
            label={period.locked ? "مسح درجات هذه الفترة" : "حذف هذه الفترة"}
            disabled={pending}
            onConfirm={() => run(() => deletePeriod({ data: period.id }), "تم تحديث الفترة")}
          />
        ) : null}
        <div className="flex gap-2 overflow-x-auto">
          {WEEK.map(([id, label]) => (
            <Button key={id} variant={week === id ? "primary" : "ghost"} onClick={() => chooseWeek(id)}>
              {label}
            </Button>
          ))}
        </div>
        <Select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">كل المجموعات</option>
          {ws.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
        {shown.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-muted">
                  <th className="border-b border-line px-2 py-2 text-start font-medium">الطالب</th>
                  <th className="border-b border-line px-2 py-2 text-start font-medium">المجموعة</th>
                  {cols.map(([key, label]) => (
                    <th key={key} className="border-b border-line px-2 py-2 text-start font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((student) => (
                  <tr key={student.userId}>
                    <td className="border-b border-line px-2 py-2">{student.name}</td>
                    <td className="border-b border-line px-2 py-2 text-muted">{groupName(ws.groups, student.groupId)}</td>
                    {cols.map(([key]) => (
                      <td key={key} className="border-b border-line px-2 py-2">
                        <Input
                          dir="ltr"
                          type="number"
                          min={0}
                          className="w-24 tabular-nums"
                          value={draft[`${student.userId}:${key}`] ?? ""}
                          onChange={(event) => {
                            setDraft({ ...draft, [`${student.userId}:${key}`]: event.target.value });
                            setDirty(true);
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>لا يوجد طلاب.</Empty>
        )}
        <Button
          disabled={pending || !shown.length || !periodId}
          onClick={() => {
            const entries = shown.flatMap((student) =>
              cols.map(([key]) => {
                const raw = (draft[`${student.userId}:${key}`] ?? "").trim();
                return { userId: student.userId, key, value: raw === "" ? null : Number(raw) };
              }),
            );
            if (entries.some((entry) => entry.value !== null && !Number.isFinite(entry.value))) {
              toast.error("في درجة غير صالحة");
              return;
            }
            void run(() => saveMarks({ data: { periodId, entries } }), "تم حفظ الدرجات");
          }}
        >
          حفظ الدرجات
        </Button>
      </Card>
    </div>
  );
}

export function MyMarks({ ws }: { ws: Workspace }) {
  const periods = ws.periods.filter((period) => ws.marks.some((mark) => mark.periodId === period.id && mark.userId === ws.me.userId));
  return (
    <div className="space-y-4">
      <Card title="درجاتي">
        {periods.length ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-muted">
                  <th className="border-b border-line px-2 py-2 text-start font-medium">الفترة</th>
                  {ALL_COLS.map(([key, label]) => (
                    <th key={key} className="border-b border-line px-2 py-2 text-start font-medium whitespace-nowrap">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr key={period.id}>
                    <td className="border-b border-line px-2 py-2">{period.name}</td>
                    {ALL_COLS.map(([key]) => {
                      const mark = ws.marks.find(
                        (item) => item.periodId === period.id && item.userId === ws.me.userId && item.key === key,
                      );
                      return (
                        <td key={key} className="border-b border-line px-2 py-2 tabular-nums">
                          {mark ? mark.value : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>لا توجد درجات مسجلة بعد.</Empty>
        )}
      </Card>
      <GradesView ws={ws} title="نتائج الامتحانات" />
      <PasswordCard email={ws.me.email} username={ws.me.username} />
    </div>
  );
}

export function GradesView({ ws, title = "درجات الامتحانات" }: { ws: Workspace; title?: string }) {
  return (
    <Card title={title}>
      {ws.results.length ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-muted">
                <th className="border-b border-line px-2 py-2 text-start font-medium">الطالب</th>
                <th className="border-b border-line px-2 py-2 text-start font-medium">الامتحان</th>
                <th className="border-b border-line px-2 py-2 text-start font-medium">الدرجة</th>
                <th className="border-b border-line px-2 py-2 text-start font-medium">النسبة</th>
              </tr>
            </thead>
            <tbody>
              {ws.results.map((result) => {
                const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
                return (
                  <tr key={`${result.examId}-${result.userId}`}>
                    <td className="border-b border-line px-2 py-2">{result.studentName}</td>
                    <td className="border-b border-line px-2 py-2">{result.examTitle}</td>
                    <td className="border-b border-line px-2 py-2 tabular-nums">
                      {result.score} / {result.total}
                    </td>
                    <td className={`border-b border-line px-2 py-2 tabular-nums ${pct >= 50 ? "text-ok" : "text-bad"}`}>
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>لا توجد درجات بعد.</Empty>
      )}
    </Card>
  );
}

export function PasswordCard({ email, username }: { email: string; username: string | null }) {
  const [password, setPassword] = useState("");
  const { pending, run } = useMutate();
  return (
    <Card title="كلمة المرور">
      <p className="text-sm text-muted">
        البريد <span dir="ltr">{email}</span>
        {username ? (
          <>
            {" "}
            · المستخدم <span dir="ltr">{username}</span>
          </>
        ) : null}
      </p>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => changeOwnPassword({ data: password }), "تم تغيير كلمة المرور").then(() => setPassword(""));
        }}
      >
        <Field label="كلمة مرور جديدة">
          <Input
            dir="ltr"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Button type="submit" disabled={pending || password.trim().length < 8}>
          حفظ
        </Button>
      </form>
    </Card>
  );
}

export function roleLabel(role: Person["role"]) {
  if (role === "admin") return "حساب المدير";
  if (role === "teacher") return "حساب المدرس";
  if (role === "student") return "حساب طالب";
  return "بانتظار التفعيل";
}
