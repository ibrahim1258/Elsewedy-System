import { createServerFn } from "@tanstack/react-start";

import { authMiddleware } from "@/lib/auth/middleware";
import {
  parseAttendance,
  parseChoices,
  parseCreateExam,
  parseCreateStudents,
  parseCreateTeacher,
  parseMarks,
  parseName,
  parsePassword,
  parsePatch,
} from "@/lib/academy.types";

function idOf(value: unknown): string {
  const id = typeof value === "string" ? value : "";
  if (!id) throw new Error("العنصر غير محدد");
  return id;
}

export const academyStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { getAcademyStatus } = await import("./academy.server");
  return getAcademyStatus();
});

export const resolveLogin = createServerFn({ method: "POST" })
  .validator((value: unknown) => (typeof value === "string" ? value : ""))
  .handler(async ({ data }) => {
    const { resolveLoginEmail } = await import("./academy.server");
    return resolveLoginEmail(data);
  });

export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getWorkspaceFor } = await import("./academy.server");
    return getWorkspaceFor(context.userId);
  });

export const createStudents = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseCreateStudents)
  .handler(async ({ context, data }) => {
    const { createStudents: run } = await import("./academy.server");
    return run(context.userId, data);
  });

export const createTeacher = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseCreateTeacher)
  .handler(async ({ context, data }) => {
    const { createTeacher: run } = await import("./academy.server");
    return run(context.userId, data);
  });

export const updatePerson = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parsePatch)
  .handler(async ({ context, data }) => {
    const { updatePerson: run } = await import("./academy.server");
    await run(context.userId, data);
  });

export const deletePerson = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    const { deletePerson: run } = await import("./academy.server");
    await run(context.userId, data);
  });

export const setGroupTeacher = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("بيانات ناقصة");
    const o = input as Record<string, unknown>;
    const groupId = typeof o.groupId === "string" ? o.groupId : "";
    if (!groupId) throw new Error("المجموعة غير محددة");
    const teacherId = o.teacherId === null || o.teacherId === "" ? null : String(o.teacherId ?? "");
    return { groupId, teacherId };
  })
  .handler(async ({ context, data }) => {
    const { setGroupTeacher: run } = await import("./academy.server");
    await run(context.userId, data.groupId, data.teacherId);
  });

export const createGroup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((value: unknown) => parseName(value))
  .handler(async ({ context, data }) => {
    const { createGroup: run } = await import("./academy.server");
    await run(context.userId, data);
  });

export const renameGroup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("بيانات ناقصة");
    const o = input as Record<string, unknown>;
    return { groupId: idOf(o.groupId), name: parseName(o.name) };
  })
  .handler(async ({ context, data }) => {
    const { renameGroup: run } = await import("./academy.server");
    await run(context.userId, data.groupId, data.name);
  });

export const deleteGroup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    const { deleteGroup: run } = await import("./academy.server");
    await run(context.userId, data);
  });

export const createExam = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseCreateExam)
  .handler(async ({ context, data }) => {
    const { createExam: run } = await import("./academy.server");
    await run(context.userId, data);
  });

export const deleteExam = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    const { deleteExam: run } = await import("./academy.server");
    await run(context.userId, data);
  });

export const openExam = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    const { openExam: run } = await import("./academy.server");
    return run(context.userId, data);
  });

export const submitExam = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseChoices)
  .handler(async ({ context, data }) => {
    const { submitExam: run } = await import("./academy.server");
    return run(context.userId, data);
  });

export const saveAttendance = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseAttendance)
  .handler(async ({ context, data }) => {
    const { saveAttendance: run } = await import("./academy.server");
    await run(context.userId, data);
  });

export const saveMarks = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseMarks)
  .handler(async ({ context, data }) => {
    const { saveMarks: run } = await import("./academy.server");
    await run(context.userId, data);
  });

export const addPeriod = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((value: unknown) => parseName(value))
  .handler(async ({ context, data }) => {
    const { addPeriod: run } = await import("./academy.server");
    await run(context.userId, data);
  });

export const deletePeriod = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(idOf)
  .handler(async ({ context, data }) => {
    const { deletePeriod: run } = await import("./academy.server");
    await run(context.userId, data);
  });

export const changeOwnPassword = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((value: unknown) => parsePassword(typeof value === "string" ? value : ""))
  .handler(async ({ context, data }) => {
    const { changeOwnPassword: run } = await import("./academy.server");
    await run(context.userId, data);
  });

