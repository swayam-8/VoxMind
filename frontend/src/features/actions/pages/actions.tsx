import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckSquare,
  Search,
  ArrowUpRight,
  Sparkles,
  Calendar,
  User,
  AlertCircle,
  FileText,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { apiClient, type ApiActionItem } from "@/lib/api-client";
import { PageTransition } from "@/components/layout/page-transition";

export function ActionsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState<"all" | "open" | "completed">("all");

  // Fetch action items with fallback to extracting from recent recordings
  const { data: response, isLoading, isError, refetch } = useQuery({
    queryKey: ["all-action-items", { status: viewFilter, search }],
    queryFn: async () => {
      try {
        const res = await apiClient.getActionItems({
          status: viewFilter === "all" ? undefined : viewFilter === "completed" ? "completed" : "pending",
          search,
        });
        if (res.data) return res.data;
      } catch {
        // Fallback for older backend deployments
      }

      const recsRes = await apiClient.getRecordings({ per_page: 50 });
      const recs = recsRes.data || [];
      const extracted: ApiActionItem[] = [];

      for (const rec of recs) {
        if (rec.action_items && rec.action_items.length > 0) {
          for (const item of rec.action_items) {
            extracted.push({
              ...item,
              recording_id: rec.id,
              recording_title: rec.title,
              recording_date: rec.created_at,
            });
          }
        }
      }
      return extracted;
    },
  });

  const rawItems = response || [];

  // Filter client-side
  const filteredItems = rawItems.filter((item) => {
    if (viewFilter === "open" && item.completed) return false;
    if (viewFilter === "completed" && !item.completed) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const taskMatch = item.task.toLowerCase().includes(q);
      const assigneeMatch = item.assignee?.toLowerCase().includes(q);
      const meetingMatch = item.recording_title?.toLowerCase().includes(q);
      return taskMatch || assigneeMatch || meetingMatch;
    }
    return true;
  });

  const totalCount = rawItems.length;
  const completedCount = rawItems.filter((i) => i.completed).length;
  const openCount = totalCount - completedCount;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ item, completed }: { item: ApiActionItem; completed: boolean }) => {
      if (!item.recording_id) return;
      return apiClient.toggleActionItem(item.recording_id, item.id, completed);
    },
    onMutate: async ({ item, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["all-action-items"] });
      const previous = queryClient.getQueryData<ApiActionItem[]>(["all-action-items", { status: viewFilter, search }]);

      queryClient.setQueryData<ApiActionItem[]>(["all-action-items", { status: viewFilter, search }], (old) => {
        if (!old) return old;
        return old.map((i) => (i.id === item.id ? { ...i, completed, status: completed ? "completed" : "pending" } : i));
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["all-action-items", { status: viewFilter, search }], context.previous);
      }
      toast({
        title: "Could not update task",
        description: "Please check your network connection and try again.",
        variant: "danger",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["all-action-items"] });
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
    },
  });

  return (
    <PageTransition className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Post-Meeting Execution
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
            Action Items
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Centralized tasks and commitments extracted from your meeting intelligence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/app/recordings">
            <Button variant="secondary" size="sm">
              <FileText className="w-4 h-4 mr-1.5" />
              View Meetings
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-surface-1 p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <p className="text-xs font-medium text-text-muted">Total Actions</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">{totalCount}</p>
          <p className="text-[11px] text-text-muted mt-0.5">From all conversations</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-1 p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <p className="text-xs font-medium text-text-muted">Open Tasks</p>
          <p className="text-2xl font-semibold text-accent mt-1">{openCount}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Pending completion</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-1 p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <p className="text-xs font-medium text-text-muted">Completed</p>
          <p className="text-2xl font-semibold text-success mt-1">{completedCount}</p>
          <p className="text-[11px] text-text-muted mt-0.5">Delivered follow-ups</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-1 p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <p className="text-xs font-medium text-text-muted">Completion Rate</p>
          <p className="text-2xl font-semibold text-text-primary mt-1">{completionRate}%</p>
          <div className="w-full bg-surface-2 h-1.5 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-accent h-full rounded-full transition-all duration-300"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* View Tabs */}
        <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
          <button
            type="button"
            onClick={() => setViewFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewFilter === "all"
                ? "bg-surface-1 text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            All Tasks ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setViewFilter("open")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewFilter === "open"
                ? "bg-surface-1 text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Open ({openCount})
          </button>
          <button
            type="button"
            onClick={() => setViewFilter("completed")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewFilter === "completed"
                ? "bg-surface-1 text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            Completed ({completedCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks or assignees…"
            className="pl-9 h-9 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-primary"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Task List / Table */}
      <div className="rounded-lg border border-border bg-surface-1 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-5 h-5 rounded" />
                <Skeleton className="h-5 flex-1 rounded" />
                <Skeleton className="w-24 h-5 rounded" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="p-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-danger mx-auto" />
            <p className="text-sm font-medium text-text-primary">Unable to load action items</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Try Again
            </Button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-3 text-text-muted">
              <CheckSquare className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary">
              {search
                ? "No matching action items"
                : viewFilter === "completed"
                ? "No completed tasks yet"
                : viewFilter === "open"
                ? "No open tasks remaining"
                : "No action items extracted yet"}
            </h3>
            <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
              {search
                ? "Try adjusting your search terms or filter to locate the task."
                : "Upload and analyze meeting recordings to automatically extract action items, assignees, and target dates."}
            </p>
            {!search && viewFilter === "all" && (
              <Link to="/app/recordings" className="inline-block mt-4">
                <Button size="sm">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Go to Meetings
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filteredItems.map((item) => (
              <li
                key={item.id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3 hover:bg-surface-2/60 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    id={`action-${item.id}`}
                    checked={item.completed}
                    onChange={(e) =>
                      toggleMutation.mutate({
                        item,
                        completed: e.target.checked,
                      })
                    }
                    className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`action-${item.id}`}
                      className={`text-sm cursor-pointer block leading-snug font-medium transition-colors ${
                        item.completed
                          ? "line-through text-text-muted"
                          : "text-text-primary"
                      }`}
                    >
                      {item.task}
                    </label>

                    {item.recording_title && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                        <Link
                          to={`/app/recordings/${item.recording_id}`}
                          className="hover:text-accent flex items-center gap-1 group-hover:underline"
                        >
                          <FileText className="w-3 h-3" />
                          <span className="truncate max-w-[200px] sm:max-w-xs">
                            {item.recording_title}
                          </span>
                        </Link>
                        {item.source_timestamp !== null && item.source_timestamp !== undefined && (
                          <span>· {Math.floor(item.source_timestamp / 60)}:{(item.source_timestamp % 60).toString().padStart(2, "0")}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 ml-7 sm:ml-0 flex-shrink-0">
                  {item.assignee && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-surface-2 text-text-secondary border border-border">
                      <User className="w-3 h-3 text-text-muted" />
                      {item.assignee}
                    </span>
                  )}

                  {item.due_date && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-surface-2 text-text-secondary border border-border">
                      <Calendar className="w-3 h-3 text-text-muted" />
                      {item.due_date}
                    </span>
                  )}

                  {item.priority && (
                    <Badge
                      variant={
                        item.priority === "high"
                          ? "danger"
                          : item.priority === "medium"
                          ? "warning"
                          : "secondary"
                      }
                      className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0"
                    >
                      {item.priority}
                    </Badge>
                  )}

                  <Link
                    to={`/app/recordings/${item.recording_id}`}
                    className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
                    title="Open meeting"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageTransition>
  );
}
