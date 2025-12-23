"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Users, Mail, Phone, Lock, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import Button from "@/app/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";

type CollectionRole = "collector" | "admin";

type CollectionUserRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: CollectionRole;
  active: boolean;
};

type ListResponse = {
  success?: boolean;
  users?: CollectionUserRow[];
  error?: string;
};

type CreateResponse = {
  success?: boolean;
  user?: CollectionUserRow;
  error?: string;
};

export default function AdminCollectionUsersPage() {
  const [users, setUsers] = useState<CollectionUserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CollectionRole>("collector");

  const totalCollectors = useMemo(
    () => users.filter((u) => u.role === "collector").length,
    [users],
  );

  const totalAdmins = useMemo(
    () => users.filter((u) => u.role === "admin").length,
    [users],
  );

  async function loadUsers() {
    setLoading(true);
    setErrorText(null);
    try {
      const res = await fetch("/api/admin/collection-users", {
        credentials: "include",
      });
      const json = (await res.json()) as ListResponse;
      if (!res.ok || !json.success || !json.users) {
        throw new Error(json.error ?? res.statusText);
      }
      setUsers(json.users);
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : "Failed to load collection users",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorText(null);

    if (!name.trim() || !phone.trim() || !email.trim() || !password.trim()) {
      setErrorText("Please fill all fields (name, phone, email, password).");
      return;
    }

    setCreating(true);
    try {
      const body = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
        role,
      };

      const res = await fetch("/api/admin/collection-users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = (await res.json()) as CreateResponse;
      if (!res.ok || !json.success || !json.user) {
        throw new Error(json.error ?? res.statusText);
      }

      setUsers((prev) => [json.user as CollectionUserRow, ...prev]);

      setName("");
      setPhone("");
      setEmail("");
      setPassword("");
      setRole("collector");
    } catch (err) {
      setErrorText(
        err instanceof Error ? err.message : "Failed to create collection user",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      {/* Header + stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Total collection users</p>
              <p className="text-2xl font-bold text-indigo-600">{users.length}</p>
            </div>
            <div className="p-3 rounded-2xl bg-indigo-50">
              <Users className="w-7 h-7 text-indigo-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Collectors</p>
              <p className="text-2xl font-bold text-emerald-600">
                {totalCollectors}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50">
              <Shield className="w-7 h-7 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Admin-level users</p>
              <p className="text-2xl font-bold text-amber-600">{totalAdmins}</p>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50">
              <Shield className="w-7 h-7 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create form */}
      <Card className="shadow-sm border">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-500" />
            <CardTitle className="text-lg">
              Create collection user
            </CardTitle>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Create employee login for field collections or branch counter.
          </p>
        </CardHeader>
        <CardContent>
          {errorText && (
            <div className="mb-3 text-sm text-red-600">{errorText}</div>
          )}

          <form
            onSubmit={handleCreate}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Full name
              </label>
              <div className="relative">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  className="pl-9"
                />
                <Users className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Phone
              </label>
              <div className="relative">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  className="pl-9"
                />
                <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Email (login id)
              </label>
              <div className="relative">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="pl-9"
                />
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">
                Password
              </label>
              <div className="relative">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Set initial password"
                  className="pl-9"
                />
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1 md:col-span-1">
              <label className="text-xs font-medium text-gray-600">
                Role
              </label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as CollectionRole)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collector">
                    Collector (field / counter)
                  </SelectItem>
                  <SelectItem value="admin">
                    Admin (full collection rights)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 flex justify-end mt-2">
              <Button
                type="submit"
                className="px-5 rounded-xl"
                disabled={creating}
              >
                {creating ? "Creating..." : "Create user"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Users list */}
      <Card className="shadow-sm border">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Collection users list</CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              All collection logins created from this admin panel.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => void loadUsers()}
          >
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="mb-2 text-sm text-gray-500">
              Loading collection users…
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-2.5 px-3 text-left">Name</th>
                  <th className="py-2.5 px-3 text-left">Contact</th>
                  <th className="py-2.5 px-3 text-left">Role</th>
                  <th className="py-2.5 px-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {users.map((u, index) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-t"
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-medium">{u.name}</div>
                        <div className="text-[11px] text-gray-500">
                          ID: {u.id}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-xs text-gray-700">{u.email}</div>
                        <div className="text-xs text-gray-500">
                          {u.phone}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={
                            u.role === "admin"
                              ? "inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700"
                              : "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700"
                          }
                        >
                          {u.role === "admin" ? "Admin" : "Collector"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={
                            u.active
                              ? "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700"
                              : "inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600"
                          }
                        >
                          {u.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>

                {users.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-4 text-center text-sm text-gray-500"
                    >
                      No collection users created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
