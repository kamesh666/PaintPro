import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../constants/colors";
import { InputStyles } from "../constants/theme";
import { useClients, useProjects } from "../hooks/useSupabase";
import { supabase } from "../lib/supabase";
import { formatCurrency, formatDate } from "../lib/utils";
import { useAuthStore } from "../store/authStore";

// ─── Work types with standard rates ──────────────────────
const WORK_TYPES = [
  {
    key: "white_cement",
    label: "White cement",
    icon: "⬜",
    unit: "sqft",
    rate: 1.5,
  },
  {
    key: "putty_2coat",
    label: "Putty 2 coat",
    icon: "🪣",
    unit: "sqft",
    rate: 6,
  },
  {
    key: "putty_1coat",
    label: "Putty 1 coat",
    icon: "🪣",
    unit: "sqft",
    rate: 3.5,
  },
  { key: "primer", label: "Primer", icon: "🖌", unit: "sqft", rate: 4 },
  {
    key: "interior_emulsion",
    label: "Interior emulsion",
    icon: "🏠",
    unit: "sqft",
    rate: 12,
  },
  {
    key: "interior_luxury",
    label: "Interior luxury paint",
    icon: "🏠",
    unit: "sqft",
    rate: 18,
  },
  {
    key: "ceiling_paint",
    label: "Ceiling paint",
    icon: "⬆",
    unit: "sqft",
    rate: 10,
  },
  {
    key: "exterior_emulsion",
    label: "Exterior emulsion",
    icon: "🏗",
    unit: "sqft",
    rate: 14,
  },
  {
    key: "exterior_weather",
    label: "Weathershield",
    icon: "🏗",
    unit: "sqft",
    rate: 22,
  },
  {
    key: "texture_paint",
    label: "Texture paint",
    icon: "🌀",
    unit: "sqft",
    rate: 25,
  },
  {
    key: "wood_polish",
    label: "Wood polish",
    icon: "🪵",
    unit: "sqft",
    rate: 30,
  },
  {
    key: "wood_enamel",
    label: "Wood enamel",
    icon: "🚪",
    unit: "sqft",
    rate: 20,
  },
  {
    key: "grill_paint",
    label: "Grill / MS paint",
    icon: "🔩",
    unit: "sqft",
    rate: 15,
  },
  {
    key: "window_door",
    label: "Window / Door",
    icon: "🪟",
    unit: "nos",
    rate: 350,
  },
  {
    key: "waterproofing",
    label: "Waterproofing",
    icon: "💧",
    unit: "sqft",
    rate: 18,
  },
  {
    key: "full_interior",
    label: "Full interior package",
    icon: "🏡",
    unit: "sqft",
    rate: 28,
  },
  {
    key: "full_exterior",
    label: "Full exterior package",
    icon: "🏘",
    unit: "sqft",
    rate: 35,
  },
  { key: "custom", label: "Custom item", icon: "📝", unit: "sqft", rate: 0 },
];

const STATUS_CONFIG = {
  draft: { bg: "#F1F5F9", text: "#475569", dot: "#94A3B8" },
  sent: { bg: "#FAEEDA", text: "#633806", dot: "#F39C12" },
  approved: { bg: "#D1FAE5", text: "#065F46", dot: "#27AE60" },
  rejected: { bg: "#FCEBEB", text: "#791F1F", dot: "#E74C3C" },
};

function genNo() {
  return `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// ─── Build PDF HTML ───────────────────────────────────────
function buildPDF(quotation, items, client, project) {
  const subtotal = items.reduce((s, i) => {
    const isSqft = (i.unit ?? "sqft") === "sqft";
    const t = isSqft
      ? (Number(i.area_sqft) || 0) *
        (Number(i.rate_per_sqft) || 0) *
        (Number(i.quantity) || 1)
      : (Number(i.rate_per_sqft) || 0) * (Number(i.quantity) || 1);
    return s + t;
  }, 0);

  const rows = items
    .map((item, idx) => {
      const wt =
        WORK_TYPES.find((w) => w.key === item.work_type) ??
        WORK_TYPES[WORK_TYPES.length - 1];
      const isSqft = (item.unit ?? "sqft") === "sqft";
      const total = isSqft
        ? (Number(item.area_sqft) || 0) *
          (Number(item.rate_per_sqft) || 0) *
          (Number(item.quantity) || 1)
        : (Number(item.rate_per_sqft) || 0) * (Number(item.quantity) || 1);
      return `<tr>
      <td style="text-align:center;color:#6B7280">${idx + 1}</td>
      <td><span style="background:#EFF6FF;color:#1E40AF;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:700">${wt.icon} ${wt.label}</span></td>
      <td style="color:#4B5563">${item.description ?? ""}</td>
      <td style="text-align:right">${isSqft ? Number(item.area_sqft || 0).toLocaleString("en-IN") : "—"}</td>
      <td style="text-align:right">₹${Number(item.rate_per_sqft || 0).toLocaleString("en-IN")}</td>
      <td style="text-align:center">${item.quantity ?? 1} ${item.unit ?? "sqft"}</td>
      <td style="text-align:right;font-weight:700;color:#1E3A5F">₹${total.toLocaleString("en-IN")}</td>
    </tr>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;padding:32px;color:#1A1A2E;font-size:13px}
.header{display:flex;justify-content:space-between;margin-bottom:20px}
.brand{font-size:26px;font-weight:900;color:#1E3A5F}
.brand-sub{font-size:11px;color:#6B7280;letter-spacing:2px;text-transform:uppercase;margin-top:2px}
.divider{height:3px;background:#1E3A5F;margin:0 0 18px;border-radius:2px}
.parties{display:flex;gap:16px;margin-bottom:20px}
.party{flex:1;background:#F8FAFC;border-radius:8px;padding:12px}
.plbl{font-size:10px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:5px}
.pname{font-size:15px;font-weight:700;margin-bottom:3px}
.pinfo{font-size:11px;color:#6B7280;line-height:1.7}
table{width:100%;border-collapse:collapse;margin-bottom:18px}
thead tr{background:#1E3A5F}
th{color:#fff;padding:9px 10px;text-align:left;font-size:11px;font-weight:700}
td{padding:9px 10px;border-bottom:1px solid #F0F0F0;font-size:12px;vertical-align:middle}
tr:nth-child(even) td{background:#FAFBFC}
.total-wrap{display:flex;justify-content:flex-end;margin-bottom:16px}
.total-box{width:240px;border:1px solid #E0E0E0;border-radius:8px;overflow:hidden}
.trow{display:flex;justify-content:space-between;padding:9px 13px;border-bottom:1px solid #F0F0F0;font-size:12px}
.trow.grand{background:#1E3A5F;color:#fff;font-size:15px;font-weight:800;border:none}
.sign-row{display:flex;justify-content:space-between;margin-top:36px}
.sign-box{text-align:center;width:42%}
.sign-line{border-top:1px solid #1A1A2E;padding-top:6px;font-size:11px;color:#6B7280}
.footer{text-align:center;font-size:10px;color:#9CA3AF;border-top:1px solid #E0E0E0;padding-top:12px;margin-top:18px}
</style></head><body>
<div class="header">
  <div><div class="brand">🎨 PaintPro</div><div class="brand-sub">Painting Contractor</div></div>
  <div style="text-align:right">
    <div style="font-size:20px;font-weight:800;color:#1E3A5F">QUOTATION</div>
    <div style="font-size:14px;font-weight:700;margin-top:2px">${quotation.quotation_no}</div>
    <div style="font-size:11px;color:#6B7280;margin-top:3px">Date: ${formatDate(quotation.quotation_date)}</div>
    ${quotation.valid_until ? `<div style="font-size:11px;color:#6B7280">Valid until: ${formatDate(quotation.valid_until)}</div>` : ""}
  </div>
</div>
<div class="divider"></div>
<div class="parties">
  <div class="party">
    <div class="plbl">Prepared for</div>
    <div class="pname">${client?.name ?? "Client"}</div>
    <div class="pinfo">${client?.phone ? "📞 " + client.phone + "<br/>" : ""}${client?.address ? "📍 " + client.address : ""}</div>
  </div>
  <div class="party">
    <div class="plbl">Project site</div>
    <div class="pname">${project?.title ?? "—"}</div>
    <div class="pinfo">${project?.location ?? ""}</div>
  </div>
</div>
<table>
  <thead><tr>
    <th style="width:5%;text-align:center">#</th>
    <th style="width:20%">Type of work</th>
    <th style="width:26%">Description</th>
    <th style="width:11%;text-align:right">Area (sqft)</th>
    <th style="width:12%;text-align:right">Rate/sqft (₹)</th>
    <th style="width:12%;text-align:center">Qty / Unit</th>
    <th style="width:14%;text-align:right">Amount (₹)</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="total-wrap">
  <div class="total-box">
    <div class="trow"><span>Subtotal</span><span>₹${subtotal.toLocaleString("en-IN")}</span></div>
    <div class="trow grand"><span>Grand Total</span><span>₹${subtotal.toLocaleString("en-IN")}</span></div>
  </div>
</div>
${quotation.notes ? `<div style="background:#F5F6FA;border-radius:8px;padding:10px 12px;font-size:11px;margin-bottom:14px"><strong>Notes:</strong> ${quotation.notes}</div>` : ""}
${quotation.terms ? `<div style="font-size:11px;color:#6B7280;line-height:1.9;margin-bottom:16px"><strong style="color:#1A1A2E">Terms & Conditions:</strong><br/>${quotation.terms}</div>` : ""}
<div class="sign-row">
  <div class="sign-box"><div class="sign-line">Client signature & date</div></div>
  <div class="sign-box"><div class="sign-line">Contractor signature & date</div></div>
</div>
<div class="footer">PaintPro · Quotation ${quotation.quotation_no} · ${new Date().toLocaleDateString("en-IN")}</div>
</body></html>`;
}

// ─── Work Item Row ────────────────────────────────────────
function ItemRow({ item, index, onChange, onRemove }) {
  const [typeOpen, setTypeOpen] = useState(false);
  const wt = WORK_TYPES.find((w) => w.key === item.work_type) ?? WORK_TYPES[0];
  const isSqft = (item.unit ?? "sqft") === "sqft";
  const total = isSqft
    ? (parseFloat(item.area_sqft) || 0) *
      (parseFloat(item.rate) || 0) *
      (parseFloat(item.quantity) || 1)
    : (parseFloat(item.rate) || 0) * (parseFloat(item.quantity) || 1);

  return (
    <View style={styles.itemBox}>
      {/* Row header */}
      <View style={styles.itemHead}>
        <Text style={styles.itemNum}>#{index + 1}</Text>
        <TouchableOpacity
          style={styles.typePill}
          onPress={() => setTypeOpen(!typeOpen)}
          activeOpacity={0.8}
        >
          <Text style={styles.typePillText} numberOfLines={1}>
            {wt.icon} {wt.label}
          </Text>
          <Text style={styles.typeArrow}>{typeOpen ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
          <Text style={{ color: Colors.danger, fontSize: 18 }}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Type dropdown */}
      {typeOpen && (
        <View style={styles.typeDropdown}>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
            {WORK_TYPES.map((w) => (
              <TouchableOpacity
                key={w.key}
                style={[
                  styles.typeDropItem,
                  item.work_type === w.key && styles.typeDropItemActive,
                ]}
                onPress={() => {
                  onChange("work_type", w.key);
                  onChange("unit", w.unit);
                  if (w.rate > 0) onChange("rate", w.rate.toString());
                  setTypeOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.typeDropText,
                    item.work_type === w.key && {
                      color: Colors.primary,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {w.icon} {w.label}
                </Text>
                {w.rate > 0 && (
                  <Text style={styles.typeDropRate}>
                    ₹{w.rate}/{w.unit}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Description */}
      <TextInput
        style={[InputStyles, { marginBottom: 8 }]}
        value={item.description}
        onChangeText={(v) => onChange("description", v)}
        placeholder="Description / details"
        placeholderTextColor="#9CA3AF"
        underlineColorAndroid="transparent"
      />

      {/* Fields */}
      <View style={styles.itemFields}>
        {isSqft && (
          <View style={styles.itemField}>
            <Text style={styles.fieldLbl}>Area (sqft)</Text>
            <TextInput
              style={[InputStyles, styles.fieldInput]}
              value={item.area_sqft}
              onChangeText={(v) => onChange("area_sqft", v)}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              underlineColorAndroid="transparent"
            />
          </View>
        )}
        <View style={styles.itemField}>
          <Text style={styles.fieldLbl}>Rate / {item.unit ?? "sqft"} (₹)</Text>
          <TextInput
            style={[InputStyles, styles.fieldInput]}
            value={item.rate}
            onChangeText={(v) => onChange("rate", v)}
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            underlineColorAndroid="transparent"
          />
        </View>
        <View style={styles.itemField}>
          <Text style={styles.fieldLbl}>Qty</Text>
          <TextInput
            style={[InputStyles, styles.fieldInput]}
            value={item.quantity}
            onChangeText={(v) => onChange("quantity", v)}
            placeholder="1"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            underlineColorAndroid="transparent"
          />
        </View>
        <View style={[styles.itemField, styles.amtField]}>
          <Text style={styles.fieldLbl}>Amount</Text>
          <Text style={styles.amtText}>{formatCurrency(total)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Quotation Modal ──────────────────────────────────────
function QuotationModal({ visible, onClose, quotation, onSaved }) {
  const { data: projects } = useProjects();
  const { data: clients } = useClients();
  const profile = useAuthStore((s) => s.profile);
  const isEdit = !!quotation?.id;

  const [qtNo, setQtNo] = useState("");
  const [qtDate, setQtDate] = useState("");
  const [validTill, setValidTill] = useState("");
  const [projId, setProjId] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("50% advance, balance on completion.");
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [projOpen, setProjOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const newItem = () => ({
    work_type: "interior_emulsion",
    description: "",
    area_sqft: "",
    rate: "12",
    quantity: "1",
    unit: "sqft",
  });

  useEffect(() => {
    if (!visible) return;
    setQtNo(quotation?.quotation_no ?? genNo());
    setQtDate(
      quotation?.quotation_date ?? new Date().toISOString().split("T")[0],
    );
    setValidTill(quotation?.valid_until ?? "");
    setProjId(quotation?.project_id ?? "");
    setClientId(quotation?.client_id ?? "");
    setStatus(quotation?.status ?? "draft");
    setNotes(quotation?.notes ?? "");
    setTerms(quotation?.terms ?? "50% advance, balance on completion.");
    setProjOpen(false);
    setClientOpen(false);
    setStatusOpen(false);

    if (quotation?.quotation_items?.length) {
      setItems(
        quotation.quotation_items.map((i) => ({
          work_type: i.work_type ?? "custom",
          description: i.description ?? "",
          area_sqft: (i.area_sqft ?? 0).toString(),
          rate: (i.rate_per_sqft ?? 0).toString(),
          quantity: (i.quantity ?? 1).toString(),
          unit: i.unit ?? "sqft",
        })),
      );
    } else {
      setItems([newItem()]);
    }
  }, [visible, quotation?.id]);

  // Auto-fill client from project
  useEffect(() => {
    if (projId && !isEdit) {
      const p = projects?.find((p) => p.id === projId);
      if (p?.client_id) setClientId(p.client_id);
    }
  }, [projId]);

  const updateItem = (i, key, val) =>
    setItems((prev) =>
      prev.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)),
    );

  const grandTotal = items.reduce((s, it) => {
    const isSqft = (it.unit ?? "sqft") === "sqft";
    return (
      s +
      (isSqft
        ? (parseFloat(it.area_sqft) || 0) *
          (parseFloat(it.rate) || 0) *
          (parseFloat(it.quantity) || 1)
        : (parseFloat(it.rate) || 0) * (parseFloat(it.quantity) || 1))
    );
  }, 0);

  const selProject = projects?.find((p) => p.id === projId);
  const selClient = clients?.find((c) => c.id === clientId);

  const handleSave = async () => {
    if (!projId) {
      Alert.alert("Required", "Select a project");
      return;
    }
    if (!items.length) {
      Alert.alert("Required", "Add at least one item");
      return;
    }
    setSaving(true);
    try {
      // Upsert quotation
      const qtPayload = {
        quotation_no: qtNo,
        quotation_date: qtDate,
        valid_until: validTill || null,
        project_id: projId,
        client_id: clientId || null,
        status,
        notes,
        terms,
        created_by: profile?.id,
      };

      let qtId = quotation?.id;
      if (isEdit) {
        const { error } = await supabase
          .from("quotations")
          .update(qtPayload)
          .eq("id", qtId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("quotations")
          .insert(qtPayload)
          .select()
          .single();
        if (error) throw error;
        qtId = data.id;
      }

      // Delete old items and re-insert
      await supabase.from("quotation_items").delete().eq("quotation_id", qtId);
      const itemPayloads = items
        .filter((it) => it.rate)
        .map((it, i) => ({
          quotation_id: qtId,
          work_type: it.work_type,
          description: it.description || null,
          area_sqft: parseFloat(it.area_sqft) || 0,
          rate_per_sqft: parseFloat(it.rate) || 0,
          quantity: parseFloat(it.quantity) || 1,
          unit: it.unit ?? "sqft",
          sort_order: i,
        }));
      if (itemPayloads.length) {
        const { error } = await supabase
          .from("quotation_items")
          .insert(itemPayloads);
        if (error) throw error;
      }

      onSaved();
      onClose();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const Picker = ({ label, open, toggle, display, placeholder, children }) => (
    <View style={{ marginBottom: 4 }}>
      <Text style={LabelStyles}>{label}</Text>
      <TouchableOpacity style={styles.picker} onPress={toggle}>
        <Text
          style={display ? styles.pickerVal : styles.pickerPh}
          numberOfLines={1}
        >
          {display ?? placeholder}
        </Text>
        <Text style={styles.pickerArrow}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {open && <View style={styles.dropdown}>{children}</View>}
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4, width: 32 }}>
            <Text style={{ fontSize: 18, color: Colors.textSecondary }}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {isEdit ? "Edit quotation" : "New quotation"}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          >
            <Text style={styles.saveBtnText}>
              {saving ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1, padding: 16 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Qt no + date */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={LabelStyles}>Quotation no.</Text>
              <TextInput
                style={InputStyles}
                value={qtNo}
                onChangeText={setQtNo}
                underlineColorAndroid="transparent"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={LabelStyles}>Date</Text>
              <TextInput
                style={InputStyles}
                value={qtDate}
                onChangeText={setQtDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
                keyboardType="numbers-and-punctuation"
                underlineColorAndroid="transparent"
              />
            </View>
          </View>

          <Text style={LabelStyles}>Valid until (optional)</Text>
          <TextInput
            style={InputStyles}
            value={validTill}
            onChangeText={setValidTill}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9CA3AF"
            keyboardType="numbers-and-punctuation"
            underlineColorAndroid="transparent"
          />

          {/* Project */}
          <Picker
            label="Project *"
            open={projOpen}
            toggle={() => {
              setProjOpen(!projOpen);
              setClientOpen(false);
              setStatusOpen(false);
            }}
            display={selProject?.title}
            placeholder="Select project"
          >
            {(projects ?? []).map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.dropItem,
                  projId === p.id && styles.dropItemActive,
                ]}
                onPress={() => {
                  setProjId(p.id);
                  setProjOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.dropText,
                    projId === p.id && {
                      color: Colors.primary,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {p.title}
                </Text>
                {p.location ? (
                  <Text style={styles.dropSub}>📍 {p.location}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </Picker>

          {/* Client */}
          <Picker
            label="Client"
            open={clientOpen}
            toggle={() => {
              setClientOpen(!clientOpen);
              setProjOpen(false);
              setStatusOpen(false);
            }}
            display={selClient?.name}
            placeholder="Select client (auto from project)"
          >
            {(clients ?? []).map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.dropItem,
                  clientId === c.id && styles.dropItemActive,
                ]}
                onPress={() => {
                  setClientId(c.id);
                  setClientOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.dropText,
                    clientId === c.id && {
                      color: Colors.primary,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {c.name}
                </Text>
                {c.phone ? (
                  <Text style={styles.dropSub}>📞 {c.phone}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </Picker>

          {/* Status */}
          <Picker
            label="Status"
            open={statusOpen}
            toggle={() => {
              setStatusOpen(!statusOpen);
              setProjOpen(false);
              setClientOpen(false);
            }}
            display={status.charAt(0).toUpperCase() + status.slice(1)}
            placeholder=""
          >
            {Object.keys(STATUS_CONFIG).map((k) => (
              <TouchableOpacity
                key={k}
                style={[styles.dropItem, status === k && styles.dropItemActive]}
                onPress={() => {
                  setStatus(k);
                  setStatusOpen(false);
                }}
              >
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                >
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: STATUS_CONFIG[k].dot },
                    ]}
                  />
                  <Text
                    style={[
                      styles.dropText,
                      status === k && {
                        color: Colors.primary,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {k.charAt(0).toUpperCase() + k.slice(1)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </Picker>

          {/* Work items */}
          <View style={styles.itemsHeader}>
            <Text style={styles.itemsTitle}>Work items</Text>
            <TouchableOpacity
              style={styles.addItemBtn}
              onPress={() => setItems((prev) => [...prev, newItem()])}
            >
              <Text style={styles.addItemText}>+ Add item</Text>
            </TouchableOpacity>
          </View>

          {items.map((item, i) => (
            <ItemRow
              key={i}
              item={item}
              index={i}
              onChange={(key, val) => updateItem(i, key, val)}
              onRemove={() =>
                setItems((prev) => prev.filter((_, idx) => idx !== i))
              }
            />
          ))}

          {/* Grand total */}
          {grandTotal > 0 && (
            <View style={styles.grandBox}>
              <Text style={styles.grandLabel}>
                {items.length} items · Grand total estimate
              </Text>
              <Text style={styles.grandValue}>
                {formatCurrency(grandTotal)}
              </Text>
            </View>
          )}

          <Text style={LabelStyles}>Notes</Text>
          <TextInput
            style={[InputStyles, { height: 72, textAlignVertical: "top" }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes for client..."
            placeholderTextColor="#9CA3AF"
            multiline
            underlineColorAndroid="transparent"
          />

          <Text style={LabelStyles}>Terms & conditions</Text>
          <TextInput
            style={[INPUT, { height: 80, textAlignVertical: "top" }]}
            value={terms}
            onChangeText={setTerms}
            multiline
            underlineColorAndroid="transparent"
          />

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────
export default function QuotationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const projId = params.projectId ?? null;
  const projTitle = params.projectTitle ?? "All Projects";

  const [filter, setFilter] = useState(projId);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { data: projects } = useProjects();

  const fetchQuotations = async () => {
    try {
      let q = supabase
        .from("quotations")
        .select(
          "*, clients(name,phone), projects(title,location), quotation_items(*)",
        )
        .order("created_at", { ascending: false });
      if (filter) q = q.eq("project_id", filter);
      const { data, error } = await q;
      if (error) throw error;
      setQuotations(data ?? []);
    } catch (e) {
      console.log("Quotation fetch error:", e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, [filter]);

  const handleDelete = (id) => {
    Alert.alert("Delete", "Delete this quotation?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await supabase.from("quotations").delete().eq("id", id);
          fetchQuotations();
        },
      },
    ]);
  };

  const handleShare = async (qt) => {
    try {
      const items = qt.quotation_items ?? [];
      const html = buildPDF(qt, items, qt.clients, qt.projects);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Quotation ${qt.quotation_no}`,
      });
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const s = (st) => STATUS_CONFIG[st] ?? STATUS_CONFIG.draft;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
            ← Back
          </Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Quotations</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {projTitle}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setSelected(null);
            setModalOpen(true);
          }}
          style={styles.addBtn}
        >
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Project filter chips */}
      {!projId && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 44, marginBottom: 8 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          <TouchableOpacity
            style={[styles.chip, !filter && styles.chipActive]}
            onPress={() => setFilter(null)}
          >
            <Text style={[styles.chipText, !filter && styles.chipTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {(projects ?? []).map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, filter === p.id && styles.chipActive]}
              onPress={() => setFilter(p.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  filter === p.id && styles.chipTextActive,
                ]}
                numberOfLines={1}
              >
                {p.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeleton} />
          ))}
        </View>
      ) : !quotations.length ? (
        <View style={styles.empty}>
          <Text style={{ fontSize: 52, marginBottom: 16 }}>📄</Text>
          <Text style={styles.emptyTitle}>No quotations yet</Text>
          <Text style={styles.emptyMsg}>
            Create professional quotations with sqft-based pricing
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => setModalOpen(true)}
          >
            <Text style={styles.emptyBtnText}>Create first quotation</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={quotations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: 16,
            paddingTop: 0,
            paddingBottom: 100,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchQuotations();
              }}
              tintColor={Colors.primary}
            />
          }
          renderItem={({ item: qt }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                setSelected(qt);
                setModalOpen(true);
              }}
              activeOpacity={ActiveOpacity}
            >
              {/* Card header */}
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardNo}>{qt.quotation_no}</Text>
                  <Text style={styles.cardClient} numberOfLines={1}>
                    👤 {qt.clients?.name ?? "—"}
                  </Text>
                  <Text style={styles.cardProj} numberOfLines={1}>
                    📋 {qt.projects?.title ?? "—"}
                  </Text>
                  <Text style={styles.cardDate}>
                    📅 {formatDate(qt.quotation_date)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: s(qt.status).bg },
                    ]}
                  >
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: s(qt.status).dot },
                      ]}
                    />
                    <Text
                      style={[styles.statusText, { color: s(qt.status).text }]}
                    >
                      {qt.status.charAt(0).toUpperCase() + qt.status.slice(1)}
                    </Text>
                  </View>
                  {/* Grand total from items */}
                  <Text style={styles.cardTotal}>
                    {formatCurrency(
                      (qt.quotation_items ?? []).reduce((sum, it) => {
                        const isSqft = (it.unit ?? "sqft") === "sqft";
                        return (
                          sum +
                          (isSqft
                            ? (Number(it.area_sqft) || 0) *
                              (Number(it.rate_per_sqft) || 0) *
                              (Number(it.quantity) || 1)
                            : (Number(it.rate_per_sqft) || 0) *
                              (Number(it.quantity) || 1))
                        );
                      }, 0),
                    )}
                  </Text>
                </View>
              </View>

              {/* Items summary */}
              {(qt.quotation_items ?? []).length > 0 && (
                <View style={styles.itemsSummary}>
                  {(qt.quotation_items ?? []).slice(0, 4).map((it, i) => {
                    const w = WORK_TYPES.find((w) => w.key === it.work_type);
                    return (
                      <View key={i} style={styles.itemPill}>
                        <Text style={styles.itemPillText}>
                          {w?.icon ?? "📝"} {w?.label ?? it.work_type}
                        </Text>
                        <Text style={styles.itemPillRate}>
                          ₹{it.rate_per_sqft}/{it.unit}
                        </Text>
                      </View>
                    );
                  })}
                  {(qt.quotation_items ?? []).length > 4 && (
                    <View style={styles.itemPill}>
                      <Text style={styles.itemPillText}>
                        +{(qt.quotation_items ?? []).length - 4} more
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Actions */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={() => handleShare(qt)}
                >
                  <Text style={styles.shareBtnText}>↗ Share PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(qt.id)}>
                  <Text style={{ color: Colors.danger, fontSize: 13 }}>
                    🗑 Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setSelected(null);
          setModalOpen(true);
        }}
        activeOpacity={ActiveOpacity}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <QuotationModal
        visible={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelected(null);
        }}
        quotation={selected}
        onSaved={fetchQuotations}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 48,
    gap: 10,
  },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  addBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "500" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  skeleton: {
    height: 130,
    backgroundColor: "#E0E0E0",
    borderRadius: 14,
    opacity: 0.5,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: 8,
  },
  emptyMsg: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    padding: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cardTop: { flexDirection: "row", gap: 10, marginBottom: 10 },
  cardNo: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.primary,
    marginBottom: 3,
  },
  cardClient: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A2E",
    marginBottom: 2,
  },
  cardProj: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  cardDate: { fontSize: 11, color: Colors.textMuted },
  cardTotal: { fontSize: 18, fontWeight: "800", color: "#1A1A2E" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  itemsSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 10,
  },
  itemPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  itemPillText: { fontSize: 11, color: "#1E40AF", fontWeight: "600" },
  itemPillRate: { fontSize: 10, color: Colors.textMuted },
  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#F0F0F0",
  },
  shareBtn: {
    backgroundColor: Colors.primary + "15",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  shareBtnText: { fontSize: 13, color: Colors.primary, fontWeight: "700" },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
  },
  fabIcon: { color: "#fff", fontSize: 28, fontWeight: "300", lineHeight: 32 },
  modal: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#1A1A2E" },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  picker: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerVal: { fontSize: 15, color: "#1A1A2E", flex: 1 },
  pickerPh: { fontSize: 15, color: "#9CA3AF", flex: 1 },
  pickerArrow: { fontSize: 12, color: Colors.textMuted },
  dropdown: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    marginTop: 4,
    overflow: "hidden",
  },
  dropItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
  },
  dropItemActive: { backgroundColor: "#EFF6FF" },
  dropText: { fontSize: 15, color: "#1A1A2E" },
  dropSub: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  itemsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  itemsTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A2E" },
  addItemBtn: {
    backgroundColor: Colors.primary + "15",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addItemText: { fontSize: 13, color: Colors.primary, fontWeight: "700" },
  itemBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  itemHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  itemNum: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textMuted,
    width: 26,
  },
  typePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.primary + "12",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typePillText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
    flex: 1,
  },
  typeArrow: { fontSize: 11, color: Colors.primary },
  removeBtn: { padding: 4 },
  typeDropdown: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    marginBottom: 8,
    overflow: "hidden",
  },
  typeDropItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F0F0F0",
  },
  typeDropItemActive: { backgroundColor: "#EFF6FF" },
  typeDropText: { fontSize: 14, color: "#1A1A2E", flex: 1 },
  typeDropRate: { fontSize: 12, fontWeight: "700", color: Colors.success },
  itemFields: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  itemField: { minWidth: "30%", flex: 1 },
  fieldLbl: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textMuted,
    marginBottom: 4,
  },
  fieldInput: { paddingVertical: 9 },
  amtField: {
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 10,
    justifyContent: "center",
  },
  amtText: { fontSize: 16, fontWeight: "800", color: Colors.primary },
  grandBox: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  grandLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)" },
  grandValue: { fontSize: 26, fontWeight: "900", color: "#fff" },
});
