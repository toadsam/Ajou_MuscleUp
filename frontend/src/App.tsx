import { Suspense, lazy } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import AdminRoute from "./components/AdminRoute";
import BetaNoticeModal from "./components/BetaNoticeModal";
import ProtectedRoute from "./components/ProtectedRoute";
import SupportWidget from "./components/SupportWidget";
import Footer from "./layouts/Footer";
import Header from "./layouts/Header";

const Home = lazy(() => import("./pages/Home"));
const Protein = lazy(() => import("./pages/Protein"));
const Reviews = lazy(() => import("./pages/Reviews"));
const Executives = lazy(() => import("./pages/Executives"));
const Members = lazy(() => import("./pages/Members"));
const Gallery = lazy(() => import("./pages/Gallery"));
const About = lazy(() => import("./pages/About"));
const AiFitness = lazy(() => import("./pages/AiFitness"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const WriteReview = lazy(() => import("./pages/WriteReview"));
const WriteProtein = lazy(() => import("./pages/WriteProtein"));
const ProteinDetail = lazy(() => import("./pages/ProteinDetail"));
const Admin = lazy(() => import("./pages/Admin"));
const ProgramsApplySuccess = lazy(() => import("./pages/ProgramsApplySuccess"));
const Programs = lazy(() => import("./pages/Programs"));
const BragList = lazy(() => import("./pages/BragList"));
const BragWrite = lazy(() => import("./pages/BragWrite"));
const BragDetail = lazy(() => import("./pages/BragDetail"));
const MyPage = lazy(() => import("./pages/MyPage"));
const AiShareView = lazy(() => import("./pages/AiShareView"));
const InbodyConsult = lazy(() => import("./pages/InbodyConsult"));
const AdminHistory = lazy(() => import("./pages/AdminHistory"));
const Attendance = lazy(() => import("./pages/Attendance"));
const AttendanceShareView = lazy(() => import("./pages/AttendanceShareView"));
const Rankings = lazy(() => import("./pages/Rankings"));
const Lounge = lazy(() => import("./pages/Lounge"));
const Events = lazy(() => import("./pages/Events"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const AdminEventsList = lazy(() => import("./pages/admin/AdminEventsList"));
const AdminEventForm = lazy(() => import("./pages/admin/AdminEventForm"));
const CrewHub = lazy(() => import("./pages/CrewHub"));
const CrewChallenge = lazy(() => import("./pages/CrewChallenge"));
const CrewLobby = lazy(() => import("./pages/CrewLobby"));
const CrewHighlights = lazy(() => import("./pages/CrewHighlights"));
const Friends = lazy(() => import("./pages/Friends"));
const Forbidden = lazy(() => import("./pages/Forbidden"));

function RouteLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-400">
      Loading...
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-grow">
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/ai/share/:slug" element={<AiShareView />} />
              <Route path="/attendance/share/:slug" element={<AttendanceShareView />} />
              <Route path="/forbidden" element={<Forbidden />} />

              <Route path="/proteins/:id" element={<ProteinDetail />} />
              <Route
                path="/brag/:id"
                element={
                  <ProtectedRoute>
                    <BragDetail />
                  </ProtectedRoute>
                }
              />
              <Route path="/members" element={<Members />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/about" element={<About />} />
              <Route path="/events" element={<Events />} />
              <Route path="/events/:id" element={<EventDetail />} />
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <Admin />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/history"
                element={
                  <AdminRoute>
                    <AdminHistory />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/events"
                element={
                  <AdminRoute>
                    <AdminEventsList />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/events/new"
                element={
                  <AdminRoute>
                    <AdminEventForm mode="create" />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/events/:id/edit"
                element={
                  <AdminRoute>
                    <AdminEventForm mode="edit" />
                  </AdminRoute>
                }
              />
              <Route path="/programs" element={<Programs />} />
              <Route path="/programs/apply/success" element={<ProgramsApplySuccess />} />
              <Route
                path="/mypage"
                element={
                  <ProtectedRoute>
                    <MyPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/protein"
                element={
                  <ProtectedRoute>
                    <Protein />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reviews"
                element={
                  <ProtectedRoute>
                    <Reviews />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/executives"
                element={
                  <ProtectedRoute>
                    <Executives />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ai"
                element={
                  <ProtectedRoute>
                    <AiFitness />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ai/inbody"
                element={
                  <ProtectedRoute>
                    <InbodyConsult />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/brag"
                element={
                  <ProtectedRoute>
                    <BragList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/brag/write"
                element={
                  <ProtectedRoute>
                    <BragWrite />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reviews/write"
                element={
                  <ProtectedRoute>
                    <WriteReview />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendance"
                element={
                  <ProtectedRoute>
                    <Attendance />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rankings"
                element={
                  <ProtectedRoute>
                    <Rankings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lounge"
                element={
                  <ProtectedRoute>
                    <Lounge />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/crew"
                element={
                  <ProtectedRoute>
                    <CrewHub />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/crew/:crewId/challenges"
                element={
                  <ProtectedRoute>
                    <CrewChallenge />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/crew/:crewId/lobby"
                element={
                  <ProtectedRoute>
                    <CrewLobby />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/crew/:crewId/highlights"
                element={
                  <ProtectedRoute>
                    <CrewHighlights />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/friends"
                element={
                  <ProtectedRoute>
                    <Friends />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/protein/write"
                element={
                  <ProtectedRoute>
                    <WriteProtein />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </main>
        <Footer />
        <SupportWidget />
        <BetaNoticeModal />
      </div>
    </Router>
  );
}

export default App;
