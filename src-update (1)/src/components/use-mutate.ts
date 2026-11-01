import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function errMsg(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "حصل خطأ. حاول مرة أخرى.";
}

export function useMutate() {
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  async function run<T>(task: () => Promise<T>, ok?: string): Promise<T> {
    setPending(true);
    try {
      const result = await task();
      if (ok) toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["workspace"] });
      return result;
    } catch (error) {
      toast.error(errMsg(error));
      throw error;
    } finally {
      setPending(false);
    }
  }
  return { pending, run };
}
