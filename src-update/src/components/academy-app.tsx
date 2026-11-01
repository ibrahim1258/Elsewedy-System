import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, CalendarCheck, ClipboardList, GraduationCap, Layers, UserCog, Users } from "lucide-react";

import {
  AttendanceView,
  ExamStudio,
  GradesView,
  GroupView,
  IssuedBanner,
  MarksView,
  MyMarks,
  PasswordCard,
  PeopleView,
  roleLabel,
  StudentExams,
  TeacherView,
} from "@/components/academy-views";
import { BootScreen, Button, Card, Empty } from "@/components/ui";
import { errMsg } from "@/components/use-mutate";
import { getWorkspace } from "@/lib/academy.fn";
import type { ExamPaper, IssuedAccount } from "@/lib/academy.types";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";

const ICONS = {
  exams: ClipboardList,
  students: Users,
  attendance: CalendarCheck,
  marks: Award,
  grades: GraduationCap,
  groups: Layers,
  teachers: UserCog,
} as const;

type TabId = keyof typeof ICONS;

const TABS: Record<"admin" | "teacher" | "student", { id: TabId; label: string }[]> = {
  admin: [
    { id: "grades", label: "الدرجات" },
    { id: "exams", label: "الامتحانات" },
    { id: "attendance", label: "الحضور" },
    { id: "students", label: "الطلاب" },
    { id: "groups", label: "التصنيفات" },
    { id: "marks", label: "الشهر" },
    { id: "teachers", label: "المدرسون" },
  ],
  teacher: [
    { id: "exams", label: "الامتحانات" },
    { id: "students", label: "الطلاب" },
    { id: "attendance", label: "الحضور" },
    { id: "marks", label: "الشهر" },
    { id: "grades", label: "الدرجات" },
  ],
  student: [
    { id: "exams", label: "الامتحانات" },
    { id: "marks", label: "درجاتي" },
    { id: "attendance", label: "حضوري" },
  ],
};

export function AcademyApp() {
  const query = useQuery({ queryKey: ["workspace"], queryFn: () => getWorkspace() });
  const [tab, setTab] = useState<TabId | null>(null);
  const [paper, setPaper] = useState<ExamPaper | null>(null);
  const [issued, setIssued] = useState<IssuedAccount[] | null>(null);

  if (query.isPending) return <BootScreen />;
  if (query.isError) {
    if (errMsg(query.error).includes("Unauthorized")) return <RedirectToSignIn />;
    return (
      <main className="grid min-h-dvh place-items-center px-4">
        <Card title="تعذر تحميل المنصة">
          <p className="text-sm text-bad">{errMsg(query.error)}</p>
          <Button onClick={() => void query.refetch()}>إعادة المحاولة</Button>
        </Card>
      </main>
    );
  }

  const ws = query.data;
  if (ws.me.role === "pending") {
    return (
      <Shell name={ws.me.name} role={roleLabel(ws.me.role)}>
        <Card title="الحساب بانتظار التفعيل">
          <Empty>اطلب من المدير ربط هذا الحساب، أو ادخل باسم المستخدم الذي أُنشئ لك.</Empty>
        </Card>
      </Shell>
    );
  }
  if (ws.me.role !== "admin" && ws.me.role !== "teacher" && ws.me.role !== "student") {
    return <BootScreen />;
  }

  const tabs = TABS[ws.me.role];
  const active = tab && tabs.some((item) => item.id === tab) ? tab : tabs[0].id;

  function selectTab(next: TabId) {
    if (paper && next !== "exams") {
      if (!window.confirm("الخروج يضيع الإجابات التي لم تُسلَّم. تخرج؟")) return;
      setPaper(null);
    }
    setTab(next);
  }

  return (
    <Shell name={ws.me.name} role={roleLabel(ws.me.role)}>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => {
          const Icon = ICONS[item.id];
          return (
            <Button
              key={item.id}
              variant={active === item.id ? "primary" : "ghost"}
              className="shrink-0"
              onClick={() => selectTab(item.id)}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </Button>
          );
        })}
      </div>
      {issued?.length ? <IssuedBanner rows={issued} onClose={() => setIssued(null)} /> : null}
      {active === "exams" && ws.me.role !== "student" ? <ExamStudio ws={ws} onReady={() => undefined} /> : null}
      {active === "exams" && ws.me.role === "student" ? (
        <StudentExams ws={ws} paper={paper} setPaper={setPaper} />
      ) : null}
      {active === "students" ? (
        <div className="space-y-4">
          <PeopleView ws={ws} onIssued={setIssued} />
          {ws.me.role === "teacher" ? <PasswordCard email={ws.me.email} username={ws.me.username} /> : null}
        </div>
      ) : null}
      {active === "teachers" && ws.me.role === "admin" ? <TeacherView ws={ws} onIssued={setIssued} /> : null}
      {active === "groups" && ws.me.role === "admin" ? <GroupView ws={ws} /> : null}
      {active === "attendance" ? <AttendanceView ws={ws} editable={ws.me.role !== "student"} /> : null}
      {active === "marks" && ws.me.role === "student" ? <MyMarks ws={ws} /> : null}
      {active === "marks" && ws.me.role !== "student" ? <MarksView ws={ws} /> : null}
      {active === "grades" ? <GradesView ws={ws} /> : null}
    </Shell>
  );
}

function Shell({ name, role, children }: { name: string; role: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 px-4 py-5">
      <header className="panel flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card p-4">
        <div className="min-w-0">
          <p className="text-sm text-muted">مدرسة العالمين</p>
          <h1 className="text-2xl font-semibold">أهلًا، {name}</h1>
          <p className="text-sm text-muted">{role}</p>
        </div>
        <UserButton />
      </header>
      {children}
    </main>
  );
}
