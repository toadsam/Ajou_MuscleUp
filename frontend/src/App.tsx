import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Header from "./layouts/Header";
import Footer from "./layouts/Footer";
import Home from "./pages/Home";
import Protein from "./pages/Protein";
import Reviews from "./pages/Reviews";
import Executives from "./pages/Executives";
import AiFitness from "./pages/AiFitness";

function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/protein" element={<Protein />} />
            <Route path="/reviews" element={<Reviews />} />
            <Route path="/executives" element={<Executives />} />
            <Route path="/ai" element={<AiFitness />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
