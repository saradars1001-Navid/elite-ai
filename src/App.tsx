import { useEffect } from "react";
import { Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import { useApp } from "./lib/store";
import { SiteLayout, DashboardLayout, AdminLayout } from "./components/Layout";
import { EmptyState } from "./components/ui";
import { OfflineBanner } from "./components/Pwa";
import { Compass } from "lucide-react";
import Explore from "./pages/Explore";
import PromptTrends from "./pages/PromptTrends";
import AdminExplore from "./pages/admin/Explore";
import AdminPromptTrends from "./pages/admin/PromptTrends";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Chapters from "./pages/Chapters";
import ChapterDetail from "./pages/ChapterDetail";
import LessonView from "./pages/LessonView";
import Exercises from "./pages/Exercises";
import Exam from "./pages/Exam";
import ExamResult from "./pages/ExamResult";
import Quiz from "./pages/Quiz";
import QuizPlay from "./pages/QuizPlay";
import LiveMatch from "./pages/LiveMatch";
import PromptLab from "./pages/PromptLab";
import Community from "./pages/Community";
import PostDetail from "./pages/PostDetail";
import Tools from "./pages/Tools";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import Checkout from "./pages/Checkout";
import Receipt from "./pages/Receipt";
import PaymentStatus from "./pages/PaymentStatus";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminChapters from "./pages/admin/Chapters";
import AdminUsers from "./pages/admin/Users";
import AdminExams from "./pages/admin/Exams";
import AdminQuizzes from "./pages/admin/Quizzes";
import AdminPayments from "./pages/admin/Payments";
import AdminTools from "./pages/admin/Tools";
import AdminCommunity from "./pages/admin/Community";
import AdminNotifications from "./pages/admin/Notifications";
import AdminSettings from "./pages/admin/Settings";
import AdminPricingPreview from "./pages/admin/PricingPreview";
import AdminPromptLab from "./pages/admin/PromptLab";
import UIKitHub from "./pages/UIKitHub";
import { useGlobalRipple } from "./components/Touch";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const loc = useLocation();
  if (!user) return <Navigate to="/auth" state={{ from: loc.pathname }} replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/auth" replace />;
  if (user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="container-x py-20">
      <EmptyState
        icon={<Compass size={26} />}
        title="صفحه پیدا نشد"
        text="آدرس مورد نظر وجود ندارد یا منتقل شده است."
        action={
          <Link to="/" className="btn-primary btn-md">
            بازگشت به خانه
          </Link>
        }
      />
    </div>
  );
}

export default function App() {
  // One document-level listener gives every row/button/tab an ink ripple.
  useGlobalRipple();

  return (
    <>
      <OfflineBanner />
      <ScrollToTop />
      <Routes>
        <Route element={<SiteLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/chapters" element={<Chapters />} />
          <Route path="/chapters/:chapterId" element={<ChapterDetail />} />
          <Route path="/chapters/:chapterId/lessons/:lessonId" element={<LessonView />} />
          <Route path="/chapters/:chapterId/exercises/:exerciseId" element={<Exercises />} />
          <Route path="/chapters/:chapterId/exam" element={<Exam />} />
          <Route path="/chapters/:chapterId/exam/result/:attemptId" element={<ExamResult />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/quiz/:quizId" element={<QuizPlay />} />
          <Route path="/quiz/live" element={<LiveMatch />} />
          <Route path="/community" element={<Community />} />
          <Route path="/community/:postId" element={<PostDetail />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/prompt-lab" element={<PromptLab />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/prompt-trends" element={<PromptTrends />} />
          <Route path="/ui-kit" element={<UIKitHub />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/checkout/:chapterId" element={<Checkout />} />
          <Route path="/receipt/:purchaseId" element={<Receipt />} />
          <Route path="/payment" element={<PaymentStatus />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        <Route
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/chapters" element={<AdminChapters />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/exams" element={<AdminExams />} />
          <Route path="/admin/quizzes" element={<AdminQuizzes />} />
          <Route path="/admin/payments" element={<AdminPayments />} />
          <Route path="/admin/tools" element={<AdminTools />} />
          <Route path="/admin/community" element={<AdminCommunity />} />
          <Route path="/admin/notifications" element={<AdminNotifications />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/pricing" element={<AdminPricingPreview />} />
          <Route path="/admin/prompt-lab" element={<AdminPromptLab />} />
          <Route path="/admin/explore" element={<AdminExplore />} />
          <Route path="/admin/prompt-trends" element={<AdminPromptTrends />} />
        </Route>
      </Routes>
    </>
  );
}
