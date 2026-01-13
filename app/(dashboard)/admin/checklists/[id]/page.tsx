import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/db";
import { requireAdmin } from "@/app/lib/auth/session";
import { Card, CardContent, CardHeader } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { ChecklistTemplateEditor } from "@/app/components/checklists/checklist-template-editor";

export default async function AdminChecklistDetailPage({
  params
}: {
  params: { id: string };
}) {
  await requireAdmin();

  const template = await prisma.checklistTemplate.findFirst({
    where: { id: params.id, userId: null },
    include: { items: { orderBy: { personalOrder: "asc" } } }
  });

  if (!template) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href="/admin/checklists">← Back to global templates</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <p className="text-sm text-slate-400">Edit global checklist</p>
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
              details: item.details,
              itemLabel: item.itemLabel,
              acceptanceCriteria: item.acceptanceCriteria,
              officialOrder: item.officialOrder,
              personalOrder: item.personalOrder
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

