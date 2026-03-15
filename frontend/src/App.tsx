import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./layouts/Header";
import Footer from "./layouts/Footer";
import Home from "./pages/Home";
import Protein from "./pages/Protein";
import Reviews from "./pages/Reviews";
import Executives from "./pages/Executives";
import Members from "./pages/Members";
import Gallery from "./pages/Gallery";
import About from "./pages/About";
import AiFitness from "./pages/AiFitness";
import Login from "./pages/Login";
import Register from "./pages/Register";
import WriteReview from "./pages/WriteReview";
import WriteProtein from "./pages/WriteProtein";
import ProteinDetail from "./pages/ProteinDetail";
import ProtectedRoute from "./components/ProtectedRoute"; // ??추�?
import AdminRoute from "./components/AdminRoute";
import Admin from "./pages/Admin";
import ProgramsApplySuccess from "./pages/ProgramsApplySuccess";
import SupportWidget from "./components/SupportWidget";
import Programs from "./pages/Programs";
import BragList from "./pages/BragList";
import BragWrite from "./pages/BragWrite";
import BragDetail from "./pages/BragDetail";
import MyPage from "./pages/MyPage";
import AiShareView from "./pages/AiShareView";
import AdminHistory from "./pages/AdminHistory";
import Attendance from "./pages/Attendance";
import AttendanceShareView from "./pages/AttendanceShareView";
import Rankings from "./pages/Rankings";
import Lounge from "./pages/Lounge";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import AdminEventsList from "./pages/admin/AdminEventsList";
import AdminEventForm from "./pages/admin/AdminEventForm";
import CrewHub from "./pages/CrewHub";
import CrewChallenge from "./pages/CrewChallenge";
import Friends from "./pages/Friends";

function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/ai/share/:slug" element={<AiShareView />} />
            <Route path="/attendance/share/:slug" element={<AttendanceShareView />} />

            {/* ??로그???�요 ?�는 공개 ?�우??*/}
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
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="/admin/history" element={<AdminRoute><AdminHistory /></AdminRoute>} />
            <Route path="/admin/events" element={<AdminRoute><AdminEventsList /></AdminRoute>} />
            <Route path="/admin/events/new" element={<AdminRoute><AdminEventForm mode="create" /></AdminRoute>} />
            <Route path="/admin/events/:id/edit" element={<AdminRoute><AdminEventForm mode="edit" /></AdminRoute>} />
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

            {/* ??보호???�우??(로그???�요) */}
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
        </main>
        <Footer />
        <SupportWidget />
      </div>
    </Router>
  );
}

export default App;
