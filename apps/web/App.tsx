import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import { ToastProvider } from '@/lib/toast/toast-context';
import { QueryProvider } from './QueryProvider';
import LoginScreen from '@/screens/LoginScreen';
import HomeScreen from '@/screens/home/HomeScreen';
import FeedScreen from '@/screens/FeedScreen';
import TrendingScreen from '@/screens/TrendingScreen';
import FixtureDetailScreen from '@/screens/FixtureDetailScreen';
import HistoryScreen from '@/screens/HistoryScreen';
import ProfileModal from '@/modals/profile/ProfileModal';
import ComradesModal from '@/modals/ComradesModal';
import LeaderboardModal from '@/modals/LeaderboardModal';
import NotificationsModal from '@/modals/NotificationsModal';
import AdminModal from '@/modals/AdminModal';

const Loading=()=> <div className="flex min-h-screen items-center justify-center bg-fan-background"><div className="h-10 w-10 animate-spin rounded-full border-2 border-fan-primary border-t-transparent"/></div>;
function LoginRoute(){const nav=useNavigate();const {isInitialized,isLoggedIn}=useAuth();if(!isInitialized)return <Loading/>;if(isLoggedIn)return <Navigate to="/home" replace/>;return <LoginScreen isOpen onClose={()=>nav('/')} onLoginSuccess={()=>nav('/home',{replace:true})}/>;}
function Shell({children}:{children:React.ReactNode}){const {isInitialized,isLoggedIn}=useAuth();if(!isInitialized)return <Loading/>;if(!isLoggedIn)return <Navigate to="/login" replace/>;return <>{children}</>;}
function App(){return <AuthProvider><ToastProvider><QueryProvider><BrowserRouter><Routes>
<Route path="/" element={<LoginRedirect/>}/><Route path="/login" element={<LoginRoute/>}/>
<Route path="/home" element={<Shell><HomeScreen/></Shell>}/><Route path="/feed" element={<Shell><FeedScreen/></Shell>}/><Route path="/trending" element={<Shell><TrendingScreen/></Shell>}/>
<Route path="/fixture/:matchId" element={<Shell><FixtureDetailScreen/></Shell>}/><Route path="/chat" element={<Navigate to="/home" replace/>}/><Route path="/history" element={<Shell><HistoryScreen/></Shell>}/>
<Route path="/profile" element={<Shell><ProfileModal/></Shell>}/><Route path="/comrades" element={<Shell><ComradesModal/></Shell>}/><Route path="/leaderboard" element={<Shell><LeaderboardModal/></Shell>}/>
<Route path="/notifications" element={<Shell><NotificationsModal/></Shell>}/><Route path="/admin/:channelId" element={<Shell><AdminModal/></Shell>}/>
<Route path="/arena" element={<Navigate to="/home?tab=arena" replace/>}/><Route path="/logs" element={<Navigate to="/home?tab=logs" replace/>}/><Route path="*" element={<Navigate to="/" replace/>}/>
</Routes></BrowserRouter></QueryProvider></ToastProvider></AuthProvider>;}
function LoginRedirect(){const {isInitialized,isLoggedIn}=useAuth();if(!isInitialized)return <Loading/>;return <Navigate to={isLoggedIn?'/home':'/login'} replace/>;}
export default App;