import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/Home';
import { AgentPage } from './pages/Agent';
import { BuyPage } from './pages/Buy';
import { ArchitecturePage } from './pages/Architecture';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="agent/:tokenId" element={<AgentPage />} />
        <Route path="buy" element={<BuyPage />} />
        <Route path="architecture" element={<ArchitecturePage />} />
        <Route path="*" element={<HomePage />} />
      </Route>
    </Routes>
  );
}
