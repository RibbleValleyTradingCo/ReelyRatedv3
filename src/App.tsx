import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Eager load: Critical pages (landing and auth)
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy load: All other pages for code splitting
const Feed = lazy(() => import("./pages/Feed"));
const AddCatch = lazy(() => import("./pages/AddCatch"));
const CatchDetail = lazy(() => import("./pages/CatchDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const VenueDetail = lazy(() => import("./pages/VenueDetail"));
const VenuesIndex = lazy(() => import("./pages/VenuesIndex"));
const Sessions = lazy(() => import("./pages/Sessions"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminAuditLog = lazy(() => import("./pages/AdminAuditLog"));
const AdminUserModeration = lazy(() => import("./pages/AdminUserModeration"));
const SearchPage = lazy(() => import("./pages/Search"));
const Insights = lazy(() => import("./pages/Insights"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

// Configure React Query with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/feed" element={<Feed />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/add-catch" element={<AddCatch />} />
                <Route path="/catch/:id" element={<CatchDetail />} />
                <Route path="/profile/:slug" element={<Profile />} />
                <Route path="/settings/profile" element={<ProfileSettings />} />
                <Route path="/sessions" element={<Sessions />} />
                <Route path="/admin/reports" element={<AdminReports />} />
                <Route path="/admin/audit-log" element={<AdminAuditLog />} />
                <Route path="/admin/users/:userId/moderation" element={<AdminUserModeration />} />
                <Route path="/admin/users/:userId/moderation" element={<AdminUserModeration />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/venues" element={<VenuesIndex />} />
                <Route path="/venues/:slug" element={<VenueDetail />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
