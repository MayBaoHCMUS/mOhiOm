import { Outlet } from 'react-router-dom';
import SideNavBar from './SideNavBar';
import TopNavBar from './TopNavBar';

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-surface">
      <SideNavBar />
      <TopNavBar />
      <main className="ml-64 pt-16 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
