"use client";

import {
  Users,
  Trophy,
  ClipboardList,
  Mail,
  FileCheck,
  Handshake,
} from "lucide-react";
import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AdminStats } from "@/app/actions/admin-actions";

interface Props {
  stats: AdminStats;
}

const statCards = [
  {
    key: "totalUsers" as const,
    label: "Total Users",
    icon: Users,
    href: "/admin/users",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    key: "totalRaces" as const,
    label: "Total Races",
    icon: Trophy,
    href: "/admin/races",
    color: "text-[#FF5733]",
    bg: "bg-[#FF5733]/10",
  },
  {
    key: "totalRegistrations" as const,
    label: "Registrations",
    icon: ClipboardList,
    href: "/admin/registrations",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    key: "totalContacts" as const,
    label: "Contact Messages",
    icon: Mail,
    href: "/admin/contacts",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    key: "pendingApplications" as const,
    label: "Pending Applications",
    icon: FileCheck,
    href: "/admin/applications",
    color: "text-[#FFB800]",
    bg: "bg-[#FFB800]/10",
  },
  {
    key: "totalSponsors" as const,
    label: "Sponsors",
    icon: Handshake,
    href: "/admin/sponsors",
    color: "text-pink-500",
    bg: "bg-pink-500/10",
  },
];

const paymentStatusColors: Record<string, string> = {
  pending: "#FFB800",
  paid: "#10B981",
  refunded: "#6B7280",
  failed: "#EF4444",
};

export default function AdminDashboard({ stats }: Props) {
  return (
    <div>
      <h2 className="text-lg font-bold text-[#1A1A1A] dark:text-white font-raleway mb-6">
        Platform Overview
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {statCards.map(({ key, label, icon: Icon, href, color, bg }) => (
          <Link
            key={key}
            href={href}
            className="group bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/5 dark:border-white/5 p-5 hover:border-[#FF5733]/20 dark:hover:border-[#FF5733]/20 transition-all"
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center`}
              >
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1A1A1A] dark:text-white font-raleway">
                  {stats[key]}
                </p>
                <p className="text-xs text-[#1A1A1A]/50 dark:text-white/40 font-medium">
                  {label}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Registrations Chart */}
      <div className="mt-10 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white font-raleway mb-6 uppercase tracking-wider">
          Registrations Overview
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.registrationsPerMonth}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#E5E7EB"
                className="dark:stroke-[#333]"
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6B7280", fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6B7280", fontSize: 12 }}
                dx={-10}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                  borderRadius: "12px",
                  border: "none",
                  boxShadow:
                    "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                }}
                itemStyle={{ color: "#1A1A1A", fontWeight: "bold" }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#10B981"
                strokeWidth={3}
                dot={{ fill: "#10B981", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Revenue & Payment Status */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 rounded-2xl p-6 flex flex-col justify-center">
          <p className="text-xs font-bold text-[#1A1A1A]/50 dark:text-white/40 uppercase tracking-wider mb-2">
            Total Revenue
          </p>
          <p className="text-3xl font-bold text-[#1A1A1A] dark:text-white font-raleway">
            ₱{stats.totalRevenue.toLocaleString()}
          </p>
          <p className="text-xs text-[#1A1A1A]/50 dark:text-white/40 mt-1">
            From paid registrations
          </p>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white font-raleway mb-6 uppercase tracking-wider">
            Payment Status
          </h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.paymentStatusBreakdown}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E5E7EB"
                  className="dark:stroke-[#333]"
                />
                <XAxis
                  dataKey="status"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                  dy={10}
                  tickFormatter={(value: string) =>
                    value.charAt(0).toUpperCase() + value.slice(1)
                  }
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                  dx={-10}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    borderRadius: "12px",
                    border: "none",
                    boxShadow:
                      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  }}
                  itemStyle={{ color: "#1A1A1A", fontWeight: "bold" }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {stats.paymentStatusBreakdown.map((entry) => (
                    <Cell key={entry.status} fill={paymentStatusColors[entry.status] ?? "#6B7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* User Growth */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white font-raleway mb-6 uppercase tracking-wider">
            New Users
          </h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.newUsersPerMonth}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E5E7EB"
                  className="dark:stroke-[#333]"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                  dx={-10}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    borderRadius: "12px",
                    border: "none",
                    boxShadow:
                      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  }}
                  itemStyle={{ color: "#1A1A1A", fontWeight: "bold" }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  dot={{ fill: "#3B82F6", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white font-raleway mb-6 uppercase tracking-wider">
            Users by Role
          </h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.usersByRole} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#E5E7EB"
                  className="dark:stroke-[#333]"
                />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="role"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                  width={70}
                  tickFormatter={(value: string) =>
                    value.charAt(0).toUpperCase() + value.slice(1)
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    borderRadius: "12px",
                    border: "none",
                    boxShadow:
                      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  }}
                  itemStyle={{ color: "#1A1A1A", fontWeight: "bold" }}
                />
                <Bar dataKey="count" radius={[0, 8, 8, 0]} fill="#FF5733" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Race & Engagement Health */}
      <div className="mt-10 bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white font-raleway mb-6 uppercase tracking-wider">
          Race Participation by Category
        </h3>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.raceParticipationByCategory}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#E5E7EB"
                className="dark:stroke-[#333]"
              />
              <XAxis
                dataKey="category"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6B7280", fontSize: 12 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6B7280", fontSize: 12 }}
                dx={-10}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                  borderRadius: "12px",
                  border: "none",
                  boxShadow:
                    "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                }}
                itemStyle={{ color: "#1A1A1A", fontWeight: "bold" }}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white font-raleway mb-6 uppercase tracking-wider">
            Disputes Over Time
          </h3>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.disputesPerMonth}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E5E7EB"
                  className="dark:stroke-[#333]"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                  dx={-10}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    borderRadius: "12px",
                    border: "none",
                    boxShadow:
                      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  }}
                  itemStyle={{ color: "#1A1A1A", fontWeight: "bold" }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#EF4444"
                  strokeWidth={3}
                  dot={{ fill: "#EF4444", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] border border-black/5 dark:border-white/5 rounded-2xl p-6">
          <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white font-raleway mb-6 uppercase tracking-wider">
            Community Posts
          </h3>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.communityPostsPerMonth}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E5E7EB"
                  className="dark:stroke-[#333]"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6B7280", fontSize: 12 }}
                  dx={-10}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    borderRadius: "12px",
                    border: "none",
                    boxShadow:
                      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                  }}
                  itemStyle={{ color: "#1A1A1A", fontWeight: "bold" }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#EC4899"
                  strokeWidth={3}
                  dot={{ fill: "#EC4899", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-10">
        <h3 className="text-sm font-bold text-[#1A1A1A] dark:text-white font-raleway mb-4 uppercase tracking-wider">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.pendingApplications > 0 && (
            <Link
              href="/admin/applications"
              className="flex items-center gap-3 p-4 rounded-xl bg-[#FFB800]/10 border border-[#FFB800]/20 hover:bg-[#FFB800]/20 transition-colors"
            >
              <FileCheck className="w-5 h-5 text-[#FFB800]" />
              <div>
                <p className="text-sm font-semibold text-[#1A1A1A] dark:text-white">
                  {stats.pendingApplications} pending application
                  {stats.pendingApplications !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-[#1A1A1A]/50 dark:text-white/40">
                  Review organizer applications
                </p>
              </div>
            </Link>
          )}
          <Link
            href="/admin/contacts"
            className="flex items-center gap-3 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
          >
            <Mail className="w-5 h-5 text-purple-500" />
            <div>
              <p className="text-sm font-semibold text-[#1A1A1A] dark:text-white">
                {stats.totalContacts} contact message
                {stats.totalContacts !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-[#1A1A1A]/50 dark:text-white/40">
                View contact submissions
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
