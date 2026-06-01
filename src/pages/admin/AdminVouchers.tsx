import React, { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Gift, Plus, Copy, Download, Check, Clock, Ban, Search,
  Loader2, Printer, Image as ImageIcon, FileText, Eye, EyeOff,
  Car, User, Users,
} from "lucide-react";

/* ═══════════════════════════════════════════ */
/*  Types                                      */
/* ═══════════════════════════════════════════ */
type AudienceType = "rider" | "driver" | "any";

interface Voucher {
  id: string;
  code: string;
  amount: number;
  status: string;
  audience: AudienceType;
  redeemed_by: string | null;
  redeemed_at: string | null;
  batch_name: string | null;
  expires_at: string | null;
  created_at: string;
}

const AUDIENCE_CONFIG: Record<AudienceType, {
  label: string; color: string; gradient: string; accent: string; badgeBg: string; badgeText: string; prefix: string; subtitle: string;
}> = {
  driver: {
    label: "سائق", color: "#3b82f6", gradient: "linear-gradient(135deg, #1e3a5f 0%, #1e40af 50%, #3b82f6 100%)",
    accent: "#60a5fa", badgeBg: "bg-blue-500/15", badgeText: "text-blue-600", prefix: "RD-", subtitle: "DRIVER CARD",
  },
  rider: {
    label: "راكب", color: "#10b981", gradient: "linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)",
    accent: "#34d399", badgeBg: "bg-emerald-500/15", badgeText: "text-emerald-600", prefix: "RR-", subtitle: "RIDER CARD",
  },
  any: {
    label: "عام", color: "#f59e0b", gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
    accent: "#f59e0b", badgeBg: "bg-amber-500/15", badgeText: "text-amber-600", prefix: "RAAN-", subtitle: "UNIVERSAL",
  },
};

/* ═══════════════════════════════════════════ */
/*  Voucher Card Component                     */
/* ═══════════════════════════════════════════ */
const VoucherCard: React.FC<{
  code: string; amount: number; serial: string; showCode: boolean; audience: AudienceType;
}> = ({ code, amount, serial, showCode, audience }) => {
  const cfg = AUDIENCE_CONFIG[audience] || AUDIENCE_CONFIG.any;
  return (
    <div className="voucher-card" style={{
      width: "340px", height: "200px", borderRadius: "16px", overflow: "hidden",
      position: "relative", fontFamily: "'Cairo', 'Tajawal', sans-serif",
      background: cfg.gradient, color: "white",
      boxShadow: "0 8px 32px rgba(0,0,0,0.3)", pageBreakInside: "avoid",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{ height: "4px", background: `linear-gradient(90deg, ${cfg.accent}, ${cfg.color}, ${cfg.accent})` }} />
      <div style={{ padding: "16px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{
              width: "32px", height: "32px", borderRadius: "8px",
              background: `linear-gradient(135deg, ${cfg.accent}, ${cfg.color})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: "900", fontSize: "14px", color: "#0f172a",
            }}>ر</div>
            <div>
              <div style={{ fontWeight: "800", fontSize: "16px", letterSpacing: "2px" }}>RAAN</div>
              <div style={{ fontSize: "8px", opacity: 0.6, letterSpacing: "1px" }}>{cfg.subtitle}</div>
            </div>
          </div>
          <div style={{
            background: `${cfg.accent}20`, border: `1px solid ${cfg.accent}50`,
            borderRadius: "8px", padding: "4px 12px", textAlign: "center",
          }}>
            <div style={{ fontSize: "20px", fontWeight: "900", color: cfg.accent }}>{Number(amount).toLocaleString('en-US')}</div>
            <div style={{ fontSize: "8px", opacity: 0.7 }}>د.ع</div>
          </div>
        </div>

        {/* Badge + Code */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", margin: "2px 0", gap: "6px" }}>
          <div style={{
            fontSize: "8px", fontWeight: "700", letterSpacing: "1px",
            background: `${cfg.accent}25`, color: cfg.accent,
            padding: "2px 10px", borderRadius: "4px",
          }}>
            {audience === "driver" ? "🚗 كارت سائق" : audience === "rider" ? "👤 كارت راكب" : "🌐 كارت عام"}
          </div>
          <div style={{
            background: showCode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
            border: "1px dashed rgba(255,255,255,0.2)",
            borderRadius: "10px", padding: "8px 20px", textAlign: "center", width: "100%",
          }}>
            {showCode ? (
              <>
                <div style={{ fontSize: "7px", opacity: 0.5, marginBottom: "3px" }}>أدخل هذا الرمز في تطبيق ران</div>
                <div style={{
                  fontFamily: "'Courier New', monospace", fontSize: "20px",
                  fontWeight: "900", letterSpacing: "3px", color: cfg.accent,
                }}>{code}</div>
              </>
            ) : (
              <div style={{ fontSize: "12px", opacity: 0.4, fontStyle: "italic" }}>
                <span>████ ████ ████</span> <span style={{ fontSize: "8px" }}>احك هنا</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "8px", opacity: 0.4, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "5px",
        }}>
          <span>SN: {serial}</span>
          <span>raan.app</span>
          <span>SINGLE USE ONLY</span>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════ */
/*  Main Page                                  */
/* ═══════════════════════════════════════════ */
const AdminVouchers = () => {
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [count, setCount] = useState(10);
  const [amount, setAmount] = useState(3000);
  const [batchName, setBatchName] = useState("");
  const [expiresDays, setExpiresDays] = useState<number | "">("");
  const [audience, setAudience] = useState<AudienceType>("driver");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAudience, setFilterAudience] = useState<AudienceType | "all">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<{ code: string; amount: number; audience: AudienceType }[]>([]);
  const [showCodes, setShowCodes] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);

  // Suggested amounts
  const suggestedAmounts = audience === "driver"
    ? [3000, 15000, 30000, 60000]
    : audience === "rider"
      ? [5000, 10000, 25000, 50000]
      : [5000, 10000, 25000, 50000];

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ["admin-vouchers"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("voucher_codes") as any)
        .select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data as Voucher[];
    },
  });

  const stats = {
    total: vouchers.length,
    active: vouchers.filter((v) => v.status === "active").length,
    redeemed: vouchers.filter((v) => v.status === "redeemed").length,
    driverActive: vouchers.filter((v) => v.status === "active" && v.audience === "driver").length,
    riderActive: vouchers.filter((v) => v.status === "active" && v.audience === "rider").length,
    totalValue: vouchers.filter((v) => v.status === "active").reduce((s, v) => s + Number(v.amount), 0),
  };

  const handleGenerate = async () => {
    if (count < 1 || count > 500) { toast.error("العدد 1-500"); return; }
    if (amount < 250) { toast.error("الحد الأدنى 250 د.ع"); return; }

    setGenerating(true);
    setGeneratedCodes([]);

    try {
      const { data, error } = await supabase.rpc("generate_voucher_batch" as any, {
        p_count: count, p_amount: amount,
        p_batch_name: batchName || null, p_expires_days: expiresDays || null,
        p_audience: audience,
      });
      if (error) throw error;

      const codes = (data as any[])?.map((r: any) => ({ code: r.code, amount: Number(r.amount), audience })) || [];
      setGeneratedCodes(codes);
      queryClient.invalidateQueries({ queryKey: ["admin-vouchers"] });
      toast.success(`تم إصدار ${codes.length} كارت ${AUDIENCE_CONFIG[audience].label}`);
    } catch (e: any) { toast.error(e.message || "خطأ"); } finally { setGenerating(false); }
  };

  const handleCopy = (code: string, id: string) => { navigator.clipboard.writeText(code); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); };
  const handleCopyAll = () => { navigator.clipboard.writeText(generatedCodes.map(c => c.code).join("\n")); toast.success(`تم نسخ ${generatedCodes.length} كود`); };

  const handleExportCSV = () => {
    const src = generatedCodes.length > 0
      ? generatedCodes
      : vouchers.filter(v => v.status === "active").map(v => ({ code: v.code, amount: Number(v.amount), audience: v.audience }));
    const csv = "\uFEFFcode,amount_iqd,type\n" + src.map(c => `${c.code},${c.amount},${c.audience}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `raan_vouchers_${audience}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    toast.success("تم تصدير CSV");
  };

  const handlePrintPDF = useCallback(() => {
    const el = printRef.current; if (!el) return;
    const pw = window.open("", "_blank"); if (!pw) { toast.error("فعّل النوافذ المنبثقة"); return; }
    pw.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>كروت ران</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{padding:10mm;background:white}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12mm;justify-items:center}
      @media print{body{padding:5mm}.grid{gap:8mm}.voucher-card{break-inside:avoid}}
      @page{size:A4;margin:10mm}</style></head><body>
      <div class="grid">${el.innerHTML}</div>
      <script>setTimeout(()=>{window.print();window.close()},500)</script></body></html>`);
    pw.document.close();
  }, []);

  const handleDisable = async (id: string) => {
    await (supabase.from("voucher_codes") as any).update({ status: "disabled" }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-vouchers"] }); toast.success("تم تعطيل الكارت");
  };

  const filtered = vouchers.filter((v) => {
    if (filterAudience !== "all" && v.audience !== filterAudience) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toUpperCase();
    return v.code.includes(q) || v.batch_name?.toUpperCase().includes(q);
  });

  const audienceBadge = (a: AudienceType) => {
    const c = AUDIENCE_CONFIG[a] || AUDIENCE_CONFIG.any;
    return <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.badgeBg} ${c.badgeText} font-medium`}>{c.label}</span>;
  };

  const statusBadge = (status: string) => {
    const m: Record<string, { b: string; t: string; l: string }> = {
      active: { b: "bg-emerald-500/15", t: "text-emerald-600", l: "فعّال" },
      redeemed: { b: "bg-blue-500/15", t: "text-blue-600", l: "مُستخدم" },
      disabled: { b: "bg-red-500/15", t: "text-red-600", l: "معطّل" },
      expired: { b: "bg-amber-500/15", t: "text-amber-600", l: "منتهي" },
    };
    const s = m[status] || { b: "bg-muted", t: "text-muted-foreground", l: status };
    return <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.b} ${s.t} font-medium`}>{s.l}</span>;
  };

  const serialFor = (code: string) => {
    const hash = code.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xFFFFFF, 0);
    return hash.toString(16).toUpperCase().padStart(6, "0");
  };

  const cardsToShow = generatedCodes.length > 0
    ? generatedCodes
    : vouchers.filter(v => v.status === "active").slice(0, 50).map(v => ({ code: v.code, amount: Number(v.amount), audience: v.audience || ("any" as AudienceType) }));

  return (
    <AdminLayout title="كروت الشحن" subtitle="إصدار وطباعة كروت شحن السائقين والركاب">
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { v: stats.total, l: "إجمالي", c: "text-foreground" },
            { v: stats.active, l: "فعّالة", c: "text-emerald-600" },
            { v: stats.redeemed, l: "مستخدمة", c: "text-blue-600" },
            { v: stats.driverActive, l: "🚗 سائق", c: "text-blue-500" },
            { v: stats.riderActive, l: "👤 راكب", c: "text-emerald-500" },
            { v: stats.totalValue.toLocaleString('en-US'), l: "قيمة الفعّالة", c: "text-amber-600" },
          ].map((s, i) => (
            <Card key={i}>
              <CardContent className="pt-3 pb-2 text-center">
                <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
                <p className="text-[10px] text-muted-foreground">{s.l}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Generate */}
        <Card className="border-2 border-amber-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> إصدار دفعة كروت شحن</CardTitle>
            <CardDescription>أكواد فريدة — RD- للسائق، RR- للراكب، RAAN- عام</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Audience selector */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">نوع الكارت</Label>
              <div className="flex gap-2">
                {(["driver", "rider", "any"] as AudienceType[]).map((a) => {
                  const cfg = AUDIENCE_CONFIG[a];
                  const isActive = audience === a;
                  return (
                    <button
                      key={a}
                      onClick={() => { setAudience(a); setAmount(a === "driver" ? 3000 : 5000); }}
                      className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all text-center ${
                        isActive ? "border-current ring-2 ring-offset-2" : "border-muted hover:border-muted-foreground/30"
                      }`}
                      style={isActive ? { borderColor: cfg.color, color: cfg.color } : {}}
                    >
                      <div className="text-lg mb-0.5">
                        {a === "driver" ? "🚗" : a === "rider" ? "👤" : "🌐"}
                      </div>
                      <div className={`text-sm font-bold ${isActive ? "" : "text-muted-foreground"}`}>{cfg.label}</div>
                      <div className="text-[10px] text-muted-foreground">{cfg.prefix}XXXX-XXXX</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount presets */}
            <div className="space-y-1.5">
              <Label className="text-xs">المبلغ المقترح</Label>
              <div className="flex gap-2">
                {suggestedAmounts.map((a) => (
                  <Button key={a} variant={amount === a ? "default" : "outline"} size="sm"
                    onClick={() => setAmount(a)} className="flex-1"
                  >
                    {a.toLocaleString('en-US')}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">العدد (1-500)</Label>
                <Input type="number" min={1} max={500} value={count} onChange={(e) => setCount(parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">المبلغ (د.ع)</Label>
                <Input type="number" min={250} step={250} value={amount} onChange={(e) => setAmount(parseInt(e.target.value) || 250)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">اسم الدفعة</Label>
                <Input placeholder="مايو_2026" value={batchName} onChange={(e) => setBatchName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">صلاحية (أيام)</Label>
                <Input type="number" min={1} placeholder="∞" value={expiresDays} onChange={(e) => setExpiresDays(e.target.value ? parseInt(e.target.value) : "")} />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <Button onClick={handleGenerate} disabled={generating}
                className="gap-2" style={{ background: AUDIENCE_CONFIG[audience].color }}
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
                إصدار {count} كارت {AUDIENCE_CONFIG[audience].label} × {amount.toLocaleString('en-US')} د.ع
              </Button>
              <span className="text-sm text-muted-foreground">
                = <strong>{(count * amount).toLocaleString('en-US')}</strong> د.ع
              </span>
            </div>

            {/* Export buttons */}
            {cardsToShow.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button size="sm" variant="outline" onClick={handleCopyAll} className="gap-1.5"><Copy className="w-3.5 h-3.5" /> نسخ</Button>
                <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-1.5"><FileText className="w-3.5 h-3.5" /> CSV</Button>
                <Button size="sm" variant="outline" onClick={handlePrintPDF} className="gap-1.5"><Printer className="w-3.5 h-3.5" /> PDF</Button>
                <div className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => setShowCodes(!showCodes)} className="gap-1.5">
                  {showCodes ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showCodes ? "إخفاء" : "إظهار"}
                </Button>
                <Button size="sm" variant={previewMode ? "default" : "ghost"} onClick={() => setPreviewMode(!previewMode)} className="gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> {previewMode ? "إغلاق" : "معاينة"}
                </Button>
              </div>
            )}

            {/* Preview */}
            {previewMode && cardsToShow.length > 0 && (
              <div className="p-4 rounded-xl bg-muted/50 border">
                <div ref={printRef} className="flex flex-wrap gap-5 justify-center">
                  {cardsToShow.map((c) => (
                    <VoucherCard key={c.code} code={c.code} amount={c.amount} serial={serialFor(c.code)} showCode={showCodes} audience={c.audience} />
                  ))}
                </div>
              </div>
            )}

            {!previewMode && (
              <div ref={printRef} style={{ position: "absolute", left: "-9999px", top: 0 }}>
                {cardsToShow.map((c) => (
                  <VoucherCard key={c.code} code={c.code} amount={c.amount} serial={serialFor(c.code)} showCode={showCodes} audience={c.audience} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-base">سجل الكروت ({filtered.length})</CardTitle>
              <div className="flex gap-2">
                <div className="flex rounded-lg border overflow-hidden">
                  {(["all", "driver", "rider", "any"] as const).map((a) => (
                    <button key={a} onClick={() => setFilterAudience(a)}
                      className={`px-3 py-1.5 text-xs transition-colors ${filterAudience === a ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      {a === "all" ? "الكل" : a === "driver" ? "🚗" : a === "rider" ? "👤" : "🌐"}
                    </button>
                  ))}
                </div>
                <div className="relative w-48">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-9 h-9" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">لا توجد كروت</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-right">
                      <th className="py-2 pr-3 font-medium">الكود</th>
                      <th className="py-2 font-medium">النوع</th>
                      <th className="py-2 font-medium">المبلغ</th>
                      <th className="py-2 font-medium">الحالة</th>
                      <th className="py-2 font-medium">الدفعة</th>
                      <th className="py-2 font-medium">التاريخ</th>
                      <th className="py-2 font-medium w-16">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((v) => (
                      <tr key={v.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-2 pr-3">
                          <button onClick={() => handleCopy(v.code, v.id)}
                            className="font-mono text-xs bg-muted px-2 py-1 rounded hover:bg-muted-foreground/10 transition-colors flex items-center gap-1.5"
                          >
                            {v.code}
                            {copiedId === v.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                          </button>
                        </td>
                        <td className="py-2">{audienceBadge(v.audience)}</td>
                        <td className="py-2 font-bold">{Number(v.amount).toLocaleString('en-US')}</td>
                        <td className="py-2">{statusBadge(v.status)}</td>
                        <td className="py-2 text-xs text-muted-foreground">{v.batch_name || "—"}</td>
                        <td className="py-2 text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString("ar-IQ")}</td>
                        <td className="py-2">
                          {v.status === "active" && (
                            <Button size="sm" variant="ghost" onClick={() => handleDisable(v.id)} className="h-7 text-red-500 hover:text-red-600 hover:bg-red-500/10">
                              <Ban className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {v.status === "redeemed" && v.redeemed_at && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />{new Date(v.redeemed_at).toLocaleDateString("ar-IQ")}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminVouchers;
