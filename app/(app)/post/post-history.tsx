import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { POST_TYPES } from "@/lib/post-types";

type HistoryItem = {
  id: string;
  content: string | null;
  post_type: string | null;
  product_id: string | null;
  created_at: string;
};

const POST_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  POST_TYPES.map((t) => [t.value, t.label]),
);

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

export function PostHistory({
  items,
  productNameById,
}: {
  items: HistoryItem[];
  productNameById: Map<string, string>;
}) {
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ประวัติ 10 โพสต์ล่าสุด</CardTitle>
        <CardDescription>
          คัดลอกใช้ซ้ำหรือดูเป็น reference
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {items.map((item) => {
          const productName =
            item.product_id && productNameById.get(item.product_id);
          const typeLabel = item.post_type
            ? POST_TYPE_LABELS[item.post_type] ?? item.post_type
            : "?";
          return (
            <div
              key={item.id}
              className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {productName ?? "(สินค้าถูกลบ)"} · {typeLabel}
                </span>
                <span>{formatTime(item.created_at)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">
                {item.content ?? "(ว่าง)"}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
