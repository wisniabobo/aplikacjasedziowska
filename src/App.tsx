import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Icon, type IconName } from './components/Icon';
import { Loading, ToastProvider } from './components/ui';
import { Home } from './pages/Home';

const Learn = lazy(() => import('./pages/Learn'));
const Session = lazy(() => import('./pages/Session'));
const Exams = lazy(() => import('./pages/Exams'));
const ExamRun = lazy(() => import('./pages/ExamRun'));
const Acts = lazy(() => import('./pages/Acts'));
const ActReader = lazy(() => import('./pages/ActReader'));
const CasusList = lazy(() => import('./pages/CasusList'));
const CasusDetail = lazy(() => import('./pages/CasusDetail'));
const Career = lazy(() => import('./pages/Career'));
const Nabor = lazy(() => import('./pages/Nabor'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Start', icon: 'home', end: true },
  { to: '/nauka', label: 'Nauka', icon: 'learn' },
  { to: '/ustawy', label: 'Ustawy', icon: 'book' },
  { to: '/kazusy', label: 'Kazusy', icon: 'case' },
  { to: '/kariera', label: 'Zarobki', icon: 'money' },
];

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Sidebar() {
  return (
    <nav className="sidebar" aria-label="Nawigacja główna">
      <div className="brand">
        <span className="brand-mark">
          <Icon name="scale" size={20} />
        </span>
        <span>
          <span className="brand-name" style={{ display: 'block' }}>Aplikacja sędziowska</span>
          <span className="t-cap muted">Nauka do konkursu KSSiP</span>
        </span>
      </div>
      <div className="side-nav">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={t.icon} size={20} />
            {t.label === 'Zarobki' ? 'Zarobki i kariera' : t.label}
          </NavLink>
        ))}
        <div className="side-title">Więcej</div>
        <NavLink to="/nauka/testy" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name="doc" size={20} />
          Oficjalne testy KSSiP
        </NavLink>
        <NavLink to="/nabor" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name="info" size={20} />
          Wszystko o naborze
        </NavLink>
        <NavLink to="/ustawienia" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name="gear" size={20} />
          Ustawienia i dane
        </NavLink>
      </div>
      <div className="side-foot t-cap faint">
        Ustawy pobierane z API Sejmu (ELI). Testy i kazusy – materiały KSSiP.
      </div>
    </nav>
  );
}

function TabBar() {
  return (
    <nav className="tabbar" aria-label="Karty">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
          <Icon name={t.icon} size={24} />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <ScrollToTop />
        <div className="app">
          <Sidebar />
          <main className="main" id="main">
            <Suspense
              fallback={
                <div className="page">
                  <Loading lines={5} />
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/nauka" element={<Learn />} />
                <Route path="/nauka/sesja" element={<Session />} />
                <Route path="/nauka/testy" element={<Exams />} />
                <Route path="/nauka/egzamin/:id" element={<ExamRun />} />
                <Route path="/ustawy" element={<Acts />} />
                <Route path="/ustawy/:slug" element={<ActReader />} />
                <Route path="/ustawy/:slug/:artId" element={<ActReader />} />
                <Route path="/kazusy" element={<CasusList />} />
                <Route path="/kazusy/:id" element={<CasusDetail />} />
                <Route path="/kariera" element={<Career />} />
                <Route path="/nabor" element={<Nabor />} />
                <Route path="/ustawienia" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </main>
          <TabBar />
        </div>
      </ToastProvider>
    </HashRouter>
  );
}
