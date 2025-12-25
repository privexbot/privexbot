/**
 * Admin Users Page
 *
 * WHY: Search and list all users for support
 * HOW: Paginated list with search functionality
 */

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Search,
  Building2,
  ChevronRight,
  Loader2,
  AlertCircle,
  Shield,
  Mail,
} from "lucide-react";
import { adminApi, type UserListItem } from "@/api/admin";

export function AdminUsers() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0); // Reset pagination on search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await adminApi.listUsers({
        search: debouncedSearch || undefined,
        limit,
        offset,
      });
      // Sort users: staff members first, then by username
      const sortedUsers = [...data.items].sort((a, b) => {
        if (a.is_staff && !b.is_staff) return -1;
        if (!a.is_staff && b.is_staff) return 1;
        return 0;
      });
      setUsers(sortedUsers);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setError("Failed to load users. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, offset]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 font-manrope">
          Users
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 font-manrope">
          Search and view all users ({total} total)
        </p>
      </div>

      {/* Search */}
      <div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by username or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-primary/50 focus:border-primary font-manrope"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-destructive font-manrope">{error}</p>
            <button
              onClick={() => void fetchUsers()}
              className="text-sm text-primary hover:underline font-manrope"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !error && (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-manrope">Loading users...</p>
          </div>
        </div>
      )}

      {/* Users List */}
      {!isLoading && !error && (
        <>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-manrope">
                {debouncedSearch
                  ? "No users found matching your search."
                  : "No users yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <Link
                  key={user.id}
                  to={`/admin/users/${user.id}`}
                  className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-primary/50 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    {user.is_staff ? (
                      <Shield className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300 font-manrope">
                          {user.username[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 dark:text-gray-100 font-manrope">
                          {user.username}
                        </h3>
                        {user.is_staff && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-manrope">
                            Staff
                          </span>
                        )}
                        {!user.is_active && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-manrope">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400 font-manrope">
                        {user.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3.5 w-3.5" />
                            {user.email}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {user.organization_count} orgs
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={offset === 0}
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-manrope"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400 font-manrope">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setOffset(offset + limit)}
                  disabled={offset + limit >= total}
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-manrope"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
