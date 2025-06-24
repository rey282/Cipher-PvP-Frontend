import { Routes, Route } from "react-router-dom";
import Landing from "./components/Landing";
import HsrHome from "./components/HsrHome";
import CharacterStats from "./components/CharacterStats";
import PlayerStats from './components/PlayerStats';
import PlayerProfile from './components/PlayerProfile';
import TermsOfService from './components/TermsOfService';
import Footer from "./components/Footer";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} /> {/* landing */}
        <Route path="/hsr" element={<HsrHome />} />
        <Route path="/characters" element={<CharacterStats />} />
        <Route path="/players" element={<PlayerStats />} />
        <Route path="/player/:id" element={<PlayerProfile />} />
        <Route path="/terms" element={<TermsOfService />} />
      </Routes>
      <Footer />
    </>
  );
}
