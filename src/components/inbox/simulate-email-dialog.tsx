"use client";

import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { FlaskConicalIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  fromEmail: z.email("Enter the sender's email"),
  fromName: z.string().trim().max(100).optional(),
  subject: z.string().trim().min(1, "Enter a subject").max(200),
  body: z.string().trim().min(1, "Write the email").max(10_000),
  forceToolFailure: z.boolean(),
});

/** Creates an inbound email without Gmail, for demos and when OAuth expired. */
export function SimulateEmailDialog() {
  const simulate = useMutation(api.inbox.simulateEmail);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = schema.safeParse({
      fromEmail: form.get("fromEmail")?.toString().trim(),
      fromName: form.get("fromName")?.toString() || undefined,
      subject: form.get("subject"),
      body: form.get("body"),
      forceToolFailure: form.get("forceToolFailure") === "on",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setPending(true);
    try {
      const threadId = await simulate(parsed.data);
      setOpen(false);
      router.push(`/inbox/${threadId}`);
    } catch (error) {
      toast.error(error instanceof ConvexError ? String(error.data) : "Could not simulate the email");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <FlaskConicalIcon />
        Simulate email
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Simulate an inbound email</DialogTitle>
            <DialogDescription>
              Goes through the same pipeline as a Gmail message, without Gmail.
              Use a tenant&apos;s email (e.g. felix.braun@example.com) to see the link.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="sim-email">From email</Label>
              <Input id="sim-email" name="fromEmail" type="email" defaultValue="felix.braun@example.com" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sim-name">From name</Label>
              <Input id="sim-name" name="fromName" defaultValue="Felix Braun" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sim-subject">Subject</Label>
            <Input id="sim-subject" name="subject" defaultValue="Heating not working" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="sim-body">Body</Label>
            <Textarea
              id="sim-body"
              name="body"
              rows={5}
              defaultValue={"Hello,\n\nthe heating in my flat has not worked since yesterday evening. Can someone come and look at it?\n\nThanks,\nFelix"}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="forceToolFailure" className="mt-0.5" />
            <span>
              Force a tool failure
              <span className="block text-xs text-muted-foreground">
                The lease search fails on its first attempt, to show the run retrying that step.
              </span>
            </span>
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Add to inbox"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
