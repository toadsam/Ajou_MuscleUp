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
import SupportWidget from "./components/SupportWidget";
import Programs from "./pages/Programs";
import BragList from "./pages/BragList";
import BragWrite from "./pages/BragWrite";
import BragDetail from "./pages/BragDetail";
import MyPage from "./pages/MyPage";

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
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="/programs" element={<Programs />} />
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
