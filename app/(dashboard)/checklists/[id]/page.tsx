import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { ChecklistTemplateEditor } from "@/app/components/checklists/checklist-template-editor";

export default async function ChecklistTemplateDetailPage({
  params
}: {
  params: { id: string };
}) {
  const user = await requireUser();

  const template = await prisma.checklistTemplate.findFirst({
    where: { id: params.id, userId: user.id },
    include: { items: { orderBy: { personalOrder: "asc" } } }
  });

  if (!template) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Button asChild variant="ghost">
            <Link href="/checklists">← Back to templates</Link>
          </Button>
          <h2 className="text-2xl font-semibold">{template.name}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Edit sections and sub-steps. Switch to a flight checklist to toggle Personal vs Official ordering.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">Checklist detail</p>
        </CardHeader>
        <CardContent>
          <ChecklistTemplateEditor
            templateId={template.id}
            initialName={template.name}
            initialItems={template.items.map((item) => ({
              id: item.id,
              kind: item.kind,
              parentId: item.parentId,
              title: item.title,
              itemLabel: item.itemLabel,
              acceptanceCriteria: item.acceptanceCriteria,
              details: item.details,
              officialOrder: item.officialOrder,
              personalOrder: item.personalOrder
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

