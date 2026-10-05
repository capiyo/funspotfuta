import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import { ToastProvider } from '@/lib/toast/toast-context';
import { QueryProvider } from '@/app/provider';
import LoginModal from '@/app/login/page';
import HomePage from '@/app/(app)/home/page';
import FeedPage from '@/app/(app)/feed/page';
import TrendingPage from '@/app/(app)/trending/page';
import FixtureDetailPage from '@/app/(app)/fixture/[matchId]/page';
import HistoryPage from '@/app/(app)/history/page';
import ProfilePage from '@/app/(app)/profile/page';
import ComradesPage from '@/app/(app)/comrades/page';
import LeaderboardPage from '@/app/(app)/leaderboard/page';
import NotificationsPage from '@/app/(app)/notifications/page';
import AdminDashboardPage from '@/app/(app)/admin/[channelId]/page';
import { ChatRoute } from '@/app/(app)/chat/page';

const Loading=()=> <div className="flex min-h-screen items-center justify-center bg-fan-background"><div className="h-10 w-10 animate-spin rounded-full border-2 border-fan-primary border-t-transparent"/></div>;
function LoginRoute(){const nav=useNavigate();const {isInitialized,isLoggedIn}=useAuth();if(!isInitialized)return <Loading/>;if(isLoggedIn)return <Navigate to="/home" replace/>;return <LoginModal isOpen onClose={()=>nav('/')} onLoginSuccess={()=>nav('/home',{replace:true})}/>;}
function Shell({children}:{children:React.ReactNode}){const {isInitialized,isLoggedIn}=useAuth();if(!isInitialized)return <Loading/>;if(!isLoggedIn)return <Navigate to="/login" replace/>;return <>{children}</>;}
function App(){return <AuthProvider><ToastProvider><QueryProvider><BrowserRouter><Routes>
<Route path="/" element={<LoginRedirect/>}/><Route path="/login" element={<LoginRoute/>}/>
<Route path="/home" element={<Shell><HomePage/></Shell>}/><Route path="/feed" element={<Shell><FeedPage/></Shell>}/><Route path="/trending" element={<Shell><TrendingPage/></Shell>}/>
<Route path="/fixture/:matchId" element={<Shell><FixtureDetailPage/></Shell>}/><Route path="/chat" element={<Shell><ChatRoute/></Shell>}/><Route path="/history" element={<Shell><HistoryPage/></Shell>}/>
<Route path="/profile" element={<Shell><ProfilePage/></Shell>}/><Route path="/comrades" element={<Shell><ComradesPage/></Shell>}/><Route path="/leaderboard" element={<Shell><LeaderboardPage/></Shell>}/>
<Route path="/notifications" element={<Shell><NotificationsPage/></Shell>}/><Route path="/admin/:channelId" element={<Shell><AdminDashboardPage/></Shell>}/>
<Route path="/arena" element={<Navigate to="/home?tab=arena" replace/>}/><Route path="/logs" element={<Navigate to="/home?tab=logs" replace/>}/><Route path="*" element={<Navigate to="/" replace/>}/>
</Routes></BrowserRouter></QueryProvider></ToastProvider></AuthProvider>;}
function LoginRedirect(){const {isInitialized,isLoggedIn}=useAuth();if(!isInitialized)return <Loading/>;return <Navigate to={isLoggedIn?'/home':'/login'} replace/>;}
export default App;