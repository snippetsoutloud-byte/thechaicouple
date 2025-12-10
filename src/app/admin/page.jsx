"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getTodayKey, auth } from "@/lib/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Minus, Plus, Edit, Trash2, Loader2, RotateCw, UserPlus } from "lucide-react";
import { ITEM_NAMES, isChai, isBun, isTiramisu, isMilkBun } from "@/lib/item-names";

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
});

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthed(Boolean(user));
      setCheckingAuth(false);
    });
    return () => unsub();
  }, []);

  if (checkingAuth) {
    return null;
  }

  if (!authed) {
    return <AdminLogin onAuthed={() => setAuthed(true)} />;
  }

  return <AdminDashboard />;
}

function AdminLogin({ onAuthed }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onAuthed();
    } catch (err) {
      setError("Login failed. Check your credentials and try again.");
      setLoading(false);
      return;
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-muted/40 flex items-center justify-center p-6">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto h-28 w-28 overflow-hidden rounded-full border-4 border-white shadow">
            <Image
              src="/thechaicouple.jpg"
              alt="Chai bun brand"
              width={160}
              height={160}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <CardTitle>Admin Sign In</CardTitle>
          <CardDescription>Only staff with registered Firebase accounts can access the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function AdminDashboard() {
  const todayKey = getTodayKey();

  const [tab, setTab] = useState("queue");
  const [queueTickets, setQueueTickets] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("connecting"); // "connected", "disconnected", "error", "connecting"

  const [dashboardDate, setDashboardDate] = useState(todayKey);
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [dashboardTickets, setDashboardTickets] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const [chaiPrice, setChaiPrice] = useState("");
  const [bunPrice, setBunPrice] = useState("");
  const [tiramisuPrice, setTiramisuPrice] = useState("");
  const [milkBunPrice, setMilkBunPrice] = useState("");
  const [pricingError, setPricingError] = useState("");
  const [pricingSaving, setPricingSaving] = useState(false);

  const [serviceStart, setServiceStart] = useState("06:00");
  const [serviceEnd, setServiceEnd] = useState("23:00");
  const [closedMessage, setClosedMessage] = useState("");
  const [inventory, setInventory] = useState(null); // null until loaded
  const [buffer, setBuffer] = useState({ chai: 10, bun: 10, tiramisu: 10, milkBun: 10 });
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [inventorySaving, setInventorySaving] = useState(false);

  const [clearing, setClearing] = useState(false);
  const [paidUpdating, setPaidUpdating] = useState({});
  const [editingTicket, setEditingTicket] = useState(null);
  const [editQuantities, setEditQuantities] = useState({ chai: 0, bun: 0, tiramisu: 0, milkBun: 0 });
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [clearTodayDialogOpen, setClearTodayDialogOpen] = useState(false);
  const [viewingTicket, setViewingTicket] = useState(null);
  const [orderDetailsDialogOpen, setOrderDetailsDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [addUserName, setAddUserName] = useState("");
  const [addUserQuantities, setAddUserQuantities] = useState({ chai: 0, bun: 0, tiramisu: 0, milkBun: 0 });
  const [addUserError, setAddUserError] = useState("");
  const [addUserSaving, setAddUserSaving] = useState(false);

  const loadDashboardTickets = useCallback(
    async (dateKey = dashboardDate, { silent } = {}) => {
      try {
        setDashboardError("");
        if (!silent) setDashboardLoading(true);
        const res = await fetch(`/api/queue?date=${dateKey}`);
        const json = await res.json();
        if (!res.ok) {
          setDashboardError(json.error || "Failed to load data");
          setDashboardLoading(false);
          return;
        }
        setDashboardTickets(json.tickets || []);
        setDashboardLoading(false);
      } catch {
        setDashboardError("Failed to load data");
        setDashboardLoading(false);
      }
    },
    [dashboardDate]
  );

  useEffect(() => {
    if (tab !== "queue") return;
    setQueueError("");
    setQueueLoading(true);
    setConnectionStatus("connecting");
    setInventoryLoaded(false); // Reset loading state when switching to queue tab
    const source = new EventSource(`/api/queue/stream?date=${todayKey}`);
    
    source.onopen = () => {
      setConnectionStatus("connected");
      setQueueError("");
    };
    
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        // Always update tickets if they exist in the payload
        if (payload.tickets !== undefined) {
          setQueueTickets(Array.isArray(payload.tickets) ? payload.tickets : []);
        }
        
        // Update settings (including inventory) in real-time
        if (payload.settings) {
          setInventory({
            chai: payload.settings.inventory?.chai ?? 0,
            bun: payload.settings.inventory?.bun ?? 0,
            tiramisu: payload.settings.inventory?.tiramisu ?? 0,
            milkBun: payload.settings.inventory?.milkBun ?? 0,
          });
          setBuffer({
            chai: payload.settings.buffer?.chai ?? 10,
            bun: payload.settings.buffer?.bun ?? 10,
            tiramisu: payload.settings.buffer?.tiramisu ?? 10,
            milkBun: payload.settings.buffer?.milkBun ?? 10,
          });
          setServiceStart(payload.settings.serviceStart || "06:00");
          setServiceEnd(payload.settings.serviceEnd || "23:00");
          setClosedMessage(payload.settings.closedMessage || "");
          setInventoryLoaded(true);
        }
        
        setQueueLoading(false);
        setQueueError("");
        setConnectionStatus("connected");
      } catch (err) {
        console.error("Error parsing stream message:", err, event.data);
        setConnectionStatus("error");
        setQueueLoading(false);
        // Don't show error message, just update status
      }
    };
    
    source.onerror = () => {
      setConnectionStatus("disconnected");
      // Don't show error message, just update status
      // Try to reconnect silently
      setTimeout(() => {
        if (source.readyState === EventSource.CLOSED) {
          setConnectionStatus("connecting");
        }
      }, 3000);
    };
    
    return () => {
      source.close();
      setConnectionStatus("disconnected");
    };
  }, [tab, todayKey]);

  useEffect(() => {
    if (tab !== "dashboard") return; // Only load when on dashboard tab
    loadDashboardTickets(dashboardDate);
  }, [tab, dashboardDate, loadDashboardTickets]);

  useEffect(() => {
    async function loadPricing() {
      try {
        const res = await fetch("/api/pricing");
        const json = await res.json();
        if (!res.ok) {
          setPricingError(json.error || "Failed to load pricing");
          return;
        }
        setChaiPrice(String(json.chaiPrice ?? ""));
        setBunPrice(String(json.bunPrice ?? ""));
        setTiramisuPrice(String(json.tiramisuPrice ?? ""));
        setMilkBunPrice(String(json.milkBunPrice ?? ""));
      } catch {
        setPricingError("Failed to load pricing");
      }
    }
    loadPricing();
  }, []);

  // const reloadInventory = useCallback(async () => {
  //   try {
  //     const res = await fetch("/api/settings");
  //     const json = await res.json();
  //     if (res.ok) {
  //       setInventory({
  //         chai: json.inventory?.chai ?? 0,
  //         bun: json.inventory?.bun ?? 0,
  //         tiramisu: json.inventory?.tiramisu ?? 0,
  //       });
  //     }
  //   } catch {
  //     // ignore
  //   }
  // }, []);

  useEffect(() => {
    if (tab !== "settings") return; // Only load when on Settings tab
    
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        const json = await res.json();
        if (!res.ok) {
          setSettingsError(json.error || "Failed to load settings");
          return;
        }
        setServiceStart(json.serviceStart || "06:00");
        setServiceEnd(json.serviceEnd || "23:00");
        setClosedMessage(json.closedMessage || "");
        setInventory({
          chai: json.inventory?.chai ?? 0,
          bun: json.inventory?.bun ?? 0,
          tiramisu: json.inventory?.tiramisu ?? 0,
          milkBun: json.inventory?.milkBun ?? 0,
        });
        setBuffer({
          chai: json.buffer?.chai ?? 10,
          bun: json.buffer?.bun ?? 10,
          tiramisu: json.buffer?.tiramisu ?? 10,
          milkBun: json.buffer?.milkBun ?? 10,
        });
        setInventoryLoaded(true);
      } catch {
        setSettingsError("Failed to load settings");
      }
    }
    loadSettings();
  }, [tab]);

  // Listen to real-time settings updates (including inventory) from stream
  // useEffect(() => {
  //   const dateKey = getTodayKey();
  //   const source = new EventSource(`/api/queue/stream?date=${dateKey}`);
  //   source.onmessage = (event) => {
  //     try {
  //       const payload = JSON.parse(event.data);
  //       if (payload.settings) {
  //         const newInventory = {
  //           chai: payload.settings.inventory?.chai ?? 0,
  //           bun: payload.settings.inventory?.bun ?? 0,
  //           tiramisu: payload.settings.inventory?.tiramisu ?? 0,
  //         };
          
  //         // Update inventory and settings in real-time
  //         setInventory(newInventory);
  //         setBuffer({
  //           chai: payload.settings.buffer?.chai ?? 10,
  //           bun: payload.settings.buffer?.bun ?? 10,
  //           tiramisu: payload.settings.buffer?.tiramisu ?? 10,
  //         });
  //         setServiceStart(payload.settings.serviceStart || "06:00");
  //         setServiceEnd(payload.settings.serviceEnd || "23:00");
  //         setClosedMessage(payload.settings.closedMessage || "");
          
  //         // Auto-adjust edit quantities if inventory drops below selected quantities
  //         // Account for items already in the current order
  //         if (editingTicket) {
  //           const currentChaiQty = editingTicket.items?.find((item) => item.name === "Special Chai" || item.name === "Irani Chai")?.qty || 0;
  //           const currentBunQty = editingTicket.items?.find((item) => item.name === "Bun")?.qty || 0;
  //           const currentTiramisuQty = editingTicket.items?.find((item) => item.name === "Tiramisu")?.qty || 0;
  //           const availableChai = (newInventory.chai || 0) + currentChaiQty;
  //           const availableBun = (newInventory.bun || 0) + currentBunQty;
  //           const availableTiramisu = (newInventory.tiramisu || 0) + currentTiramisuQty;
            
  //           setEditQuantities((prev) => ({
  //             chai: Math.min(prev.chai || 0, availableChai),
  //             bun: Math.min(prev.bun || 0, availableBun),
  //             tiramisu: Math.min(prev.tiramisu || 0, availableTiramisu),
  //           }));
  //         }
  //         setInventoryLoaded(true);
  //       }
  //     } catch {
  //       // ignore parse errors
  //     }
  //   };
  //   source.onerror = () => {
  //     // ignore stream errors
  //   };
  //   return () => {
  //     source.close();
  //   };
  // }, [editingTicket]);

  async function updateStatus(id, dateKey, status) {
    try {
      const res = await fetch("/api/ready", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, dateKey, status }),
      });
      if (!res.ok) return;
      // The stream will automatically update the queue
      // Only refresh dashboard if needed
      if (dateKey === dashboardDate) {
        await loadDashboardTickets(dashboardDate, { silent: true });
      }
    } catch {
      // ignore
    }
  }

  async function openEditDialog(ticket) {
    const items = Array.isArray(ticket.items) ? ticket.items : [];
    const chaiItem = items.find((item) => isChai(item.name));
    const bunItem = items.find((item) => isBun(item.name));
    const tiramisuItem = items.find((item) => isTiramisu(item.name));
    const milkBunItem = items.find((item) => isMilkBun(item.name));
    setEditQuantities({
      chai: chaiItem ? Number(chaiItem.qty) || 0 : 0,
      bun: bunItem ? Number(bunItem.qty) || 0 : 0,
      tiramisu: tiramisuItem ? Number(tiramisuItem.qty) || 0 : 0,
      milkBun: milkBunItem ? Number(milkBunItem.qty) || 0 : 0,
    });
    // Store a stable reference to the ticket
    setEditingTicket({ ...ticket, id: ticket.id, dateKey: ticket.dateKey });
    setEditError("");
    
    // Refresh inventory to ensure we have the latest values
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const json = await res.json();
        setInventory({
          chai: json.inventory?.chai ?? 0,
          bun: json.inventory?.bun ?? 0,
          tiramisu: json.inventory?.tiramisu ?? 0,
          milkBun: json.inventory?.milkBun ?? 0,
        });
      }
    } catch {
      // Ignore errors, stream will update it
    }
  }

  function cancelEdit() {
    setEditingTicket(null);
//    setEditQuantities({ chai: 0, bun: 0, tiramisu: 0, milkBun: 0 });
    setEditError("");
  }

  function updateEditQuantity(key, delta) {
    setEditQuantities((prev) => {
      const next = Math.max(0, (prev[key] || 0) + delta);
      return { ...prev, [key]: next };
    });
  }

  function handleEditQuantityChange(key, value) {
    const numValue = value === "" ? 0 : Math.max(0, parseInt(value, 10) || 0);
    const maxValue = key === "chai" ? editAvailability.chai : key === "bun" ? editAvailability.bun : key === "tiramisu" ? editAvailability.tiramisu : editAvailability.milkBun;
    const clampedValue = Math.min(numValue, maxValue);
    setEditQuantities((prev) => ({ ...prev, [key]: clampedValue }));
  }

  function handleAddUserQuantityChange(key, value) {
    const numValue = value === "" ? 0 : Math.max(0, parseInt(value, 10) || 0);
    const maxValue = key === "chai" ? (inventory?.chai ?? 0) : key === "bun" ? (inventory?.bun ?? 0) : key === "tiramisu" ? (inventory?.tiramisu ?? 0) : (inventory?.milkBun ?? 0);
    const clampedValue = Math.min(numValue, maxValue);
    setAddUserQuantities((prev) => ({ ...prev, [key]: clampedValue }));
  }

  async function saveEdit() {
    if (!editingTicket) return;
    
    setEditError("");
    setEditSaving(true);

    try {
      // Build items array
      const items = [];
      if (editQuantities.chai > 0) {
        // Preserve existing chai display name if present (handles legacy "Irani Chai")
        const existingChaiName =
          editingTicket.items?.find((item) => isChai(item.name))?.name ||
          ITEM_NAMES.CHAI;
        items.push({ name: existingChaiName, qty: editQuantities.chai });
      }
      if (editQuantities.bun > 0) {
        items.push({ name: ITEM_NAMES.BUN, qty: editQuantities.bun });
      }
      if (editQuantities.tiramisu > 0) {
        items.push({ name: ITEM_NAMES.TIRAMISU, qty: editQuantities.tiramisu });
      }
      if (editQuantities.milkBun > 0) {
        items.push({ name: ITEM_NAMES.MILK_BUN, qty: editQuantities.milkBun });
      }

      if (items.length === 0) {
        setEditError("At least one item with quantity is required");
        setEditSaving(false);
        return;
      }

      const res = await fetch("/api/ticket", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTicket.id,
          dateKey: editingTicket.dateKey,
          items,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setEditError(json.message || json.error || "Failed to update order");
        setEditSaving(false);
        return;
      }

      // Success - close dialog and reset state
      // The stream will automatically update the queue and inventory
      setEditingTicket(null);
      setEditQuantities({ chai: 0, bun: 0, tiramisu: 0, milkBun: 0 });
      setEditSaving(false);
    } catch (err) {
      console.error("Error saving edit:", err);
      setEditError(err.message || "Failed to update order");
      setEditSaving(false);
    }
  }

  function openDeleteDialog(ticket) {
    setTicketToDelete(ticket);
    setDeleteDialogOpen(true);
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!ticketToDelete) return;
    
    const { id, dateKey } = ticketToDelete;
    setDeletingTicket(id);
    setDeleteError("");
    
    try {
      const res = await fetch(`/api/ticket?id=${encodeURIComponent(id)}&date=${encodeURIComponent(dateKey)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete ticket");
      }
      
      // Success - close dialog
      // The stream will automatically update the queue and inventory
      // Also refresh dashboard if needed (it doesn't have a stream)
      if (dateKey === dashboardDate) {
        await loadDashboardTickets(dashboardDate, { silent: true });
      }
      setDeleteDialogOpen(false);
      setTicketToDelete(null);
      setDeletingTicket(null);
    } catch (err) {
      console.error("Delete ticket error:", err);
      setDeleteError(err.message || "Failed to delete ticket. Please try again.");
      setDeletingTicket(null);
    }
  }

  async function updatePaid(id, dateKey, paid) {
    setPaidUpdating((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch("/api/payment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, dateKey, paid }),
      });
      if (!res.ok) {
        throw new Error("Failed to update payment");
      }
      await loadDashboardTickets(dashboardDate, { silent: true });
    } catch (err) {
      console.error(err);
    } finally {
      setPaidUpdating((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }

  async function clearToday() {
    setClearing(true);
    try {
      const res = await fetch("/api/queue", { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to clear queue");
      }
      // The stream will automatically update the queue
      // Only refresh dashboard if needed (it doesn't have a stream)
      if (todayKey === dashboardDate) {
        await loadDashboardTickets(dashboardDate, { silent: true });
      }
    } catch (err) {
      console.error("Error clearing queue:", err);
    } finally {
      setClearing(false);
      setClearTodayDialogOpen(false);
    }
  }

  function openAddUserDialog() {
    setAddUserName("");
    setAddUserQuantities({ chai: 0, bun: 0, tiramisu: 0, milkBun: 0 });
    setAddUserError("");
    setAddUserDialogOpen(true);
  }

  function updateAddUserQuantity(key, delta) {
    setAddUserQuantities((prev) => {
      const next = Math.max(0, (prev[key] || 0) + delta);
      return { ...prev, [key]: next };
    });
  }

  async function saveAddUser() {
    setAddUserError("");
    setAddUserSaving(true);

    try {
      const name = addUserName.trim();
      if (!name) {
        setAddUserError("Name is required");
        setAddUserSaving(false);
        return;
      }

      // Build items array
      const items = [];
      if (addUserQuantities.chai > 0) {
        items.push({ name: ITEM_NAMES.CHAI, qty: addUserQuantities.chai });
      }
      if (addUserQuantities.bun > 0) {
        items.push({ name: ITEM_NAMES.BUN, qty: addUserQuantities.bun });
      }
      if (addUserQuantities.tiramisu > 0) {
        items.push({
          name: ITEM_NAMES.TIRAMISU,
          qty: addUserQuantities.tiramisu,
        });
      }
      if (addUserQuantities.milkBun > 0) {
        items.push({
          name: ITEM_NAMES.MILK_BUN,
          qty: addUserQuantities.milkBun,
        });
      }

      if (items.length === 0) {
        setAddUserError("At least one item with quantity is required");
        setAddUserSaving(false);
        return;
      }

      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, items }),
      });

      const json = await res.json();
      if (!res.ok) {
        setAddUserError(json.error || "Failed to add user to queue");
        setAddUserSaving(false);
        return;
      }

      // Success - close dialog and reset state
      // The stream will automatically update the queue and inventory
      setAddUserDialogOpen(false);
      setAddUserName("");
      setAddUserQuantities({ chai: 0, bun: 0, tiramisu: 0, milkBun: 0 });
      setAddUserSaving(false);
    } catch (err) {
      console.error("Error adding user:", err);
      setAddUserError(err.message || "Failed to add user to queue");
      setAddUserSaving(false);
    }
  }

  async function savePricing(event) {
    event.preventDefault();
    setPricingError("");
    setPricingSaving(true);
    try {
      const res = await fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chaiPrice: Number(chaiPrice),
          bunPrice: Number(bunPrice),
          tiramisuPrice: Number(tiramisuPrice),
          milkBunPrice: Number(milkBunPrice),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setPricingError(json.error || "Failed to save pricing");
        setPricingSaving(false);
        return;
      }
      setChaiPrice(String(json.chaiPrice ?? ""));
      setBunPrice(String(json.bunPrice ?? ""));
      setTiramisuPrice(String(json.tiramisuPrice ?? ""));
      setMilkBunPrice(String(json.milkBunPrice ?? ""));
      setPricingSaving(false);
    } catch {
      setPricingError("Failed to save pricing");
      setPricingSaving(false);
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSettingsError("");
    setSettingsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceStart,
          serviceEnd,
          closedMessage,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSettingsError(json.error || "Failed to save settings");
        setSettingsSaving(false);
        return;
      }
      setServiceStart(json.serviceStart || "06:00");
      setServiceEnd(json.serviceEnd || "23:00");
      setClosedMessage(json.closedMessage || "");
      setSettingsSaving(false);
    } catch {
      setSettingsError("Failed to save settings");
      setSettingsSaving(false);
    }
  }

  async function saveInventory(event) {
    event.preventDefault();
    setSettingsError("");
    setInventorySaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventory,
          buffer,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSettingsError(json.error || "Failed to save inventory");
        setInventorySaving(false);
        return;
      }
      setInventory(json.inventory || { chai: 0, bun: 0, tiramisu: 0, milkBun: 0 });
      setBuffer(json.buffer || { chai: 10, bun: 10, tiramisu: 10, milkBun: 10 });
      setInventorySaving(false);
    } catch {
      setSettingsError("Failed to save inventory");
      setInventorySaving(false);
    }
  }

  // Calculate available inventory for edit modal (current inventory + items in the order being edited)
  const editAvailability = useMemo(() => {
    if (!editingTicket) {
      return { chai: 0, bun: 0, tiramisu: 0, milkBun: 0 };
    }
    // Ensure inventory is an object with numeric values
    const currentInventory = inventory || { chai: 0, bun: 0, tiramisu: 0, milkBun: 0 };
    const currentChaiQty = Number(editingTicket.items?.find((item) => isChai(item.name))?.qty || 0);
    const currentBunQty = Number(editingTicket.items?.find((item) => isBun(item.name))?.qty || 0);
    const currentTiramisuQty = Number(editingTicket.items?.find((item) => isTiramisu(item.name))?.qty || 0);
    const currentMilkBunQty = Number(editingTicket.items?.find((item) => isMilkBun(item.name))?.qty || 0);
    
    const chaiInv = Number(currentInventory.chai) || 0;
    const bunInv = Number(currentInventory.bun) || 0;
    const tiramisuInv = Number(currentInventory.tiramisu) || 0;
    const milkBunInv = Number(currentInventory.milkBun) || 0;
    
    return {
      chai: chaiInv + currentChaiQty,
      bun: bunInv + currentBunQty,
      tiramisu: tiramisuInv + currentTiramisuQty,
      milkBun: milkBunInv + currentMilkBunQty,
    };
  }, [editingTicket, inventory]);

  const queueTicketsWaiting = useMemo(
    () =>
      queueTickets
        .filter((ticket) => ticket.status === "waiting")
        .sort((a, b) => (a.basePosition || 0) - (b.basePosition || 0)),
    [queueTickets]
  );

  const readyTickets = useMemo(
    () =>
      dashboardTickets
        .filter((ticket) => ticket.status === "ready")
        .sort((a, b) => {
          // Sort unpaid tickets to the top
          if (a.paid !== b.paid) {
            return a.paid ? 1 : -1; // unpaid (false) comes before paid (true)
          }
          // If both have same paid status, sort by updatedAt
          return (a.updatedAt?.seconds || 0) - (b.updatedAt?.seconds || 0);
        }),
    [dashboardTickets]
  );

  const filteredReadyTickets = useMemo(() => {
    const query = dashboardSearch.trim().toLowerCase();
    if (!query) {
      return readyTickets;
    }
    return readyTickets.filter((ticket) => {
      const nameMatch =
        typeof ticket.name === "string" &&
        ticket.name.toLowerCase().includes(query);
      const tokenMatch = String(ticket.basePosition ?? "")
        .toLowerCase()
        .includes(query);
      const itemsMatch = Array.isArray(ticket.items)
        ? ticket.items.some((item) =>
            typeof item.name === "string"
              ? item.name.toLowerCase().includes(query)
              : false
          )
        : false;
      return nameMatch || tokenMatch || itemsMatch;
    });
  }, [dashboardSearch, readyTickets]);

  const hasDashboardSearch = dashboardSearch.trim().length > 0;

  const readySummary = useMemo(() => {
    let chaiCount = 0;
    let bunCount = 0;
    let tiramisuCount = 0;
    let revenue = 0;
    let milkBunCount = 0;
    readyTickets.forEach((ticket) => {
      ticket.items?.forEach((item) => {
        if (!item.qty) return;
        if (isChai(item.name)) chaiCount += item.qty;
        if (isBun(item.name)) bunCount += item.qty;
        if (isTiramisu(item.name)) tiramisuCount += item.qty;
        if (isMilkBun(item.name)) milkBunCount += item.qty;
      });
      // Only include paid tickets in revenue
      if (ticket.paid) {
        revenue += ticketTotal(
          ticket,
          Number(chaiPrice) || 0,
          Number(bunPrice) || 0,
          Number(tiramisuPrice) || 0,
          Number(milkBunPrice) || 0
        );
      }
    });
    return { chaiCount, bunCount, tiramisuCount, milkBunCount, revenue };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyTickets]);

  return (
    <main className="min-h-screen bg-muted/40 py-10">
      <div className="container max-w-6xl space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-white shadow">
            <Image
              src="/thechaicouple.jpg"
              alt="Chai Bun Maska brand"
              width={200}
              height={200}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <h1 className="text-3xl font-semibold">Admin Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Manage today&apos;s queue and review completed orders.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="w-full max-w-2xl">
            <TabsTrigger value="queue" className="w-full">
              Queue
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="w-full">
              Served dashboard
            </TabsTrigger>
            <TabsTrigger value="settings" className="w-full">
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>Live Queue</CardTitle>
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          connectionStatus === "connected"
                            ? "bg-green-500 animate-pulse"
                            : connectionStatus === "connecting"
                            ? "bg-yellow-500 animate-pulse"
                            : "bg-red-500"
                        }`}
                        title={
                          connectionStatus === "connected"
                            ? "Connected"
                            : connectionStatus === "connecting"
                            ? "Connecting..."
                            : "Disconnected"
                        }
                      />
                      <span className="text-xs text-muted-foreground">
                        {connectionStatus === "connected"
                          ? "Live"
                          : connectionStatus === "connecting"
                          ? "Connecting..."
                          : "Offline"}
                      </span>
                    </div>
                  </div>
                  <CardDescription>
                    Waiting tickets for {todayKey}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    {!inventoryLoaded ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Badge 
                          variant={(inventory?.chai ?? 0) <= 0 ? "destructive" : (inventory?.chai ?? 0) < (buffer.chai ?? 10) ? "default" : "secondary"}
                        >
                          Chai: {inventory?.chai ?? 0}
                        </Badge>
                        <Badge 
                          variant={(inventory?.bun ?? 0) <= 0 ? "destructive" : (inventory?.bun ?? 0) < (buffer.bun ?? 10) ? "default" : "secondary"}
                        >
                          Bun: {inventory?.bun ?? 0}
                        </Badge>
                        <Badge 
                          variant={(inventory?.tiramisu ?? 0) <= 0 ? "destructive" : (inventory?.tiramisu ?? 0) < (buffer.tiramisu ?? 10) ? "default" : "secondary"}
                        >
                          Tiramisu: {inventory?.tiramisu ?? 0}
                        </Badge>
                        <Badge 
                          variant={(inventory?.milkBun ?? 0) <= 0 ? "destructive" : (inventory?.milkBun ?? 0) < (buffer.milkBun ?? 10) ? "default" : "secondary"}
                        >
                          Premium Milk Bun: {inventory?.milkBun ?? 0}
                        </Badge>
                      </>
                    )}
                  </div>
                  <Badge variant="secondary">
                    {queueTicketsWaiting.length} waiting
                  </Badge>
                  <Button
                    variant="default"
                    size="icon"
                    onClick={openAddUserDialog}
                    title="Add User"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setClearTodayDialogOpen(true)}
                    disabled={clearing}
                    title={clearing ? "Clearing..." : "Clear Today"}
                  >
                    {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {queueLoading ? (
                  <LoaderCard />
                ) : queueTicketsWaiting.length === 0 ? (
                  <p className="py-12 text-center text-muted-foreground">
                    No one is waiting right now.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Queue #</TableHead>
                        <TableHead>Token</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queueTicketsWaiting.map((ticket, index) => (
                        <TableRow 
                          key={ticket.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => {
                            setSelectedTicket({ ...ticket, queueNumber: index + 1 });
                            setOrderDetailsDialogOpen(true);
                          }}
                        >
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="font-medium">
                            {ticket.basePosition}
                          </TableCell>
                          <TableCell>{ticket.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatOrder(ticket.items)}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant={ticket.paid ? "default" : "outline"}
                              className={
                                ticket.paid
                                  ? "bg-green-600 text-white hover:bg-green-600/90"
                                  : undefined
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                updatePaid(ticket.id, ticket.dateKey, !ticket.paid);
                              }}
                              disabled={Boolean(paidUpdating[ticket.id])}
                            >
                              {paidUpdating[ticket.id]
                                ? "Saving..."
                                : ticket.paid
                                ? "Paid"
                                : "Mark paid"}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditDialog(ticket);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDeleteDialog(ticket);
                                }}
                                disabled={deletingTicket === ticket.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateStatus(ticket.id, ticket.dateKey, "ready");
                                }}
                              >
                                Done
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Dialog
              open={clearTodayDialogOpen}
              onOpenChange={(open) => {
                if (!open && !clearing) {
                  setClearTodayDialogOpen(false);
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Clear today&apos;s queue?</DialogTitle>
                  <DialogDescription>
                    This will remove all waiting tickets for today and restore their inventory. This action
                    cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={() => setClearTodayDialogOpen(false)}
                    disabled={clearing}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full sm:w-auto"
                    onClick={clearToday}
                    disabled={clearing}
                  >
                    {clearing ? "Clearing..." : "Yes, clear today"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Order Dialog */}
            <Dialog open={editingTicket !== null} onOpenChange={(open) => !open && cancelEdit()}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Order</DialogTitle>
                  <DialogDescription>
                    Update quantities for {editingTicket?.name || ""}. Stock will be validated.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
                      <div>
                        <p className="font-medium">Special Chai </p>
                        <p className="text-xs text-muted-foreground">Available: {editAvailability.chai}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => updateEditQuantity("chai", -1)}
                          disabled={editQuantities.chai === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          max={editAvailability.chai}
                          value={editQuantities.chai}
                          onChange={(e) => handleEditQuantityChange("chai", e.target.value)}
                          className="w-16 text-center text-lg font-semibold"
                        />
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => updateEditQuantity("chai", 1)}
                          disabled={editQuantities.chai >= editAvailability.chai}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
                      <div>
                        <p className="font-medium">Bun Maska</p>
                        <p className="text-xs text-muted-foreground">Available: {editAvailability.bun}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => updateEditQuantity("bun", -1)}
                          disabled={editQuantities.bun === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          max={editAvailability.bun}
                          value={editQuantities.bun}
                          onChange={(e) => handleEditQuantityChange("bun", e.target.value)}
                          className="w-16 text-center text-lg font-semibold"
                        />
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => updateEditQuantity("bun", 1)}
                          disabled={editQuantities.bun >= editAvailability.bun}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
                      <div>
                        <p className="font-medium">Tiramisu</p>
                        <p className="text-xs text-muted-foreground">Available: {editAvailability.tiramisu}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => updateEditQuantity("tiramisu", -1)}
                          disabled={editQuantities.tiramisu === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          max={editAvailability.tiramisu}
                          value={editQuantities.tiramisu}
                          onChange={(e) => handleEditQuantityChange("tiramisu", e.target.value)}
                          className="w-16 text-center text-lg font-semibold"
                        />
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => updateEditQuantity("tiramisu", 1)}
                          disabled={editQuantities.tiramisu >= editAvailability.tiramisu}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
                      <div>
                        <p className="font-medium">Premium Milk Bun</p>
                        <p className="text-xs text-muted-foreground">Available: {editAvailability.milkBun}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => updateEditQuantity("milkBun", -1)}
                          disabled={editQuantities.milkBun === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          max={editAvailability.milkBun}
                          value={editQuantities.milkBun}
                          onChange={(e) => handleEditQuantityChange("milkBun", e.target.value)}
                          className="w-16 text-center text-lg font-semibold"
                        />
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => updateEditQuantity("milkBun", 1)}
                          disabled={editQuantities.milkBun >= editAvailability.milkBun}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={cancelEdit}
                    disabled={editSaving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={saveEdit} disabled={editSaving}>
                    {editSaving ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add User Dialog */}
            <Dialog open={addUserDialogOpen} onOpenChange={(open) => {
              if (!open) {
                setAddUserDialogOpen(false);
                setAddUserName("");
                setAddUserQuantities({ chai: 0, bun: 0, tiramisu: 0 });
                setAddUserError("");
              }
            }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add User to Queue</DialogTitle>
                  <DialogDescription>
                    Manually add a customer to the queue. Inventory will be updated automatically.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="addUserName">Customer Name</Label>
                    <Input
                      id="addUserName"
                      placeholder="Enter customer name"
                      value={addUserName}
                      onChange={(e) => setAddUserName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>Order Items</Label>
                    <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
                      <div>
                        <p className="font-medium">Special Chai</p>
                        <p className="text-xs text-muted-foreground">Available: {inventory?.chai ?? 0}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => updateAddUserQuantity("chai", -1)}
                          disabled={addUserQuantities.chai === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          max={inventory?.chai ?? 0}
                          value={addUserQuantities.chai}
                          onChange={(e) => handleAddUserQuantityChange("chai", e.target.value)}
                          className="w-16 text-center text-lg font-semibold"
                        />
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => updateAddUserQuantity("chai", 1)}
                          disabled={addUserQuantities.chai >= (inventory?.chai ?? 0)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
                      <div>
                        <p className="font-medium">Bun Maska</p>
                        <p className="text-xs text-muted-foreground">Available: {inventory?.bun ?? 0}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => updateAddUserQuantity("bun", -1)}
                          disabled={addUserQuantities.bun === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          max={inventory?.bun ?? 0}
                          value={addUserQuantities.bun}
                          onChange={(e) => handleAddUserQuantityChange("bun", e.target.value)}
                          className="w-16 text-center text-lg font-semibold"
                        />
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => updateAddUserQuantity("bun", 1)}
                          disabled={addUserQuantities.bun >= (inventory?.bun ?? 0)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
                      <div>
                        <p className="font-medium">Tiramisu</p>
                        <p className="text-xs text-muted-foreground">Available: {inventory?.tiramisu ?? 0}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => updateAddUserQuantity("tiramisu", -1)}
                          disabled={addUserQuantities.tiramisu === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          max={inventory?.tiramisu ?? 0}
                          value={addUserQuantities.tiramisu}
                          onChange={(e) => handleAddUserQuantityChange("tiramisu", e.target.value)}
                          className="w-16 text-center text-lg font-semibold"
                        />
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => updateAddUserQuantity("tiramisu", 1)}
                          disabled={addUserQuantities.tiramisu >= (inventory?.tiramisu ?? 0)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
                      <div>
                        <p className="font-medium">Premium Milk Bun</p>
                        <p className="text-xs text-muted-foreground">Available: {inventory?.milkBun ?? 0}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => updateAddUserQuantity("milkBun", -1)}
                          disabled={addUserQuantities.milkBun === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          max={inventory?.milkBun ?? 0}
                          value={addUserQuantities.milkBun}
                          onChange={(e) => handleAddUserQuantityChange("milkBun", e.target.value)}
                          className="w-16 text-center text-lg font-semibold"
                        />
                        <Button
                          type="button"
                          size="icon"
                          onClick={() => updateAddUserQuantity("milkBun", 1)}
                          disabled={addUserQuantities.milkBun >= (inventory?.milkBun ?? 0)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  {addUserError && (
                    <Alert variant="destructive">
                      <AlertDescription>{addUserError}</AlertDescription>
                    </Alert>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAddUserDialogOpen(false);
                      setAddUserName("");
                      setAddUserQuantities({ chai: 0, bun: 0, tiramisu: 0, milkBun: 0 });
                      setAddUserError("");
                    }}
                    disabled={addUserSaving}
                  >
                    Cancel
                  </Button>
                  <Button onClick={saveAddUser} disabled={addUserSaving}>
                    {addUserSaving ? "Adding..." : "Add to Queue"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Order Details Dialog */}
            <Dialog
              open={orderDetailsDialogOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setOrderDetailsDialogOpen(false);
                  setSelectedTicket(null);
                }
              }}
            >
              <DialogContent className="max-h-[90vh] sm:max-h-none flex flex-col">
                <DialogHeader>
                  <DialogTitle>Order Details</DialogTitle>
                  <DialogDescription>
                    View and manage this order
                  </DialogDescription>
                </DialogHeader>
                {selectedTicket && (
                  <div className="space-y-4 py-4 flex-1 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border bg-card p-4">
                        <p className="text-sm text-muted-foreground">Queue Number</p>
                        <p className="text-2xl font-bold">{selectedTicket.queueNumber}</p>
                      </div>
                      <div className="rounded-lg border bg-card p-4">
                        <p className="text-sm text-muted-foreground">Token Number</p>
                        <p className="text-2xl font-bold">{selectedTicket.basePosition}</p>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-sm text-muted-foreground mb-2">Customer Name</p>
                      <p className="text-lg font-semibold">{selectedTicket.name}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-sm text-muted-foreground mb-2">Items</p>
                      <div className="space-y-1">
                        {Array.isArray(selectedTicket.items) && selectedTicket.items.length > 0 ? (
                          selectedTicket.items
                            .filter((item) => item.qty > 0)
                            .map((item, idx) => (
                              <div key={idx} className="flex justify-between">
                                <span className="text-muted-foreground">{item.name}</span>
                                <span className="font-medium">× {item.qty}</span>
                              </div>
                            ))
                        ) : (
                          <p className="text-muted-foreground">—</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="text-2xl font-bold">
                          ₹{ticketTotal(
                            selectedTicket,
                            Number(chaiPrice) || 0,
                            Number(bunPrice) || 0,
                            Number(tiramisuPrice) || 0,
                            Number(milkBunPrice) || 0
                          ).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t pt-4">
                      <span className="text-sm font-medium text-muted-foreground">Payment Status:</span>
                      <Badge 
                        variant={selectedTicket.paid ? "default" : "outline"}
                        className={selectedTicket.paid ? "bg-green-600 text-white" : undefined}
                      >
                        {selectedTicket.paid ? "Paid" : "Unpaid"}
                      </Badge>
                    </div>
                  </div>
                )}
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (selectedTicket) {
                        setOrderDetailsDialogOpen(false);
                        openDeleteDialog(selectedTicket);
                      }
                    }}
                    disabled={deletingTicket === selectedTicket?.id}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (selectedTicket) {
                        setOrderDetailsDialogOpen(false);
                        openEditDialog(selectedTicket);
                      }
                    }}
                    className="w-full sm:w-auto"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant={selectedTicket?.paid ? "outline" : "default"}
                    className={`w-full sm:w-auto ${
                      selectedTicket?.paid
                        ? ""
                        : "bg-green-600 text-white hover:bg-green-600/90"
                    }`}
                    onClick={async () => {
                      if (selectedTicket && !paidUpdating[selectedTicket.id]) {
                        const newPaidStatus = !selectedTicket.paid;
                        // Optimistically update the local state
                        setSelectedTicket({ ...selectedTicket, paid: newPaidStatus });
                        // Update in the queue tickets list
                        setQueueTickets((prev) =>
                          prev.map((t) =>
                            t.id === selectedTicket.id ? { ...t, paid: newPaidStatus } : t
                          )
                        );
                        // Call the API
                        await updatePaid(selectedTicket.id, selectedTicket.dateKey, newPaidStatus);
                      }
                    }}
                    disabled={Boolean(selectedTicket && paidUpdating[selectedTicket.id])}
                  >
                    {selectedTicket && paidUpdating[selectedTicket.id]
                      ? "Saving..."
                      : selectedTicket?.paid
                      ? "Mark as Unpaid"
                      : "Mark as Paid"}
                  </Button>
                  <Button
                    onClick={() => {
                      if (selectedTicket) {
                        setOrderDetailsDialogOpen(false);
                        updateStatus(selectedTicket.id, selectedTicket.dateKey, "ready");
                      }
                    }}
                    className="w-full sm:w-auto"
                  >
                    Done
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle>Serve dashboard</CardTitle>
                  <CardDescription>
                    Pick a date to inspect ready orders and revenue.
                  </CardDescription>
                </div>
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end sm:gap-3">
                  <div className="flex w-full flex-col gap-1 sm:w-auto">
                    <Label className="text-xs uppercase text-muted-foreground">
                      Date
                    </Label>
                    <Input
                      type="date"
                      max={todayKey}
                      value={dashboardDate}
                      onChange={(e) => setDashboardDate(e.target.value || todayKey)}
                      className="w-full sm:w-[220px]"
                    />
                  </div>
                  <div className="flex w-full flex-col gap-1 sm:flex-1">
                    <Label className="text-xs uppercase text-muted-foreground">
                      Search served orders
                    </Label>
                    <Input
                      type="search"
                      placeholder="Search name, token, or item"
                      value={dashboardSearch}
                      onChange={(e) => setDashboardSearch(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => loadDashboardTickets(dashboardDate)}
                    disabled={dashboardLoading}
                  >
                    <RotateCw className="mr-2 h-4 w-4" />
                    {dashboardLoading ? "Loading..." : "Refresh"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <SummaryCard label="Served chai" value={readySummary.chaiCount} />
                  <SummaryCard label="Served buns" value={readySummary.bunCount} />
                  <SummaryCard label="Served tiramisu" value={readySummary.tiramisuCount} />
                  <SummaryCard label="Served premium milk buns" value={readySummary.milkBunCount} />
                  <SummaryCard
                    label="Revenue"
                    value={currency.format(readySummary.revenue || 0)}
                  />
                </div>

                {dashboardLoading ? (
                  <LoaderCard />
                ) : filteredReadyTickets.length === 0 ? (
                  <p className="py-12 text-center text-muted-foreground">
                    {hasDashboardSearch
                      ? `No matches for "${dashboardSearch.trim()}" on ${dashboardDate}.`
                      : `No ready tickets for ${dashboardDate}.`}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Token</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReadyTickets.map((ticket) => (
                        <TableRow 
                          key={ticket.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setViewingTicket(ticket)}
                        >
                          <TableCell className="font-medium">
                            {ticket.basePosition}
                          </TableCell>
                          <TableCell>{ticket.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatOrder(ticket.items)}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant={ticket.paid ? "default" : "outline"}
                              className={
                                ticket.paid
                                  ? "bg-green-600 text-white hover:bg-green-600/90"
                                  : undefined
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                updatePaid(ticket.id, ticket.dateKey, !ticket.paid);
                              }}
                              disabled={Boolean(paidUpdating[ticket.id])}
                            >
                              {paidUpdating[ticket.id]
                                ? "Saving..."
                                : ticket.paid
                                ? "Paid"
                                : "Mark paid"}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {currency.format(ticketTotal(ticket, Number(chaiPrice) || 0, Number(bunPrice) || 0, Number(tiramisuPrice) || 0, Number(milkBunPrice) || 0))}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteDialog(ticket);
                              }}
                              disabled={deletingTicket === ticket.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* View Served Ticket Dialog */}
            <Dialog
              open={viewingTicket !== null}
              onOpenChange={(open) => !open && setViewingTicket(null)}
            >
              <DialogContent className="max-h-[90vh] sm:max-h-none flex flex-col">
                <DialogHeader>
                  <DialogTitle>Order Details</DialogTitle>
                  <DialogDescription>
                    View order information and payment status
                  </DialogDescription>
                </DialogHeader>
                {viewingTicket && (
                  <div className="space-y-4 py-4 flex-1 overflow-y-auto">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Token:</span>
                        <span className="text-sm font-semibold">{viewingTicket.basePosition}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Name:</span>
                        <span className="text-sm font-semibold">{viewingTicket.name}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Order:</p>
                      <div className="rounded-lg border bg-card p-3">
                        {Array.isArray(viewingTicket.items) && viewingTicket.items.length > 0 ? (
                          <div className="space-y-2">
                            {viewingTicket.items
                              .filter((item) => item.qty > 0)
                              .map((item, index) => (
                                <div key={index} className="flex justify-between text-sm">
                                  <span>{item.name}</span>
                                  <span className="font-medium">× {item.qty}</span>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No items</p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between border-t pt-4">
                      <span className="text-base font-semibold">Total:</span>
                      <span className="text-base font-bold">
                        {currency.format(ticketTotal(viewingTicket, Number(chaiPrice) || 0, Number(bunPrice) || 0, Number(tiramisuPrice) || 0, Number(milkBunPrice) || 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t pt-4">
                      <span className="text-sm font-medium text-muted-foreground">Payment Status:</span>
                      <Badge 
                        variant={viewingTicket.paid ? "default" : "outline"}
                        className={viewingTicket.paid ? "bg-green-600 text-white" : undefined}
                      >
                        {viewingTicket.paid ? "Paid" : "Unpaid"}
                      </Badge>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setViewingTicket(null)}
                  >
                    Close
                  </Button>
                  {viewingTicket && (
                    <Button
                      variant={viewingTicket.paid ? "outline" : "default"}
                      className={
                        viewingTicket.paid
                          ? undefined
                          : "bg-green-600 text-white hover:bg-green-600/90"
                      }
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (viewingTicket && !paidUpdating[viewingTicket.id]) {
                          const newPaidStatus = !viewingTicket.paid;
                          // Optimistically update the local state
                          setViewingTicket({ ...viewingTicket, paid: newPaidStatus });
                          // Update in the dashboard tickets list
                          setDashboardTickets((prev) =>
                            prev.map((t) =>
                              t.id === viewingTicket.id ? { ...t, paid: newPaidStatus } : t
                            )
                          );
                          // Call the API
                          await updatePaid(viewingTicket.id, viewingTicket.dateKey, newPaidStatus);
                        }
                      }}
                      disabled={Boolean(viewingTicket && paidUpdating[viewingTicket.id])}
                    >
                      {viewingTicket && paidUpdating[viewingTicket.id]
                        ? "Saving..."
                        : viewingTicket?.paid
                        ? "Mark as Unpaid"
                        : "Mark as Paid"}
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Service window & availability</CardTitle>
                <CardDescription>
                  Control when the queue opens and what items are on the menu.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveSettings} className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="serviceStart">Service start</Label>
                    <Input
                      id="serviceStart"
                      type="time"
                      value={serviceStart}
                      onChange={(e) => setServiceStart(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="serviceEnd">Service end</Label>
                    <Input
                      id="serviceEnd"
                      type="time"
                      value={serviceEnd}
                      onChange={(e) => setServiceEnd(e.target.value)}
                      required
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="closedMessage">Closed caption</Label>
                    <Input
                      id="closedMessage"
                      value={closedMessage}
                      onChange={(e) => setClosedMessage(e.target.value)}
                      placeholder="We pour chai daily between 6am – 11pm."
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" disabled={settingsSaving}>
                      {settingsSaving ? "Saving..." : "Save service settings"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory Management</CardTitle>
                <CardDescription>
                  Set inventory levels and buffer thresholds for each item.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveInventory} className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="chaiInventory">Special Chai Inventory</Label>
                      <Input
                        id="chaiInventory"
                        type="number"
                        min={0}
                        value={inventory?.chai ?? 0}
                        onChange={(e) => setInventory((prev) => ({ ...(prev || { chai: 0, bun: 0, tiramisu: 0 }), chai: Number(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chaiBuffer">Special Chai Buffer</Label>
                      <Input
                        id="chaiBuffer"
                        type="number"
                        min={0}
                        value={buffer.chai ?? 10}
                        onChange={(e) => setBuffer((prev) => ({ ...prev, chai: Number(e.target.value) || 0 }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Warning will show when inventory falls below this level
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="bunInventory">Bun Maska Inventory</Label>
                      <Input
                        id="bunInventory"
                        type="number"
                        min={0}
                        value={inventory?.bun ?? 0}
                        onChange={(e) => setInventory((prev) => ({ ...(prev || { chai: 0, bun: 0, tiramisu: 0 }), bun: Number(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bunBuffer">Bun Maska Buffer</Label>
                      <Input
                        id="bunBuffer"
                        type="number"
                        min={0}
                        value={buffer.bun ?? 10}
                        onChange={(e) => setBuffer((prev) => ({ ...prev, bun: Number(e.target.value) || 0 }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Warning will show when inventory falls below this level
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="tiramisuInventory">Tiramisu Inventory</Label>
                      <Input
                        id="tiramisuInventory"
                        type="number"
                        min={0}
                        value={inventory?.tiramisu ?? 0}
                        onChange={(e) => setInventory((prev) => ({ ...(prev || { chai: 0, bun: 0, tiramisu: 0 }), tiramisu: Number(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tiramisuBuffer">Tiramisu Buffer</Label>
                      <Input
                        id="tiramisuBuffer"
                        type="number"
                        min={0}
                        value={buffer.tiramisu ?? 10}
                        onChange={(e) => setBuffer((prev) => ({ ...prev, tiramisu: Number(e.target.value) || 0 }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Warning will show when inventory falls below this level
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="milkBunInventory">Premium Milk Bun Inventory</Label>
                      <Input
                        id="milkBunInventory"
                        type="number"
                        min={0}
                        value={inventory?.milkBun ?? 0}
                        onChange={(e) => setInventory((prev) => ({ ...(prev || { chai: 0, bun: 0, tiramisu: 0, milkBun: 0 }), milkBun: Number(e.target.value) || 0 }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="milkBunBuffer">Premium Milk Bun Buffer</Label>
                      <Input
                        id="milkBunBuffer"
                        type="number"
                        min={0}
                        value={buffer.milkBun ?? 10}
                        onChange={(e) => setBuffer((prev) => ({ ...prev, milkBun: Number(e.target.value) || 0 }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Warning will show when inventory falls below this level
                      </p>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <Button type="submit" disabled={inventorySaving}>
                      {inventorySaving ? "Saving..." : "Save inventory settings"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
                <CardDescription>
                  Set the prices for Special Chai, Bun Maska, Tiramisu, and Premium Milk Bun.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={savePricing}
                  className="space-y-4"
                >
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-2">
                      <Label htmlFor="chaiPrice">Special Chai price</Label>
                      <Input
                        id="chaiPrice"
                        type="number"
                        min={0}
                        value={chaiPrice}
                        onChange={(e) => setChaiPrice(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bunPrice">Bun Maska price</Label>
                      <Input
                        id="bunPrice"
                        type="number"
                        min={0}
                        value={bunPrice}
                        onChange={(e) => setBunPrice(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tiramisuPrice">Tiramisu price</Label>
                      <Input
                        id="tiramisuPrice"
                        type="number"
                        min={0}
                        value={tiramisuPrice}
                        onChange={(e) => setTiramisuPrice(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="milkBunPrice">Premium Milk Bun price</Label>
                      <Input
                        id="milkBunPrice"
                        type="number"
                        min={0}
                        value={milkBunPrice}
                        onChange={(e) => setMilkBunPrice(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Button type="submit" disabled={pricingSaving}>
                      {pricingSaving ? "Saving..." : "Save prices"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Order Confirmation Dialog - Shared across all tabs */}
        <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogOpen(false);
            setTicketToDelete(null);
            setDeleteError("");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Order</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this order? Inventory will be restored. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {ticketToDelete && (
              <div className="mt-2 rounded-md bg-muted p-3">
                <p className="font-medium">{ticketToDelete.name}</p>
                <div className="text-sm text-muted-foreground">
                  {formatOrder(ticketToDelete.items)}
                </div>
              </div>
            )}
            {deleteError && (
              <Alert variant="destructive">
                <AlertDescription>{deleteError}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setTicketToDelete(null);
                  setDeleteError("");
                }}
                disabled={deletingTicket === ticketToDelete?.id}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deletingTicket === ticketToDelete?.id}
              >
                {deletingTicket === ticketToDelete?.id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Order"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function LoaderCard() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

const ITEM_CODE_STYLES = {
  C: "bg-amber-100 text-amber-900",
  B: "bg-orange-100 text-orange-900",
  T: "bg-rose-100 text-rose-900",
  M: "bg-purple-100 text-purple-900",
};

function getItemCode(name = "") {
  if (name.toLowerCase().includes("tiramisu")) return "T";
  if (name.toLowerCase().includes("milk bun")) return "M";
  if (name.toLowerCase().includes("bun")) return "B";
  return "C";
}

function formatOrder(items) {
  if (!Array.isArray(items)) return <span>—</span>;
  const filtered = items.filter((item) => item.qty > 0);
  if (filtered.length === 0) return <span>—</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {filtered.map((item, index) => {
        const code = getItemCode(item.name);
        return (
          <span
            key={`${code}-${index}`}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${ITEM_CODE_STYLES[code] || "bg-muted text-foreground"}`}
          >
            <span className="uppercase">{code}</span>
            <span className="font-bold">- {item.qty}</span>
          </span>
        );
      })}
    </div>
  );
}

function ticketTotal(ticket, fallbackChai = 0, fallbackBun = 0, fallbackTiramisu = 0, fallbackMilkBun = 0) {
  if (!Array.isArray(ticket.items)) return 0;
  return ticket.items.reduce((sum, item) => {
    let price = fallbackBun;
    if (isChai(item.name)) {
      price = fallbackChai;
    } else if (isTiramisu(item.name)) {
      price = fallbackTiramisu;
    } else if (isMilkBun(item.name)) {
      price = fallbackMilkBun;
    }
    return sum + (price || 0) * (item.qty || 0);
  }, 0);
}


