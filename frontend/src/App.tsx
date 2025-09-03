import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./layouts/Header";
import Footer from "./layouts/Footer";
import Home from "./pages/Home";
import Protein from "./pages/Protein";
import Reviews from "./pages/Reviews";
import Executives from "./pages/Executives";
import AiFitness from "./pages/AiFitness";
import Login from "./pages/Login";
import Register from "./pages/Register";
import WriteReview from "./pages/WriteReview";
import WriteProtein from "./pages/WriteProtein";
import ProteinDetail from './pages/ProteinDetail';


function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/proteins/:id" element={<ProteinDetail />} /> 
            <Route path="/" element={<Home />} />
            <Route path="/protein" element={<Protein />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/executives" element={<Executives />} />
            <Route path="/ai" element={<AiFitness />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reviews/write" element={<WriteReview />} />
            <Route path="/protein/write" element={<WriteProtein />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
