import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type HistoryItem = {
  id: string;
  customer_msg: string | null;
  ai_reply: string | null;
  created_at: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

export function ReplyHistory({ items }: { items: HistoryItem[] }) {
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ประวัติ 10 รายการล่าสุด</CardTitle>
        <CardDescription>
          ใช้ตรวจสอบย้อนหลัง — ลูกค้าถามอะไรและ AI ตอบยังไง
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {items.map((item) => (
          <div key={item.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <p className="text-xs text-muted-foreground">
              {formatTime(item.created_at)}
            </p>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">ลูกค้า</p>
              <p className="text-sm whitespace-pre-wrap">
                {item.customer_msg ?? "(ว่าง)"}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">AI ตอบ</p>
              <p className="text-sm whitespace-pre-wrap">
                {item.ai_reply ?? "(ว่าง)"}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
